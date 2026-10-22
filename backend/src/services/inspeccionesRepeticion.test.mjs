import assert from "node:assert/strict";
import test from "node:test";
import { claveIdentifica, mismaCuenta, repeticionesDe } from "./inspeccionesRepeticion.js";

const clave = "31-04-09-01";
const todas = [
  { id: 1, numero_inspeccion: "INS-1", clave_catastral: clave, abonado_numero: "100", estado: "ASIGNADA", fecha_asignacion: "2026-10-16" },
  { id: 2, numero_inspeccion: "INS-2", clave_catastral: clave, abonado_numero: "100", estado: "EN_PROCESO", fecha_asignacion: "2026-10-20", tecnico_responsable_nombre: "Sayma Lorena" },
  { id: 3, numero_inspeccion: "INS-3", clave_catastral: clave, abonado_numero: "200", estado: "ASIGNADA", fecha_asignacion: "2026-10-18" },
  { id: 4, numero_inspeccion: "INS-4", clave_catastral: clave, abonado_numero: "100", estado: "FINALIZADA", fecha_finalizacion: "2026-09-02" },
  { id: 5, numero_inspeccion: "INS-5", clave_catastral: clave, abonado_numero: "200", estado: "FINALIZADA", fecha_finalizacion: "2026-10-01" },
  { id: 6, numero_inspeccion: "INS-6", clave_catastral: "12-01-01-01", abonado_numero: "300", estado: "ASIGNADA" },
  { id: 7, numero_inspeccion: "INS-7", clave_catastral: "00-00-00-00", abonado_numero: "", inspeccion_general: 1, estado: "ASIGNADA" },
  { id: 8, numero_inspeccion: "INS-8", clave_catastral: "00-00-00-00", abonado_numero: "", inspeccion_general: 1, estado: "ASIGNADA" },
  { id: 9, numero_inspeccion: "INS-9", clave_catastral: "44-01-01-01", abonado_numero: "", inspeccion_general: 1, estado: "ASIGNADA" },
  { id: 10, numero_inspeccion: "INS-10", clave_catastral: "44-01-01-01", abonado_numero: "500", estado: "SEGUIMIENTO" }
];

test("una clave de relleno o vacía no identifica un inmueble", () => {
  assert.equal(claveIdentifica("00-00-00-00"), false);
  assert.equal(claveIdentifica(""), false);
  assert.equal(claveIdentifica(clave), true);
});

test("misma cuenta: el mismo abonado o una inspección general de la clave", () => {
  assert.equal(mismaCuenta(todas[0], todas[1]), true);
  assert.equal(mismaCuenta(todas[0], todas[2]), false);
  assert.equal(mismaCuenta(todas[8], todas[9]), true);
});

test("separa la repetida de la misma cuenta de las otras cuentas de la clave", () => {
  const repeticion = repeticionesDe(todas[0], todas);
  assert.deepEqual(repeticion.repetidas.map((item) => item.numero_inspeccion), ["INS-2"]);
  assert.equal(repeticion.repetidas[0].tecnico_responsable_nombre, "Sayma Lorena");
  assert.deepEqual(repeticion.otras_cuentas.map((item) => [item.numero_inspeccion, item.abonado_numero]), [["INS-3", "200"]]);
  assert.equal(repeticion.ultima_finalizada.numero_inspeccion, "INS-4");
  assert.equal(repeticion.total, 4);
});

test("otra cuenta sola no es repetida, y la anterior debe ser de su cuenta", () => {
  const repeticion = repeticionesDe(todas[2], todas);
  assert.deepEqual(repeticion.repetidas, []);
  assert.deepEqual(repeticion.otras_cuentas.map((item) => item.numero_inspeccion), ["INS-1", "INS-2"]);
  assert.equal(repeticion.ultima_finalizada.numero_inspeccion, "INS-5");
});

test("la general repite a cualquier cuenta abierta de la clave", () => {
  assert.deepEqual(repeticionesDe(todas[8], todas).repetidas.map((item) => item.numero_inspeccion), ["INS-10"]);
  assert.deepEqual(repeticionesDe(todas[9], todas).repetidas.map((item) => item.numero_inspeccion), ["INS-9"]);
});

test("sin otras inspecciones en la clave, o con clave de relleno, no hay aviso", () => {
  assert.equal(repeticionesDe(todas[5], todas), null);
  assert.equal(repeticionesDe(todas[6], todas), null);
});
