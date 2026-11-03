import test from "node:test";
import assert from "node:assert/strict";
import { debeGuardar, distanciaMetros, lecturaValida, mapaDelEquipo, muestrearRastro, registrarUbicacion } from "./teamLocationService.js";

const tecnico = { id: 41, role: "validadora_campo", full_name: "Técnica" };

test("ubicación: valida coordenadas y redondea los extras", () => {
  const ahora = new Date("2026-11-03T15:00:00Z");
  assert.equal(lecturaValida({ latitude: "abc", longitude: -87.19 }, ahora), null);
  assert.equal(lecturaValida({ latitude: 0, longitude: 0 }, ahora), null);
  assert.equal(lecturaValida({ latitude: 95, longitude: -87 }, ahora), null);
  assert.deepEqual(lecturaValida({ latitude: 13.30031234567, longitude: -87.1908, accuracy: 7.6, heading: 370, speed: -1 }, ahora), {
    latitude: 13.3003123, longitude: -87.1908, accuracy: 8, heading: 10, speed: null, at: "2026-11-03T15:00:00.000Z"
  });
});

test("ubicación: se guarda cada 2 min o al moverse 15 m", () => {
  const base = { latitude: 13.3, longitude: -87.19, at: "2026-11-03T15:00:00Z" };
  assert.equal(debeGuardar(null, base), true);
  assert.equal(debeGuardar(base, { ...base, at: "2026-11-03T15:01:30Z" }), false);
  assert.equal(debeGuardar(base, { ...base, at: "2026-11-03T15:02:00Z" }), true);
  assert.equal(debeGuardar(base, { ...base, latitude: 13.3002, at: "2026-11-03T15:00:05Z" }), true); // ~22 m
  assert.ok(Math.abs(distanciaMetros(base, { ...base, latitude: 13.301 }) - 111) < 1);
});

test("ubicación: el recorrido se recorta conservando inicio y fin", () => {
  const puntos = Array.from({ length: 1000 }, (_, i) => i);
  const corto = muestrearRastro(puntos, 50);
  assert.equal(corto.length, 50);
  assert.equal(corto[0], 0);
  assert.equal(corto.at(-1), 999);
  assert.deepEqual(muestrearRastro([1, 2, 3], 50), [1, 2, 3]);
});

test("ubicación: solo técnicos la envían y solo admin y gerencia ven el mapa", async () => {
  await assert.rejects(() => registrarUbicacion({ latitude: 13.3, longitude: -87.19 }, { id: 1, role: "admin" }), (error) => error.status === 403);
  await assert.rejects(() => registrarUbicacion({ latitude: 13.3, longitude: -87.19 }, { ...tecnico, preview: true }), (error) => error.status === 403);
  await assert.rejects(() => registrarUbicacion({ latitude: "x", longitude: -87.19 }, tecnico), (error) => error.status === 400);
  assert.deepEqual(await registrarUbicacion({ latitude: 13.3, longitude: -87.19, accuracy: 6 }, tecnico), { ok: true, guardada: true });
  assert.deepEqual(await registrarUbicacion({ latitude: 13.3, longitude: -87.19, accuracy: 6 }, tecnico), { ok: true, guardada: false });
  await assert.rejects(() => mapaDelEquipo({}, tecnico), (error) => error.status === 403);
  const mapa = await mapaDelEquipo({ tz: 360 }, { id: 2, role: "gerente" });
  const yo = mapa.tecnicos.find((item) => item.id === tecnico.id);
  assert.equal(mapa.hoy, true);
  assert.equal(yo.rastro.length, 1);
  assert.equal(yo.ubicacion.accuracy, 6);
});
