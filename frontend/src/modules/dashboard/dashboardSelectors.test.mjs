import assert from "node:assert/strict";
import { clampSplit, SPLIT_DEFAULT, debtRanking, filterBarriosByQuery, formatCompactCurrency, lastDaysSeries, metricValueOf, normalizeBarrioText, selectedRankedRows, sumSelectedDebt, sumSelectedServices } from "./dashboardSelectors.js";
assert.deepEqual(debtRanking([{ barrio: "A", deuda: { total: 2 } }, { barrio: "B", deuda: { total: 5 } }]).map((x) => x.name), ["B", "A"]);
assert.deepEqual(debtRanking([{ barrio_colonia: "Centro", deuda: { criticos: 3 } }], "critical").map(({ name, value }) => ({ name, value })), [{ name: "Centro", value: 3 }]);
assert.deepEqual(sumSelectedDebt([{ name: "A", debt: { total: 5, capital: 3 } }, { name: "B", debt: { total: 7, capital: 4 } }], ["A", "B"]), { capital: 7, intereses: 0, total: 12, deudores: 0, criticos: 0, records: 0 });
assert.deepEqual(sumSelectedServices([{ name: "A", services: [{ field: "agua", label: "Agua", active: 2, inactive: 1, deuda: { total: 5 } }] }, { name: "B", services: [{ field: "agua", label: "Agua", active: 3, unknown: 1, deuda: { total: 7 } }] }], ["A", "B"]), [{ field: "agua", label: "Agua", active: 5, inactive: 1, unknown: 1, debt: 12 }]);

// La sumatoria tiene que arrastrar los abonados del barrio, no solo la mora.
assert.deepEqual(
  sumSelectedDebt([{ name: "A", debt: { total: 5 }, records: 638 }, { name: "B", debt: { total: 7 }, records: 202 }], ["A", "B"]).records,
  840
);
assert.equal(sumSelectedDebt([{ name: "A", debt: { total: 5 }, records: 638 }], ["B"]).records, 0);

// La busqueda ignora tildes y mayusculas: el padron escribe "COLONIA EL EDEN".
assert.equal(normalizeBarrioText("COL. Víctor Argeñal"), "col. victor argenal");
const padron = [
  { name: "BO. PORVENIR", debt: { total: 100, deudores: 9, criticos: 4 }, records: 638 },
  { name: "COLONIA EL EDEN", debt: { total: 50, deudores: 5, criticos: 1 }, records: 202 },
  { name: "COLONIA NUEVA EDEN", debt: { total: 20, deudores: 2, criticos: 0 }, records: 56 }
];
assert.deepEqual(filterBarriosByQuery(padron, "edén").map((x) => x.name), ["COLONIA EL EDEN", "COLONIA NUEVA EDEN"]);
assert.deepEqual(filterBarriosByQuery(padron, "nueva eden").map((x) => x.name), ["COLONIA NUEVA EDEN"]);
// Varias palabras sueltas y en cualquier orden.
assert.deepEqual(filterBarriosByQuery(padron, "eden nueva").map((x) => x.name), ["COLONIA NUEVA EDEN"]);
// Sin texto no se devuelve nada: la lista sigue mostrando el top.
assert.deepEqual(filterBarriosByQuery(padron, "   "), []);
assert.deepEqual(filterBarriosByQuery(padron, "xyz"), []);
assert.equal(filterBarriosByQuery(padron, "o", 2).length, 2);

// El grafico de la seleccion se reordena segun la metrica activa.
assert.equal(metricValueOf(padron[0], "accounts"), 9);
assert.equal(metricValueOf(padron[0], "critical"), 4);
assert.equal(metricValueOf(padron[0]), 100);
assert.deepEqual(
  selectedRankedRows(padron, ["COLONIA EL EDEN", "BO. PORVENIR"], "total").map((x) => [x.name, x.value]),
  [["BO. PORVENIR", 100], ["COLONIA EL EDEN", 50]]
);
assert.deepEqual(
  selectedRankedRows(padron, ["COLONIA EL EDEN", "BO. PORVENIR"], "critical").map((x) => [x.name, x.value]),
  [["BO. PORVENIR", 4], ["COLONIA EL EDEN", 1]]
);
assert.deepEqual(selectedRankedRows(padron, [], "total"), []);

// Montos abreviados para el tablero.
assert.equal(formatCompactCurrency(231919057.42), "L 231.9 M");
assert.equal(formatCompactCurrency(56201982.88), "L 56.2 M");
assert.equal(formatCompactCurrency(12345), "L 12.3 mil");
assert.equal(formatCompactCurrency(980), "L 980");
assert.equal(formatCompactCurrency(1500000000), "L 1.5 mil M");
assert.equal(formatCompactCurrency(null), "L 0");

// La serie diaria rellena con cero y cruza el cambio de mes.
assert.deepEqual(
  lastDaysSeries(new Map([["2026-09-30", 4], ["2026-10-02", 7]]), "2026-10-02", 4),
  [
    { key: "2026-09-29", total: 0 },
    { key: "2026-09-30", total: 4 },
    { key: "2026-10-01", total: 0 },
    { key: "2026-10-02", total: 7 }
  ]
);
assert.deepEqual(lastDaysSeries(new Map(), ""), []);

// El separador respeta los minimos en pixeles de cada columna.
assert.equal(clampSplit(62, 1200), 62);
assert.equal(clampSplit(20, 1200), 35); // 420 px de 1200
assert.equal(clampSplit(95, 1200), 75); // deja 300 px a la lateral
assert.equal(clampSplit(90, 600), 75); // sin espacio para ambos minimos
assert.equal(clampSplit("x", 1200), SPLIT_DEFAULT);
