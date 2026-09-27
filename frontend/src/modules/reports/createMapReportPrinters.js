import {
  MAP_REPORT_SERVICE_LEGEND,
  REPORT_POINT_ALERT_BORDER_RGB,
  REPORT_POINT_ALERT_FILL_RGB,
  REPORT_POINT_ALERT_RGB,
  REPORT_POINT_DANGER_BORDER_RGB,
  REPORT_POINT_DANGER_FILL_RGB,
  REPORT_POINT_DANGER_RGB,
  buildMapReportBriefRows,
  buildMapReportStaffMarkup,
  buildMapReportTypeChartMarkup,
  getMapPointPadronNames,
  getMapPointReferenceNote,
  getMapPointReportReferenceLabel,
  getMapPointTechnicalDescription,
  getMapReportTechniciansLabel,
  getMapReportTypeChartRows,
  getReportPointRowClassName,
  isAlertReportPoint,
  isRedReportPoint
} from "../../utils/mapReport";
import { defaultMapReportSettings } from "../../constants/formsAndUi";
import { escapeHtml } from "../../utils/html";
import { formatCoordinate, getMapPointTypeLabel } from "../../utils/mapField";
import { formatCurrency } from "../../utils/formatting";
import { formatDateTime, formatMapDiaryLabel } from "../../utils/datesAndBusiness";
import logoAguasCholuteca from "../../assets/logo-aguas-choluteca.png";
import { printDocument, saveReportPdf } from "../../utils/printDocument";
import { urlToDataUrl } from "../../utils/imageUtils";

