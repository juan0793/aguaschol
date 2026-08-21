import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBarrioCatalog,
  buildClaveBase,
  classifyGpsAccuracy,
  extractClaveFromText,
  getBarrioCodeFromClave,
  getPointClave,
  haversineMeters,
  matchesBarrioCode,
  median,
  resolveFieldZone
} from "./claveField.js";

// Los casos de "misma clave / mismo barrio" replican frontend/src/components/fieldControlUtils.test.mjs.
// Si uno de estos asserts cambia, el test del frontend debe cambiar igual: son la misma regla.

const catalog = buildBarrioCatalog([{ codigo: "24", barrio: "La Libertad", activo: true }]);

test("extrae la clave desde el texto del punto igual que el frontend", () => {
  assert.equal(getPointClave({ reference_note: "Clave 24-04-20" }), "24-04-20");
  assert.equal(getPointClave({ description: "24-05-10" }), "24-05-10");
  assert.equal(getPointClave({ reference_note: "Casa esquina sin clave" }), "");
  assert.equal(extractClaveFromText("pozo 105-01-02-03 al fondo"), "105-01-02-03");
});

test("la clave base son los tres primeros bloques", () => {
  assert.equal(buildClaveBase("24-04-20-01"), "24-04-20");
  assert.equal(buildClaveBase("24-04-20"), "24-04-20");
  assert.equal(buildClaveBase("24-04"), "");
  assert.equal(getBarrioCodeFromClave("5-04-20"), "05");
});

test("resuelve el barrio con la misma cascada que getFieldPointZone", () => {
  assert.equal(resolveFieldZone({ reference_note: "Clave 24-04-20" }, catalog).label, "24 - La Libertad");
  assert.equal(resolveFieldZone({ reference_note: "sin clave" }, catalog).label, "Sin barrio");
  assert.equal(resolveFieldZone({ reference_note: "99-01-02" }, catalog).label, "99 - Barrio sin nombre");

  const oficial = buildBarrioCatalog([
    { codigo: "05", barrio: "Barrio Campo Sol" },
    { codigo_barrio: "05", nombre_barrio: "CAMPO SOL" }
  ]);
  assert.equal(resolveFieldZone({ suggested_zone: "Barrio Campo Sol" }, oficial).label, "05 - CAMPO SOL");
  assert.equal(resolveFieldZone({ report_zone_label: "5 - Campo Sol | Clave 05-01-02" }, oficial).label, "05 - CAMPO SOL");
});

test("clasifica la precision GPS en los cortes acordados", () => {
  assert.equal(classifyGpsAccuracy(4.8), "excelente");
  assert.equal(classifyGpsAccuracy(5), "excelente");
  assert.equal(classifyGpsAccuracy(10.1), "aceptable");
  assert.equal(classifyGpsAccuracy(30), "baja");
  assert.equal(classifyGpsAccuracy(31), "deficiente");
  assert.equal(classifyGpsAccuracy(null), "sin_dato");
  assert.equal(classifyGpsAccuracy(0), "sin_dato");
});

test("la distancia entre dos coordenadas es correcta", () => {
  assert.equal(haversineMeters(13.3017, -87.1889, 13.3017, -87.1889), 0);
  const distance = haversineMeters(13.3017, -87.1889, 13.3043, -87.1889);
  assert.ok(distance > 285 && distance < 292, `distancia inesperada: ${distance}`);
  assert.equal(haversineMeters(13.3, null, 13.3, -87.1), null);
});

test("compara barrio declarado vs geografico sin autocorregir", () => {
  assert.equal(matchesBarrioCode("24", "24"), true);
  assert.equal(matchesBarrioCode("24", "05"), false);
  assert.equal(matchesBarrioCode("24", ""), null);
  assert.equal(matchesBarrioCode("", "24"), null);
  assert.equal(matchesBarrioCode(null, null), null);
});

test("la mediana soporta listas pares, impares y vacias", () => {
  assert.equal(median([]), 0);
  assert.equal(median([5]), 5);
  assert.equal(median([1, 3, 5, 9]), 4);
  assert.equal(median([9, 1, 5]), 5);
});
