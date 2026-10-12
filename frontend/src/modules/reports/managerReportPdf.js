import { saveReportPdf } from "../../utils/printDocument.js";

export const buildManagerReportPdf = async (report, { logo } = {}) => {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const stamp = new Date(report.created_at).toLocaleString("es-HN", { timeZone: "America/Tegucigalpa" });
  const header = () => {
    doc.setFillColor(11, 63, 115);
    doc.rect(0, 0, width, 88, "F");
    if (logo) doc.addImage(logo, "PNG", 40, 18, 48, 48);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("AGUAS DE CHOLUTECA", logo ? 102 : 40, 27);
    doc.setFontSize(15);
    doc.text(report.title, logo ? 102 : 40, 49);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Preparado ${stamp}`, logo ? 102 : 40, 67);
  };
  let y = 109;
  doc.setFontSize(9);
  doc.setTextColor(35, 55, 70);
  const scope = [report.period ? `Período: ${report.period.from} al ${report.period.to}` : "Consulta del estado actual", report.filters.barrio ? `Barrio: ${report.filters.barrio}` : "", report.cutoff ? `Corte del padrón: ${new Date(report.cutoff).toLocaleDateString("es-HN", { timeZone: "America/Tegucigalpa" })}` : "", ...report.notes].filter(Boolean);
  for (const text of scope) {
    const lines = doc.splitTextToSize(text, width - 80);
    doc.text(lines, 40, y);
    y += lines.length * 12 + 5;
  }
  for (const item of report.sections) {
    if (y > height - 110) { doc.addPage(); y = 109; }
    const body = item.rows.length ? item.rows.map((row) => row.map((cell) => String(cell ?? ""))) : [[{ content: "Sin registros para los filtros seleccionados.", colSpan: item.columns.length }]];
    autoTable(doc, {
      startY: y, margin: { top: 105, right: 40, bottom: 45, left: 40 },
      head: [[{ content: item.title, colSpan: item.columns.length }], item.columns], body,
      theme: "striped", styles: { font: "helvetica", fontSize: 8, cellPadding: 5, overflow: "linebreak", textColor: [25, 45, 60] },
      headStyles: { fillColor: [11, 63, 115], textColor: 255 },
      alternateRowStyles: { fillColor: [244, 248, 252] }
    });
    y = doc.lastAutoTable.finalY + 18;
  }
  const pages = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    header();
    doc.setFontSize(7);
    doc.setTextColor(80, 100, 115);
    doc.text("Informe gerencial de consulta", 40, height - 29);
    doc.text(report.report_id, 40, height - 17);
    doc.text(`Página ${page} de ${pages}`, width - 40, height - 17, { align: "right" });
  }
  doc.setProperties({ title: report.title, subject: `ID de reporte: ${report.report_id}`, author: "Aguas de Choluteca" });
  return doc;
};

export const downloadManagerReport = async (report, apiFetch, options = {}) => {
  const doc = await buildManagerReportPdf(report, options);
  const bytes = doc.output("arraybuffer");
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, "0")).join("");
  for (const event of ["pdf_generated", "download_requested"]) {
    const response = await apiFetch(`/reports/manager/${report.report_id}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, bytes: bytes.byteLength, sha256 }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "No se pudo registrar la exportación. El PDF no se descargó.");
  }
  if (options.isActive && !options.isActive()) throw new Error("La consulta se cerró antes de descargar el informe.");
  (options.save || saveReportPdf)(doc, `gerencia-${report.type}.pdf`, { reportId: report.report_id, title: report.title, reportType: `manager.${report.type}` });
};
