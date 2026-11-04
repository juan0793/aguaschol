import assert from "node:assert/strict";
import test from "node:test";
import { compararPadrones, resumirPadron } from "./padronLotesService.js";

const cuenta = (abonado, total, barrio = "BO. UNO", extra = {}) => ({ abonado, clave_catastral: `01-01-${abonado}`, barrio_colonia: barrio, valor: total, intereses: 0, total, agua: "S", alcantarillado: "N", barrido: "N", recoleccion: "N", desechos_peligrosos: "N", ...extra });

test("el puente de mora entre dos lotes cuadra exacto", () => {
  const antes = [cuenta("1", 500), cuenta("2", 1200), cuenta("3", 0), cuenta("4", 800, "BO. DOS"), cuenta("5", 300)];
  const ahora = [cuenta("1", 650), cuenta("2", 0), cuenta("3", 90, "BO. UNO", { alcantarillado: "S" }), cuenta("5", 100), cuenta("6", 2000, "BO. DOS")];
  const r = compararPadrones(antes, ahora);
  const m = r.movimientos;
  assert.equal(m.nuevas.cuentas, 1); assert.equal(m.nuevas.monto, 2000);
  assert.equal(m.salieron.cuentas, 1); assert.equal(m.salieron.monto, 800);
  assert.equal(m.aumentaron.cuentas, 2); assert.equal(m.aumentaron.monto, 240);
  assert.equal(m.saldaron.cuentas, 1); assert.equal(m.saldaron.monto, 1200);
  assert.equal(m.bajaron.cuentas, 1); assert.equal(m.bajaron.monto, 200);
  assert.equal(m.cayeron_en_mora.cuentas, 1);
  assert.equal(m.cambio_servicio, 1);
  const puente = r.anterior.total + m.nuevas.monto + m.aumentaron.monto - m.salieron.monto - m.bajaron.monto - m.saldaron.monto;
  assert.equal(Math.round(puente * 100) / 100, r.actual.total);
  assert.deepEqual(r.barrios.subieron.map((b) => [b.barrio, b.diferencia]), [["BO. DOS", 1200]]);
  assert.deepEqual(r.barrios.bajaron.map((b) => [b.barrio, b.diferencia]), [["BO. UNO", -1160]]);
});

test("resumen del padrón cuenta mora y mora alta", () => {
  const r = resumirPadron([cuenta("1", 0), cuenta("2", 999.99), cuenta("3", 1000, "BO. DOS")]);
  assert.deepEqual([r.cuentas, r.con_mora, r.mora_alta, r.barrios], [3, 2, 1, 2]);
});

test("compara el padrón activo con el lote anterior guardado en R2", async () => {
  const { compararLotesPadron } = await import("./padronLotesService.js");
  const { getMasterRecords } = await import("./claveLookupService.js");
  const actuales = getMasterRecords();
  const anteriores = actuales.slice(1).map((record, i) => (i === 0 ? { ...record, total: Number(record.total || 0) + 500 } : record));
  const lotes = [
    { id: 2, codigo_lote: "FOX-NUEVO", estado: "APLICADO", fecha_aplicacion: "2026-11-04T10:00:00Z", r2_historico_key: "padron/historico/b" },
    { id: 1, codigo_lote: "FOX-VIEJO", estado: "APLICADO", fecha_aplicacion: "2026-10-28T10:00:00Z", r2_historico_key: "padron/historico/a" }
  ];
  const pool = { query: async (sql) => [sql.includes("FROM importacion_padron_registros") ? [] : sql.includes("estado='APLICADO'") ? lotes : []] };
  const r2 = { configured: true, loadHistorical: async (key) => ({ key, records: anteriores }) };
  const r = await compararLotesPadron({ pool, r2 });
  assert.equal(r.disponible, true);
  assert.equal(r.anterior.codigo, "FOX-VIEJO");
  assert.equal(r.anterior.origen, "r2");
  assert.equal(r.comparacion.actual.cuentas, actuales.length);
  assert.equal(r.comparacion.movimientos.nuevas.cuentas, 1);
  assert.deepEqual(r.lotes.map((lote) => lote.codigo), ["FOX-VIEJO"]);
});
