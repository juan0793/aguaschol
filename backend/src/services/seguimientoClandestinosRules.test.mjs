import test from "node:test";
import assert from "node:assert/strict";
import { claveCanonica } from "../utils/claveCanonica.js";
import { armarCasos, casoDe, indicePorClave, resumirCasos } from "./seguimientoClandestinosRules.js";
import { resumenCasos, estadoPorClave } from "./seguimientoClandestinosService.js";
import { createInmueble, getByClave } from "./inmuebleService.js";

// Datos inventados (claves 99x): ningún predio real.
const c = (id, clave, extra = {}) => ({ id, clave_catastral: clave, estado: "pendiente", dictamen: "clandestino", asignado_a: null, inmueble_id: null, motivo_descarte: "", duplicado_de: null, no_duplicado: 0, ...extra });
const f = (id, clave, etapa = "pending", extra = {}) => ({ id, clave_catastral: clave, clave_norm: "", estado_operativo: etapa, archived_at: null, ...extra });
const AUTO = "Aparece en Aguas (verificación automática): Registrado en Aguas";

test("clave canónica: una sola forma por clave", () => {
  for (const v of ["89-13-05", "89-13-5", "89 13 5", "089-13-05"]) assert.equal(claveCanonica(v), "89-13-05", v);
  assert.equal(claveCanonica("14-08-02-7"), "14-08-02-07");
  for (const v of ["", "casa verde", "1-2", "1234-05-07", "00-00-00"]) assert.equal(claveCanonica(v), "", v);
});

test("la ficha manda sobre el candidato; archivar no cambia la etapa", () => {
  assert.equal(casoDe(c(1, "991-01-01")).estado, "por_revisar");
  assert.equal(casoDe(c(1, "991-01-01", { dictamen: "registrado" })).grupo, "aparte");
  assert.equal(casoDe(c(1, "991-01-01", { estado: "descartado", motivo_descarte: AUTO })).estado, "en_aguas");
  assert.equal(casoDe(c(1, "991-01-01", { estado: "descartado", duplicado_de: 2 })), null);
  assert.equal(casoDe(c(1, "991-01-01", { estado: "enviado" }), null).sin_ficha, true);
  const archivada = casoDe(c(1, "991-01-01"), f(5, "991-01-01", "visit", { archived_at: "2026-11-01" }));
  assert.deepEqual([archivada.estado, archivada.grupo, archivada.archivada], ["en_ficha", "pendiente", true]);
});

test("un caso por clave: ficha escrita distinto, copias, sin clave y 4 bloques", () => {
  const casos = armarCasos([
    c(1, "992-06-01", { estado: "enviado", inmueble_id: 5 }),
    c(2, "992-01-01"), c(3, "992-01-01", { estado: "descartado", motivo_descarte: "Punto duplicado" }),
    c(4, "992-01-01", { estado: "descartado", duplicado_de: 2 }),
    c(5, ""), c(6, "992-01-01-01"), c(7, "992-02-02")
  ], [f(5, "992-6-1", "visit"), f(6, "992-02-02", "confirmed")]);
  assert.equal(casos.length, 5);
  const porClave = indicePorClave(casos);
  assert.equal(porClave.get("992-06-01").estado, "en_ficha");
  assert.equal(porClave.get("992-01-01").estado, "descartado");
  assert.equal(porClave.get("992-01-01-01").estado, "por_revisar");
  assert.equal(porClave.get("992-02-02").pendientes_con_ficha, 1);
  const r = resumirCasos(casos);
  assert.equal(r.pendiente + r.aparte + r.resuelto, r.total);
  assert.equal(r.avisos.pendientes_con_ficha, 1);
});

test("el técnico solo recibe sus casos; estadoPorClave acepta cualquier escritura", async () => {
  const fuentes = { candidatos: [c(1, "993-01-01", { asignado_a: 7 }), c(2, "993-01-02")], fichas: [f(9, "993-02-01", "regularized")] };
  assert.equal((await resumenCasos({ id: 1, role: "admin" }, fuentes)).total, 3);
  const propio = await resumenCasos({ id: 7, role: "operator" }, fuentes);
  assert.deepEqual([propio.total, propio.alcance], [1, "propio"]);
  assert.equal((await estadoPorClave(["993-2-1", "999-99-99"], fuentes)).get("993-02-01").estado, "regularizado");
});

test("una ficha escrita 994-6-1 se encuentra con 994-06-01", async () => {
  const ficha = await createInmueble({ clave_catastral: "994-6-1" });
  assert.equal((await getByClave("994-06-01")).id, ficha.id);
  assert.equal(ficha.clave_norm, "994-06-01");
});
