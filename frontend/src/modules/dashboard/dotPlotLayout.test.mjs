import assert from "node:assert/strict";
import test from "node:test";
import { buildServiceColumns, layoutDots, niceTicks } from "./dotPlotLayout.js";

test("el eje usa pasos redondos que cubren el máximo", () => {
  assert.deepEqual(niceTicks(12302140), { top: 15000000, ticks: [0, 5000000, 10000000, 15000000] });
  assert.deepEqual(niceTicks(7.3).ticks, [0, 2, 4, 6, 8]);
  assert.equal(niceTicks(0).top, 1);
});

test("una columna por servicio, un punto por barrio con mora en ese servicio", () => {
  const barrios = [
    { barrio_colonia: "BO. CABAÑAS", servicios: [{ field: "agua", active: 10, deuda: { total: 500 } }, { field: "barrido", active: 0, deuda: { total: 0 } }] },
    { barrio_colonia: " ", servicios: [{ field: "agua", active: 3, deuda: { total: 90 } }] }
  ];
  const columns = buildServiceColumns(barrios, [{ field: "agua", label: "Agua" }, { field: "barrido", label: "Barrido" }]);
  assert.deepEqual(columns.map((column) => column.dots.length), [2, 0]);
  assert.equal(columns[0].dots[1].barrio, "Sin barrio");
});

const sameValue = (count, value = 10) => Array.from({ length: count }, (_, index) => ({ barrio: `B${index}`, value, cuentas: 1 }));
const positions = (column) => new Set(column.dots.map((dot) => `${dot.x.toFixed(2)},${dot.y.toFixed(2)}`)).size;

test("los puntos quedan dentro de su columna, cerca de su valor y sin taparse", () => {
  const { radius, columns: [column] } = layoutDots([{ field: "agua", label: "Agua", dots: sameValue(60) }], { width: 200, height: 100, left: 0, top: 0, radius: 4, maxValue: 20 });
  assert.equal(column.center, 100);
  assert.ok(column.dots.every((dot) => dot.x >= radius && dot.x <= 200 - radius));
  assert.ok(column.dots.every((dot) => Math.abs(dot.y - 50) <= 20), "se quedan cerca de su altura");
  assert.equal(positions(column), 60, "cada barrio tiene su propio lugar");
});

test("en una columna angosta los puntos se achican y en el piso solo suben", () => {
  const { radius, columns: [column] } = layoutDots([{ field: "agua", label: "Agua", dots: sameValue(40, 0.01) }], { width: 52, height: 230, left: 0, top: 10, radius: 4, maxValue: 100 });
  assert.ok(radius < 4, "achica los puntos antes de amontonarlos");
  assert.equal(positions(column), 40);
  assert.ok(column.dots.every((dot) => dot.y <= 240 + 0.01), "no bajan del eje");
});
