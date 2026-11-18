import test from "node:test";
import assert from "node:assert/strict";
import { armarPrioridad, criterioValido, moraPorBarrio, motivosPrioridad, nivelPrioridad } from "./entregasPrioridadRules.js";

const hoy = "2026-11-18";
const barrio = (codigo, extra = {}) => ({
  codigo,
  nombre: `Barrio ${codigo}`,
  responsable_id: 1,
  responsable_nombre: "Ana",
  orden_ruta: Number(codigo),
  estado: "pendiente",
  carga: { documentos: 100, fuente: "historial" },
  plan: null,
  ...extra
});

test("moraPorBarrio suma solo la mora positiva por código de barrio", () => {
  const mora = moraPorBarrio([
    { clave_catastral: "22-01-01-01", intereses: 100.5 },
    { clave_catastral: "22-01-02-01", intereses: 20 },
    { clave_catastral: "22-01-03-01", intereses: -5 },
    { clave_catastral: "24-02-01-01", intereses: "7.25" },
    { clave_catastral: "sin-clave", intereses: 50 }
  ]);
  assert.deepEqual(mora.get("22"), { mora: 120.5, cuentas: 2 });
  assert.deepEqual(mora.get("24"), { mora: 7.25, cuentas: 1 });
  assert.equal(mora.size, 2);
});

test("nivel y motivos de un barrio", () => {
  assert.equal(nivelPrioridad({ estado: "en_curso", dias_sin_entrega: 2 }), "alta");
  assert.equal(nivelPrioridad({ estado: "pendiente", plan: { fecha: hoy }, dias_sin_entrega: 2 }), "alta");
  assert.equal(nivelPrioridad({ estado: "pendiente", dias_sin_entrega: null }), "alta");
  assert.equal(nivelPrioridad({ estado: "pendiente", dias_sin_entrega: 31 }), "alta");
  assert.equal(nivelPrioridad({ estado: "pendiente", dias_sin_entrega: 27 }), "media");
  assert.equal(nivelPrioridad({ estado: "pendiente", dias_sin_entrega: 26 }), "baja");
  assert.deepEqual(motivosPrioridad({ estado: "en_curso", dias_sin_entrega: 3 }), ["Lote abierto"]);
  assert.deepEqual(motivosPrioridad({ estado: "pendiente", plan: { fecha: hoy }, dias_sin_entrega: 1 }), ["Anotado para mañana", "1 día sin entrega"]);
  assert.deepEqual(motivosPrioridad({ estado: "pendiente", dias_sin_entrega: null }), ["Sin entregas registradas"]);
});

test("armarPrioridad deja fuera lo entregado y ordena por el criterio combinado", () => {
  const filas = armarPrioridad({
    hoy,
    barrios: [
      barrio("1", { estado: "entregado" }),
      barrio("2"),
      barrio("3", { estado: "en_curso" }),
      barrio("4", { plan: { fecha: "2026-11-19" } }),
      barrio("5"),
      barrio("6"),
      barrio("7")
    ],
    ultimas: new Map([["2", "2026-10-25"], ["3", "2026-11-17"], ["4", "2026-11-10"], ["5", "2026-10-14"], ["6", "2026-10-20"]]),
    mora: new Map([["2", { mora: 50, cuentas: 1 }], ["6", { mora: 900, cuentas: 4 }]])
  });
  assert.deepEqual(filas.map((fila) => fila.codigo), ["3", "4", "7", "5", "6", "2"]);
  assert.deepEqual(filas.map((fila) => fila.nivel), ["alta", "alta", "alta", "alta", "media", "baja"]);
  assert.equal(filas.find((fila) => fila.codigo === "5").dias_sin_entrega, 35);
  assert.equal(filas.find((fila) => fila.codigo === "7").ultima_entrega, null);
  assert.deepEqual(filas.map((fila) => fila.posicion), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(filas.find((fila) => fila.codigo === "7").mora, { mora: 0, cuentas: 0 });
});

test("sin mora no se ordena por mora ni sale el monto", () => {
  const filas = armarPrioridad({
    hoy,
    criterio: "mora",
    barrios: [barrio("2", { orden_ruta: 2 }), barrio("1", { orden_ruta: 1 })],
    ultimas: new Map([["1", "2026-10-01"], ["2", "2026-11-01"]])
  });
  assert.deepEqual(filas.map((fila) => fila.codigo), ["1", "2"]);
  assert.ok(filas.every((fila) => !("mora" in fila)));
  assert.equal(criterioValido("mora", { conMora: false }), "combinado");
  assert.equal(criterioValido("carga"), "carga");
  assert.equal(criterioValido("cualquiera"), "combinado");
});

test("los demás criterios", () => {
  const barrios = [
    barrio("1", { carga: { documentos: 50 }, orden_ruta: 3 }),
    barrio("2", { carga: { documentos: 300 }, orden_ruta: 1, responsable_nombre: "Beto" }),
    barrio("3", { carga: { documentos: 120 }, orden_ruta: 2 })
  ];
  const ultimas = new Map([["1", "2026-10-30"], ["2", "2026-10-10"], ["3", "2026-10-20"]]);
  assert.deepEqual(armarPrioridad({ hoy, barrios, ultimas, criterio: "carga" }).map((f) => f.codigo), ["2", "3", "1"]);
  assert.deepEqual(armarPrioridad({ hoy, barrios, ultimas, criterio: "dias" }).map((f) => f.codigo), ["2", "3", "1"]);
  assert.deepEqual(armarPrioridad({ hoy, barrios, ultimas, criterio: "ruta" }).map((f) => f.codigo), ["3", "1", "2"]);
});
