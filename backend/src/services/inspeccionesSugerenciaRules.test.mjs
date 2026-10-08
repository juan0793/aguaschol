import test from "node:test";
import assert from "node:assert/strict";
import { centroidesDeBarrios, sugerirTecnicos } from "./inspeccionesSugerenciaRules.js";

// Tres barrios en línea: 01 en x=0, 02 en x=100 (1 km), 03 en x=300 (3 km).
const mapa = {
  poligonos: [
    { codigo: "01", d: "M-10,-10L10,-10L10,10L-10,10Z" },
    { codigo: "02", d: "M90,0L110,0L100,10L100,-10Z" },
    { codigo: null, d: "M5,5L6,6Z" }
  ],
  puntos: [
    { codigo: "03", x: 300, y: 0 },
    { codigo: "01", x: 999, y: 999 }
  ]
};
const centroides = centroidesDeBarrios(mapa);

const barrios = [
  { codigo: "01", nombre: "Bo. Uno", responsable_id: 1 },
  { codigo: "02", nombre: "Bo. Dos", responsable_id: 2 },
  { codigo: "03", nombre: "Bo. Tres", responsable_id: 3 },
  { codigo: "04", nombre: "Bo. Cuatro", responsable_id: null }
];
const personal = [
  { id: 1, nombre_completo: "Ana", user_id: 11, activo: 1 },
  { id: 2, nombre_completo: "Beto", user_id: 12, activo: 1 },
  { id: 3, nombre_completo: "Carla", user_id: null, activo: 1 }
];
const tecnicos = [
  { id: 11, full_name: "Ana López", inspecciones_activas: 4 },
  { id: 12, full_name: "Beto Paz", inspecciones_activas: 1 }
];
const sugerir = (clave, extra = {}) => sugerirTecnicos({ clave, barrios, personal, tecnicos, centroides, ...extra });

test("centroides: promedio de vértices y punto GPS solo si no hay polígono", () => {
  assert.deepEqual(centroides.get("01"), { x: 0, y: 0 });
  assert.deepEqual(centroides.get("02"), { x: 100, y: 0 });
  assert.deepEqual(centroides.get("03"), { x: 300, y: 0 });
  assert.equal(centroides.size, 3);
});

test("el dueño del barrio va primero y luego el más cercano", () => {
  const resultado = sugerir("01-02-03-04");
  assert.equal(resultado.barrio_nombre, "Bo. Uno");
  assert.equal(resultado.aviso, null);
  assert.deepEqual(resultado.sugerencias.map((item) => [item.nombre, item.distancia_m, item.es_su_zona]), [
    ["Ana López", 0, true],
    ["Beto Paz", 1000, false]
  ]);
  assert.equal(resultado.sugerencias[1].barrio_cercano_nombre, "Bo. Dos");
});

test("dueño sin usuario vinculado: avisa y sugiere al más cercano con usuario", () => {
  const resultado = sugerir("03-01-01");
  assert.match(resultado.aviso, /Carla tiene este barrio/);
  assert.deepEqual(resultado.sugerencias.map((item) => [item.nombre, item.distancia_m]), [
    ["Beto Paz", 2000],
    ["Ana López", 3000]
  ]);
});

test("barrio fuera del reparto y del mapa: sin sugerencias y con aviso", () => {
  const resultado = sugerir("04-01-01");
  assert.equal(resultado.sugerencias.length, 0);
  assert.match(resultado.aviso, /no está en el reparto ni en el mapa/);
});

test("barrio fuera del reparto pero en el mapa: sugiere por cercanía", () => {
  const resultado = sugerir("02-01-01", { barrios: barrios.filter((fila) => fila.codigo !== "02") });
  assert.match(resultado.aviso, /se sugiere por cercanía/);
  assert.deepEqual(resultado.sugerencias.map((item) => item.nombre), ["Ana López"]);
});

test("empate de distancia: gana quien tiene menos inspecciones activas", () => {
  const resultado = sugerir("01-01", {
    barrios: [{ codigo: "02", responsable_id: 1 }, { codigo: "02b", responsable_id: 2 }],
    centroides: new Map([["01", { x: 0, y: 0 }], ["02", { x: 50, y: 0 }], ["02b", { x: -50, y: 0 }]])
  });
  assert.deepEqual(resultado.sugerencias.map((item) => item.nombre), ["Beto Paz", "Ana López"]);
});

test("personal inactivo o usuario no elegible no se sugiere", () => {
  const resultado = sugerir("01-01", {
    personal: [{ ...personal[0], activo: 0 }, { ...personal[1], user_id: 99 }]
  });
  assert.equal(resultado.sugerencias.length, 0);
  assert.match(resultado.aviso, /Ana tiene este barrio/);
});

test("clave sin código de barrio", () => {
  const resultado = sugerir("00-00-00");
  assert.equal(resultado.barrio_codigo, "");
  assert.equal(resultado.sugerencias.length, 0);
  assert.ok(resultado.aviso);
});
