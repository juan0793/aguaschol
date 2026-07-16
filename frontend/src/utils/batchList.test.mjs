import assert from "node:assert/strict";
import { filterAndSortBatches, getBatchTransferProgress } from "./batchList.js";

const rows = [{ codigo_lote: "B", estado: "LISTO", fecha_recepcion: "2026-01-01" }, { codigo_lote: "A", estado: "APLICADO", fecha_recepcion: "2026-02-01" }];
assert.deepEqual(filterAndSortBatches(rows).map((item) => item.codigo_lote), ["A", "B"]);
assert.deepEqual(filterAndSortBatches(rows, { status: "LISTO", query: "b" }).map((item) => item.codigo_lote), ["B"]);
assert.deepEqual(filterAndSortBatches(rows, { query: "2026-02" }).map((item) => item.codigo_lote), ["A"]);
assert.deepEqual(getBatchTransferProgress({ total_bloques: 10, bloques_recibidos: 4, total_registros: 1000, registros_recibidos: 400 }), {
  totalBlocks: 10, blocksReceived: 4, totalRecords: 1000, recordsReceived: 400, percent: 40, complete: false
});
assert.deepEqual(getBatchTransferProgress({ total_bloques: 2, bloques_recibidos: 3 }), {
  totalBlocks: 2, blocksReceived: 3, totalRecords: 0, recordsReceived: 0, percent: 100, complete: true
});
