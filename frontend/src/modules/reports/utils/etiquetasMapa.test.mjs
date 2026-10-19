import assert from "node:assert/strict";
import test from "node:test";
import { foliosDelInforme, ubicarEtiquetas } from "./etiquetasMapa.js";

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
