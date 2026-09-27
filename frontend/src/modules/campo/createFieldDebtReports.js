import { buildFieldDebtPointRows, buildFieldDebtServicesMarkup, getFieldDebtResultLabel } from "../../utils/fieldDebt";
import { buildPadronNameIndex, buildReportDebtRows, buildSharedCadastralKeys } from "../reports/utils/reportSelectors";
import { escapeHtml } from "../../utils/html";
import { formatCurrency } from "../../utils/formatting";
import { formatDateTime, formatMapDiaryLabel } from "../../utils/datesAndBusiness";
import logoAguasCholuteca from "../../assets/logo-aguas-choluteca.png";
import { printDocument, saveReportPdf } from "../../utils/printDocument";

export function createFieldDebtReports({
  activeMapDiaryDateKey,
  apiFetch,
  fieldDebtChartData,
  fieldDebtReport,
  fieldDebtSummary,
  padronMeta,
  setFieldDebtReport,
  setLoadingFieldDebtReport,
  setShowFieldDebtModal,
  showAlert,
  visibleMapPoints
}) {
  const buildFieldDebtReport = async (points = visibleMapPoints) => {
    const pointRows = buildFieldDebtPointRows(points);
    const referencesByKey = new Map();
    pointRows.forEach((row) => {
      row.references.forEach((reference) => {
        if (!referencesByKey.has(reference.key)) {
          referencesByKey.set(reference.key, reference);
        }
      });
    });
    const keys = Array.from(referencesByKey.keys());
    const keyCounts = pointRows.reduce((accumulator, row) => {
      row.keys.forEach((key) => {
        accumulator[key] = (accumulator[key] || 0) + 1;
      });
      return accumulator;
    }, {});

    if (!keys.length) {
      return {
        generatedAt: new Date().toISOString(),
        dateKey: activeMapDiaryDateKey,
        pointRows,
        keyCounts,
        keys,
        results: []
      };
    }

    const results = await Promise.all(
      keys.map(async (key) => {
        const reference = referencesByKey.get(key) || { field: "clave", value: key, label: key };
        try {
          const response = await apiFetch(
            `/claves/search?clave=${encodeURIComponent(reference.value)}&field=${encodeURIComponent(reference.field)}&_padron=${encodeURIComponent(padronMeta?.updated_at || Date.now())}`
          );
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || "No fue posible consultar la clave.");
          }

          return {
            key,
            field: reference.field,
            label: reference.label,
            query: reference.value,
            exists: Boolean(data.exists),
            total_matches: Number(data.total_matches || 0),
            matches: Array.isArray(data.matches) ? data.matches : [],
            error: ""
          };
        } catch (error) {
          return {
            key,
            field: reference.field,
            label: reference.label,
            query: reference.value,
            exists: false,
            total_matches: 0,
            matches: [],
            error: error.message || "No fue posible consultar la clave."
          };
        }
      })
    );

    return {
      generatedAt: new Date().toISOString(),
      dateKey: activeMapDiaryDateKey,
      pointRows,
      keyCounts,
      keys,
      results
    };
  };

  const buildMapReportPadronData = async (reportData) => {
    const points = reportData?.zones?.flatMap((zone) => zone.items || []);
    const results = (await buildFieldDebtReport(points)).results;
    return {
      padronNames: buildPadronNameIndex(results),
      sharedKeys: buildSharedCadastralKeys(results),
      debtRows: buildReportDebtRows(results)
    };
  };

  const handleVerifyFieldDebt = async () => {
    setLoadingFieldDebtReport(true);
    setShowFieldDebtModal(true);

    try {
      const report = await buildFieldDebtReport();
      setFieldDebtReport(report);
      showAlert(
        report.keys.length
          ? `Verificacion lista: ${report.keys.length} referencias extraidas de la jornada.`
          : "No encontre claves o abonados en las referencias de esta jornada."
      );
    } catch (error) {
      showAlert(error.message || "No fue posible verificar la deuda de la jornada.");
    } finally {
      setLoadingFieldDebtReport(false);
    }
  };

  const buildFieldDebtPrintMarkup = () => {
    const results = fieldDebtReport?.results ?? [];
    const rowsMarkup = results
      .map((result) => {
        const matches = result.matches?.length ? result.matches : [null];
        return matches
          .map((match, matchIndex) => `
            <tr class="${result.exists ? "" : "is-red-report-point"}">
              <td class="field-debt-key-cell">${matchIndex === 0 ? escapeHtml(getFieldDebtResultLabel(result)) : ""}</td>
              <td class="field-debt-account-cell">${matchIndex === 0 ? Number(fieldDebtReport?.keyCounts?.[result.key] || 0) : ""}</td>
              <td class="field-debt-account-cell">${match ? escapeHtml(match.abonado || "--") : "--"}</td>
              <td>${match ? escapeHtml(match.inquilino || match.nombre || "--") : result.error ? escapeHtml(result.error) : "No aparece en el padrón"}</td>
              <td>${match ? escapeHtml(match.barrio_colonia || "--") : "--"}</td>
              <td class="field-debt-money-cell">${match ? escapeHtml(formatCurrency(Number(match.valor || 0))) : "--"}</td>
              <td class="field-debt-money-cell">${match ? escapeHtml(formatCurrency(Number(match.intereses || 0))) : "--"}</td>
              <td class="field-debt-money-cell is-total">${match ? escapeHtml(formatCurrency(Number(match.total || 0))) : "--"}</td>
              <td class="field-debt-services-cell">${match ? buildFieldDebtServicesMarkup(match) : "--"}</td>
            </tr>
          `)
          .join("");
      })
      .join("");

    return `
      <div class="field-report-shell field-debt-print-shell">
        <header class="field-report-header">
          <div class="field-report-brand">
            <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" />
            <div>
              <p class="field-report-kicker">Verificación de deuda por reporte GPS</p>
              <h1>Jornada ${escapeHtml(formatMapDiaryLabel(fieldDebtReport?.dateKey || activeMapDiaryDateKey))}</h1>
              <p>Claves o abonados extraidos de referencias escritas por el equipo tecnico en campo.</p>
            </div>
          </div>
          <div class="field-report-meta">
            <span>Generado: ${formatDateTime(fieldDebtReport?.generatedAt || new Date().toISOString())}</span>
            <span>Referencias unicas: ${fieldDebtSummary.totalKeys}</span>
            <span>Encontradas: ${fieldDebtSummary.foundKeys}</span>
            <span class="field-debt-meta-money">Deuda total: ${formatCurrency(fieldDebtSummary.totalDebt)} lempiras</span>
          </div>
        </header>
        <section class="field-debt-summary-panel">
          <span class="field-report-kicker">Resumen compacto</span>
          <h2>Totales de zona censada</h2>
          <div class="field-debt-metrics">
            <div><strong>Puntos con referencia</strong><span>${fieldDebtSummary.totalPoints}</span></div>
            <div><strong>Cuentas encontradas</strong><span>${fieldDebtSummary.accounts}</span></div>
            <div class="is-money"><strong>Deuda total</strong><span>${formatCurrency(fieldDebtSummary.totalDebt)} lempiras</span></div>
          </div>
        </section>
        <section class="field-report-zone field-debt-results-section">
          <div class="field-report-zone-head">
            <div>
              <span class="field-report-zone-kicker">Consulta al padrón</span>
              <h3>Resultado por referencia extraida</h3>
            </div>
          </div>
          <table class="field-report-table field-debt-print-table">
            <thead>
              <tr>
                <th>Referencia</th>
                <th>Reportes</th>
                <th>Abonado</th>
                <th>Nombre</th>
                <th>Barrio</th>
                <th>Valor</th>
                <th>Intereses</th>
                <th>Total</th>
                <th>Servicios</th>
              </tr>
            </thead>
            <tbody>${rowsMarkup || '<tr><td colspan="9">No se extrajeron claves ni abonados de la jornada.</td></tr>'}</tbody>
          </table>
        </section>
        <section class="field-debt-signature">
          <div>
            <strong>Ing. Juan Ordóñez Bonilla</strong>
            <span>Departamento de Catastro</span>
          </div>
          <div class="field-debt-stamp-space">
            Firma
          </div>
        </section>
      </div>
    `;
  };

  const handlePrintFieldDebtReport = async () => {
    if (!fieldDebtReport) {
      showAlert("Primero ejecuta la verificación de deuda.");
      return;
    }

    await printDocument(
      "Verificación de deuda GPS",
      buildFieldDebtPrintMarkup(),
      {
        pageSize: "Letter landscape",
        pageMargin: "8mm",
        bodyClassName: "field-report-body",
        showPageFooter: true
      }
    );
  };

  const buildFieldDebtChartPrintMarkup = () => {
    const topRows = fieldDebtChartData.topRows.length ? fieldDebtChartData.topRows : fieldDebtChartData.debtRows.slice(0, 8);
    const maxDebt = fieldDebtChartData.maxDebt || Math.max(1, ...topRows.map((row) => Number(row.total || 0)));
    const barsMarkup = topRows
      .map((row) => {
        const percent = Math.max(3, Math.min(100, (Number(row.total || 0) / maxDebt) * 100));
        return `
          <article class="field-debt-chart-bar">
            <div>
              <strong>${escapeHtml(row.key)}</strong>
              <span>${escapeHtml(row.nombre || "--")} - ${escapeHtml(row.barrio || "--")}</span>
            </div>
            <b>${escapeHtml(formatCurrency(row.total))}</b>
            <svg class="field-debt-chart-svg" viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(row.key)} ${escapeHtml(formatCurrency(row.total))}">
              <rect x="0" y="0" width="100" height="10" rx="5" fill="#e8eef5"></rect>
              <rect x="0" y="0" width="${percent.toFixed(2)}" height="10" rx="5" fill="#0d6fb8"></rect>
            </svg>
          </article>
        `;
      })
      .join("");
    const detailRowsMarkup = fieldDebtChartData.debtRows
      .slice(0, 12)
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.key)}</td>
            <td>${escapeHtml(row.abonado)}</td>
            <td>${escapeHtml(row.nombre)}</td>
            <td>${escapeHtml(row.barrio)}</td>
            <td>${escapeHtml(formatCurrency(row.valor))}</td>
            <td>${escapeHtml(formatCurrency(row.intereses))}</td>
            <td class="is-total">${escapeHtml(formatCurrency(row.total))}</td>
          </tr>
        `
      )
      .join("");

    return `
      <div class="field-report-shell field-debt-print-shell field-debt-chart-print-shell">
        <header class="field-report-header">
          <div class="field-report-brand">
            <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" />
            <div>
              <p class="field-report-kicker">Analitica de mora</p>
              <h1>Mora por referencia del reporte</h1>
              <p>Jornada ${escapeHtml(formatMapDiaryLabel(fieldDebtReport?.dateKey || activeMapDiaryDateKey))}</p>
            </div>
          </div>
          <div class="field-report-meta">
            <span>Generado: ${formatDateTime(fieldDebtReport?.generatedAt || new Date().toISOString())}</span>
            <span>Referencias verificadas: ${fieldDebtSummary.totalKeys}</span>
            <span>Sin coincidencia: ${fieldDebtChartData.missingRows.length}</span>
            <span class="field-debt-meta-money">Mora total: ${formatCurrency(fieldDebtChartData.totalDebt)}</span>
          </div>
        </header>
        <section class="field-debt-chart-kpis">
          <div><span>Referencias verificadas</span><strong>${fieldDebtSummary.totalKeys}</strong></div>
          <div><span>Mora total</span><strong>${formatCurrency(fieldDebtChartData.totalDebt)}</strong></div>
          <div><span>Con mora critica</span><strong>${fieldDebtChartData.criticalRows.length}</strong></div>
          <div><span>Sin coincidencia</span><strong>${fieldDebtChartData.missingRows.length}</strong></div>
        </section>
        <section class="field-debt-chart-print-grid">
          <div class="field-debt-chart-card">
            <h2>Grafico por referencia</h2>
            <div class="field-debt-chart-bars">${barsMarkup || '<p>No hay mora para graficar.</p>'}</div>
          </div>
          <div class="field-debt-chart-card">
            <h2>Detalle ejecutivo</h2>
            <table class="field-report-table field-debt-chart-table">
              <thead>
                <tr>
                  <th>Clave</th>
                  <th>Abonado</th>
                  <th>Nombre</th>
                  <th>Barrio</th>
                  <th>Valor</th>
                  <th>Intereses</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>${detailRowsMarkup || '<tr><td colspan="7">No hay cuentas encontradas.</td></tr>'}</tbody>
            </table>
          </div>
        </section>
      </div>
    `;
  };

  const handlePrintFieldDebtChart = async () => {
    if (!fieldDebtReport) {
      showAlert("Primero genera el grafico de mora.");
      return;
    }

    await printDocument(
      "Grafico de mora por referencia",
      buildFieldDebtChartPrintMarkup(),
      {
        pageSize: "Letter landscape",
        pageMargin: "8mm",
        bodyClassName: "field-report-body field-debt-chart-print-body",
        showPageFooter: true
      }
    );
  };

  const handleDownloadFieldDebtPdf = async () => {
    if (!fieldDebtReport) {
      showAlert("Primero ejecuta la verificación de deuda.");
      return;
    }

    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableModule.default;
      const document = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter", compress: true });

      document.setFont("helvetica", "bold");
      document.setFontSize(15);
      document.setTextColor(18, 59, 93);
      document.text("Verificación de deuda GPS", 14, 15);
      document.setFont("helvetica", "normal");
      document.setFontSize(9);
      document.text(`Jornada: ${formatMapDiaryLabel(fieldDebtReport.dateKey)} | Generado: ${formatDateTime(fieldDebtReport.generatedAt)}`, 14, 21);
      document.text(`Referencias unicas: ${fieldDebtSummary.totalKeys} | Encontradas: ${fieldDebtSummary.foundKeys} | Sin coincidencia: ${fieldDebtSummary.missingKeys}`, 14, 28);
      document.text(`Deuda total: ${formatCurrency(fieldDebtSummary.totalDebt)} lempiras | Puntos con referencia: ${fieldDebtSummary.totalPoints}`, 14, 35);

      const body = (fieldDebtReport.results || []).flatMap((result) => {
        if (!result.matches?.length) {
          return [[getFieldDebtResultLabel(result), String(fieldDebtReport?.keyCounts?.[result.key] || 0), "--", result.error || "No aparece", "--", "--", "--", "--"]];
        }

        return result.matches.map((match) => [
          getFieldDebtResultLabel(result),
          String(fieldDebtReport?.keyCounts?.[result.key] || 0),
          match.abonado || "--",
          match.inquilino || match.nombre || "--",
          match.barrio_colonia || "--",
          formatCurrency(Number(match.valor || 0)),
          formatCurrency(Number(match.intereses || 0)),
          formatCurrency(Number(match.total || 0))
        ]);
      });

      autoTable(document, {
        startY: 42,
        head: [["Referencia", "Reportes", "Abonado", "Nombre", "Barrio", "Valor", "Intereses", "Total"]],
        body: body.length ? body : [["Sin referencias", "--", "--", "--", "--", "--", "--", "--"]],
        theme: "grid",
        styles: { fontSize: 7.8, cellPadding: 2, overflow: "linebreak" },
        headStyles: { fillColor: [21, 118, 209], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 251, 255] },
        margin: { left: 14, right: 14 },
        columnStyles: {
          0: { cellWidth: 24 },
          1: { cellWidth: 17, halign: "center" },
          2: { cellWidth: 24 },
          3: { cellWidth: 54 },
          4: { cellWidth: 42 },
          5: { cellWidth: 24, halign: "right" },
          6: { cellWidth: 24, halign: "right" },
          7: { cellWidth: 24, halign: "right" }
        }
      });

      const pageHeight = document.internal.pageSize.getHeight();
      const signatureY = Math.min((document.lastAutoTable?.finalY ?? 42) + 14, pageHeight - 54);
      document.setDrawColor(180, 205, 224);
      document.setFillColor(248, 252, 255);
      document.roundedRect(14, signatureY, 250, 44, 3, 3, "FD");
      document.setFont("helvetica", "bold");
      document.setFontSize(9.5);
      document.setTextColor(18, 59, 93);
      document.text("Ing. Juan Ordóñez Bonilla", 20, signatureY + 8);
      document.setFont("helvetica", "normal");
      document.setFontSize(8.5);
      document.text("Departamento de Catastro", 20, signatureY + 14);
      document.setDrawColor(120, 151, 178);
      document.line(174, signatureY + 31, 250, signatureY + 31);
      document.text("Firma", 212, signatureY + 38, { align: "center" });

      saveReportPdf(document, `verificacion-deuda-gps-${fieldDebtReport.dateKey || new Date().toISOString().slice(0, 10)}.pdf`);
      showAlert("PDF de verificacion de deuda descargado.");
    } catch (error) {
      showAlert(error.message || "No fue posible descargar el PDF de deuda.");
    }
  };

  return {
    buildMapReportPadronData,
    handleVerifyFieldDebt,
    handlePrintFieldDebtReport,
    handlePrintFieldDebtChart,
    handleDownloadFieldDebtPdf
  };
}
