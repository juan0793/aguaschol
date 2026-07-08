import assert from "node:assert/strict";
import test from "node:test";
import { extractPadronLookupReferences } from "./claveAndLookup.js";

test("extrae clave y abonado desde descripcion tecnica", () => {
  assert.deepEqual(
    extractPadronLookupReferences("Caja con clave 10-07-01-01 y codigo de abonado 22095").map(({ field, value, label }) => ({
      field,
      value,
      label
    })),
    [
      { field: "clave", value: "10-07-01-01", label: "10-07-01-01" },
      { field: "abonado", value: "22095", label: "Abonado 22095" }
    ]
  );
});

test("reconoce abonado con acento y evita numeros sueltos", () => {
  assert.deepEqual(
    extractPadronLookupReferences("co\u0301digo de abonado: 16523; casa 2026").map(({ field, value }) => ({ field, value })),
    [{ field: "abonado", value: "16523" }]
  );
});

test("acepta solo el numero como abonado", () => {
  assert.deepEqual(
    extractPadronLookupReferences("22095").map(({ field, value, label }) => ({ field, value, label })),
    [{ field: "abonado", value: "22095", label: "Abonado 22095" }]
  );

  assert.deepEqual(extractPadronLookupReferences("casa 2026"), []);
});
