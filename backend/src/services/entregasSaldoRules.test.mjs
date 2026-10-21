import assert from "node:assert/strict";
import test from "node:test";
import { indexarPadron, normalizarAviso, saldoDeDocumento, sumarSaldos, textoAviso } from "./entregasSaldoRules.js";

const padron = [
  { clave_catastral: "31-04-09-01", clave_base: "31-04-09", abonado: "10326", valor: 450.5, intereses: 120.25, total: 570.75 },
  { clave_catastral: "31-04-10-01", clave_base: "31-04-10", abonado: "22869", valor: 0, intereses: 0, total: 0 },
  { clave_catastral: "31-04-11-01", clave_base: "31-04-11", abonado: "", valor: 80, intereses: 20, total: 100 },
  { clave_catastral: "31-04-12-01", clave_base: "31-04-12", abonado: "7001", valor: 10, intereses: 0, total: 10 },
  { clave_catastral: "31-04-12-02", clave_base: "31-04-12", abonado: "7002", valor: 15, intereses: 0, total: 15 }
];
const indice = indexarPadron(padron);
const normalizar = (valor) => String(valor).trim();

test("el saldo se busca por abonado y, si no aparece, por clave", () => {
  assert.deepEqual(saldoDeDocumento(indice, { numero_abonado: " 10326 " }, normalizar), { encontrado: true, capital: 450.5, mora: 120.25, total: 570.75 });
  assert.equal(saldoDeDocumento(indice, { numero_abonado: "", clave_catastral: "31-04-11-01" }, normalizar).total, 100);
  assert.equal(saldoDeDocumento(indice, { numero_abonado: "99999", clave_catastral: "31-04-11" }, normalizar).total, 100);
});

test("una clave base de varios inmuebles o un documento fuera del padrón no inventan saldo", () => {
  assert.equal(saldoDeDocumento(indice, { clave_catastral: "31-04-12" }, normalizar).encontrado, false);
  assert.equal(saldoDeDocumento(indice, { numero_abonado: "55555" }, normalizar).encontrado, false);
  assert.equal(saldoDeDocumento(indice, { clave_catastral: "malo" }, () => { throw new Error("x"); }).encontrado, false);
});

test("el total del lote omite cancelados y separa lo pendiente", () => {
  const conSaldo = (documento) => ({ ...documento, saldo: saldoDeDocumento(indice, documento, normalizar) });
  const suma = sumarSaldos([
    conSaldo({ numero_abonado: "10326", estado: "PENDIENTE" }),
    conSaldo({ numero_abonado: "22869", estado: "PENDIENTE" }),
    conSaldo({ clave_catastral: "31-04-11-01", estado: "REENTREGADA" }),
    conSaldo({ numero_abonado: "55555", estado: "PENDIENTE" }),
    conSaldo({ numero_abonado: "7001", estado: "CANCELADA" })
  ]);
  assert.deepEqual(suma, { cuentas: 4, con_saldo: 2, sin_padron: 1, capital: 530.5, mora: 140.25, total: 670.75, total_pendiente: 570.75 });
});

test("el aviso exige una plantilla conocida y un texto propio cuando es 'Otro'", () => {
  assert.deepEqual(normalizarAviso({ plantilla: "entregar_hoy", nota: "  antes   de las 3 " }), { plantilla: "ENTREGAR_HOY", nota: "antes de las 3" });
  assert.throws(() => normalizarAviso({ plantilla: "NADA" }), /Elige el mensaje/);
  assert.throws(() => normalizarAviso({ plantilla: "OTRO", nota: "ok" }), /mínimo 5/);
  assert.equal(normalizarAviso({ plantilla: "OTRO", nota: "x".repeat(400) }).nota.length, 300);
});

test("el texto del aviso nombra el documento y nunca lleva montos", () => {
  const texto = textoAviso({ plantilla: "EN_PERSONA", nota: "Urgente" }, { numero_abonado: "10326", abonado_nombre: "ANA CRUZ", barrio_nombre: "Barrio El Brasil", lote_id: 12, saldo: { total: 570.75 } });
  assert.equal(texto, "Documento no entregado: abonado 10326 · ANA CRUZ (Barrio El Brasil, lote #12). El abonado tiene saldo pendiente: entrégala en persona y deja constancia. Urgente");
  assert.doesNotMatch(texto, /570/);
  assert.match(textoAviso({ plantilla: "OTRO", nota: "Llama a la oficina" }, { clave_catastral: "31-04-11-01" }), /^Documento no entregado: clave 31-04-11-01\. Llama a la oficina$/);
});
