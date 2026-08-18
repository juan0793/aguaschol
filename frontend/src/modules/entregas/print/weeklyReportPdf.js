// Generacion del PDF del informe semanal, bajo demanda y siempre a partir del
// snapshot. Nada se almacena en el servidor: el archivo se arma en el navegador.

import { formatDate, formatNumber, formatPercent, tipoDocumentoLabel } from "../utils/entregasFormatters";

const AZUL = [14, 95, 158];
const GRIS = [246, 249, 252];
const TEXTO = [20, 31, 41];

const cargarJsPdf = async () => {
  const [{ jsPDF }, autoTable] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  return { jsPDF, autoTable: autoTable.default || autoTable };
};

export const descargarReporteSemanalPdf = async (snapshot, { incluirAnexo = false } = {}) => {
  if (!snapshot) return;
  const { jsPDF, autoTable } = await cargarJsPdf();
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
  const ancho = doc.internal.pageSize.getWidth();
  const margen = 48;
  const totales = snapshot.totales;

  const encabezado = () => {
    doc.setFillColor(...AZUL);
    doc.rect(0, 0, ancho, 74, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text("AGUAS DE CHOLUTECA", margen, 28);
    doc.setFontSize(14);
    doc.text("REPORTE SEMANAL DE CONTROL DE ENTREGAS", margen, 47);
    doc.setFontSize(9);
    doc.text(snapshot.periodo.etiqueta || "", margen, 63);
    doc.setTextColor(...TEXTO);
  };

  const pie = () => {
    const paginas = doc.internal.getNumberOfPages();
    for (let pagina = 1; pagina <= paginas; pagina += 1) {
      doc.setPage(pagina);
      const alto = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(97, 111, 125);
      doc.text(
        `${formatDate(snapshot.periodo.fecha_inicio)} al ${formatDate(snapshot.periodo.fecha_fin)}`,
        margen,
        alto - 24
      );
      doc.text(`Generado: ${new Date(snapshot.generacion?.generado_en || Date.now()).toLocaleString("es-HN")}`, ancho / 2, alto - 24, {
        align: "center"
      });
      doc.text(`Página ${pagina} de ${paginas}`, ancho - margen, alto - 24, { align: "right" });
      doc.setTextColor(...TEXTO);
    }
  };

  const tabla = (titulo, head, body, startY) => {
    autoTable(doc, {
      startY,
      head: [head],
      body: body.length ? body : [head.map(() => "—")],
      margin: { left: margen, right: margen, bottom: 48 },
      styles: { fontSize: 8.5, cellPadding: 4, textColor: TEXTO, lineColor: [219, 227, 234], lineWidth: 0.4 },
      headStyles: { fillColor: GRIS, textColor: TEXTO, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [252, 253, 255] },
      showHead: "everyPage",
      didDrawPage: () => encabezado()
    });
    return doc.lastAutoTable.finalY + 22;
  };

  encabezado();
  let y = 100;

  doc.setFontSize(11);
  doc.text("Resumen de la semana", margen, y);
  y += 10;

  y = tabla(
    "Resumen",
    ["Indicador", "Valor"],
    [
      ["Asignadas", formatNumber(totales.asignadas)],
      ["Entregadas", formatNumber(totales.entregadas)],
      ["No entregadas", formatNumber(totales.no_entregadas)],
      ["Reentregadas", formatNumber(totales.reentregadas)],
      ["Pendientes", formatNumber(totales.pendientes)],
      ["Efectividad", formatPercent(totales.efectividad)],
      ["Tipo de documento", tipoDocumentoLabel(snapshot.periodo.tipo_documento) || "Todos"]
    ],
    y
  );

  y = tabla(
    "Por día",
    ["Fecha", "Asignadas", "Entregadas", "No entregadas", "Efectividad"],
    snapshot.por_dia.map((fila) => [
      formatDate(fila.fecha),
      formatNumber(fila.asignadas),
      formatNumber(fila.entregadas),
      formatNumber(fila.no_entregadas),
      formatPercent(fila.efectividad)
    ]),
    y
  );

  y = tabla(
    "Indicadores",
    ["Indicador de atención", "Casos"],
    snapshot.indicadores_atencion.map((fila) => [fila.etiqueta, formatNumber(fila.total)]),
    y
  );

  doc.addPage();
  encabezado();
  y = tabla(
    "Responsables",
    ["Responsable", "Tipo", "Lotes", "Asignadas", "Entregadas", "Pendientes", "Efectividad"],
    snapshot.por_responsable.map((fila) => [
      fila.responsable_nombre,
      tipoDocumentoLabel(fila.tipo_predominante),
      formatNumber(fila.lotes),
      formatNumber(fila.asignadas),
      formatNumber(fila.entregadas),
      formatNumber(fila.pendientes),
      formatPercent(fila.efectividad)
    ]),
    100
  );

  y = tabla(
    "Barrios",
    ["Barrio", "Asignadas", "Entregadas", "No entregadas", "Reentregadas", "Pendientes", "Efectividad"],
    snapshot.por_barrio.map((fila) => [
      fila.barrio_nombre,
      formatNumber(fila.asignadas),
      formatNumber(fila.entregadas),
      formatNumber(fila.no_entregadas),
      formatNumber(fila.reentregadas),
      formatNumber(fila.pendientes),
      formatPercent(fila.efectividad)
    ]),
    y
  );

  doc.addPage();
  encabezado();
  y = tabla(
    "Motivos",
    ["Motivo de no entrega", "Casos", "% del total"],
    snapshot.por_motivo.map((fila) => [fila.motivo_etiqueta, formatNumber(fila.total), formatPercent(fila.porcentaje)]),
    100
  );

  y = tabla(
    "Observaciones",
    ["Responsable", "Barrio", "Fecha", "Observación"],
    snapshot.observaciones.map((fila) => [
      fila.responsable_nombre,
      fila.barrio_nombre,
      formatDate(fila.fecha),
      fila.texto
    ]),
    y
  );

  const pendientes = incluirAnexo && snapshot.anexo_pendientes?.length
    ? snapshot.anexo_pendientes
    : snapshot.pendientes_prioritarios;

  tabla(
    "Pendientes",
    ["Abonado", "Clave", "Barrio", "Responsable", "Motivo", "Días", "Intentos"],
    pendientes.map((fila) => [
      fila.numero_abonado || "—",
      fila.clave_catastral || "—",
      fila.barrio_nombre,
      fila.responsable_nombre,
      fila.motivo_etiqueta,
      formatNumber(fila.dias_pendiente),
      formatNumber(fila.intentos)
    ]),
    y
  );

  pie();
  doc.save(`reporte-entregas-${snapshot.periodo.fecha_inicio}-a-${snapshot.periodo.fecha_fin}.pdf`);
};
