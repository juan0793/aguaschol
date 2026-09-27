import { ensureClaveHasPrefix } from "../../utils/barrioCodes";
import { escapeHtml } from "../../utils/html";
import { formatCurrency } from "../../utils/formatting";
import { formatDashboardSyncDate } from "../../utils/timeFormat";
import { formatDateTime } from "../../utils/datesAndBusiness";
import { getRecordAguasPresenceLabel, getRecordDisplayName, getRecordFichaDateLabel } from "../../utils/recordLabels";
import logoAguasCholuteca from "../../assets/logo-aguas-choluteca.png";
import { printDocument, saveReportPdf } from "../../utils/printDocument";

export function createPadronReportPrinters({
  aguasServiceReportData,
  alcaldiaComparison,
  alcaldiaComparisonByClave,
  alcaldiaMeta,
  getRecordBarrioName,
  loadAlcaldiaComparison,
  markBatchFichaRecordsAsPrinted,
  overdueComparisonRecords,
  padronChartMode,
  padronMeta,
  padronRequestResult,
  padronServiceReport,
  padronStatisticsData,
  padronStatsSortMetric,
  printComparisonHeader,
  safeBarrioCodes,
  selectedAguasServiceBarrioRows,
  selectedPadronServiceField,
  setDownloadingAguasServicePdf,
  setDownloadingPadronStatsPdf,
  setPrintingComparison,
  setShowPrintComparisonModal,
  showAlert
}) {
  const handlePrintPadronRequest = async () => {
    if (!padronRequestResult) {
      showAlert("Genera primero la peticion para imprimirla.");
      return;
    }

    const summary = padronRequestResult.summary ?? {};
    const barriosMarkup = (summary.barrios ?? [])
      .map(
        (barrio, index) => `
          <section class="request-report-zone">
            <div class="request-report-zone-head">
              <div>
                <span class="field-report-zone-kicker">Barrio ${index + 1}</span>
                <h3>${escapeHtml(barrio.barrio_colonia)}</h3>
              </div>
              <div class="request-report-zone-meta">
                <span>${barrio.total_registros} registros</span>
                <span>Tarifa: ${formatCurrency(barrio.tarifa_total)}</span>
                <span>Total: ${formatCurrency(barrio.total_con_interes)}</span>
              </div>
            </div>
            <table class="request-report-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nombre</th>
                  <th>Abonado</th>
                  <th>Clave</th>
                  <th>Barrio</th>
                  <th>Tarifa</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${barrio.rows
                  .map(
                    (row, rowIndex) => `
                      <tr>
                        <td>${rowIndex + 1}</td>
                        <td>${escapeHtml(row.nombre || "--")}</td>
                        <td>${escapeHtml(row.abonado || "--")}</td>
                        <td>${escapeHtml(ensureClaveHasPrefix(row.clave_catastral || row.clave_aguas_formato || row.clave_alcaldia, row.barrio_colonia, safeBarrioCodes) || "--")}</td>
                        <td>${escapeHtml(row.barrio_colonia || "--")}</td>
                        <td>${formatCurrency(row.tarifa || 0)}</td>
                        <td>${formatCurrency(row.total || 0)}</td>
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
      padronRequestResult.request?.title || "Peticion de padron",
      `
        <div class="request-report-shell">
          <header class="request-report-header">
            <div class="request-report-brand">
              <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" />
              <div>
                <p class="field-report-kicker">Aguas de Choluteca, S.A. de C.V.</p>
                <h1>${escapeHtml(padronRequestResult.request?.title || "Peticion de padron")}</h1>
                <p>${escapeHtml(padronRequestResult.request?.description || "")}</p>
              </div>
            </div>
            <div class="request-report-summary">
              <div><strong>Total de registros</strong><span>${summary.total_registros ?? 0}</span></div>
              <div><strong>Total de barrios</strong><span>${summary.total_barrios ?? 0}</span></div>
              <div><strong>Tarifa acumulada</strong><span>${formatCurrency(summary.tarifa_total ?? 0)}</span></div>
              <div><strong>Total con interes</strong><span>${formatCurrency(summary.total_con_interes ?? 0)}</span></div>
            </div>
            <p class="request-report-keywords"><strong>Palabras clave:</strong> ${escapeHtml((padronRequestResult.request?.keywords || []).join(", "))}</p>
          </header>
          ${barriosMarkup || '<p class="request-report-empty">No hay registros para mostrar en esta peticion.</p>'}
        </div>
      `,
      {
        pageSize: "Letter landscape",
        pageMargin: "10mm",
        bodyClassName: "request-report-body"
      }
    );
  };

  const handleDownloadPadronRequestPdf = async () => {
    if (!padronRequestResult) {
      showAlert("Genera primero la peticion para descargarla en PDF.");
      return;
    }

    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableModule.default;
      const document = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "letter"
      });

      document.setFillColor(237, 246, 255);
      document.rect(0, 0, 279.4, 18, "F");
      document.setFont("helvetica", "bold");
      document.setFontSize(18);
      document.setTextColor(18, 59, 93);
      document.text(padronRequestResult.request?.title || "Peticion de padron", 14, 12);
      document.setFontSize(9);
      document.setFont("helvetica", "normal");
      document.setTextColor(82, 114, 141);
      document.text("Aguas de Choluteca, S.A. de C.V.", 14, 17);

      const summary = padronRequestResult.summary ?? {};
      document.setFontSize(10);
      document.setTextColor(23, 52, 78);
      document.text(`Registros: ${summary.total_registros ?? 0}`, 170, 10);
      document.text(`Barrios: ${summary.total_barrios ?? 0}`, 170, 15);
      document.text(`Tarifa acumulada: ${formatCurrency(summary.tarifa_total ?? 0)}`, 214, 10);
      document.text(`Total con interes: ${formatCurrency(summary.total_con_interes ?? 0)}`, 214, 15);

      let currentY = 24;
      autoTable(document, {
        startY: currentY,
        head: [["Descripcion", "Palabras clave"]],
        body: [[padronRequestResult.request?.description || "--", (padronRequestResult.request?.keywords || []).join(", ")]],
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 2.5, textColor: [23, 52, 78] },
        headStyles: { fillColor: [21, 118, 209], textColor: [255, 255, 255] },
        columnStyles: {
          0: { cellWidth: 120 },
          1: { cellWidth: 130 }
        }
      });

      currentY = (document.lastAutoTable?.finalY ?? currentY) + 5;

      (summary.barrios ?? []).forEach((barrio, index) => {
        if (currentY > 180) {
          document.addPage();
          currentY = 16;
        }

        document.setFont("helvetica", "bold");
        document.setFontSize(12);
        document.setTextColor(18, 59, 93);
        document.text(`${index + 1}. ${barrio.barrio_colonia}`, 14, currentY);
        document.setFont("helvetica", "normal");
        document.setFontSize(9);
        document.setTextColor(82, 114, 141);
        document.text(
          `Registros: ${barrio.total_registros} | Tarifa: ${formatCurrency(barrio.tarifa_total)} | Total: ${formatCurrency(barrio.total_con_interes)}`,
          14,
          currentY + 5
        );

        autoTable(document, {
          startY: currentY + 8,
          head: [["#", "Nombre", "Abonado", "Clave", "Barrio", "Tarifa", "Total"]],
          body: barrio.rows.map((row, rowIndex) => [
            rowIndex + 1,
            row.nombre || "--",
            row.abonado || "--",
            ensureClaveHasPrefix(row.clave_catastral || row.clave_aguas_formato || row.clave_alcaldia, row.barrio_colonia, safeBarrioCodes) || "--",
            row.barrio_colonia || "--",
            formatCurrency(row.tarifa || 0),
            formatCurrency(row.total || 0)
          ]),
          theme: "striped",
          styles: { fontSize: 8, cellPadding: 2, textColor: [23, 52, 78] },
          headStyles: { fillColor: [21, 118, 209], textColor: [255, 255, 255] },
          alternateRowStyles: { fillColor: [244, 248, 252] },
          margin: { left: 14, right: 14 }
        });

        currentY = (document.lastAutoTable?.finalY ?? currentY + 30) + 6;
      });

      saveReportPdf(document, `peticion-padron-${new Date().toISOString().slice(0, 10)}.pdf`);
      showAlert("Peticion descargada en PDF.");
    } catch (error) {
      showAlert(error.message || "No fue posible descargar la peticion en PDF.");
    }
  };

  const handlePrintAguasServiceReport = async ({ onlySelected = false } = {}) => {
    if (!aguasServiceReportData.hasData) {
      showAlert("Actualiza primero el informe del padron maestro.");
      return;
    }

    const barriosToPrint = onlySelected ? selectedAguasServiceBarrioRows : aguasServiceReportData.barrios;
    if (onlySelected && !barriosToPrint.length) {
      showAlert("Selecciona al menos un barrio para imprimir.");
      return;
    }

    const generatedAt = formatDateTime(padronServiceReport?.generated_at || new Date().toISOString());
    const reportTitle = onlySelected
      ? "Informe de servicios por barrios seleccionados"
      : "Informe de servicios del padron maestro";
    const printedTotalRecords = onlySelected
      ? barriosToPrint.reduce((total, barrio) => total + Number(barrio.total_registros || 0), 0)
      : aguasServiceReportData.totalRecords;
    const printedDebt = barriosToPrint.reduce(
      (totals, barrio) => ({
        capital: totals.capital + Number(barrio.deuda?.capital || 0),
        intereses: totals.intereses + Number(barrio.deuda?.intereses || 0),
        total: totals.total + Number(barrio.deuda?.total || 0),
        deudores: totals.deudores + Number(barrio.deuda?.deudores || 0)
      }),
      { capital: 0, intereses: 0, total: 0, deudores: 0 }
    );
    const serviceRowsForPrint = aguasServiceReportData.serviceRows.map((service) => {
      if (!onlySelected) return service;
      const scopedTotals = barriosToPrint.reduce(
        (totals, barrio) => {
          const services = Array.isArray(barrio.servicios) ? barrio.servicios : [];
          const match = services.find((item) => item.field === service.field) || {};
          return {
            active: totals.active + Number(match.active || 0),
            inactive: totals.inactive + Number(match.inactive || 0),
            unknown: totals.unknown + Number(match.unknown || 0),
            deuda: {
              capital: totals.deuda.capital + Number(match.deuda?.capital || 0),
              intereses: totals.deuda.intereses + Number(match.deuda?.intereses || 0),
              total: totals.deuda.total + Number(match.deuda?.total || 0),
              deudores: totals.deuda.deudores + Number(match.deuda?.deudores || 0)
            }
          };
        },
        { active: 0, inactive: 0, unknown: 0, deuda: { capital: 0, intereses: 0, total: 0, deudores: 0 } }
      );
      return {
        ...service,
        ...scopedTotals,
        percentage: printedTotalRecords ? Number(((scopedTotals.active / printedTotalRecords) * 100).toFixed(1)) : 0
      };
    });
    const serviceRows = serviceRowsForPrint
      .map(
        (service) => `
          <tr>
            <td>${escapeHtml(service.label)}</td>
            <td>${Number(service.active || 0)}</td>
            <td>${Number(service.inactive || 0)}</td>
            <td>${Number(service.unknown || 0)}</td>
            <td>${Number(service.percentage || 0)}%</td>
            <td>${escapeHtml(formatCurrency(service.deuda?.capital || 0))}</td>
            <td>${escapeHtml(formatCurrency(service.deuda?.intereses || 0))}</td>
            <td>${escapeHtml(formatCurrency(service.deuda?.total || 0))}</td>
          </tr>
        `
      )
      .join("");
    const barrioRows = barriosToPrint
      .map((barrio) => {
        const services = Array.isArray(barrio.servicios) ? barrio.servicios : [];
        return `
          <tr>
            <td>${escapeHtml(barrio.barrio_colonia || "Sin barrio")}</td>
            <td>${Number(barrio.total_registros || 0)}</td>
            ${["agua", "alcantarillado", "barrido", "recoleccion", "desechos_peligrosos"]
              .map((field) => `<td>${Number(services.find((service) => service.field === field)?.active || 0)}</td>`)
              .join("")}
          </tr>
        `;
      })
      .join("");
    const barrioDebtRows = barriosToPrint
      .map((barrio) => {
        const services = Array.isArray(barrio.servicios) ? barrio.servicios : [];
        const serviceDebt = (field) => services.find((service) => service.field === field)?.deuda?.total || 0;
        return `
          <tr>
            <td>${escapeHtml(barrio.barrio_colonia || "Sin barrio")}</td>
            <td>${escapeHtml(formatCurrency(barrio.deuda?.capital || 0))}</td>
            <td>${escapeHtml(formatCurrency(barrio.deuda?.intereses || 0))}</td>
            <td>${escapeHtml(formatCurrency(barrio.deuda?.total || 0))}</td>
            ${["agua", "alcantarillado", "barrido", "recoleccion", "desechos_peligrosos"]
              .map((field) => `<td>${escapeHtml(formatCurrency(serviceDebt(field)))}</td>`)
              .join("")}
          </tr>
        `;
      })
      .join("");

    await printDocument(
      reportTitle,
      `
        <div class="field-report-shell census-report-shell">
          <header class="field-report-header census-report-header">
            <div class="field-report-brand">
              <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" />
              <div>
                <p class="field-report-kicker">Aguas de Choluteca, S.A. de C.V.</p>
                <h1>${escapeHtml(reportTitle)}</h1>
                <p>${onlySelected ? "Resumen filtrado con los barrios seleccionados por el operador." : "Resumen actualizado desde el padron maestro activo de Aguas."}</p>
              </div>
            </div>
            <div class="field-report-meta">
              <span>Generado: ${generatedAt}</span>
              <span>Registros impresos: ${printedTotalRecords}</span>
              <span>Barrios impresos: ${barriosToPrint.length}</span>
              <span>Deuda total: ${escapeHtml(formatCurrency(printedDebt.total))}</span>
              <span>Fuente: ${escapeHtml(padronServiceReport?.source?.file_name || "Padron maestro")}</span>
            </div>
          </header>
          <section class="field-report-summary">
            ${serviceRowsForPrint
              .map(
                (service) => `
                  <div class="field-report-total-chip">
                    <strong>${escapeHtml(service.label)}</strong>
                    <span>${Number(service.active || 0)} (${Number(service.percentage || 0)}%)</span>
                  </div>
                `
              )
              .join("")}
          </section>
          <section class="field-report-zone census-report-zone">
            <div class="field-report-zone-head census-report-zone-head">
              <div>
                <span class="field-report-zone-kicker">Resumen general</span>
                <h3>Servicios activos e inactivos</h3>
              </div>
            </div>
            <table class="field-report-table census-report-table data-report-table">
              <thead>
                <tr>
                  <th>Servicio</th>
                  <th>Activos</th>
                  <th>Sin servicio</th>
                  <th>Sin dato</th>
                  <th>% activo</th>
                  <th>Capital asociado</th>
                  <th>Intereses asociados</th>
                  <th>Deuda asociada</th>
                </tr>
              </thead>
              <tbody>${serviceRows}</tbody>
            </table>
          </section>
          <section class="field-report-zone census-report-zone">
            <div class="field-report-zone-head census-report-zone-head">
              <div>
                <span class="field-report-zone-kicker">Barrios principales</span>
                <h3>${onlySelected ? "Desglose de barrios seleccionados" : "Desglose por barrio"}</h3>
              </div>
            </div>
            <table class="field-report-table census-report-table data-report-table">
              <thead>
                <tr>
                  <th>Barrio</th>
                  <th>Total</th>
                  <th>Agua</th>
                  <th>Alcantarillado</th>
                  <th>Barrido</th>
                  <th>Desechos / tren</th>
                  <th>Desechos peligrosos</th>
                </tr>
              </thead>
              <tbody>${barrioRows}</tbody>
            </table>
          </section>
          <section class="field-report-zone census-report-zone">
            <div class="field-report-zone-head census-report-zone-head">
              <div>
                <span class="field-report-zone-kicker">Cartera por barrio</span>
                <h3>Capital, intereses y deuda asociada a cada servicio activo</h3>
              </div>
            </div>
            <table class="field-report-table census-report-table data-report-table">
              <thead>
                <tr>
                  <th>Barrio</th>
                  <th>Capital</th>
                  <th>Intereses</th>
                  <th>Total</th>
                  <th>Agua</th>
                  <th>Alcantarillado</th>
                  <th>Barrido</th>
                  <th>Recoleccion</th>
                  <th>Desechos peligrosos</th>
                </tr>
              </thead>
              <tbody>${barrioDebtRows}</tbody>
            </table>
            <p><strong>Nota:</strong> la deuda por servicio corresponde al total de las cuentas que tienen ese servicio activo; una misma cuenta puede aparecer en varios servicios.</p>
          </section>
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

  const handleDownloadAguasServicePdf = async () => {
    if (!aguasServiceReportData.hasData) {
      showAlert("Actualiza primero el informe del padron maestro.");
      return;
    }

    try {
      setDownloadingAguasServicePdf(true);
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableModule.default;
      const document = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "letter"
      });
      const pageWidth = document.internal.pageSize.getWidth();
      const pageHeight = document.internal.pageSize.getHeight();
      const generatedAt = formatDateTime(padronServiceReport?.generated_at || new Date().toISOString());
      const formatPdfInteger = (value) =>
        new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value || 0));
      const formatPdfPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
      const formatPdfCurrency = (value) =>
        new Intl.NumberFormat("es-HN", { style: "currency", currency: "HNL" }).format(Number(value || 0));
      const totalBarrios = Number(padronServiceReport?.summary?.total_barrios || 0);
      const sourceName = padronServiceReport?.source?.file_name || "Padron maestro";
      const sourceUpdated = padronServiceReport?.source?.updated_at
        ? formatDateTime(padronServiceReport.source.updated_at)
        : "Sin fecha de fuente";
      const profiles = aguasServiceReportData.profiles || {};
      const allCoreServices = Number(profiles.all_core_services || 0);
      const noCoreServices = Number(profiles.no_core_services || 0);
      const waterWithoutSewer = Number(profiles.water_without_sewer || 0);
      const sewerWithoutWater = Number(profiles.sewer_without_water || 0);
      const topService = aguasServiceReportData.serviceRows[0] || null;
      const weakestService = [...aguasServiceReportData.serviceRows].sort(
        (left, right) => Number(left.percentage || 0) - Number(right.percentage || 0)
      )[0] || null;
      const getBarrioServiceActive = (barrio, field) => {
        const services = Array.isArray(barrio.servicios) ? barrio.servicios : [];
        return Number(services.find((service) => service.field === field)?.active || 0);
      };
      const serviceCoverageRows = aguasServiceReportData.serviceRows.map((service) => {
        const barriosSinServicio = aguasServiceReportData.barrios.filter(
          (barrio) => Number(barrio.total_registros || 0) > 0 && getBarrioServiceActive(barrio, service.field) === 0
        ).length;
        return {
          ...service,
          barriosSinServicio,
          barriosConServicio: Math.max(0, totalBarrios - barriosSinServicio),
          barrioCoverage: totalBarrios ? ((totalBarrios - barriosSinServicio) / totalBarrios) * 100 : 0
        };
      });
      const totalGeneralBarriosSinServicio = serviceCoverageRows.reduce(
        (total, service) => total + Number(service.barriosSinServicio || 0),
        0
      );
      const coreServiceFields = ["agua", "alcantarillado", "barrido", "recoleccion"];
      const barriosConTodosServicios = aguasServiceReportData.barrios.filter(
        (barrio) =>
          Number(barrio.total_registros || 0) > 0 &&
          coreServiceFields.every((field) => getBarrioServiceActive(barrio, field) > 0)
      ).length;
      const barriosSinServicios = aguasServiceReportData.barrios.filter(
        (barrio) =>
          Number(barrio.total_registros || 0) > 0 &&
          coreServiceFields.every((field) => getBarrioServiceActive(barrio, field) === 0)
      ).length;
      const barriosCoberturaParcial = Math.max(0, totalBarrios - barriosConTodosServicios - barriosSinServicios);
      const totalGeneralBarriosEvaluados = barriosConTodosServicios + barriosCoberturaParcial + barriosSinServicios;
      const addFooter = () => {
        const pageNumber = document.getCurrentPageInfo().pageNumber;
        document.setFont("helvetica", "normal");
        document.setFontSize(8);
        document.setTextColor(95, 116, 138);
        document.text(`Aguas de Choluteca - informe de servicios - pag. ${pageNumber}`, 14, pageHeight - 8);
      };

      document.setFillColor(10, 65, 112);
      document.rect(0, 0, pageWidth, 24, "F");
      document.setTextColor(255, 255, 255);
      document.setFont("helvetica", "bold");
      document.setFontSize(15);
      document.text("Informe de servicios del padron maestro", 14, 14);
      document.setFont("helvetica", "normal");
      document.setFontSize(9);
      document.text(`Generado: ${generatedAt}`, pageWidth - 14, 14, { align: "right" });

      document.setTextColor(22, 54, 82);
      document.setFont("helvetica", "normal");
      document.setFontSize(9);
      document.text(`Fuente: ${sourceName}`, 14, 32);
      document.text(`Actualizacion fuente: ${sourceUpdated}`, 14, 38);
      document.text(`Registros: ${formatPdfInteger(aguasServiceReportData.totalRecords)}`, 150, 32);
      document.text(`Barrios: ${formatPdfInteger(totalBarrios)}`, 150, 38);

      const summaryCards = [
        ["Total barrios Choluteca", formatPdfInteger(totalBarrios), "Barrios o sectores registrados en el padron maestro."],
        ["Total padron", formatPdfInteger(aguasServiceReportData.totalRecords), "Usuarios registrados en el padron activo."],
        ["Sin servicios base", formatPdfInteger(noCoreServices), "Usuarios sin agua, alcantarillado, barrido ni recoleccion activos."],
        ["Deuda total", formatPdfCurrency(aguasServiceReportData.deuda.total), `${formatPdfInteger(aguasServiceReportData.deuda.deudores)} cuentas con deuda.`]
      ];

      summaryCards.forEach((card, index) => {
        const cardWidth = (pageWidth - 34) / 4;
        const x = 14 + index * (cardWidth + 2);
        document.setDrawColor(196, 220, 242);
        document.setFillColor(244, 249, 253);
        document.roundedRect(x, 46, cardWidth, 25, 2.6, 2.6, "FD");
        document.setFont("helvetica", "normal");
        document.setFontSize(7.5);
        document.setTextColor(74, 96, 120);
        document.text(card[0], x + 3, 53);
        document.setFont("helvetica", "bold");
        document.setFontSize(14);
        document.setTextColor(10, 65, 112);
        document.text(card[1], x + 3, 61);
        document.setFont("helvetica", "normal");
        document.setFontSize(6.8);
        document.setTextColor(74, 96, 120);
        document.text(document.splitTextToSize(card[2], cardWidth - 6), x + 3, 67);
      });

      const greenCards = [
        [
          "Barrios con todos los servicios",
          formatPdfInteger(barriosConTodosServicios),
          "Agua, alcantarillado, barrido y recoleccion con actividad en el barrio."
        ],
        [
          "Barrios con cobertura parcial",
          formatPdfInteger(barriosCoberturaParcial),
          "Tienen al menos un servicio base activo, pero no todos."
        ],
        [
          "Barrios sin servicios",
          formatPdfInteger(barriosSinServicios),
          "Sin actividad registrada en agua, alcantarillado, barrido ni recoleccion."
        ]
      ];

      greenCards.forEach((card, index) => {
        const cardWidth = (pageWidth - 34) / 3;
        const x = 14 + index * (cardWidth + 3);
        document.setDrawColor(39, 145, 88);
        document.setFillColor(232, 248, 239);
        document.roundedRect(x, 76, cardWidth, 24, 3, 3, "FD");
        document.setFont("helvetica", "normal");
        document.setFontSize(8);
        document.setTextColor(31, 108, 67);
        document.text(card[0], x + 4, 83);
        document.setFont("helvetica", "bold");
        document.setFontSize(14);
        document.text(card[1], x + 4, 91);
        document.setFont("helvetica", "normal");
        document.setFontSize(7);
        document.text(document.splitTextToSize(card[2], cardWidth - 38), x + 26, 89);
      });

      document.setDrawColor(27, 128, 78);
      document.setFillColor(218, 245, 230);
      document.roundedRect(14, 103, pageWidth - 28, 13, 3, 3, "FD");
      document.setFont("helvetica", "bold");
      document.setFontSize(9);
      document.setTextColor(25, 102, 64);
      document.text("Total general de barrios evaluados", 18, 111);
      document.setFontSize(13);
      document.text(formatPdfInteger(totalGeneralBarriosEvaluados), pageWidth - 18, 111, { align: "right" });
      document.setFont("helvetica", "normal");
      document.setFontSize(7.5);
      document.text(
        `${formatPdfInteger(barriosConTodosServicios)} con todos + ${formatPdfInteger(barriosCoberturaParcial)} parciales + ${formatPdfInteger(barriosSinServicios)} sin servicios = ${formatPdfInteger(totalGeneralBarriosEvaluados)}`,
        82,
        111
      );

      document.setFont("helvetica", "bold");
      document.setFontSize(10);
      document.setTextColor(10, 65, 112);
      document.text("Lectura general", 14, 125);
      document.setFont("helvetica", "normal");
      document.setFontSize(8.5);
      document.setTextColor(22, 54, 82);
      const insights = [
        topService
          ? `Servicio con mayor cobertura: ${topService.label} con ${formatPdfInteger(topService.active)} activos (${formatPdfPercent(topService.percentage)}).`
          : "No hay servicios calculados para el padron.",
        weakestService
          ? `Servicio con menor cobertura: ${weakestService.label} con ${formatPdfInteger(weakestService.active)} activos (${formatPdfPercent(weakestService.percentage)}).`
          : "",
        `Total de barrios de la ciudad de Choluteca en el padron: ${formatPdfInteger(totalBarrios)}.`,
        `Clasificacion territorial: ${formatPdfInteger(barriosConTodosServicios)} con todos los servicios, ${formatPdfInteger(barriosCoberturaParcial)} con cobertura parcial y ${formatPdfInteger(barriosSinServicios)} sin servicios.`,
        `Total general de barrios evaluados: ${formatPdfInteger(totalGeneralBarriosEvaluados)}.`,
        `Total general de incidencias de barrios sin servicio: ${formatPdfInteger(totalGeneralBarriosSinServicio)}.`,
        `Casos con agua sin alcantarillado: ${formatPdfInteger(waterWithoutSewer)}. Casos con alcantarillado sin agua: ${formatPdfInteger(sewerWithoutWater)}.`,
        `El desglose por barrio inicia en la pagina siguiente para mantener esta hoja como resumen de totales.`
      ].filter(Boolean);
      insights.forEach((line, index) => document.text(`- ${line}`, 16, 132 + index * 5));

      autoTable(document, {
        startY: 164,
        head: [["Servicio", "Barrios sin servicio", "Barrios con servicio", "% barrios con servicio", "Usuarios activos", "Deuda asociada"]],
        body: serviceCoverageRows.map((service) => [
          service.label,
          formatPdfInteger(service.barriosSinServicio),
          formatPdfInteger(service.barriosConServicio),
          formatPdfPercent(service.barrioCoverage),
          formatPdfInteger(service.active),
          formatPdfCurrency(service.deuda?.total),
        ]),
        theme: "grid",
        styles: { fontSize: 8.8, cellPadding: 2.6, textColor: [24, 55, 82] },
        headStyles: { fillColor: [18, 93, 160], textColor: 255 },
        margin: { left: 14, right: 14 }
      });

      autoTable(document, {
        startY: (document.lastAutoTable?.finalY ?? 145) + 8,
        head: [["Perfil operativo", "Registros", "% del padron"]],
        body: [
          ["Todos los servicios base", formatPdfInteger(allCoreServices), formatPdfPercent((allCoreServices / aguasServiceReportData.totalRecords) * 100)],
          ["Sin servicios base", formatPdfInteger(noCoreServices), formatPdfPercent((noCoreServices / aguasServiceReportData.totalRecords) * 100)],
          ["Agua sin alcantarillado", formatPdfInteger(waterWithoutSewer), formatPdfPercent((waterWithoutSewer / aguasServiceReportData.totalRecords) * 100)],
          ["Alcantarillado sin agua", formatPdfInteger(sewerWithoutWater), formatPdfPercent((sewerWithoutWater / aguasServiceReportData.totalRecords) * 100)]
        ],
        theme: "striped",
        styles: { fontSize: 8.5, cellPadding: 2.4, textColor: [23, 52, 78] },
        headStyles: { fillColor: [10, 65, 112], textColor: 255 },
        alternateRowStyles: { fillColor: [244, 248, 252] },
        margin: { left: 14, right: 14 }
      });

      addFooter();
      document.addPage("letter", "landscape");
      document.setTextColor(10, 65, 112);
      document.setFont("helvetica", "bold");
      document.setFontSize(14);
      document.text("Desglose de servicios por barrio", 14, 16);
      document.setFont("helvetica", "normal");
      document.setFontSize(8.5);
      document.setTextColor(74, 96, 120);
      document.text(
        `Registros: ${formatPdfInteger(aguasServiceReportData.totalRecords)} | Barrios: ${formatPdfInteger(totalBarrios)} | Fuente: ${sourceName}`,
        14,
        23
      );

      autoTable(document, {
        startY: 30,
        head: [["Barrio", "Total", "Agua", "Alcantarillado", "Barrido", "Desechos / tren", "Desechos peligrosos"]],
        body: aguasServiceReportData.barrios.map((barrio) => {
          const services = Array.isArray(barrio.servicios) ? barrio.servicios : [];
          const getActive = (field) => Number(services.find((service) => service.field === field)?.active || 0);
          return [
            barrio.barrio_colonia || "Sin barrio",
            formatPdfInteger(barrio.total_registros),
            formatPdfInteger(getActive("agua")),
            formatPdfInteger(getActive("alcantarillado")),
            formatPdfInteger(getActive("barrido")),
            formatPdfInteger(getActive("recoleccion")),
            formatPdfInteger(getActive("desechos_peligrosos"))
          ];
        }),
        theme: "striped",
        styles: { fontSize: 7.2, cellPadding: 1.8, textColor: [23, 52, 78], overflow: "linebreak" },
        headStyles: { fillColor: [21, 118, 209], textColor: 255 },
        alternateRowStyles: { fillColor: [244, 248, 252] },
        margin: { left: 14, right: 14 },
        didDrawPage: addFooter
      });

      document.addPage("letter", "landscape");
      document.setTextColor(10, 65, 112);
      document.setFont("helvetica", "bold");
      document.setFontSize(14);
      document.text("Totales de deuda por barrio y servicio", 14, 16);
      document.setFont("helvetica", "normal");
      document.setFontSize(8);
      document.setTextColor(74, 96, 120);
      document.text(
        "La deuda por servicio corresponde a cuentas con ese servicio activo; una cuenta puede sumar en varios servicios.",
        14,
        23
      );

      autoTable(document, {
        startY: 30,
        head: [["Barrio", "Capital", "Intereses", "Total", "Agua", "Alcantarillado", "Barrido", "Recoleccion", "Peligrosos"]],
        body: aguasServiceReportData.barrios.map((barrio) => {
          const services = Array.isArray(barrio.servicios) ? barrio.servicios : [];
          const serviceDebt = (field) => services.find((service) => service.field === field)?.deuda?.total || 0;
          return [
            barrio.barrio_colonia || "Sin barrio",
            formatPdfCurrency(barrio.deuda?.capital),
            formatPdfCurrency(barrio.deuda?.intereses),
            formatPdfCurrency(barrio.deuda?.total),
            formatPdfCurrency(serviceDebt("agua")),
            formatPdfCurrency(serviceDebt("alcantarillado")),
            formatPdfCurrency(serviceDebt("barrido")),
            formatPdfCurrency(serviceDebt("recoleccion")),
            formatPdfCurrency(serviceDebt("desechos_peligrosos"))
          ];
        }),
        theme: "grid",
        styles: { fontSize: 6.3, cellPadding: 1.5, textColor: [23, 52, 78], overflow: "linebreak" },
        headStyles: { fillColor: [12, 112, 95], textColor: 255 },
        alternateRowStyles: { fillColor: [241, 250, 247] },
        margin: { left: 10, right: 10 },
        didDrawPage: addFooter
      });

      saveReportPdf(document, `informe-servicios-padron-${new Date().toISOString().slice(0, 10)}.pdf`);
      showAlert("Informe de servicios descargado en PDF.");
    } catch (error) {
      showAlert(error.message || "No fue posible descargar el informe de servicios.");
    } finally {
      setDownloadingAguasServicePdf(false);
    }
  };

  const handleDownloadPadronStatsPdf = async () => {
    if (!alcaldiaComparison?.summary || !padronStatisticsData.dynamicRows.length) {
      showAlert("Genera primero los graficos para guardar el reporte en PDF.");
      return;
    }

    try {
      setDownloadingPadronStatsPdf(true);
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableModule.default;
      const document = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "letter"
      });
      const pageWidth = document.internal.pageSize.getWidth();
      const pageHeight = document.internal.pageSize.getHeight();
      const generatedAt = formatDateTime(new Date().toISOString());
      const modeLabels = {
        brecha: "Brecha por barrio",
        cobertura_alta: "Barrios con mas cobertura",
        cobertura_baja: "Barrios con menos cobertura",
        servicio_dominante: "Servicio mayoritario por barrio",
        comparativa: `Comparativa por ${padronStatisticsData.metricLabels?.[padronStatsSortMetric] || "metrica"}`,
        servicios: "Division por servicios"
      };
      const summary = alcaldiaComparison.summary;
      const addFooter = () => {
        const pageHeight = document.internal.pageSize.getHeight();
        const pageNumber = document.getCurrentPageInfo().pageNumber;
        document.setFontSize(8);
        document.setTextColor(95, 116, 138);
        document.text(`Aguas de Choluteca - reporte estadistico - pag. ${pageNumber}`, 14, pageHeight - 8);
      };
      const chartRows = padronStatisticsData.dynamicRows.map((item) => ({
        label: String(item.barrio_colonia || ""),
        detail: String(item.detail || ""),
        value: Number(item.value || 0),
        formattedValue:
          padronChartMode.includes("cobertura") || (padronChartMode === "servicios" && selectedPadronServiceField)
            ? `${Number(item.value || 0)}%`
            : String(item.value ?? 0)
      }));
      const chartMaxValue =
        padronChartMode.includes("cobertura") || (padronChartMode === "servicios" && selectedPadronServiceField)
          ? 100
          : Math.max(1, ...chartRows.map((item) => item.value));
      const drawChartRows = (startY) => {
        const left = 14;
        const right = pageWidth - 14;
        const chartWidth = right - left;
        const rowHeight = 16;
        const barHeight = 4.2;
        let y = startY;

        document.setFont("helvetica", "bold");
        document.setFontSize(12);
        document.setTextColor(18, 59, 93);
        document.text("Grafico", left, y);
        y += 7;

        chartRows.forEach((row, index) => {
          if (y + rowHeight > pageHeight - 16) {
            addFooter();
            document.addPage("letter", "landscape");
            y = 18;
            document.setFont("helvetica", "bold");
            document.setFontSize(12);
            document.setTextColor(18, 59, 93);
            document.text("Grafico (continuacion)", left, y);
            y += 7;
          }

          const barWidth = Math.max(2, Math.min(chartWidth, (row.value / chartMaxValue) * chartWidth));
          document.setFillColor(index % 2 === 0 ? 248 : 255, 251, 255);
          document.roundedRect(left - 1, y - 5, chartWidth + 2, rowHeight, 2.6, 2.6, "F");
          document.setFont("helvetica", "bold");
          document.setFontSize(9.2);
          document.setTextColor(18, 59, 93);
          document.text(document.splitTextToSize(row.label, 120)[0], left, y);
          document.setFont("helvetica", "bold");
          document.setFontSize(8.8);
          document.setTextColor(6, 92, 144);
          document.text(row.formattedValue, right, y, { align: "right" });
          document.setFont("helvetica", "normal");
          document.setFontSize(7.5);
          document.setTextColor(82, 112, 140);
          document.text(document.splitTextToSize(row.detail, 190)[0], left, y + 4.3);
          document.setFillColor(226, 240, 253);
          document.roundedRect(left, y + 7.2, chartWidth, barHeight, 1.8, 1.8, "F");
          document.setFillColor(22, 112, 217);
          document.roundedRect(left, y + 7.2, barWidth, barHeight, 1.8, 1.8, "F");
          document.setFillColor(38, 194, 213);
          document.roundedRect(left + Math.max(0, barWidth - 8), y + 7.2, Math.min(8, barWidth), barHeight, 1.8, 1.8, "F");
          y += rowHeight + 2;
        });

        return y;
      };

      document.setFillColor(10, 65, 112);
      document.rect(0, 0, pageWidth, 22, "F");
      document.setTextColor(255, 255, 255);
      document.setFont("helvetica", "bold");
      document.setFontSize(15);
      document.text("Reporte estadistico de padrones", 14, 14);
      document.setFont("helvetica", "normal");
      document.setFontSize(9);
      document.text(`Generado: ${generatedAt}`, pageWidth - 14, 14, { align: "right" });

      document.setTextColor(22, 54, 82);
      document.setFont("helvetica", "bold");
      document.setFontSize(11);
      document.text(`Grafico activo: ${modeLabels[padronChartMode] || "Analisis por barrio"}`, 14, 32);

      autoTable(document, {
        startY: 38,
        head: [["Aguas", "Alcaldia", "No aparecen en Aguas", "Coincidencias"]],
        body: [[
          summary.aguas_records ?? padronMeta?.total_records ?? 0,
          summary.alcaldia_records ?? alcaldiaMeta?.total_records ?? 0,
          summary.candidate_clandestine ?? 0,
          Number(summary.exact_matches ?? 0) + Number(summary.base_matches ?? 0)
        ]],
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 3, halign: "center", textColor: [24, 55, 82] },
        headStyles: { fillColor: [18, 93, 160], textColor: 255 },
        margin: { left: 14, right: 14 }
      });

      drawChartRows((document.lastAutoTable?.finalY ?? 58) + 8);

      if (padronStatisticsData.selectedBarrio) {
        document.addPage("letter", "landscape");
        const barrio = padronStatisticsData.selectedBarrio;
        document.setTextColor(22, 54, 82);
        document.setFont("helvetica", "bold");
        document.setFontSize(13);
        document.text(`Detalle del barrio: ${barrio.barrio_colonia}`, 14, 18);

        autoTable(document, {
          startY: 26,
          head: [["Claves Alcaldia", "En Aguas", "Cobertura", "Brecha", "Servicio mayoritario"]],
          body: [[
            barrio.alcaldia_total ?? 0,
            barrio.aguas_registradas ?? 0,
            `${barrio.cobertura_aguas_pct ?? 0}%`,
            barrio.brecha_registros ?? 0,
            barrio.servicio_dominante || "Sin servicio dominante"
          ]],
          theme: "grid",
          styles: { fontSize: 9, cellPadding: 3, halign: "center", textColor: [24, 55, 82] },
          headStyles: { fillColor: [18, 93, 160], textColor: 255 },
          margin: { left: 14, right: 14 }
        });

        autoTable(document, {
          startY: (document.lastAutoTable?.finalY ?? 46) + 8,
          head: [["Servicio", "Usuarios"]],
          body: Object.entries(padronStatisticsData.serviceLabels).map(([field, label]) => [
            label,
            Number(barrio.servicios?.[field] || 0)
          ]),
          theme: "striped",
          styles: { fontSize: 9, cellPadding: 3, textColor: [24, 55, 82] },
          headStyles: { fillColor: [226, 240, 253], textColor: [11, 61, 104] },
          margin: { left: 14, right: 14 },
          didDrawPage: addFooter
        });
      }

      addFooter();
      saveReportPdf(document, `reporte-estadistico-padrones-${new Date().toISOString().slice(0, 10)}.pdf`);
      showAlert("Reporte estadistico guardado en PDF.");
    } catch (error) {
      showAlert(error.message || "No fue posible guardar el reporte estadistico en PDF.");
    } finally {
      setDownloadingPadronStatsPdf(false);
    }
  };

  const handlePrintAguasComparisonList = async (recordsToPrint = overdueComparisonRecords) => {
    const rows = recordsToPrint.filter(Boolean);
    if (!rows.length) {
      showAlert("No hay fichas vencidas para comparar e imprimir.");
      return;
    }

    setPrintingComparison(true);
    try {
      let comparisonByClave = alcaldiaComparisonByClave;
      if (!alcaldiaComparison?.summary) {
        const comparisonData = await loadAlcaldiaComparison({ silent: true }).catch(() => null);
        const comparisonRows = [
          ...(comparisonData?.candidates || []),
          ...(comparisonData?.matched_by_base || []),
          ...(comparisonData?.matched_exact || [])
        ];
        if (comparisonRows.length) {
          comparisonByClave = comparisonRows.reduce((map, row) => {
            [row.clave_catastral, row.clave_aguas_formato].forEach((key) => {
              const cleanKey = String(key || "").trim();
              if (cleanKey && !map.has(cleanKey)) {
                map.set(cleanKey, row);
              }
            });
            return map;
          }, new Map());
        }
      }

      const generatedAt = formatDashboardSyncDate(Date.now());
      const headerKicker = String(printComparisonHeader.kicker || "").trim() || "Lista de fichas vencidas";
      const headerTitle = String(printComparisonHeader.title || "").trim() || "Comparacion contra Aguas";
      const headerNote = String(printComparisonHeader.note || "").trim();
      setShowPrintComparisonModal(false);
      const printResult = await printDocument(
        `${headerTitle} (${rows.length})`,
        `
        <style>
          .comparison-print-body {
            margin: 0;
            color: #111827;
            font-family: Arial, sans-serif;
            background: #fff;
          }
          .comparison-print-sheet {
            display: grid;
            gap: 9px;
            padding: 2px;
          }
          .comparison-print-head {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 10px;
            align-items: start;
            border: 1px solid #bfdbfe;
            border-left: 6px solid #1d4ed8;
            border-radius: 10px;
            background: #eff6ff;
            padding: 10px 12px;
          }
          .comparison-print-head span {
            display: block;
            color: #1d4ed8;
            font-size: 8px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          .comparison-print-head h1 {
            margin: 2px 0 3px;
            color: #0f172a;
            font-size: 18px;
            line-height: 1.1;
          }
          .comparison-print-head p {
            margin: 0;
            color: #475569;
            font-size: 10px;
          }
          .comparison-print-count {
            align-self: center;
            border-radius: 999px;
            background: #1d4ed8;
            color: #fff;
            padding: 5px 9px;
            font-size: 11px;
            white-space: nowrap;
          }
          .comparison-print-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          .comparison-print-table th,
          .comparison-print-table td {
            border: 1px solid #cbd5e1;
            padding: 5px 6px;
            text-align: left;
            vertical-align: top;
            font-size: 10px;
            line-height: 1.25;
            word-break: break-word;
          }
          .comparison-print-table th {
            background: #dbeafe;
            color: #1e3a8a;
            font-size: 8px;
            letter-spacing: 0.05em;
            text-transform: uppercase;
          }
          .comparison-print-table tr:nth-child(even) td {
            background: #f8fafc;
          }
          .comparison-print-table .is-missing {
            color: #b91c1c;
            font-weight: 700;
          }
          .comparison-print-table .is-found {
            color: #166534;
            font-weight: 700;
          }
          .comparison-print-status {
            display: inline-block;
            border-radius: 999px;
            background: #fee2e2;
            color: #b91c1c;
            font-size: 9px;
            font-weight: 700;
            line-height: 1;
            padding: 4px 7px;
            white-space: nowrap;
          }
        </style>
        <section class="comparison-print-sheet">
          <header class="comparison-print-head">
            <div>
              <span>${escapeHtml(headerKicker)}</span>
              <h1>${escapeHtml(headerTitle)}</h1>
              <p>${escapeHtml(headerNote ? `${headerNote} | Generado: ${generatedAt}` : `Generado: ${generatedAt}`)}</p>
            </div>
            <strong class="comparison-print-count">${rows.length} fichas</strong>
          </header>
          <table class="comparison-print-table">
            <thead>
              <tr>
                <th>Clave catastral</th>
                <th>Nombre</th>
                <th>Barrio</th>
                <th>Fecha ficha</th>
                <th>Estado</th>
                <th>Aguas</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map((record) => {
                  const alcaldiaMatch = comparisonByClave.get(String(record.clave_catastral || "").trim()) || null;
                  const aguasLabel = getRecordAguasPresenceLabel(record);
                  const aguasClass = aguasLabel === "Si aparece en Aguas" ? "is-found" : "is-missing";
                  return `
                    <tr>
                      <td>${escapeHtml(record.clave_catastral || "--")}</td>
                      <td>${escapeHtml(getRecordDisplayName(record, alcaldiaMatch))}</td>
                      <td>${escapeHtml(getRecordBarrioName(record, "") || record.barrio_alcaldia || alcaldiaMatch?.caserio || alcaldiaMatch?.direccion || "--")}</td>
                      <td>${escapeHtml(getRecordFichaDateLabel(record))}</td>
                      <td><span class="comparison-print-status">Vencida</span></td>
                      <td class="${aguasClass}">${escapeHtml(aguasLabel)}</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </section>
      `,
      {
        bodyClassName: "comparison-print-body",
        pageSize: "Letter portrait",
        pageMargin: "10mm",
        windowFeatures: "width=980,height=1200"
      }
      );
      if (!printResult?.printed) {
        showAlert("Vista previa cerrada. La lista comparativa no se marco como impresa.");
        return;
      }

      const movedCount = await markBatchFichaRecordsAsPrinted(rows.map((record) => ({ record, ficha: 1, aviso: 0 })));
      showAlert(
        movedCount
          ? `Lista comparativa impresa. ${movedCount} fichas salieron de alertas y pasaron a impresas.`
          : "Lista comparativa impresa."
      );
    } catch (error) {
      showAlert(error.message || "No fue posible preparar la lista comparativa.");
    } finally {
      setPrintingComparison(false);
    }
  };

  return {
    handlePrintPadronRequest,
    handleDownloadPadronRequestPdf,
    handlePrintAguasServiceReport,
    handleDownloadAguasServicePdf,
    handleDownloadPadronStatsPdf,
    handlePrintAguasComparisonList
  };
}
