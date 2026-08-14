import test from "node:test";
import assert from "node:assert/strict";
import { DEBT_RANGES, computeFieldAnalytics } from "./fieldAnalyticsService.js";

const catalog = [
  { codigo: "24", barrio: "La Libertad", activo: true },
  { codigo: "02", barrio: "Lotificacion Carranza", activo: true }
];

const padronRecord = (base, abonado, total, extra = {}) => ({
  clave_catastral: `${base}-01`,
  clave_base: base,
  abonado,
  inquilino: `Abonado ${abonado}`,
  nombre: `Abonado ${abonado}`,
  agua: "S",
  alcantarillado: "N",
  valor: total,
  intereses: 0,
  total,
  ...extra
});

const buildIndex = (records) => {
  const byBase = new Map();
  records.forEach((record) => {
    const rows = byBase.get(record.clave_base) ?? [];
    rows.push(record);
    byBase.set(record.clave_base, rows);
  });
  return { byBase, byExact: new Map() };
};

const padronIndex = buildIndex([
  padronRecord("24-04-20", "000123", 18425.2),
  padronRecord("02-12-04", "000456", 800),
  padronRecord("02-12-04", "000457", 0),
  padronRecord("24-09-01", "000999", 62000, { agua: "N", alcantarillado: "S" })
]);

const points = [
  {
    id: 1,
    point_type: "negocio_local_comercial",
    latitude: 13.3017,
    longitude: -87.1889,
    accuracy_meters: 4.8,
    reference_note: "Pulperia clave 24-04-20",
    description: "",
    validation_status: "approved",
    created_by: 7,
    created_by_name: "Luis Herrera",
    diary_date: "2026-08-13",
    created_at: "2026-08-13T18:29:00Z"
  },
  {
    id: 2,
    point_type: "caja_registro",
    latitude: 13.302,
    longitude: -87.1891,
    accuracy_meters: 42,
    reference_note: "Caja 02-12-04",
    description: "",
    validation_status: "pending",
    created_by: 7,
    created_by_name: "Luis Herrera",
    diary_date: "2026-08-13",
    created_at: "2026-08-13T18:35:00Z"
  },
  {
    id: 3,
    point_type: "caja_registro",
    latitude: 13.3045,
    longitude: -87.1889,
    accuracy_meters: 6,
    reference_note: "Caja 02-12-04 otro sector",
    description: "",
    validation_status: "pending",
    created_by: 9,
    created_by_name: "Ana Discua",
    diary_date: "2026-08-10",
    created_at: "2026-08-10T15:00:00Z"
  },
  {
    id: 4,
    point_type: "caja_registro",
    latitude: 13.3011,
    longitude: -87.1885,
    accuracy_meters: null,
    reference_note: "Casa esquina sin clave",
    description: "",
    validation_status: "needs_correction",
    created_by: 9,
    created_by_name: "Ana Discua",
    diary_date: "2026-08-10",
    created_at: "2026-08-10T15:10:00Z"
  }
];

const analytics = computeFieldAnalytics({ points, padronIndex, catalog });

test("el territorio cuenta puntos, barrios, claves y tecnicos", () => {
  assert.equal(analytics.territory.points, 4);
  assert.equal(analytics.territory.keys, 2); // 24-04-20 y 02-12-04
  assert.equal(analytics.territory.zones, 3); // La Libertad, Carranza y "Sin barrio"
  assert.equal(analytics.territory.technicians, 2);
  assert.equal(analytics.territory.withoutKey, 1);
});

test("la cartera no cuenta dos veces al mismo abonado aunque la clave aparezca en varios puntos", () => {
  // 02-12-04 aparece en dos puntos con dos abonados (800 + 0); 24-04-20 aporta 18,425.20.
  assert.equal(analytics.portfolio.accountsFound, 3);
  assert.equal(analytics.portfolio.total, 19225.2);
  assert.equal(analytics.portfolio.median, 800);
});

test("los rangos de cartera suman el total y el 100 por ciento", () => {
  const ranges = analytics.portfolio.ranges;
  assert.equal(ranges.length, DEBT_RANGES.length);
  assert.equal(
    ranges.reduce((sum, range) => sum + range.accounts, 0),
    analytics.portfolio.accountsFound
  );
  assert.equal(
    Number(ranges.reduce((sum, range) => sum + range.total, 0).toFixed(2)),
    analytics.portfolio.total
  );
  assert.equal(ranges.find((range) => range.id === "sin_deuda").accounts, 1);
  assert.equal(ranges.find((range) => range.id === "r4").accounts, 1);
});

