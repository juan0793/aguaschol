import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { computeFechaLimite, describeAvisoPlazo, etiquetaPlazo, normalizePlazo, numeroEnLetras } from "./avisoPlazo.js";

// 2 de octubre de 2026 es viernes.
const VIERNES = "2026-10-02";

test("24 y 48 horas vencen en días hábiles: un viernes salta al lunes y al martes", () => {
  assert.equal(computeFechaLimite(VIERNES, { tipo: "horas", valor: 24 }), "2026-10-05");
  assert.equal(computeFechaLimite(VIERNES, { tipo: "horas", valor: 48 }), "2026-10-06");
  assert.equal(computeFechaLimite("2026-10-05", { tipo: "horas", valor: 24 }), "2026-10-06");
});

test("los días hábiles no cuentan sábado ni domingo", () => {
  assert.equal(computeFechaLimite(VIERNES, { tipo: "dias", valor: 2 }), "2026-10-06");
  assert.equal(computeFechaLimite(VIERNES, { tipo: "dias", valor: 5 }), "2026-10-09");
  assert.equal(computeFechaLimite("2026-10-03", { tipo: "dias", valor: 1 }), "2026-10-05");
});

test("la fecha exacta se respeta y los valores fuera de rango no dan fecha", () => {
  assert.equal(computeFechaLimite(VIERNES, { tipo: "fecha", fecha: "2026-10-20" }), "2026-10-20");
  assert.equal(computeFechaLimite(VIERNES, { tipo: "fecha", fecha: "2026-02-30" }), null);
  assert.equal(computeFechaLimite(VIERNES, { tipo: "horas", valor: 0 }), null);
  assert.equal(computeFechaLimite(VIERNES, { tipo: "dias", valor: 91 }), null);
  assert.equal(computeFechaLimite("no-fecha", { tipo: "dias", valor: 2 }), null);
  assert.equal(normalizePlazo({ tipo: "semanas", valor: 1 }), null);
});

test("la frase del aviso depende del tipo, no de que haya fecha límite", () => {
  const fecha = (value) => `[${value}]`;
  assert.equal(describeAvisoPlazo({ aviso_plazo_tipo: "horas", aviso_plazo_valor: 24, fecha_limite_aviso: "2026-10-05" }, fecha), "en un plazo máximo de 24 horas a partir de la recepción del presente aviso");
  assert.equal(describeAvisoPlazo({ aviso_plazo_tipo: "dias", aviso_plazo_valor: 2, fecha_limite_aviso: "2026-10-06" }, fecha), "en un plazo máximo de dos (2) días hábiles a partir de la recepción del presente aviso");
  assert.equal(describeAvisoPlazo({ aviso_plazo_tipo: "dias", aviso_plazo_valor: 1 }, fecha), "en un plazo máximo de un (1) día hábil a partir de la recepción del presente aviso");
  assert.equal(describeAvisoPlazo({ aviso_plazo_tipo: "fecha", fecha_limite_aviso: "2026-10-20" }, fecha), "a más tardar el [2026-10-20]");
});

test("los avisos de antes conservan su texto", () => {
  assert.equal(describeAvisoPlazo({ fecha_limite_aviso: "2026-08-20" }, (v) => v), "a más tardar el 2026-08-20");
  assert.match(describeAvisoPlazo({}), /7 \(7\) días calendario/);
  assert.match(describeAvisoPlazo({ aviso_plazo_dias: 3 }), /3 \(3\) días calendario/);
});

test("números en letras y etiqueta corta", () => {
  assert.deepEqual([1, 2, 21, 24, 30, 48, 90].map(numeroEnLetras), ["un", "dos", "veintiún", "veinticuatro", "treinta", "cuarenta y ocho", "noventa"]);
  assert.equal(etiquetaPlazo({ aviso_plazo_tipo: "horas", aviso_plazo_valor: 48 }), "48 horas");
  assert.equal(etiquetaPlazo({ aviso_plazo_tipo: "dias", aviso_plazo_valor: 1 }), "1 día hábil");
  assert.equal(etiquetaPlazo({}), "");
});

test("la copia del frontend es igual a la del backend", () => {
  const sinCabecera = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n").split("\n").filter((line) => !line.includes("frontend/src/modules/clandestinos/avisoPlazo.js") && !line.includes("Copia de backend/src/utils/avisoPlazo.js")).join("\n");
  assert.equal(sinCabecera("../../../frontend/src/modules/clandestinos/avisoPlazo.js"), sinCabecera("./avisoPlazo.js"));
});
