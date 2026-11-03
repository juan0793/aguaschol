import test from "node:test";
import assert from "node:assert/strict";
import { capasDelMapa, colorDe, conLectura, encuadre, estadoTecnico, tecnicosDelMapa } from "./equipoMapaDatos.js";

const ahora = new Date("2026-11-03T16:00:00Z").getTime();
const hace = (min) => new Date(ahora - min * 60000).toISOString();
const data = {
  tecnicos: [
    { id: 1, nombre: "Luis", ubicacion: { latitude: 13.3, longitude: -87.19, accuracy: 8, at: hace(40) }, rastro: [{ latitude: 13.29, longitude: -87.18 }, { latitude: 13.3, longitude: -87.19 }] },
    { id: 2, nombre: "Sayma", ubicacion: { latitude: 13.31, longitude: -87.2, accuracy: 4, at: hace(1) }, rastro: [] },
    { id: 3, nombre: "Sin nada", ubicacion: null, rastro: [] },
    { id: 4, nombre: "Ana", ubicacion: null, rastro: [] }
  ],
  candidatos: [
    { id: 10, tecnico_id: 1, estado: "pendiente", latitude: 13.28, longitude: -87.17, clave: "30-07-12" },
    { id: 11, tecnico_id: 1, estado: "enviado", latitude: 13.281, longitude: -87.171 },
    { id: 12, tecnico_id: 4, estado: "descartado", latitude: 13.32, longitude: -87.21 }
  ]
};

test("mapa: estado del técnico según su última ubicación", () => {
  assert.equal(estadoTecnico(null, ahora), "sin_gps");
  assert.equal(estadoTecnico({ at: hace(2) }, ahora), "en_linea");
  assert.equal(estadoTecnico({ at: hace(20) }, ahora), "reciente");
  assert.equal(estadoTecnico({ at: hace(90) }, ahora), "inactivo");
  assert.equal(colorDe(12), colorDe(0));
});

test("mapa: técnicos con trabajo o GPS, en línea primero, con sus conteos", () => {
  const lista = tecnicosDelMapa(data, ahora);
  assert.deepEqual(lista.map((t) => t.nombre), ["Sayma", "Luis", "Ana"]);
  const luis = lista.find((t) => t.id === 1);
  assert.deepEqual([luis.pendientes, luis.revisados, luis.enviados, luis.estado], [1, 1, 1, "inactivo"]);
  assert.equal(luis.color, colorDe(0)); // el color sale del orden original, no del ordenado
});

test("mapa: capas filtradas por técnico y encuadre", () => {
  const tecnicos = tecnicosDelMapa(data, ahora);
  const todas = capasDelMapa(data, tecnicos);
  assert.equal(todas.candidatos.features.length, 3);
  assert.equal(todas.rastros.features.length, 1);
  assert.equal(todas.precision.features.length, 2);
  const luis = capasDelMapa(data, tecnicos, 1);
  assert.deepEqual(luis.candidatos.features.map((f) => f.properties.id), [10, 11]);
  assert.equal(luis.candidatos.features[0].properties.tecnico, "Luis");
  assert.deepEqual(encuadre(luis, tecnicos.filter((t) => t.id === 1)), [[-87.19, 13.28], [-87.17, 13.3]]);
  assert.equal(encuadre(capasDelMapa({}, []), []), null);
});

test("mapa: una lectura en vivo mueve al técnico y alarga su recorrido", () => {
  const nuevo = conLectura(data, { user_id: 2, latitude: 13.312, longitude: -87.201, accuracy: 5, at: hace(0) });
  const sayma = nuevo.tecnicos.find((t) => t.id === 2);
  assert.equal(sayma.ubicacion.latitude, 13.312);
  assert.equal(sayma.rastro.length, 1);
  const extra = conLectura(data, { user_id: 9, nombre: "Nuevo", latitude: 13.3, longitude: -87.1, at: hace(0) });
  assert.equal(extra.tecnicos.at(-1).nombre, "Nuevo");
  assert.equal(data.tecnicos.length, 4); // no muta
});
