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

test("en trámite es su propio estado y el vencimiento escrito va aparte del calculado", async () => {
  const { estadoLegal, presentarSituacionLegal } = await import("./pozosLegalService.js");
  assert.equal(estadoLegal({ uso: "purificadora", permiso_tipo: "en_tramite" }, "2026-11-04").estado, "en_tramite");
  const sinManual = presentarSituacionLegal({ uso: "purificadora", permiso_tipo: "permiso_municipal", permiso_fecha: "2020-03-10" }, { codigo: "P-1", nombre: "Uno" }, "2026-11-04");
  assert.equal(sinManual.permiso_vence, "2030-03-10");
  assert.equal(sinManual.permiso_vence_manual, null);
});

test("un registro guardado para otro pozo queda por definir y dice para cuál era", async () => {
  const { presentarSituacionLegal } = await import("./pozosLegalService.js");
  const registro = { pozo_codigo: "Pchol.-010", pozo_nombre: "Gasolinera", uso: "industrial_comercial", permiso_tipo: "permiso_municipal", permiso_vence: "2030-01-01" };
  const mismo = presentarSituacionLegal(registro, { codigo: "Pchol.-010", nombre: "Gasolinera" }, "2026-11-04");
  assert.equal(mismo.estado, "al_dia");
  assert.equal(mismo.desfasado, false);
  const otro = presentarSituacionLegal(registro, { codigo: "Pchol.-011", nombre: "Casa" }, "2026-11-04");
  assert.equal(otro.estado, "por_definir");
  assert.deepEqual(otro.registrado_para, { codigo: "Pchol.-010", nombre: "Gasolinera" });
  assert.equal(presentarSituacionLegal({ ...registro, pozo_codigo: "" }, { codigo: "X" }, "2026-11-04").desfasado, false);
});

test("guardar anota el código y el nombre del pozo", async () => {
  const { guardarSituacionLegal, __resetPozosLegalMemoryForTests } = await import("./pozosLegalService.js");
  __resetPozosLegalMemoryForTests();
  const guardado = await guardarSituacionLegal(7, { uso: "purificadora", permiso_tipo: "en_tramite" }, { id: 1 }, { codigo: "Pchol.-007", nombre: "Purificadora" });
  assert.equal(guardado.pozo_codigo, "Pchol.-007");
  assert.equal(guardado.pozo_nombre, "Purificadora");
});

test("renovar: con el vencimiento vacío rige la nueva fecha + 10 años", async () => {
  const { normalizarSituacionLegal, presentarSituacionLegal } = await import("./pozosLegalService.js");
  const antes = { uso: "purificadora", permiso_tipo: "permiso_municipal", permiso_fecha: "2016-01-10", permiso_vence: "2026-01-10" };
  const renovado = normalizarSituacionLegal({ permiso_fecha: "2026-11-04", permiso_vence: "" }, antes);
  assert.equal(renovado.permiso_vence, null);
  const visto = presentarSituacionLegal(renovado, {}, "2026-11-05");
  assert.equal(visto.permiso_vence, "2036-11-04");
  assert.equal(visto.estado, "al_dia");
});
