import assert from "node:assert/strict";
import { test } from "node:test";
import { formatMetric, heatLevel, hourlyHeatmap, linePath, niceCeil, servicePeaks, sliceRange, timeTicks } from "./railwayUsageCharts.js";

test("niceCeil redondea el techo del eje", () => {
  assert.equal(niceCeil(0.0137), 0.02);
  assert.equal(niceCeil(1.87), 2);
  assert.equal(niceCeil(3.2), 5);
  assert.equal(niceCeil(0), 1);
});

test("sliceRange recorta desde el dato más reciente", () => {
  const list = [{ serviceId: "a", points: [[0, 1], [3600, 2], [7200, 3]] }];
  const { from, to, list: sliced } = sliceRange(list, 1);
  assert.equal(to, 7200);
  assert.equal(from, 3600);
  assert.deepEqual(sliced[0].points, [[3600, 2], [7200, 3]]);
});

test("hourlyHeatmap usa la hora de Honduras (UTC-6) y lunes como primer día", () => {
  // 2026-09-21 20:00 UTC = lunes 14:00 en Tegucigalpa.
  const ts = Date.UTC(2026, 8, 21, 20) / 1000;
  const heat = hourlyHeatmap([
    { points: [[ts, 1]] },
    { points: [[ts, 0.5]] }
  ]);
  assert.equal(heat.peak.day, 0);
  assert.equal(heat.peak.hour, 14);
  assert.equal(heat.peak.value, 1.5);
  assert.equal(heat.cells.filter((cell) => cell.value !== null).length, 1);
});

test("heatLevel escala entre la hora más tranquila y la más cargada", () => {
  assert.equal(heatLevel(null, 1, 2), null);
  assert.equal(heatLevel(1.9, 1.9, 2.8), 0);
  assert.equal(heatLevel(2.8, 1.9, 2.8), 5);
  assert.equal(heatLevel(2.35, 1.9, 2.8), 3);
  assert.equal(heatLevel(1, 1, 1), 5);
});

test("linePath corta la línea en huecos de más de dos horas", () => {
  const d = linePath([[0, 0], [3600, 1], [5 * 3600, 1]], (ts) => ts / 3600, (v) => v);
  assert.equal(d, "M0.0,0.0L1.0,1.0M5.0,1.0");
});

test("timeTicks alinea los cortes diarios a medianoche local", () => {
  const from = Date.UTC(2026, 8, 20, 0) / 1000;
  const { ticks } = timeTicks(from, from + 3 * 86400, 168);
  const local = new Date((ticks[0] - 6 * 3600) * 1000);
  assert.equal(local.getUTCHours(), 0);
});

test("servicePeaks da un máximo por servicio, del más alto al más bajo", () => {
  const peaks = servicePeaks([
    { serviceId: "a", service: "A", points: [[1, 0.2], [2, 0.5]] },
    { serviceId: "b", service: "B", points: [[1, 0.9], [2, 0.1]] },
    { serviceId: "c", service: "C", points: [] }
  ]);
  assert.deepEqual(peaks.map((peak) => [peak.serviceId, peak.timestamp, peak.value]), [["b", 1, 0.9], ["a", 2, 0.5]]);
});

test("formatMetric pasa a MB por debajo de 1 GB", () => {
  assert.equal(formatMetric("MEMORY_USAGE_GB", 0.5), "512 MB");
  assert.equal(formatMetric("MEMORY_USAGE_GB", 1.87), "1.87 GB");
  assert.equal(formatMetric("CPU_USAGE", 0.02), "0.020 vCPU");
});
