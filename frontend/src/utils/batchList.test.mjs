import assert from "node:assert/strict";
import { filterAndSortBatches } from "./batchList.js";

const rows = [{ codigo_lote: "B", estado: "LISTO", fecha_recepcion: "2026-01-01" }, { codigo_lote: "A", estado: "APLICADO", fecha_recepcion: "2026-02-01" }];
assert.deepEqual(filterAndSortBatches(rows).map((item) => item.codigo_lote), ["A", "B"]);
assert.deepEqual(filterAndSortBatches(rows, { status: "LISTO", query: "b" }).map((item) => item.codigo_lote), ["B"]);
assert.deepEqual(filterAndSortBatches(rows, { query: "2026-02" }).map((item) => item.codigo_lote), ["A"]);
