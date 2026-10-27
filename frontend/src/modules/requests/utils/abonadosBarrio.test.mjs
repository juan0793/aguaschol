import assert from "node:assert/strict";
import test from "node:test";
import { coincide, estadoSaldo, ordenarAbonados, resumirAbonados } from "./abonadosBarrio.js";

const cuentas = [
  { clave_catastral: "16-02-02-01", abonado: "5201", nombre: "JOSE LUIS ORDOÑEZ", tarifa: 187, intereses: 72.25, total: 259.25 },
  { clave_catastral: "16-01-01-01", abonado: "5200", nombre: "ANA LUCIA MARTINEZ", tarifa: 0, intereses: 0, total: 0 },
  { clave_catastral: "16-10-01-01", abonado: "5210", nombre: "MARIA JOSE CASTILLO", tarifa: -165.6, intereses: 5.4, total: -160.2 },
  { clave_catastral: "16-03-03-01", abonado: "5202", nombre: "PEDRO LOPEZ", tarifa: 5422.06, intereses: 658.95, total: 6081.01 }
];

test("el estado sale del saldo, que ya incluye los intereses", () => {
  assert.deepEqual(cuentas.map(estadoSaldo), ["deuda", "al-dia", "a-favor", "deuda"]);
  assert.equal(estadoSaldo({ total: 0.004 }), "al-dia", "un residuo de redondeo es al día");
});

test("la búsqueda ignora acentos y acepta claves sin guiones", () => {
  assert.ok(coincide(cuentas[0], "ordonez"));
  assert.ok(coincide(cuentas[0], "160202"), "clave sin guiones");
  assert.ok(coincide(cuentas[0], "16-02-02"));
  assert.ok(coincide(cuentas[0], "5201"));
  assert.ok(!coincide(cuentas[1], "160202"));
  assert.ok(!coincide(cuentas[0], "12"), "dos dígitos no bastan para buscar dentro de la clave");
  assert.ok(coincide(cuentas[2], "jose"));
});

test("ordena por mayor saldo, nombre o clave", () => {
  assert.deepEqual(ordenarAbonados(cuentas, "saldo").map((c) => c.abonado), ["5202", "5201", "5200", "5210"]);
  assert.deepEqual(ordenarAbonados(cuentas, "nombre").map((c) => c.abonado), ["5200", "5201", "5210", "5202"]);
  assert.deepEqual(ordenarAbonados(cuentas, "clave").map((c) => c.abonado), ["5200", "5201", "5202", "5210"]);
});

test("el resumen suma sin volver a sumar los intereses al saldo", () => {
  const resumen = resumirAbonados(cuentas);
  assert.equal(Number(resumen.saldo.toFixed(2)), 6180.06);
  assert.equal(Number((resumen.capital + resumen.intereses).toFixed(2)), 6180.06);
  assert.equal(resumen.deuda, 2);
  assert.equal(resumen["al-dia"], 1);
  assert.equal(resumen["a-favor"], 1);
});
