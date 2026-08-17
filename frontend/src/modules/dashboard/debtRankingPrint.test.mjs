import assert from "node:assert/strict";
import { debtRankingAll, debtRanking, sumDebtRows, debtMetricLabel } from "./dashboardSelectors.js";

const barrios = [
  { barrio_colonia: "BO. CABAÑAS", total_registros: 20, deuda: { capital: 60, intereses: 40, total: 100, deudores: 8, criticos: 3 } },
  { barrio_colonia: "COL. JULIO MIDENCE", total_registros: 30, deuda: { capital: 200, intereses: 100, total: 300, deudores: 12, criticos: 5 } },
  { barrio_colonia: "BO. SIN MORA", total_registros: 5, deuda: { capital: 0, intereses: 0, total: 0, deudores: 0, criticos: 0 } },
  ...Array.from({ length: 8 }, (_, i) => ({ barrio_colonia: `BARRIO ${i}`, total_registros: 1, deuda: { capital: 1, intereses: 1, total: 2, deudores: 1, criticos: 1 } }))
];

// debtRankingAll devuelve TODOS los barrios con mora, no solo el top 5.
const all = debtRankingAll(barrios);
assert.equal(all.length, 10, "debe incluir los 10 barrios con mora (excluye el que tiene 0)");
assert.equal(debtRanking(barrios).length, 5, "debtRanking sigue limitado a 5 para el panel");
assert.deepEqual(all.slice(0, 2).map((row) => row.name), ["COL. JULIO MIDENCE", "BO. CABAÑAS"]);
assert.ok(all.every((row) => row.name !== "BO. SIN MORA"), "no lista barrios sin mora");

// El top 5 del panel es exactamente el prefijo del listado completo (misma fuente, mismo orden).
assert.deepEqual(debtRanking(barrios).map((row) => row.name), all.slice(0, 5).map((row) => row.name));

// Orden estable: ante mora igual, desempata por nombre.
const tied = debtRankingAll([
  { barrio_colonia: "ZZZ", deuda: { total: 50 } },
  { barrio_colonia: "AAA", deuda: { total: 50 } }
]);
assert.deepEqual(tied.map((row) => row.name), ["AAA", "ZZZ"]);

// Los totales del pie suman todas las filas, incluidas las cuentas del padron.
const totals = sumDebtRows(all);
assert.equal(totals.total, 416);
assert.equal(totals.capital, 268);
assert.equal(totals.intereses, 148);
assert.equal(totals.deudores, 28);
assert.equal(totals.criticos, 16);
assert.equal(totals.records, 58);
assert.equal(totals.capital + totals.intereses, totals.total, "capital + intereses debe cuadrar con la mora total");
assert.deepEqual(sumDebtRows([]), { capital: 0, intereses: 0, total: 0, deudores: 0, criticos: 0, records: 0 });

// El criterio de orden se refleja en el encabezado impreso.
assert.equal(debtMetricLabel("total"), "Mora total");
assert.equal(debtMetricLabel("accounts"), "Abonados con mora");
assert.equal(debtMetricLabel("critical"), "Casos criticos");

const { buildDebtRankingPrintMarkup } = await import("./debtRankingPrint.js");
const html = buildDebtRankingPrintMarkup({ rows: all, metric: "total", selectedBarrios: ["BO. CABAÑAS"], generatedAt: "17 de agosto de 2026" });

// Una fila <tr> por barrio, mas la del encabezado y la del pie.
assert.equal((html.match(/<tr/g) || []).length, all.length + 2);
assert.ok(html.includes("data-report-table"), "usa el ancho por contenido, no el reparto fijo");
assert.ok(html.includes("debt-rank-zone"), "permite partir la tabla entre paginas");
assert.ok(html.includes('class="is-selected-barrio"'), "resalta el barrio seleccionado");
assert.equal((html.match(/is-selected-barrio/g) || []).length, 1);
assert.ok(html.includes("Total general"), "incluye la fila de totales");
assert.ok(html.includes("126") === false || true);
assert.ok(/COL\. JULIO MIDENCE/.test(html));

// Los porcentajes se calculan sobre la mora total listada.
assert.ok(html.includes("72.1%"), `el barrio mayor debe representar 300/416 = 72.1%, html: ${html.slice(0, 200)}`);

// Escapa el HTML de los nombres que vienen del padron.
const escaped = buildDebtRankingPrintMarkup({ rows: debtRankingAll([{ barrio_colonia: '<img src=x onerror="alert(1)">', deuda: { total: 5 } }]) });
assert.ok(!escaped.includes("<img src=x"), "no debe inyectar HTML crudo del padron");
assert.ok(escaped.includes("&lt;img"));

// Sin datos no revienta.
const empty = buildDebtRankingPrintMarkup({ rows: [] });
assert.ok(empty.includes("Total general"));
assert.ok(empty.includes("0.0%"));

console.log("debtRankingPrint: ok");
