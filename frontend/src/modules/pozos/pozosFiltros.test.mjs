import assert from "node:assert/strict";
import test from "node:test";
import { coloniasDe, contarVistas, filtrarPozos, formatoNumero, fueraDeRango, haceCuanto, normalizar, ordenarPozos, paginar, resumenMetricas } from "./pozosFiltros.js";

const pozos = [
  { id: 1, codigo: "Pchol.-001", nombre: "Casa de habitación", colonia: "Bo. Brisas del Sur", en_uso: true, ph: 6.3, tds_g_l: 0.19, profundidad_m: null, coordenada_valida: true, codigo_repetido: true, tipo_bomba: "Sumergible, 2 hp", observaciones: "" },
  { id: 2, codigo: "Pchol.-032", nombre: "Puma Cabañas", colonia: "Bo. Cabañas", en_uso: true, ph: null, tds_g_l: null, profundidad_m: 30, coordenada_valida: false, codigo_repetido: true, tipo_bomba: null, observaciones: null },
  { id: 3, codigo: "Pchol.-045", nombre: "Tienda Carrión", colonia: "Bo.Guadalupe", en_uso: null, ph: 7.1, tds_g_l: 1.4, profundidad_m: 24, coordenada_valida: true, codigo_repetido: false, tipo_bomba: null, observaciones: "Solo para limpieza" }
];

test("normaliza acentos, mayúsculas y espacios", () => {
  assert.equal(normalizar("  Cabañas   ÁREA "), "cabanas area");
});

test("cuenta cada pestaña", () => {
  assert.deepEqual(contarVistas(pozos), { todos: 3, en_uso: 2, calidad: 2, fuera: 2, revisar: 2 });
});

test("busca por número de código, nombre sin acentos u observación", () => {
  assert.deepEqual(filtrarPozos(pozos, { texto: "32" }).map((p) => p.id), [2]);
  assert.deepEqual(filtrarPozos(pozos, { texto: "pchol 1" }).map((p) => p.id), [1]);
  assert.deepEqual(filtrarPozos(pozos, { texto: "Pchol.-045" }).map((p) => p.id), [3]);
  assert.deepEqual(filtrarPozos(pozos, { texto: "carrion" }).map((p) => p.id), [3]);
  assert.deepEqual(filtrarPozos(pozos, { texto: "2 hp" }).map((p) => p.id), [1]);
});

test("combina pestaña y colonia", () => {
  assert.deepEqual(filtrarPozos(pozos, { vista: "revisar", colonia: "Bo. Cabañas" }).map((p) => p.id), [2]);
  assert.deepEqual(filtrarPozos(pozos, { vista: "fuera" }).map((p) => p.id), [1, 3]);
});

test("ordena con los vacíos al final en ambos sentidos", () => {
  assert.deepEqual(ordenarPozos(pozos, { campo: "ph", dir: "asc" }).map((p) => p.id), [1, 3, 2]);
  assert.deepEqual(ordenarPozos(pozos, { campo: "ph", dir: "desc" }).map((p) => p.id), [3, 1, 2]);
  assert.deepEqual(ordenarPozos(pozos, { campo: "codigo", dir: "desc" }).map((p) => p.id), [3, 2, 1]);
});

test("pagina con índice continuo y página dentro del rango", () => {
  const lista = Array.from({ length: 45 }, (_, i) => i);
  assert.deepEqual(paginar(lista, 3, 20), { items: [40, 41, 42, 43, 44], pagina: 3, totalPaginas: 3, desde: 41, hasta: 45, total: 45 });
  assert.equal(paginar(lista, 9, 20).pagina, 3);
  assert.deepEqual(paginar([], 1, 20), { items: [], pagina: 1, totalPaginas: 1, desde: 0, hasta: 0, total: 0 });
});

test("resume las mediciones de los pozos que tienen el dato", () => {
  const ph = resumenMetricas(pozos).find((m) => m.campo === "ph");
  assert.equal(ph.n, 2);
  assert.ok(Math.abs(ph.promedio - 6.7) < 1e-9);
  assert.equal(ph.min, 6.3);
  assert.equal(ph.fuera, 1);
  const profundidad = resumenMetricas(pozos).find((m) => m.campo === "profundidad_m");
  assert.deepEqual([profundidad.n, profundidad.promedio, profundidad.fuera], [2, 27, null]);
});

test("ordena colonias alfabéticamente", () => {
  assert.deepEqual(coloniasDe(pozos).map((c) => c.colonia), ["Bo. Brisas del Sur", "Bo. Cabañas", "Bo.Guadalupe"]);
});

test("marca pH y TDS fuera de los valores guía", () => {
  assert.equal(fueraDeRango("ph", 6.3), true);
  assert.equal(fueraDeRango("ph", 7.1), false);
  assert.equal(fueraDeRango("tds_g_l", 1.4), true);
  assert.equal(fueraDeRango("tds_g_l", null), false);
});

test("muestra — cuando no hay dato, decimales fijos para columnas y el tiempo desde la última carga", () => {
  assert.equal(formatoNumero(null), "—");
  assert.equal(formatoNumero(36.58), "36.58");
  assert.equal(formatoNumero(0.4, 3, true), "0.400");
  assert.equal(formatoNumero(32, 1, true), "32.0");
  const ahora = Date.UTC(2026, 9, 20, 12, 30);
  assert.equal(haceCuanto(new Date(ahora - 20000).toISOString(), ahora), "hace un momento");
  assert.equal(haceCuanto(new Date(ahora - 5 * 60000).toISOString(), ahora), "hace 5 min");
});