export function createMapReportPrinters({
  activeMapDiaryDateKey,
  apiFetch,
  buildMapReportPadronData,
  captureReportMapImage,
  getSelectedCajaTotal,
  getSelectedMapReportData,
  mapReportSettings,
  mapReportStaff,
  showAlert
}) {
  const handleDownloadMapReport = async () => {
    try {
      const response = await apiFetch(`/map-points/export?date=${encodeURIComponent(activeMapDiaryDateKey)}`);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "No fue posible descargar el reporte.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `reporte-detallado-puntos-campo-${activeMapDiaryDateKey || new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showAlert("Reporte detallado de puntos descargado.");
    } catch (error) {
      showAlert(error.message || "No fue posible descargar el reporte.");
    }
  };

  const handlePrintMapFieldReport = async ({ includedZoneKeys } = {}) => {
    const generatedAt = formatDateTime(new Date().toISOString());
    const mapImageDataUrl = mapReportSettings.map_image_data_url || (await captureReportMapImage());
    const reportData = getSelectedMapReportData(includedZoneKeys);
    const reportCajaTotal = getSelectedCajaTotal(reportData);
    const reportTitle = mapReportSettings.title.trim() || defaultMapReportSettings.title;
    const reportSubtitle = mapReportSettings.subtitle.trim() || defaultMapReportSettings.subtitle;
    const reportDescription = mapReportSettings.description.trim() || defaultMapReportSettings.description;
    const reportNotes = mapReportSettings.report_notes.trim();
    const totalsMarkup = Object.entries(reportData.totalsByType)
      .map(
        ([label, total]) => `
          <div class="field-report-total-chip">
            <strong>${label}</strong>
            <span>${total}</span>
          </div>
        `
      )
      .join("");
    const portadaMarkup = `
      <section class="field-report-cover">
        <div class="field-report-cover-copy">
          <span class="field-report-kicker">Resumen de operaciones</span>
          <h2>Levantamiento consolidado de puntos de campo</h2>
          <p>Vista institucional del trabajo levantado, lista para seguimiento y revision administrativa.</p>
          <div class="field-report-cover-metrics">
            <div>
              <strong>Total de puntos</strong>
              <span>${reportData.totalPoints}</span>
            </div>
            <div>
              <strong>Total de barrios</strong>
              <span>${reportData.totalZones}</span>
            </div>
            <div>
              <strong>Cajas de registro</strong>
              <span>${reportCajaTotal}</span>
            </div>
          </div>
          ${buildMapReportStaffMarkup(mapReportStaff)}
        </div>
        <div class="field-report-cover-map">
          ${
            mapImageDataUrl
              ? `<img src="${mapImageDataUrl}" alt="Mapa visual del levantamiento" class="field-report-map-image" />`
              : `<div class="field-report-map-fallback">No fue posible capturar la vista del mapa para esta impresion.</div>`
          }
        </div>
      </section>
    `;

    const zonesMarkup = reportData.zones
      .map(
        (zone, index) => `
          <section class="field-report-zone">
            <div class="field-report-zone-head">
              <div>
                <span class="field-report-zone-kicker">${escapeHtml(zone.displayKicker || `Zona ${index + 1}`)}</span>
                <h3>${escapeHtml(zone.displayName || zone.zone)}</h3>
                <p>Referencia sugerida: ${escapeHtml(zone.displayReference || "Sin contexto cercano")}</p>
                <p>Ubicacion completa: ${escapeHtml(zone.displayLocation || "Sin direccion ampliada")}</p>
              </div>
              <div class="field-report-zone-meta">
                <span>Total: ${zone.total}</span>
                <span>Tipos: ${zone.pointTypesLabel || "--"}</span>
                <span>Precision prom.: ${zone.averageAccuracy ?? "--"} m</span>
              </div>
            </div>
            <table class="field-report-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tipo</th>
                  <th>Marca</th>
                  <th>Latitud</th>
                  <th>Longitud</th>
                  <th>Precision</th>
                  <th>Barrio</th>
                  <th>Referencia cercana</th>
                  <th>Referencia</th>
                  <th>Descripcion</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                ${zone.items
                  .map(
                    (point, pointIndex) => `
                      <tr class="${getReportPointRowClassName(point)}">
                        <td>${pointIndex + 1}</td>
                        <td>${getMapPointTypeLabel(point.point_type)}</td>
                        <td>
                          <span class="field-report-color-chip" style="--point-color: ${escapeHtml(point.marker_color || "#1576d1")}"></span>
                          ${point.is_terminal_point ? "Pin final" : point.marker_color || "#1576d1"}
                        </td>
                        <td>${formatCoordinate(point.latitude)}</td>
                        <td>${formatCoordinate(point.longitude)}</td>
                        <td>${point.accuracy_meters ? `${point.accuracy_meters} m` : "--"}</td>
                        <td>${escapeHtml(point.report_zone_label || point.suggested_zone || zone.zone)}</td>
                        <td>${escapeHtml(point.suggested_reference || "--")}</td>
                        <td>${escapeHtml(getMapPointReferenceNote(point) || "--")}</td>
                        <td>${escapeHtml(getMapPointTechnicalDescription(point) || "--")}</td>
                        <td>${formatDateTime(point.created_at)}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </section>
        `
      )
      .join("");

    await printDocument(
      reportTitle,
      `
        <div class="field-report-shell">
          <header class="field-report-header">
            <div class="field-report-brand">
              <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" />
              <div>
                <p class="field-report-kicker">${escapeHtml(reportSubtitle)}</p>
                <h1>${escapeHtml(reportTitle)}</h1>
                <p>${escapeHtml(reportDescription)}</p>
              </div>
            </div>
            <div class="field-report-meta">
              <span>Generado: ${generatedAt}</span>
              <span>Total de puntos: ${reportData.totalPoints}</span>
              <span>Total de barrios: ${reportData.totalZones}</span>
            </div>
            ${buildMapReportStaffMarkup(mapReportStaff)}
          </header>
          ${portadaMarkup}
          <section class="field-report-summary">
            ${totalsMarkup || '<div class="field-report-total-chip"><strong>Sin puntos</strong><span>0</span></div>'}
          </section>
          ${reportNotes ? `<section class="field-report-notes"><strong>Observaciones del censo</strong><p>${escapeHtml(reportNotes)}</p></section>` : ""}
          ${zonesMarkup || '<p class="field-report-empty">No hay puntos guardados para generar el reporte.</p>'}
        </div>
      `,
      {
        pageSize: "Letter landscape",
        pageMargin: "8mm",
        bodyClassName: "field-report-body",
        showPageFooter: true
      }
    );
  };

  const handleDownloadMapFieldPdf = async ({ includedZoneKeys } = {}) => {
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableModule.default;
      const document = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "letter",
        compress: true
      });
      const generatedAt = formatDateTime(new Date().toISOString());
      const mapImageDataUrl = mapReportSettings.map_image_data_url || (await captureReportMapImage());
      const reportData = getSelectedMapReportData(includedZoneKeys);
      const reportCajaTotal = getSelectedCajaTotal(reportData);
      const reportTitle = mapReportSettings.title.trim() || defaultMapReportSettings.title;
      const reportSubtitle = mapReportSettings.subtitle.trim() || defaultMapReportSettings.subtitle;
      const reportNotes = mapReportSettings.report_notes.trim();
      const addPdfPageFooter = () => {
        const pageWidth = document.internal.pageSize.getWidth();
        const pageHeight = document.internal.pageSize.getHeight();
        const currentPage = document.getCurrentPageInfo().pageNumber;
        document.setFont("helvetica", "normal");
        document.setFontSize(9);
        document.setTextColor(69, 96, 122);
        document.text(`Pagina ${currentPage}`, pageWidth - 14, pageHeight - 8, { align: "right" });
      };

      try {
        const logoDataUrl = await urlToDataUrl(logoAguasCholuteca);
        document.addImage(logoDataUrl, "PNG", 14, 10, 20, 20);
      } catch {
        // Keep the report generation going even if the logo cannot be embedded.
      }

      document.setFont("helvetica", "bold");
      document.setFontSize(16);
      document.text(reportTitle, 38, 16);
      document.setFontSize(9.5);
      document.setTextColor(64, 91, 117);
      document.text(reportSubtitle, 38, 22);

      document.setTextColor(22, 50, 74);
      document.setFont("helvetica", "normal");
      document.text(`Generado: ${generatedAt}`, 14, 36);
      document.text(`Total de puntos: ${reportData.totalPoints}`, 86, 36);
      document.text(`Total de barrios: ${reportData.totalZones}`, 138, 36);
      document.text(document.splitTextToSize(`Tecnicos: ${getMapReportTechniciansLabel(mapReportStaff)}`, 116), 14, 42);
      document.text(`Ingeniero de datos: ${mapReportStaff.data_engineer || "--"}`, 138, 42);
      document.text(`Cajas de registro: ${reportCajaTotal}`, 14, 56);

      if (mapImageDataUrl) {
        const mapImageType = mapImageDataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
        document.setFillColor(237, 245, 252);
        document.roundedRect(154, 48, 104, 48, 3, 3, "F");
        document.addImage(mapImageDataUrl, mapImageType, 156, 50, 100, 44);
      } else {
        document.setFillColor(237, 245, 252);
        document.roundedRect(154, 48, 104, 48, 3, 3, "F");
        document.setFont("helvetica", "normal");
        document.setFontSize(9);
        document.setTextColor(69, 96, 122);
        document.text("Mapa no disponible", 206, 73, { align: "center" });
      }

      autoTable(document, {
        startY: 62,
        head: [["Resumen", "Cantidad"]],
        body: Object.entries(reportData.totalsByType).length
          ? Object.entries(reportData.totalsByType)
          : [["Sin puntos", "0"]],
        theme: "grid",
        styles: {
          fontSize: 8.5,
          cellPadding: 2.6,
          textColor: [24, 42, 60]
        },
        headStyles: {
          fillColor: [21, 118, 209],
          textColor: [255, 255, 255],
          fontStyle: "bold"
        },
        columnStyles: {
          0: { cellWidth: 54 },
          1: { cellWidth: 20, halign: "center" }
        },
        margin: { left: 14, right: 14 }
      });

      addPdfPageFooter();
      let currentY = (document.lastAutoTable?.finalY ?? 58) + 6;
      if (reportNotes) {
        document.setFont("helvetica", "bold");
        document.setFontSize(9);
        document.setTextColor(16, 55, 91);
        document.text("Observaciones del censo", 14, currentY);
        document.setFont("helvetica", "normal");
        document.setFontSize(8.5);
        document.setTextColor(69, 96, 122);
        const noteLines = document.splitTextToSize(reportNotes, 130);
        document.text(noteLines, 14, currentY + 5);
        currentY += Math.min(22, noteLines.length * 4 + 9);
      }

      for (let index = 0; index < reportData.zones.length; index += 1) {
        const zone = reportData.zones[index];

        if (currentY > 175) {
          document.addPage("letter", "landscape");
          addPdfPageFooter();
          currentY = 16;
        }

        document.setFillColor(237, 245, 252);
        document.roundedRect(14, currentY, 250, 16, 3, 3, "F");
        document.setFont("helvetica", "bold");
        document.setFontSize(11.5);
        document.setTextColor(16, 55, 91);
        document.text(`${zone.displayKicker || `Zona ${index + 1}`}: ${zone.displayName || zone.zone}`, 18, currentY + 6);
        document.setFont("helvetica", "normal");
        document.setFontSize(8.5);
        document.text(`Referencia sugerida: ${zone.displayReference || "Sin contexto cercano"}`, 18, currentY + 11);
        document.text(`Ubicacion completa: ${zone.displayLocation || "Sin direccion ampliada"}`, 128, currentY + 11);

        autoTable(document, {
          startY: currentY + 20,
          head: [[
            "#",
            "Tipo",
            "Marca",
            "Latitud",
            "Longitud",
            "Precision",
            "Referencia cercana",
            "Referencia",
            "Descripcion",
            "Fecha"
          ]],
          body: zone.items.map((point, pointIndex) => {
            const row = [
              String(pointIndex + 1),
              getMapPointTypeLabel(point.point_type),
              point.is_terminal_point ? "Pin final" : point.marker_color || "#1576d1",
              formatCoordinate(point.latitude),
              formatCoordinate(point.longitude),
              point.accuracy_meters ? `${point.accuracy_meters} m` : "--",
              point.suggested_reference || "--",
              getMapPointReferenceNote(point) || "--",
              getMapPointTechnicalDescription(point) || "--",
              formatDateTime(point.created_at)
            ];
            row.rawPoint = point;
            return row;
          }),
          theme: "grid",
          styles: {
            fontSize: 7.6,
            cellPadding: 2.1,
            textColor: [28, 44, 62],
            overflow: "linebreak"
          },
          headStyles: {
            fillColor: [21, 118, 209],
            textColor: [255, 255, 255],
            fontStyle: "bold"
          },
          alternateRowStyles: {
            fillColor: [248, 251, 255]
          },
          didParseCell: (data) => {
            if (data.section !== "body") return;
            const rawPoint = data.row.raw?.rawPoint;
            if (isAlertReportPoint(rawPoint)) {
              data.cell.styles.textColor = REPORT_POINT_ALERT_RGB;
              data.cell.styles.fillColor = REPORT_POINT_ALERT_FILL_RGB;
              data.cell.styles.lineColor = REPORT_POINT_ALERT_BORDER_RGB;
            } else if (isRedReportPoint(rawPoint)) {
              data.cell.styles.textColor = REPORT_POINT_DANGER_RGB;
              data.cell.styles.fillColor = REPORT_POINT_DANGER_FILL_RGB;
              data.cell.styles.lineColor = REPORT_POINT_DANGER_BORDER_RGB;
            } else {
              return;
            }
            if (data.column.index === 1 || data.column.index === 2) {
              data.cell.styles.fontStyle = "bold";
            }
          },
          margin: { left: 14, right: 14 },
          columnStyles: {
            0: { cellWidth: 8, halign: "center" },
            1: { cellWidth: 22 },
            2: { cellWidth: 14 },
            3: { cellWidth: 18 },
            4: { cellWidth: 18 },
            5: { cellWidth: 16 },
            6: { cellWidth: 31 },
            7: { cellWidth: 34 },
            8: { cellWidth: 55 },
            9: { cellWidth: 24 }
          }
        });

        currentY = (document.lastAutoTable?.finalY ?? currentY + 20) + 7;
        addPdfPageFooter();
      }

      saveReportPdf(document, `reporte-campo-${new Date().toISOString().slice(0, 10)}.pdf`);
      showAlert("Reporte PDF descargado.");
    } catch (error) {
      showAlert(error.message || "No fue posible descargar el reporte PDF.");
    }
  };

  const handlePrintMapCensusReport = async ({ includedZoneKeys } = {}) => {
    const generatedAt = formatDateTime(new Date().toISOString());
    const reportData = getSelectedMapReportData(includedZoneKeys);
    const reportCajaTotal = getSelectedCajaTotal(reportData);
    const { padronNames } = await buildMapReportPadronData(reportData);
    const reportTitle = mapReportSettings.title.trim() || defaultMapReportSettings.title;
    const reportSubtitle = mapReportSettings.subtitle.trim() || defaultMapReportSettings.subtitle;
    const reportDescription = mapReportSettings.description.trim() || defaultMapReportSettings.description;
    const reportNotes = mapReportSettings.report_notes.trim();
    const mapImageDataUrl = mapReportSettings.map_image_data_url || "";
    const zonesMarkup = reportData.zones
      .map(
        (zone, index) => `
          <section class="field-report-zone census-report-zone">
            <div class="field-report-zone-head census-report-zone-head">
              <div>
                <span class="field-report-zone-kicker">${escapeHtml(zone.displayKicker || `Zona ${index + 1}`)}</span>
                <h3>${escapeHtml(zone.displayName || zone.zone)}</h3>
                <p>Ubicación: ${escapeHtml(zone.displayLocation || "Sin referencia")}</p>
              </div>
              <div class="field-report-zone-meta">
                <span>Puntos: ${zone.total}</span>
              </div>
            </div>
            <table class="field-report-table census-report-table map-points-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Barrio / sector</th>
                  <th>Clave / abonado</th>
                  <th>Nombre en padrón</th>
                  <th>Tipo</th>
                  <th>Referencia</th>
                  <th>Descripción</th>
                </tr>
              </thead>
              <tbody>
                ${zone.items
                  .map(
                    (point, pointIndex) => `
                      <tr class="${getReportPointRowClassName(point)}">
                        <td>${pointIndex + 1}</td>
                        <td>${escapeHtml(zone.displayName || zone.zone || "--")}</td>
                        <td>${escapeHtml(getMapPointReportReferenceLabel(point))}</td>
                        <td>${escapeHtml(getMapPointPadronNames(point, padronNames))}</td>
                        <td>${escapeHtml(getMapPointTypeLabel(point.point_type))}</td>
                        <td>${escapeHtml(getMapPointReferenceNote(point) || zone.displayLocation || "--")}</td>
                        <td>${escapeHtml(getMapPointTechnicalDescription(point) || "--")}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </section>
        `
      )
      .join("");

    await printDocument(
      `${reportTitle} - Censo sin coordenadas`,
      `
        <div class="field-report-shell census-report-shell">
          <header class="field-report-header census-report-header">
            <div class="field-report-brand">
              <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" />
              <div>
                <p class="field-report-kicker">${escapeHtml(reportSubtitle)}</p>
                <h1>${escapeHtml(reportTitle)}</h1>
                <p>${escapeHtml(reportDescription)}</p>
              </div>
            </div>
            <div class="field-report-meta">
              <span>Tipo: Reporte de censo sin coordenadas</span>
              <span>Generado: ${generatedAt}</span>
              <span>Total de puntos: ${reportData.totalPoints}</span>
              <span>Zonas / manzanas: ${reportData.totalZones}</span>
            </div>
            ${buildMapReportStaffMarkup(mapReportStaff)}
          </header>
          ${
            mapImageDataUrl
              ? `<section class="census-report-map"><img src="${mapImageDataUrl}" alt="Mapa del censo" class="field-report-map-image" /></section>`
              : ""
          }
          <section class="field-report-summary">
            <div class="field-report-total-chip"><strong>Total de puntos</strong><span>${reportData.totalPoints}</span></div>
            <div class="field-report-total-chip"><strong>Zonas / manzanas</strong><span>${reportData.totalZones}</span></div>
            <div class="field-report-total-chip"><strong>Cajas de registro</strong><span>${reportCajaTotal}</span></div>
          </section>
          ${buildMapReportTypeChartMarkup(reportData)}
          ${reportNotes ? `<section class="field-report-notes"><strong>Observaciones del censo</strong><p>${escapeHtml(reportNotes)}</p></section>` : ""}
          ${zonesMarkup || '<p class="field-report-empty">No hay puntos guardados para generar el reporte.</p>'}
        </div>
      `,
      {
        pageSize: "Letter portrait",
        pageMargin: "10mm",
        bodyClassName: "field-report-body census-report-body",
        showPageFooter: true
      }
    );
  };

  const handleDownloadMapCensusPdf = async ({ includedZoneKeys } = {}) => {
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableModule.default;
      const document = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "letter",
        compress: true
      });
      const reportData = getSelectedMapReportData(includedZoneKeys);
      const { padronNames } = await buildMapReportPadronData(reportData);
      const generatedAt = formatDateTime(new Date().toISOString());
      const reportTitle = mapReportSettings.title.trim() || defaultMapReportSettings.title;
      const reportSubtitle = mapReportSettings.subtitle.trim() || defaultMapReportSettings.subtitle;
      const reportDescription = mapReportSettings.description.trim() || defaultMapReportSettings.description;
      const reportNotes = mapReportSettings.report_notes.trim();
      const pageWidth = document.internal.pageSize.getWidth();
      const pageHeight = document.internal.pageSize.getHeight();
      const addPageFooter = () => {
        const currentPage = document.getCurrentPageInfo().pageNumber;
        document.setFont("helvetica", "normal");
        document.setFontSize(8.5);
        document.setTextColor(69, 96, 122);
        document.text(`Pagina ${currentPage}`, pageWidth - 14, pageHeight - 8, { align: "right" });
      };

      try {
        const logoDataUrl = await urlToDataUrl(logoAguasCholuteca);
        document.addImage(logoDataUrl, "PNG", 14, 10, 18, 18);
      } catch {
        // Keep the report generation going even if the logo cannot be embedded.
      }

      document.setFont("helvetica", "bold");
      document.setFontSize(15);
      document.setTextColor(18, 59, 93);
      document.text(reportTitle, 36, 15);
      document.setFont("helvetica", "normal");
      document.setFontSize(9);
      document.setTextColor(64, 91, 117);
      document.text(reportSubtitle, 36, 21);
      document.text(document.splitTextToSize(reportDescription, 150), 36, 26);

      document.setFillColor(237, 245, 252);
      document.roundedRect(14, 38, 188, 22, 3, 3, "F");
      document.setFontSize(8.8);
      document.setTextColor(22, 50, 74);
      document.text(`Tipo: Reporte de censo sin coordenadas`, 18, 45);
      document.text(`Generado: ${generatedAt}`, 18, 51);
      document.text(`Total de puntos: ${reportData.totalPoints}`, 102, 45);
      document.text(`Zonas / manzanas: ${reportData.totalZones}`, 102, 51);
      document.text(document.splitTextToSize(`Tecnicos: ${getMapReportTechniciansLabel(mapReportStaff)}`, 178), 18, 57);

      const chartRows = getMapReportTypeChartRows(reportData);
      let currentY = 66;
      if (chartRows.length) {
        const maxChartValue = Math.max(1, ...chartRows.map(([, total]) => Number(total || 0)));
        document.setFont("helvetica", "bold");
        document.setFontSize(9);
        document.setTextColor(16, 55, 91);
        document.text("Distribucion de puntos", 14, currentY);
        chartRows.forEach(([label, total], index) => {
          const rowY = currentY + 6 + index * 5;
          document.setFont("helvetica", "normal");
          document.setFontSize(7.5);
          document.setTextColor(45, 75, 101);
          document.text(String(label).slice(0, 25), 14, rowY);
          document.setFillColor(224, 235, 245);
          document.roundedRect(62, rowY - 2.7, 120, 3, 1.5, 1.5, "F");
          document.setFillColor(21, 118, 209);
          document.roundedRect(62, rowY - 2.7, Math.max(4, (Number(total || 0) / maxChartValue) * 120), 3, 1.5, 1.5, "F");
          document.text(String(total), 198, rowY, { align: "right" });
        });
        currentY += chartRows.length * 5 + 10;
      }
      if (reportNotes) {
        document.setFont("helvetica", "bold");
        document.setFontSize(9);
        document.setTextColor(16, 55, 91);
        document.text("Observaciones del censo", 14, currentY);
        document.setFont("helvetica", "normal");
        document.setFontSize(8.5);
        document.setTextColor(69, 96, 122);
        const noteLines = document.splitTextToSize(reportNotes, 180);
        document.text(noteLines, 14, currentY + 5);
        currentY += Math.min(24, noteLines.length * 4 + 10);
      }

      addPageFooter();

      for (let index = 0; index < reportData.zones.length; index += 1) {
        const zone = reportData.zones[index];
        if (currentY > 235) {
          document.addPage("letter", "portrait");
          addPageFooter();
          currentY = 16;
        }

        document.setFillColor(237, 245, 252);
        document.roundedRect(14, currentY, 188, 13, 3, 3, "F");
        document.setFont("helvetica", "bold");
        document.setFontSize(10.5);
        document.setTextColor(16, 55, 91);
        document.text(`${zone.displayKicker || `Zona ${index + 1}`}: ${zone.displayName || zone.zone}`, 18, currentY + 6);
        document.setFont("helvetica", "normal");
        document.setFontSize(8.2);
        document.text(`Ubicacion: ${zone.displayLocation || "Sin referencia"}`, 18, currentY + 11);

        autoTable(document, {
          startY: currentY + 17,
          head: [["#", "Barrio / sector", "Clave / abonado", "Nombre en padron", "Tipo", "Referencia", "Descripcion"]],
          body: zone.items.map((point, pointIndex) => {
            const row = [
              String(pointIndex + 1),
              zone.displayName || zone.zone || "--",
              getMapPointReportReferenceLabel(point),
              getMapPointPadronNames(point, padronNames),
              getMapPointTypeLabel(point.point_type),
              getMapPointReferenceNote(point) || zone.displayLocation || "--",
              getMapPointTechnicalDescription(point) || "--"
            ];
            row.rawPoint = point;
            return row;
          }),
          theme: "grid",
          styles: {
            fontSize: 7.5,
            cellPadding: 2,
            textColor: [28, 44, 62],
            overflow: "linebreak"
          },
          headStyles: {
            fillColor: [21, 118, 209],
            textColor: [255, 255, 255],
            fontStyle: "bold"
          },
          alternateRowStyles: {
            fillColor: [248, 251, 255]
          },
          didParseCell: (data) => {
            if (data.section !== "body") return;
            const rawPoint = data.row.raw?.rawPoint;
            if (isAlertReportPoint(rawPoint)) {
              data.cell.styles.textColor = REPORT_POINT_ALERT_RGB;
              data.cell.styles.fillColor = REPORT_POINT_ALERT_FILL_RGB;
              data.cell.styles.lineColor = REPORT_POINT_ALERT_BORDER_RGB;
            } else if (isRedReportPoint(rawPoint)) {
              data.cell.styles.textColor = REPORT_POINT_DANGER_RGB;
              data.cell.styles.fillColor = REPORT_POINT_DANGER_FILL_RGB;
              data.cell.styles.lineColor = REPORT_POINT_DANGER_BORDER_RGB;
            } else {
              return;
            }
            if (data.column.index === 1 || data.column.index === 2) {
              data.cell.styles.fontStyle = "bold";
            }
          },
          margin: { left: 14, right: 14 },
          columnStyles: {
            0: { cellWidth: 8, halign: "center" },
            1: { cellWidth: 27 },
            2: { cellWidth: 25 },
            3: { cellWidth: 35 },
            4: { cellWidth: 22 },
            5: { cellWidth: 28 },
            6: { cellWidth: 43 }
          }
        });

        currentY = (document.lastAutoTable?.finalY ?? currentY + 22) + 7;
        addPageFooter();
      }

      saveReportPdf(document, `reporte-censo-sin-coordenadas-${new Date().toISOString().slice(0, 10)}.pdf`);
      showAlert("Reporte de censo sin coordenadas descargado.");
    } catch (error) {
      showAlert(error.message || "No fue posible descargar el reporte de censo.");
    }
  };

  const handlePrintMapBriefReport = async ({ sharedKeys: includeSharedKeys = false, debtSummary: includeDebtSummary = false, includedZoneKeys } = {}) => {
    const generatedAt = formatDateTime(new Date().toISOString());
    const reportData = getSelectedMapReportData(includedZoneKeys);
    const reportCajaTotal = getSelectedCajaTotal(reportData);
    const { padronNames, sharedKeys, debtRows } = await buildMapReportPadronData(reportData);
    const reportTitle = mapReportSettings.title.trim() || defaultMapReportSettings.title;
    const reportSubtitle = mapReportSettings.subtitle.trim() || defaultMapReportSettings.subtitle;
    const reportNotes = mapReportSettings.report_notes.trim();
    const sharedAccounts = sharedKeys.reduce((total, item) => total + item.total, 0);
    const totalDebt = debtRows.reduce((total, item) => total + item.total, 0);
    const rowsMarkup = buildMapReportBriefRows(reportData, padronNames)
      .map(
        ([index, barrio, clave, nombre, tipo, descripcion, services]) => `
          <tr>
            <td>${escapeHtml(index)}</td>
            <td>${escapeHtml(barrio)}</td>
            <td>${escapeHtml(clave)}</td>
            <td>${escapeHtml(nombre)}</td>
            <td>${escapeHtml(tipo)}</td>
            <td>${escapeHtml(descripcion)}</td>
            <td class="map-brief-service-cell">${escapeHtml(services)}</td>
          </tr>
        `
      )
      .join("");

    await printDocument(
      `${reportTitle} - Resumen ligero`,
      `
        <div class="field-report-shell map-brief-report-shell">
          <header class="field-report-header map-brief-report-header">
            <div class="field-report-brand">
              <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" />
              <div>
                <p class="field-report-kicker">${escapeHtml(reportSubtitle)}</p>
                <h1>${escapeHtml(reportTitle)}</h1>
                <p>Resumen ligero de jornada GPS para lectura rapida, archivo PDF e impresion.</p>
              </div>
            </div>
            <div class="field-report-meta">
              <span>Generado: ${generatedAt}</span>
              <span>Jornada: ${escapeHtml(formatMapDiaryLabel(activeMapDiaryDateKey))}</span>
              <span>Tecnicos: ${escapeHtml(getMapReportTechniciansLabel(mapReportStaff))}</span>
            </div>
          </header>
          <section class="map-brief-report-metrics">
            <div><strong>Total general</strong><span>${reportData.totalPoints}</span></div>
            <div><strong>Barrios / zonas</strong><span>${reportData.totalZones}</span></div>
            <div><strong>Cajas de registro</strong><span>${reportCajaTotal}</span></div>
          </section>
          ${buildMapReportTypeChartMarkup(reportData)}
          ${reportNotes ? `<section class="field-report-notes"><strong>Observaciones</strong><p>${escapeHtml(reportNotes)}</p></section>` : ""}
          <section class="field-report-zone map-brief-report-table-section">
            <div class="field-report-zone-head">
              <div>
                <span class="field-report-zone-kicker">Listado resumido</span>
                <h3>Listado por barrio y clave</h3>
                <p class="map-brief-service-legend">${escapeHtml(MAP_REPORT_SERVICE_LEGEND)}</p>
              </div>
              <div class="field-report-zone-meta">
                <span>${reportData.totalZones} barrios</span>
              </div>
            </div>
            <table class="field-report-table map-brief-report-table">
              <colgroup>
                <col class="map-brief-col-index" />
                <col class="map-brief-col-barrio" />
                <col class="map-brief-col-clave" />
                <col class="map-brief-col-nombre" />
                <col class="map-brief-col-tipo" />
                <col class="map-brief-col-descripcion" />
                <col class="map-brief-col-servicios" />
              </colgroup>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Barrio / zona</th>
                  <th>Clave / abonado</th>
                  <th>Nombre en padrón</th>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th>Servicios activos</th>
                </tr>
              </thead>
              <tbody>
                ${rowsMarkup || '<tr><td colspan="7">No hay puntos guardados para generar el resumen.</td></tr>'}
              </tbody>
            </table>
          </section>
          ${includeSharedKeys ? `<section class="map-brief-shared-keys">
            <div>
              <span class="field-report-zone-kicker">Cruce del padrón</span>
              <h3>Abonados que comparten clave catastral</h3>
              <p><strong>${sharedKeys.length}</strong> claves agrupan <strong>${sharedAccounts}</strong> abonados.</p>
            </div>
            ${
              sharedKeys.length
                ? `<table><thead><tr><th>Clave catastral base</th><th>Abonados</th><th>Total</th></tr></thead><tbody>${sharedKeys
                    .map(
                      (item) =>
                        `<tr><td>${escapeHtml(item.clave)}</td><td>${escapeHtml(item.abonados.join(", "))}</td><td>${item.total}</td></tr>`
                    )
                    .join("")}</tbody></table>`
                : "<p>No se detectaron varios abonados con la misma clave catastral.</p>"
            }
          </section>` : ""}
          ${includeDebtSummary ? `<section class="map-brief-debt-summary">
            <header><div><span class="field-report-zone-kicker">Cartera de los abonados</span><h3>Deuda asociada</h3></div><strong>${escapeHtml(formatCurrency(totalDebt))}</strong></header>
            ${
              debtRows.length
                ? `<table><thead><tr><th>Clave</th><th>Abonado</th><th>Nombre</th><th>Deuda</th></tr></thead><tbody>${debtRows
                    .map(
                      (item) =>
                        `<tr><td>${escapeHtml(item.clave)}</td><td>${escapeHtml(item.abonado)}</td><td>${escapeHtml(item.nombre)}</td><td>${escapeHtml(formatCurrency(item.total))}</td></tr>`
                    )
                    .join("")}</tbody></table>`
                : "<p>No se encontraron abonados del padrón para calcular deuda.</p>"
            }
          </section>` : ""}
        </div>
      `,
      {
        pageSize: "Letter portrait",
        pageMargin: "9mm",
        bodyClassName: "field-report-body map-brief-report-body",
        showPageFooter: true
      }
    );
  };

  const handleDownloadMapBriefPdf = async ({ sharedKeys: includeSharedKeys = false, debtSummary: includeDebtSummary = false, includedZoneKeys } = {}) => {
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableModule.default;
      const document = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "letter",
        compress: true
      });
      const reportData = getSelectedMapReportData(includedZoneKeys);
      const reportCajaTotal = getSelectedCajaTotal(reportData);
      const { padronNames, sharedKeys, debtRows } = await buildMapReportPadronData(reportData);
      const generatedAt = formatDateTime(new Date().toISOString());
      const reportTitle = mapReportSettings.title.trim() || defaultMapReportSettings.title;
      const reportSubtitle = mapReportSettings.subtitle.trim() || defaultMapReportSettings.subtitle;
      const reportNotes = mapReportSettings.report_notes.trim();
      const sharedAccounts = sharedKeys.reduce((total, item) => total + item.total, 0);
      const totalDebt = debtRows.reduce((total, item) => total + item.total, 0);
      const pageWidth = document.internal.pageSize.getWidth();
      const pageHeight = document.internal.pageSize.getHeight();
      const addPageFooter = () => {
        const currentPage = document.getCurrentPageInfo().pageNumber;
        document.setFont("helvetica", "normal");
        document.setFontSize(8);
        document.setTextColor(83, 103, 122);
        document.text(`Pagina ${currentPage}`, pageWidth - 14, pageHeight - 8, { align: "right" });
      };

      try {
        const logoDataUrl = await urlToDataUrl(logoAguasCholuteca);
        document.addImage(logoDataUrl, "PNG", 14, 10, 18, 18);
      } catch {
        // Keep the report generation going even if the logo cannot be embedded.
      }

      document.setFont("helvetica", "bold");
      document.setFontSize(15);
      document.setTextColor(18, 59, 93);
      document.text(document.splitTextToSize(reportTitle, 152), 36, 15);
      document.setFont("helvetica", "normal");
      document.setFontSize(9);
      document.setTextColor(64, 91, 117);
      document.text(reportSubtitle, 36, 24);
      document.text(`Resumen ligero GPS | ${generatedAt}`, 36, 29);

      document.setFillColor(238, 246, 252);
      document.roundedRect(14, 38, 188, 24, 3, 3, "F");
      document.setFont("helvetica", "bold");
      document.setFontSize(10);
      document.setTextColor(16, 55, 91);
      document.text("Jornada", 20, 46);
      document.text("Puntos", 80, 46);
      document.text("Barrios", 122, 46);
      document.text("Cajas", 164, 46);
      document.setFontSize(13);
      document.text(formatMapDiaryLabel(activeMapDiaryDateKey), 20, 55);
      document.text(String(reportData.totalPoints), 80, 55);
      document.text(String(reportData.totalZones), 122, 55);
      document.text(String(reportCajaTotal), 164, 55);

      const chartRows = getMapReportTypeChartRows(reportData);
      const maxChartValue = Math.max(1, ...chartRows.map(([, total]) => Number(total || 0)));
      document.setFont("helvetica", "bold");
      document.setFontSize(9);
      document.setTextColor(16, 55, 91);
      document.text("Distribucion de puntos", 14, 70);
      chartRows.forEach(([label, total], index) => {
        const rowY = 76 + index * 5;
        document.setFont("helvetica", "normal");
        document.setFontSize(7.5);
        document.setTextColor(45, 75, 101);
        document.text(String(label).slice(0, 25), 14, rowY);
        document.setFillColor(224, 235, 245);
        document.roundedRect(62, rowY - 2.7, 120, 3, 1.5, 1.5, "F");
        document.setFillColor(21, 118, 209);
        document.roundedRect(62, rowY - 2.7, Math.max(4, (Number(total || 0) / maxChartValue) * 120), 3, 1.5, 1.5, "F");
        document.text(String(total), 198, rowY, { align: "right" });
      });

      let currentY = 80 + chartRows.length * 5;
      if (reportNotes) {
        document.setFont("helvetica", "bold");
        document.setFontSize(9);
        document.setTextColor(16, 55, 91);
        document.text("Observaciones", 14, currentY);
        document.setFont("helvetica", "normal");
        document.setFontSize(8.2);
        document.setTextColor(69, 96, 122);
        const noteLines = document.splitTextToSize(reportNotes, 184);
        document.text(noteLines.slice(0, 4), 14, currentY + 5);
        currentY += Math.min(24, noteLines.length * 4 + 10);
      }

      document.setFont("helvetica", "normal");
      document.setFontSize(7.8);
      document.setTextColor(69, 96, 122);
      document.text(`Servicios: ${MAP_REPORT_SERVICE_LEGEND}`, 14, currentY + 2);

      autoTable(document, {
        startY: currentY + 6,
        head: [["#", "Barrio / zona", "Clave / abonado", "Nombre en padron", "Tipo", "Descripcion", "Servicios"]],
        body: buildMapReportBriefRows(reportData, padronNames),
        theme: "grid",
        styles: {
          fontSize: 7.4,
          cellPadding: 1.8,
          textColor: [28, 44, 62],
          overflow: "linebreak"
        },
        headStyles: {
          fillColor: [21, 118, 209],
          textColor: [255, 255, 255],
          fontStyle: "bold"
        },
        alternateRowStyles: {
          fillColor: [248, 251, 255]
        },
        margin: { left: 14, right: 14, bottom: 14 },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 25 },
          2: { cellWidth: 24 },
          3: { cellWidth: 30 },
          4: { cellWidth: 20 },
          5: { cellWidth: 50 },
          6: { cellWidth: 31, fontStyle: "bold" }
        }
      });

      let appendixY = (document.lastAutoTable?.finalY ?? 220) + 10;
      if (includeSharedKeys) {
        if (appendixY > 230) {
          document.addPage("letter", "portrait");
          appendixY = 18;
        }
        document.setFont("helvetica", "bold");
        document.setFontSize(11);
        document.setTextColor(16, 55, 91);
        document.text("Abonados que comparten clave catastral", 14, appendixY);
        document.setFont("helvetica", "normal");
        document.setFontSize(8.5);
        document.setTextColor(69, 96, 122);
        document.text(`${sharedKeys.length} claves agrupan ${sharedAccounts} abonados.`, 14, appendixY + 6);
        if (sharedKeys.length) {
          autoTable(document, {
            startY: appendixY + 10,
            head: [["Clave catastral base", "Abonados", "Nombres", "Total"]],
            body: sharedKeys.map((item) => [item.clave, item.abonados.join(", "), item.nombres.join(", ") || "--", String(item.total)]),
            theme: "grid",
            styles: { fontSize: 8, cellPadding: 2, textColor: [28, 44, 62] },
            headStyles: { fillColor: [13, 77, 134], textColor: [255, 255, 255], fontStyle: "bold" },
            alternateRowStyles: { fillColor: [248, 251, 255] },
            margin: { left: 14, right: 14, bottom: 14 },
            columnStyles: {
              0: { cellWidth: 40 },
              1: { cellWidth: 45 },
              2: { cellWidth: 87 },
              3: { cellWidth: 16, halign: "center" }
            }
          });
          appendixY = (document.lastAutoTable?.finalY ?? appendixY + 10) + 10;
        } else {
          document.text("No se detectaron varios abonados con la misma clave catastral base.", 14, appendixY + 12);
          appendixY += 20;
        }
      }

      if (includeDebtSummary) {
        if (appendixY > 225) {
          document.addPage("letter", "portrait");
          appendixY = 18;
        }
        document.setFont("helvetica", "bold");
        document.setFontSize(11);
        document.setTextColor(16, 55, 91);
        document.text("Deuda de los abonados del informe", 14, appendixY);
        document.setFontSize(12);
        document.text(formatCurrency(totalDebt), 202, appendixY, { align: "right" });
        if (debtRows.length) {
          autoTable(document, {
            startY: appendixY + 5,
            head: [["Clave", "Abonado", "Nombre", "Deuda"]],
            body: debtRows.map((item) => [item.clave, item.abonado, item.nombre, formatCurrency(item.total)]),
            theme: "grid",
            styles: { fontSize: 7.8, cellPadding: 1.8, textColor: [28, 44, 62] },
            headStyles: { fillColor: [13, 77, 134], textColor: [255, 255, 255], fontStyle: "bold" },
            alternateRowStyles: { fillColor: [248, 251, 255] },
            margin: { left: 14, right: 14, bottom: 14 },
            columnStyles: {
              0: { cellWidth: 38 },
              1: { cellWidth: 30 },
              2: { cellWidth: 80 },
              3: { cellWidth: 40, halign: "right", fontStyle: "bold" }
            }
          });
        } else {
          document.setFont("helvetica", "normal");
          document.setFontSize(8.5);
          document.text("No se encontraron abonados del padron para calcular deuda.", 14, appendixY + 7);
        }
      }

      const pageCount = document.getNumberOfPages();
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        document.setPage(pageNumber);
        addPageFooter();
      }

      saveReportPdf(document, `resumen-ligero-gps-${activeMapDiaryDateKey || new Date().toISOString().slice(0, 10)}.pdf`);
      showAlert("Resumen ligero GPS descargado.");
    } catch (error) {
      showAlert(error.message || "No fue posible descargar el resumen ligero.");
    }
  };

  return {
    handleDownloadMapReport,
    handlePrintMapFieldReport,
    handleDownloadMapFieldPdf,
    handlePrintMapCensusReport,
    handleDownloadMapCensusPdf,
    handlePrintMapBriefReport,
    handleDownloadMapBriefPdf
  };
}
