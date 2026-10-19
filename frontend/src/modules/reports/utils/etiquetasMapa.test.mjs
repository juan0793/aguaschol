import assert from "node:assert/strict";
import test from "node:test";
import { dividirEnHojas, foliosDelInforme, ubicarEtiquetas } from "./etiquetasMapa.js";

test("las etiquetas de puntos encimados se separan sin salirse del lienzo", () => {
  const puntos = Array.from({ length: 6 }, () => ({ x: 300, y: 200, ancho: 30 }));
  const lugares = ubicarEtiquetas(puntos, { alto: 26, lienzoAncho: 600, lienzoAlto: 400 });
  assert.equal(lugares[0].movida, false);
  assert.ok(lugares.slice(1).every((lugar) => lugar.movida));
  for (let i = 0; i < lugares.length; i += 1) {
    for (let j = i + 1; j < lugares.length; j += 1) {
      const separadas = Math.abs(lugares[i].x - lugares[j].x) >= 30 || Math.abs(lugares[i].y - lugares[j].y) >= 26;
      assert.ok(separadas, `etiquetas ${i} y ${j} encimadas`);
    }
  }
  assert.ok(lugares.every((lugar) => lugar.x >= 15 && lugar.x <= 585 && lugar.y >= 13 && lugar.y <= 387));
});

test("un punto aislado conserva su lugar", () => {
  const [lugar] = ubicarEtiquetas([{ x: 100, y: 100, ancho: 26 }]);
  assert.deepEqual(lugar, { x: 100, y: 100, movida: false });
});

test("los folios siguen el orden de jornadas, barrios y puntos", () => {
  const a = { id: 1 }; const b = { id: 2 }; const c = { id: 3 };
  const folios = foliosDelInforme([
    { dateKey: "2026-10-14", data: { zones: [{ items: [a] }, { items: [b] }] } },
    { dateKey: "2026-10-15", data: { zones: [{ items: [c] }] } }
  ]);
  assert.deepEqual([folios.get(a), folios.get(b), folios.get(c)], [1, 2, 3]);
});

test("un barrio chico queda en una sola hoja, ordenado por clave", () => {
  const puntos = [
    { id: 1, latitude: 13.3, longitude: -87.19, report_key: "113-45-02" },
    { id: 2, latitude: 13.3001, longitude: -87.1901, report_key: "113-45-01" },
    { id: 3, latitude: 13.3002, longitude: -87.1902, report_key: "" }
  ];
  const hojas = dividirEnHojas(puntos, { claveDe: (punto) => punto.report_key });
  assert.equal(hojas.length, 1);
  assert.deepEqual(hojas[0].map((punto) => punto.id), [2, 1, 3]);
});

test("un barrio grande se parte en hojas de norte a sur sin perder puntos", () => {
  // 200 puntos en una cuadrícula de ~1.3 km × 1.3 km.
  const puntos = Array.from({ length: 200 }, (_, i) => ({ id: i, latitude: 13.30 + Math.floor(i / 20) * 0.0013, longitude: -87.19 + (i % 20) * 0.0006 }));
  puntos.push({ id: "sin", latitude: null, longitude: null });
  const hojas = dividirEnHojas(puntos);
  assert.ok(hojas.length > 1);
  assert.equal(hojas.flat().length, puntos.length);
  assert.equal(new Set(hojas.flat().map((punto) => punto.id)).size, puntos.length);
  const latitudMedia = (hoja) => hoja.filter((p) => p.latitude).reduce((t, p) => t + p.latitude, 0) / hoja.filter((p) => p.latitude).length;
  assert.ok(latitudMedia(hojas[0]) >= latitudMedia(hojas[hojas.length - 1]), "la primera hoja queda al norte");
  assert.equal(hojas[hojas.length - 1].at(-1).id, "sin");
});
