import assert from "node:assert/strict";
import test from "node:test";
import { armarAvanceMes } from "./entregasRules.js";

const barrios = [
  { codigo: "24", nombre: "Bo. La Libertad", claves: 944, responsable_id: 1 },
  { codigo: "14", nombre: "Bo. El Centro", claves: 869, responsable_id: 1 },
  { codigo: "22", nombre: "Bo. Cabañas", claves: 1285, responsable_id: 2 },
  { codigo: "41", nombre: "Bo. Iztoca", claves: 724, responsable_id: null }
];
const personal = [{ id: 1, nombre_completo: "Carlos Osorto" }, { id: 2, nombre_completo: "Luis Fernando" }];

test("un barrio se llena con un lote cerrado y sin lotes abiertos en el ciclo", () => {
  const avance = armarAvanceMes({ barrios, personal, desde: "2026-10-10", hasta: "2026-10-12", lotes: [
    { barrio_codigo: "24", estado: "CERRADO", lotes: 2, asignadas: 900, entregadas: 880, ids: "41,37" },
    { barrio_codigo: "22", estado: "CERRADO", lotes: 1, asignadas: 600, entregadas: 590 },
    { barrio_codigo: "22", estado: "ABIERTO", lotes: 1, asignadas: 500, entregadas: 0, ids: "52" }
  ] });
  assert.equal(avance.total, 3, "Iztoca no tiene responsable: queda fuera");
  assert.equal(avance.entregados, 1);
  assert.equal(avance.en_curso, 1);
  assert.equal(avance.pendientes, 1);
  assert.equal(avance.porcentaje, 33.3);
  assert.equal(avance.documentos_entregados, 1470);
  const libertad = avance.barrios.find((fila) => fila.codigo === "24");
  assert.deepEqual([libertad.lotes_cerrados, libertad.lotes_abiertos], [[41, 37], []]);
  assert.deepEqual(avance.barrios.find((fila) => fila.codigo === "22").lotes_abiertos, [52]);
  assert.deepEqual(avance.barrios.map((fila) => [fila.nombre, fila.estado, fila.responsable_nombre]), [
    ["Bo. El Centro", "pendiente", "Carlos Osorto"],
    ["Bo. La Libertad", "entregado", "Carlos Osorto"],
    ["Bo. Cabañas", "en_curso", "Luis Fernando"]
  ]);
});

test("sin reparto no inventa avance", () => {
  const avance = armarAvanceMes({ barrios: [], lotes: [] });
  assert.equal(avance.total, 0);
  assert.equal(avance.porcentaje, 0);
});
