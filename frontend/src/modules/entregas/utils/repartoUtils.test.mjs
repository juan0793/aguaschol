import test from "node:test";
import assert from "node:assert/strict";
import {
  asignacionesDePlantilla,
  barriosDeResponsable,
  colorPorResponsable,
  desvioEnFrase,
  emparejarNombre,
  metaPorPersona,
  participantesDelReparto,
  totalesPorResponsable,
  tramoDeCarga
} from "./repartoUtils.js";

const personal = [
  { id: 7, nombre_completo: "Luis Fernando Herrera", activo: true, tipo_personal: "ENTREGA_FACTURAS" },
  { id: 3, nombre_completo: "Sayma Lorena Díaz", activo: true, tipo_personal: "ENTREGA_FACTURAS" },
  { id: 9, nombre_completo: "Sindy Martínez", activo: true, tipo_personal: "ENTREGA_FACTURAS" },
  { id: 12, nombre_completo: "Oscar Álvarez", activo: true, tipo_personal: "COBRADOR" },
  { id: 15, nombre_completo: "Luis Mejía", activo: true, tipo_personal: "ENTREGA_FACTURAS" },
  { id: 20, nombre_completo: "Pedro Inactivo", activo: false, tipo_personal: "ENTREGA_FACTURAS" }
];

const barrios = [
  { codigo: "12", nombre: "El Hospital", claves: 277, responsable_id: 3, orden_ruta: 1 },
  { codigo: "16", nombre: "Los Mangos", claves: 445, responsable_id: 3, orden_ruta: 4 },
  { codigo: "41", nombre: "Iztoca", claves: 724, responsable_id: 3, orden_ruta: null },
  { codigo: "22", nombre: "Cabañas", claves: 1285, responsable_id: 7, orden_ruta: null },
  { codigo: "17", nombre: "Morazán", claves: 207, responsable_id: 12, orden_ruta: null },
  { codigo: "113", nombre: "Montelimar", claves: 1389, responsable_id: null, orden_ruta: null }
];

test("participantes: con barrios o activos que reparten, ordenados por id", () => {
  const ids = participantesDelReparto(barrios, personal).map((p) => p.id);
  // El cobrador entra porque tiene barrio; el inactivo sin barrios no.
  assert.deepEqual(ids, [3, 7, 9, 12, 15]);
});

test("el color sigue a la persona, no a la carga", () => {
  const colores = colorPorResponsable(participantesDelReparto(barrios, personal));
  assert.equal(colores.get(3), "#2a78d6");
  assert.equal(colores.get(7), "#eb6834");
});

test("totales y meta pareja", () => {
  const { totales, sinAsignar } = totalesPorResponsable(barrios);
  assert.deepEqual(totales.get(3), { claves: 1446, barrios: 3 });
  assert.deepEqual(sinAsignar, { claves: 1389, barrios: 1 });
  assert.equal(metaPorPersona(barrios, participantesDelReparto(barrios, personal)), Math.round(4327 / 5));
});

test("tramo de carga alrededor de la meta", () => {
  assert.equal(tramoDeCarga(0, 1000).etiqueta, "Sin barrios");
  assert.equal(tramoDeCarga(1000, 1000).clave, "pareja");
  assert.equal(tramoDeCarga(1100, 1000).clave, "alta");
  assert.equal(tramoDeCarga(1300, 1000).clave, "muy-alta");
  assert.equal(tramoDeCarga(900, 1000).clave, "baja");
});

test("barrios en orden de ruta y luego por carga", () => {
  assert.deepEqual(barriosDeResponsable(barrios, 3).map((b) => b.codigo), ["12", "16", "41"]);
});

test("emparejar nombres de plantilla sin adivinar empates", () => {
  assert.equal(emparejarNombre("Luis Fernando", personal)?.id, 7);
  assert.equal(emparejarNombre("Sayma", personal)?.id, 3);
  assert.equal(emparejarNombre("Oscar Alvarez", personal)?.id, 12);
  // "Luis" solo empata entre Luis Fernando y Luis Mejía.
  assert.equal(emparejarNombre("Luis", personal), null);
  assert.equal(emparejarNombre("Diego Saldaña", personal), null);
});

test("aplicar plantilla: reparto completo, orden solo donde es real", () => {
  const plantilla = { ordenReal: ["Sayma"], zonas: { Sayma: ["16", "12", "99"], Sindy: ["113"], Diego: ["22"] } };
  const { asignaciones, desconocidos } = asignacionesDePlantilla(plantilla, { Sayma: 3, Sindy: 9 }, barrios);
  const porCodigo = Object.fromEntries(asignaciones.map((a) => [a.barrio_codigo, a]));
  assert.deepEqual(desconocidos, ["99"]);
  assert.deepEqual(porCodigo["16"], { barrio_codigo: "16", responsable_id: 3, orden_ruta: 1 });
  assert.deepEqual(porCodigo["113"], { barrio_codigo: "113", responsable_id: 9, orden_ruta: null });
  // Diego no se emparejo: su barrio queda libre.
  assert.equal(porCodigo["22"].responsable_id, null);
  // Iztoca y Morazán no estan en la plantilla: se liberan.
  assert.equal(porCodigo["41"].responsable_id, null);
  assert.equal(porCodigo["17"].responsable_id, null);
});

test("frase de desvio sin repetir 'la meta'", () => {
  assert.equal(desvioEnFrase(2702, 2702), "en la meta");
  assert.equal(desvioEnFrase(2810, 2702), "4 % sobre la meta");
  assert.equal(desvioEnFrase(2530, 2702), "6 % bajo la meta");
});