test("el analisis comercial solo considera point_type negocio_local_comercial", () => {
  assert.equal(analytics.commercial.businesses, 1);
  assert.equal(analytics.commercial.percentOfPoints, 25);
  assert.equal(analytics.commercial.accounts, 1);
  assert.equal(analytics.commercial.total, 18425.2);
  assert.equal(analytics.commercial.over10k, 1);
  assert.equal(analytics.commercial.over20k, 0);
  assert.equal(analytics.commercial.withoutSewer, 1); // el padron marca alcantarillado en N
});

test("la calidad GPS clasifica por rango y detecta puntos sin clave", () => {
  const buckets = Object.fromEntries(analytics.quality.buckets.map((bucket) => [bucket.id, bucket.count]));
  assert.equal(buckets.excelente, 1);
  assert.equal(buckets.buena, 1);
  assert.equal(buckets.deficiente, 1);
  assert.equal(buckets.sin_dato, 1);
  assert.equal(analytics.quality.accuracy.best, 4.8);
  assert.equal(analytics.quality.accuracy.worst, 42);
  assert.equal(analytics.quality.withoutKey, 1);
});

test("una clave repetida a mas de 15 m se marca como inconsistencia territorial", () => {
  assert.equal(analytics.duplicates.length, 1);
  const duplicate = analytics.duplicates[0];
  assert.equal(duplicate.clave, "02-12-04");
  assert.equal(duplicate.count, 2);
  assert.ok(duplicate.maxDistanceMeters > 15, `distancia: ${duplicate.maxDistanceMeters}`);
  assert.equal(duplicate.kind, "inconsistencia_territorial");
  assert.equal(analytics.anomalies.some((item) => item.type === "clave_distante"), true);
});

test("el ranking de barrios ordena por cartera y acumula por barrio", () => {
  const libertad = analytics.zones.find((zone) => zone.label === "24 - La Libertad");
  assert.equal(analytics.zones[0].label, "24 - La Libertad");
  assert.equal(libertad.businesses, 1);
  assert.equal(libertad.total, 18425.2);
  assert.equal(libertad.accounts, 1);
});

test("el resumen por tecnico calcula jornadas y porcentaje con clave", () => {
  const luis = analytics.technicians.find((item) => item.name === "Luis Herrera");
  const ana = analytics.technicians.find((item) => item.name === "Ana Discua");
  assert.equal(luis.points, 2);
  assert.equal(luis.diaries, 1);
  assert.equal(luis.pointsPerDiary, 2);
  assert.equal(luis.businesses, 1);
  assert.equal(luis.keyRate, 100);
  assert.equal(ana.withoutKey, 1);
  assert.equal(ana.keyRate, 50);
});

test("las banderas permiten filtrar el mapa sin volver a consultar", () => {
  assert.deepEqual(analytics.selection.flags.sin_clave, [4]);
  assert.deepEqual(analytics.selection.flags.gps_deficiente, [2]);
  assert.deepEqual(analytics.selection.flags.negocio, [1]);
  assert.deepEqual(analytics.selection.ranges.r4, [1]);
  assert.equal(analytics.points.length, 4);
  assert.equal(analytics.points.find((item) => item.id === 1).debt, 18425.2);
});

test("includePoints false omite el detalle por punto", () => {
  const slim = computeFieldAnalytics({ points, padronIndex, catalog, includePoints: false });
  assert.equal(slim.points.length, 0);
  assert.equal(slim.territory.points, 4);
});

test("sin puntos devuelve una estructura vacia y estable", () => {
  const empty = computeFieldAnalytics({ points: [], padronIndex, catalog });
  assert.equal(empty.territory.points, 0);
  assert.equal(empty.portfolio.total, 0);
  assert.equal(empty.portfolio.median, 0);
  assert.equal(empty.quality.accuracy.mean, null);
  assert.deepEqual(empty.duplicates, []);
  assert.equal(empty.zones.length, 0);
});
