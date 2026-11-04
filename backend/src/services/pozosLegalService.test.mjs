import test from "node:test";
import assert from "node:assert/strict";
import { requierePermiso, estadoLegal, volumenAnualEstimado, canonEstimado, sugerirUso, normalizarSituacionLegal } from "./pozosLegalService.js";

test("requisito y estados legales con fechas límite", () => {
  assert.equal(requierePermiso("domiciliario"), false);
  assert.equal(requierePermiso("industrial_comercial"), true);
  assert.equal(requierePermiso("sin_dato"), "por_definir");
  const r = { uso: "industrial_comercial", permiso_tipo: "permiso_municipal", permiso_vence: "2027-03-01" };
  assert.equal(estadoLegal(r, "2026-11-01").estado, "por_vencer");
  assert.equal(estadoLegal(r, "2026-10-31").estado, "al_dia");
  assert.equal(estadoLegal(r, "2027-03-02").estado, "vencido");
  assert.equal(estadoLegal({ uso: "industrial_comercial", permiso_tipo: "ninguno" }, "2026-12-01").falta_declaracion, true);
  assert.equal(estadoLegal({ ...r, anio_declarado: 2026, volumen_declarado_m3: 0 }, "2026-12-01").falta_declaracion, false);
  assert.equal(estadoLegal({ uso: "comunitario" }, "2026-12-01").estado, "no_requiere");
});

test("volumen, canon, sugerencias y validación", () => {
  const r = { caudal_lps: 2, horas_bombeo_dia: 5, dias_mes: 20 };
  assert.equal(volumenAnualEstimado(r), 8640);
  assert.equal(canonEstimado(r), 21.6);
  assert.equal(sugerirUso("Panadería de prueba"), "industrial_comercial");
  assert.equal(sugerirUso("Purificadora de prueba"), "purificadora");
  assert.equal(sugerirUso("Casa de prueba"), "domiciliario");
  assert.equal(sugerirUso("Pozo comunitario"), "comunitario");
  assert.throws(() => normalizarSituacionLegal({ horas_bombeo_dia: 25 }));
});
