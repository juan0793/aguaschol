import test from "node:test";
import assert from "node:assert/strict";
import { faseRecordatorio, jornadaEntregas } from "./entregasReminderService.js";
import { validarSobrantes, validarTotalAsignado } from "./entregasRules.js";

test("cantidades enteras y jornada local: límites y escalamiento", () => {
  for (const value of [1.5, Infinity, NaN, true, "2.9"]) {
    assert.throws(() => validarTotalAsignado(value));
    assert.throws(() => validarSobrantes(value, 10));
  }
  const config = { entregasRecordatorio: "12:00", entregasPreaviso: "16:30", entregasFin: "17:00" };
  const lote = { fecha: "2026-09-08", estado: "ABIERTO" };
  const fase = (fecha, hora, estado = "ABIERTO") => faseRecordatorio({ ...lote, estado }, { fecha, hora }, config);
  assert.deepEqual(jornadaEntregas(new Date("2026-09-09T02:00:00Z")), { fecha: "2026-09-08", hora: "20:00" });
  assert.equal(fase("2026-09-08", "11:59"), "");
  assert.equal(fase("2026-09-08", "12:00"), "JORNADA");
  assert.equal(fase("2026-09-08", "16:30"), "PREAVISO");
  assert.equal(fase("2026-09-08", "17:00"), "FIN");
  assert.equal(fase("2026-09-09", "00:00"), "ATRASADO");
  assert.equal(fase("2026-09-07", "18:00"), "");
  for (const estado of ["CERRADO", "REVISADO"]) assert.equal(fase("2026-09-09", "18:00", estado), "");
});
