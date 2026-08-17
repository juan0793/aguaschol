import { formatCurrency } from "../../utils/currency.js";
import { escapeHtml } from "../../utils/html.js";
import { debtMetricLabel, sumDebtRows } from "./dashboardSelectors.js";

const money = (value) => escapeHtml(formatCurrency(Number(value || 0)));
const count = (value) => escapeHtml(Number(value || 0).toLocaleString("es-HN"));

export const buildDebtRankingPrintMarkup = ({ rows = [], metric = "total", selectedBarrios = [], logoSrc = "", generatedAt = "" } = {}) => {
  const totals = sumDebtRows(rows);
  const topRows = rows.slice(0, 5);
  const topMax = Math.max(1, ...topRows.map((item) => Number(item.value || 0)));
  const criterion = escapeHtml(debtMetricLabel(metric).toLowerCase());
  const share = (value) => `${totals.total ? ((Number(value || 0) / totals.total) * 100).toFixed(1) : "0.0"}%`;
  const metricValue = (item) => (metric === "total" ? money(item.value) : count(item.value));
  const bodyRows = rows
    .map(
      (item, index) =>
        `<tr${selectedBarrios.includes(item.name) ? ' class="is-selected-barrio"' : ""}><td class="col-rank">${index + 1}</td><td class="col-barrio">${escapeHtml(item.name)}</td><td>${count(item.records)}</td><td>${count(item.debt?.deudores)}</td><td>${count(item.debt?.criticos)}</td><td>${money(item.debt?.capital)}</td><td>${money(item.debt?.intereses)}</td><td class="col-strong">${money(item.debt?.total)}</td><td>${share(item.debt?.total)}</td></tr>`
    )
    .join("");

  return `<div class="field-report-shell debt-rank-shell">
      <header class="field-report-header">
        <div class="field-report-brand">
          ${logoSrc ? `<img src="${escapeHtml(logoSrc)}" alt="Logo Aguas de Choluteca" class="print-logo" />` : "<span></span>"}
          <div>
            <p class="field-report-kicker">Aguas de Choluteca, S.A. de C.V.</p>
            <h1>Mora por barrio</h1>
            <p>Datos reales del padron maestro, ordenados por ${criterion}.</p>
          </div>
        </div>
        <div class="field-report-meta">
          <span>Generado: ${escapeHtml(generatedAt)}</span>
          <span>Barrios con mora: ${count(rows.length)}</span>
          <span>Cuentas del padron: ${count(totals.records)}</span>
          <span>Cuentas con mora: ${count(totals.deudores)}</span>
          <span>Mora total: ${money(totals.total)}</span>
        </div>
      </header>
      <section class="debt-rank-top">
        <span class="field-report-zone-kicker">Los 5 barrios con mayor ${criterion}</span>
        ${topRows
          .map(
            (item, index) =>
              `<article><b>${index + 1}</b><span><strong>${escapeHtml(item.name)}</strong><i><em style="width:${Math.max(3, (Number(item.value || 0) / topMax) * 100).toFixed(1)}%"></em></i></span><small>${metricValue(item)}</small></article>`
          )
          .join("")}
      </section>
      <section class="field-report-zone debt-rank-zone">
        <div class="field-report-zone-head"><div><span class="field-report-zone-kicker">Desglose completo</span><h3>Mora total de cada barrio</h3></div></div>
        <table class="field-report-table data-report-table debt-rank-table">
          <thead><tr><th class="col-rank">#</th><th class="col-barrio">Barrio / colonia</th><th>Cuentas</th><th>Con mora</th><th>Criticos</th><th>Capital</th><th>Intereses</th><th>Mora total</th><th>% del total</th></tr></thead>
          <tbody>${bodyRows}</tbody>
          <tfoot><tr><th class="col-rank"></th><th class="col-barrio">Total general</th><th>${count(totals.records)}</th><th>${count(totals.deudores)}</th><th>${count(totals.criticos)}</th><th>${money(totals.capital)}</th><th>${money(totals.intereses)}</th><th>${money(totals.total)}</th><th>${rows.length ? "100.0%" : "0.0%"}</th></tr></tfoot>
        </table>
        <p class="debt-rank-note"><strong>Nota:</strong> casos criticos son cuentas con mora igual o mayor a L 1,000. El porcentaje se calcula sobre la mora total de los barrios listados.</p>
      </section>
    </div>`;
};
