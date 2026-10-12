import test from "node:test";
import assert from "node:assert/strict";
import { filterRows, formatLempiras, formatShare, pageNumbers, paginate } from "./managerReportFormat.js";

test("lempiras compactos como en el tablero", () => {
  assert.equal(formatLempiras(235433637.19), "L 235.4 M");
  assert.equal(formatLempiras(12300), "L 12.3 mil");
  assert.equal(formatLempiras(950), "L 950.00");
  assert.equal(formatShare(1, 4), "25%");
  assert.equal(formatShare(1, 0), "—");
});

test("el detalle se busca en cualquier columna y se pagina", () => {
  const rows = Array.from({ length: 30 }, (_, i) => [`Barrio ${i + 1}`, i]);
  assert.equal(filterRows(rows, "barrio 2").length, 11);
  const page = paginate(rows, 3, 12);
  assert.deepEqual([page.page, page.totalPages, page.from, page.to, page.items.length], [3, 3, 25, 30, 6]);
  assert.equal(paginate(rows, 9, 12).page, 3);
  assert.deepEqual(paginate([], 1, 12), { page: 1, totalPages: 1, items: [], from: 0, to: 0, total: 0 });
});

test("los números de página dejan huecos legibles", () => {
  assert.deepEqual(pageNumbers(1, 1), [1]);
  assert.deepEqual(pageNumbers(5, 12), [1, "…", 4, 5, 6, "…", 12]);
  assert.deepEqual(pageNumbers(2, 4), [1, 2, 3, 4]);
});
