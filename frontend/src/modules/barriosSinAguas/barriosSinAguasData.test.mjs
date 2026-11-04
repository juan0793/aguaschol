import assert from "node:assert/strict";
import test from "node:test";
import { cumpleCriterio, filtrarBarrios, totalesBarrios } from "./barriosSinAguasData.js";

const barrio = (nombre, claves, en_aguas, extra = {}) => ({ barrio: nombre, codigo_caserio: "060", claves, en_aguas, sin_registrar: claves - en_aguas, cobertura: claves ? (en_aguas / claves) * 100 : 0, urbano: claves, rural: 0, avaluo: 0, con_pago_alcaldia: 0, parecido: null, ...extra });
const lista = [barrio("Col. Uno", 100, 0), barrio("Res. Dos", 50, 4), barrio("Aldea Tres", 30, 0, { urbano: 2, rural: 28 }), barrio("Col. Cuatro", 10, 9, { parecido: { nombre: "COL. CUATRO", usuarios: 9 } })];

test("el criterio cuenta solo los barrios sin ninguna clave o bajo el porcentaje elegido", () => {
  assert.equal(cumpleCriterio(lista[0], "0"), true);
  assert.equal(cumpleCriterio(lista[1], "0"), false);
  assert.equal(cumpleCriterio(lista[1], "10"), true);
  assert.deepEqual(filtrarBarrios(lista, { criterio: "50" }).map((b) => b.barrio), ["Col. Uno", "Res. Dos", "Aldea Tres"]);
});

test("filtra por tipo, búsqueda sin acentos y nombre parecido, y suma los totales", () => {
  assert.deepEqual(filtrarBarrios(lista, { criterio: "0", tipo: "rural" }).map((b) => b.barrio), ["Aldea Tres"]);
  assert.deepEqual(filtrarBarrios(lista, { criterio: "50", busqueda: "aldea tres" }).map((b) => b.barrio), ["Aldea Tres"]);
  assert.equal(filtrarBarrios([...lista, barrio("Col. Cinco", 5, 0, { parecido: { nombre: "X", usuarios: 1 } })], { soloParecido: true }).length, 1);
  const t = totalesBarrios(filtrarBarrios(lista, { criterio: "0" }));
  assert.deepEqual([t.barrios, t.claves, t.sin_registrar, t.rural], [2, 130, 130, 28]);
});
