import { env } from "../config/env.js";
import { getPool } from "../config/db.js";
import { listBarrioCodes } from "./barrioCodeService.js";
import { getPadronIndex, getPadronIndexStats } from "./padronIndexService.js";
import { listFieldPointsForAnalytics } from "./fieldValidationService.js";
import {
  DUPLICATE_DISTANCE_METERS,
  GPS_ACCURACY_BUCKETS,
  buildBarrioCatalog,
  buildClaveBase,
  classifyGpsAccuracy,
  getPointClave,
  haversineMeters,
  median,
  normalizeSearchText,
  resolveFieldZone,
  roundMoney
} from "../utils/claveField.js";

// Centro de inteligencia territorial: un solo pase sobre los puntos filtrados produce todas
// las agregaciones de la pantalla. Sustituye las N llamadas a /claves/search que hacia el frontend.

export const COMMERCIAL_POINT_TYPE = "negocio_local_comercial";
const IDENTICAL_POINT_METERS = 2;
const SAME_COORDINATE_POINTS = 3;
const IMPROBABLE_SPEED_KMH = 80;
const EXACT_PAIR_LIMIT = 30;
const HONDURAS_BOUNDS = { minLat: 12.8, maxLat: 16.6, minLng: -89.4, maxLng: -83 };

export const DEBT_RANGES = [
  { id: "sin_deuda", label: "Sin deuda", min: -Infinity, max: 0 },
  { id: "r1", label: "L 1 - 1,000", min: 0.01, max: 1000 },
  { id: "r2", label: "L 1,001 - 5,000", min: 1000.01, max: 5000 },
  { id: "r3", label: "L 5,001 - 10,000", min: 5000.01, max: 10000 },
  { id: "r4", label: "L 10,001 - 20,000", min: 10000.01, max: 20000 },
  { id: "r5", label: "L 20,001 - 50,000", min: 20000.01, max: 50000 },
  { id: "r6", label: "Mas de L 50,000", min: 50000.01, max: Infinity }
];

const resolveDebtRange = (total) => DEBT_RANGES.find((range) => total >= range.min && total <= range.max)?.id || "sin_deuda";
const isActiveService = (value) => String(value ?? "").trim().toUpperCase() === "S";
const accountKey = (match, fallbackBase) =>
  String(match.abonado || `${match.clave_catastral || fallbackBase}:${match.inquilino || match.nombre || ""}`);

const getPointDateKey = (point = {}) => String(point.diary_date || point.created_at || "").slice(0, 10);
const getTechnicianName = (point = {}) =>
  point.created_by_name || point.created_by_username || (point.created_by ? `Usuario ${point.created_by}` : "Sin tecnico");

// Cartera de un conjunto de claves base, sin contar dos veces al mismo abonado.
const summarizePortfolio = (bases, index) => {
  const accounts = new Map();
  let keysFound = 0;

  bases.forEach((base) => {
    const matches = index.byBase.get(base);
    if (!matches?.length) return;
    keysFound += 1;
    matches.forEach((match) => {
      const key = accountKey(match, base);
      if (!accounts.has(key)) accounts.set(key, match);
    });
  });

  const rows = Array.from(accounts.values());
  const totals = rows.map((row) => Number(row.total) || 0);
  const total = totals.reduce((sum, value) => sum + value, 0);

  return { accounts: rows, keysFound, total: roundMoney(total), totals };
};

const buildRangeBreakdown = (accounts) => {
  const buckets = new Map(DEBT_RANGES.map((range) => [range.id, { ...range, accounts: 0, keys: new Set(), total: 0 }]));

  accounts.forEach((account) => {
    const value = Number(account.total) || 0;
    const bucket = buckets.get(resolveDebtRange(value));
    bucket.accounts += 1;
    bucket.total += value;
    if (account.clave_base) bucket.keys.add(account.clave_base);
  });

  const grandTotal = accounts.reduce((sum, account) => sum + (Number(account.total) || 0), 0);

  return Array.from(buckets.values()).map((bucket) => ({
    id: bucket.id,
    label: bucket.label,
    accounts: bucket.accounts,
    keys: bucket.keys.size,
    total: roundMoney(bucket.total),
    percent: grandTotal > 0 ? Number(((bucket.total / grandTotal) * 100).toFixed(1)) : 0
  }));
};

const maxDistanceWithin = (points) => {
  const coords = points
    .map((point) => [Number(point.latitude), Number(point.longitude)])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  if (coords.length < 2) return 0;

  if (coords.length <= EXACT_PAIR_LIMIT) {
    let max = 0;
    for (let i = 0; i < coords.length; i += 1) {
      for (let j = i + 1; j < coords.length; j += 1) {
        const distance = haversineMeters(coords[i][0], coords[i][1], coords[j][0], coords[j][1]) ?? 0;
        if (distance > max) max = distance;
      }
    }
    return max;
  }

  // Grupos grandes: se aproxima con el doble de la distancia maxima al centroide para evitar O(n^2).
  const centroid = coords.reduce((sum, [lat, lng]) => [sum[0] + lat / coords.length, sum[1] + lng / coords.length], [0, 0]);
  const radius = coords.reduce(
    (max, [lat, lng]) => Math.max(max, haversineMeters(centroid[0], centroid[1], lat, lng) ?? 0),
    0
  );
  return Number((radius * 2).toFixed(2));
};

const buildDuplicates = (pointsByBase) => {
  const duplicates = [];

  pointsByBase.forEach((points, base) => {
    if (points.length < 2) return;
    const distance = maxDistanceWithin(points);
    duplicates.push({
      clave: base,
      count: points.length,
      maxDistanceMeters: distance,
      kind: distance <= DUPLICATE_DISTANCE_METERS ? "probable_duplicado" : "inconsistencia_territorial",
      points: points.map((point) => ({
        id: point.id,
        latitude: Number(point.latitude),
        longitude: Number(point.longitude),
        date: getPointDateKey(point),
        technician: getTechnicianName(point),
        accuracy_meters: point.accuracy_meters == null ? null : Number(point.accuracy_meters)
      }))
    });
  });

  return duplicates.sort((a, b) => b.maxDistanceMeters - a.maxDistanceMeters || b.count - a.count);
};

const buildAnomalies = (points, duplicates, decorated) => {
  const anomalies = [];
  const push = (type, severity, detail, pointIds) => {
    if (pointIds.length) anomalies.push({ type, severity, detail, pointIds: pointIds.slice(0, 200), total: pointIds.length });
  };

  const sameCoordinate = new Map();
  points.forEach((point) => {
    const lat = Number(point.latitude);
    const lng = Number(point.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    const bucket = sameCoordinate.get(key) ?? [];
    bucket.push(point.id);
    sameCoordinate.set(key, bucket);
  });

  push(
    "coordenada_repetida",
    "media",
    `Tres o mas puntos comparten exactamente la misma coordenada.`,
    Array.from(sameCoordinate.values()).filter((ids) => ids.length >= SAME_COORDINATE_POINTS).flat()
  );

  push(
    "punto_casi_identico",
    "baja",
    `Puntos de la misma clave a menos de ${IDENTICAL_POINT_METERS} m entre si.`,
    duplicates.filter((item) => item.maxDistanceMeters <= IDENTICAL_POINT_METERS).flatMap((item) => item.points.map((p) => p.id))
  );

  push(
    "clave_distante",
    "alta",
    `Misma clave con registros a mas de ${DUPLICATE_DISTANCE_METERS} m de distancia.`,
    duplicates.filter((item) => item.kind === "inconsistencia_territorial").flatMap((item) => item.points.map((p) => p.id))
  );

  push(
    "gps_deficiente",
    "media",
    "Precision GPS peor a 30 m.",
    decorated.filter((item) => item.accuracyBucket === "deficiente").map((item) => item.id)
  );

  push(
    "fuera_de_area",
    "alta",
    "Coordenada fuera del area esperada.",
    points
      .filter((point) => {
        const lat = Number(point.latitude);
        const lng = Number(point.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true;
        return (
          lat < HONDURAS_BOUNDS.minLat ||
          lat > HONDURAS_BOUNDS.maxLat ||
          lng < HONDURAS_BOUNDS.minLng ||
          lng > HONDURAS_BOUNDS.maxLng
        );
      })
      .map((point) => point.id)
  );

  push(
    "sin_clave",
    "media",
    "No fue posible extraer una clave valida del texto del punto.",
    decorated.filter((item) => !item.clave).map((item) => item.id)
  );

  push(
    "registro_incompleto",
    "baja",
    "Punto sin referencia ni descripcion.",
    points
      .filter((point) => !String(point.reference_note || "").trim() && !String(point.description || "").trim())
      .map((point) => point.id)
  );

  // Velocidad improbable entre capturas consecutivas del mismo tecnico.
  const byTechnician = new Map();
  points.forEach((point) => {
    const key = point.created_by ?? getTechnicianName(point);
    const bucket = byTechnician.get(key) ?? [];
    bucket.push(point);
    byTechnician.set(key, bucket);
  });

  const improbable = [];
  byTechnician.forEach((items) => {
    const ordered = items
      .filter((point) => point.created_at && Number.isFinite(Number(point.latitude)))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    for (let i = 1; i < ordered.length; i += 1) {
      const previous = ordered[i - 1];
      const current = ordered[i];
      const seconds = (new Date(current.created_at) - new Date(previous.created_at)) / 1000;
      if (!Number.isFinite(seconds) || seconds <= 0) continue;
      const distance = haversineMeters(previous.latitude, previous.longitude, current.latitude, current.longitude);
      if (distance == null) continue;
      if ((distance / seconds) * 3.6 > IMPROBABLE_SPEED_KMH) improbable.push(current.id);
    }
  });

  push("velocidad_improbable", "media", `Capturas consecutivas que implican mas de ${IMPROBABLE_SPEED_KMH} km/h.`, improbable);

  return anomalies;
};

export const computeFieldAnalytics = ({
  points = [],
  padronIndex = { byBase: new Map(), byExact: new Map() },
  catalog = [],
  clandestinosByBase = new Map(),
  includePoints = true
} = {}) => {
  const barrioCatalog = buildBarrioCatalog(catalog);
  const pointsByBase = new Map();
  const zones = new Map();
  const technicians = new Map();
  const accuracyValues = [];
  const bucketCounts = new Map(GPS_ACCURACY_BUCKETS.map((bucket) => [bucket.id, 0]));

  const decorated = points.map((point) => {
    const clave = getPointClave(point);
    const base = buildClaveBase(clave);
    const zone = resolveFieldZone(point, barrioCatalog);
    const matches = base ? padronIndex.byBase.get(base) ?? [] : [];
    const accounts = new Map();
    matches.forEach((match) => {
      const key = accountKey(match, base);
      if (!accounts.has(key)) accounts.set(key, match);
    });
    const accountRows = Array.from(accounts.values());
    const debt = roundMoney(accountRows.reduce((sum, row) => sum + (Number(row.total) || 0), 0));
    const accuracy = point.accuracy_meters == null ? null : Number(point.accuracy_meters);
    const accuracyBucket = classifyGpsAccuracy(accuracy);
    const business = point.point_type === COMMERCIAL_POINT_TYPE;

    if (Number.isFinite(accuracy) && accuracy > 0) accuracyValues.push(accuracy);
    bucketCounts.set(accuracyBucket, (bucketCounts.get(accuracyBucket) ?? 0) + 1);

    if (base) {
      const bucket = pointsByBase.get(base) ?? [];
      bucket.push(point);
      pointsByBase.set(base, bucket);
    }

    const zoneEntry = zones.get(zone.label) ?? {
      code: zone.code,
      name: zone.name,
      label: zone.label,
      points: 0,
      bases: new Set(),
      businesses: 0,
      withoutKey: 0,
      accuracy: [],
      technicians: new Set()
    };
    zoneEntry.points += 1;
    if (base) zoneEntry.bases.add(base);
    else zoneEntry.withoutKey += 1;
    if (business) zoneEntry.businesses += 1;
    if (Number.isFinite(accuracy) && accuracy > 0) zoneEntry.accuracy.push(accuracy);
    zoneEntry.technicians.add(getTechnicianName(point));
    zones.set(zone.label, zoneEntry);

    const technicianId = point.created_by ?? getTechnicianName(point);
    const technicianEntry = technicians.get(technicianId) ?? {
      id: point.created_by ?? null,
      name: getTechnicianName(point),
      points: 0,
      bases: new Set(),
      businesses: 0,
      zones: new Set(),
      diaries: new Set(),
      accuracy: [],
      withoutKey: 0,
      approved: 0,
      pending: 0,
      corrected: 0,
      needsCorrection: 0
    };
    technicianEntry.points += 1;
    if (base) technicianEntry.bases.add(base);
    else technicianEntry.withoutKey += 1;
    if (business) technicianEntry.businesses += 1;
    technicianEntry.zones.add(zone.label);
    const dateKey = getPointDateKey(point);
    if (dateKey) technicianEntry.diaries.add(dateKey);
    if (Number.isFinite(accuracy) && accuracy > 0) technicianEntry.accuracy.push(accuracy);
    if (point.validation_status === "approved") technicianEntry.approved += 1;
    else if (point.validation_status === "corrected") technicianEntry.corrected += 1;
    else if (point.validation_status === "needs_correction") technicianEntry.needsCorrection += 1;
    else technicianEntry.pending += 1;
    technicians.set(technicianId, technicianEntry);

    return {
      id: point.id,
      clave,
      base,
      zone: zone.label,
      zoneCode: zone.code,
      business,
      accounts: accountRows.length,
      debt,
      debtRange: accountRows.length ? resolveDebtRange(debt) : null,
      accuracyBucket,
      water: matches.some((match) => isActiveService(match.agua)),
      sewer: matches.some((match) => isActiveService(match.alcantarillado)),
      clandestine: base ? clandestinosByBase.has(base) : false
    };
  });

  const duplicates = buildDuplicates(pointsByBase);
  const duplicatedBases = new Set(duplicates.map((item) => item.clave));
  const allBases = new Set(decorated.map((item) => item.base).filter(Boolean));
  const portfolio = summarizePortfolio(allBases, padronIndex);

  const commercialBases = new Set(decorated.filter((item) => item.business && item.base).map((item) => item.base));
  const commercialPortfolio = summarizePortfolio(commercialBases, padronIndex);
  const businessPoints = decorated.filter((item) => item.business);

  const flags = {
    sin_clave: decorated.filter((item) => !item.base).map((item) => item.id),
    gps_deficiente: decorated.filter((item) => item.accuracyBucket === "deficiente").map((item) => item.id),
    gps_sin_dato: decorated.filter((item) => item.accuracyBucket === "sin_dato").map((item) => item.id),
    clave_repetida: decorated.filter((item) => duplicatedBases.has(item.base)).map((item) => item.id),
    negocio: businessPoints.map((item) => item.id),
    clandestino: decorated.filter((item) => item.clandestine).map((item) => item.id),
    sin_abonado: decorated.filter((item) => item.base && !item.accounts).map((item) => item.id),
    pendiente_validacion: points
      .filter((point) => !point.validation_status || point.validation_status === "pending")
      .map((point) => point.id)
  };

  const rangesIndex = DEBT_RANGES.reduce((acc, range) => {
    acc[range.id] = decorated.filter((item) => item.debtRange === range.id).map((item) => item.id);
    return acc;
  }, {});

  const zoneRows = Array.from(zones.values())
    .map((zone) => {
      const zonePortfolio = summarizePortfolio(zone.bases, padronIndex);
      const withDebt = zonePortfolio.accounts.filter((account) => (Number(account.total) || 0) > 0).length;
      return {
        code: zone.code,
        name: zone.name,
        label: zone.label,
        points: zone.points,
        keys: zone.bases.size,
        businesses: zone.businesses,
        accounts: zonePortfolio.accounts.length,
        total: zonePortfolio.total,
        average: zonePortfolio.accounts.length
          ? roundMoney(zonePortfolio.total / zonePortfolio.accounts.length)
          : 0,
        debtRate: zonePortfolio.accounts.length
          ? Number(((withDebt / zonePortfolio.accounts.length) * 100).toFixed(1))
          : 0,
        withoutKey: zone.withoutKey,
        duplicates: Array.from(zone.bases).filter((base) => duplicatedBases.has(base)).length,
        accuracyMean: zone.accuracy.length
          ? Number((zone.accuracy.reduce((sum, value) => sum + value, 0) / zone.accuracy.length).toFixed(2))
          : null,
        technicians: zone.technicians.size
      };
    })
    .sort((a, b) => b.total - a.total || b.points - a.points);

  const technicianRows = Array.from(technicians.values())
    .map((item) => ({
      id: item.id,
      name: item.name,
      points: item.points,
      keys: item.bases.size,
      businesses: item.businesses,
      zones: item.zones.size,
      diaries: item.diaries.size,
      pointsPerDiary: item.diaries.size ? Number((item.points / item.diaries.size).toFixed(1)) : item.points,
      accuracyMean: item.accuracy.length
        ? Number((item.accuracy.reduce((sum, value) => sum + value, 0) / item.accuracy.length).toFixed(2))
        : null,
      withoutKey: item.withoutKey,
      duplicates: Array.from(item.bases).filter((base) => duplicatedBases.has(base)).length,
      approved: item.approved,
      pending: item.pending,
      corrected: item.corrected,
      needsCorrection: item.needsCorrection,
      keyRate: item.points ? Number((((item.points - item.withoutKey) / item.points) * 100).toFixed(1)) : 0,
      validationRate: item.points ? Number((((item.approved + item.corrected) / item.points) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.points - a.points);

  const commercialAccounts = commercialPortfolio.accounts;
  const overThreshold = (limit) => commercialAccounts.filter((account) => (Number(account.total) || 0) > limit).length;

  return {
    territory: {
      points: points.length,
      zones: zones.size,
      keys: allBases.size,
      technicians: technicians.size,
      withoutKey: flags.sin_clave.length,
      pendingValidation: flags.pendiente_validacion.length
    },
    portfolio: {
      accountsFound: portfolio.accounts.length,
      keysFound: portfolio.keysFound,
      total: portfolio.total,
      average: portfolio.accounts.length ? roundMoney(portfolio.total / portfolio.accounts.length) : 0,
      median: median(portfolio.totals),
      ranges: buildRangeBreakdown(portfolio.accounts)
    },
    commercial: {
      businesses: businessPoints.length,
      percentOfPoints: points.length ? Number(((businessPoints.length / points.length) * 100).toFixed(1)) : 0,
      keys: commercialBases.size,
      accounts: commercialAccounts.length,
      total: commercialPortfolio.total,
      average: commercialAccounts.length ? roundMoney(commercialPortfolio.total / commercialAccounts.length) : 0,
      withoutDebt: commercialAccounts.filter((account) => (Number(account.total) || 0) <= 0).length,
      withDebt: commercialAccounts.filter((account) => (Number(account.total) || 0) > 0).length,
      over5k: overThreshold(5000),
      over10k: overThreshold(10000),
      over20k: overThreshold(20000),
      over50k: overThreshold(50000),
      withoutKey: businessPoints.filter((item) => !item.base).length,
      duplicatedKey: businessPoints.filter((item) => duplicatedBases.has(item.base)).length,
      withoutWater: businessPoints.filter((item) => item.accounts && !item.water).length,
      withoutSewer: businessPoints.filter((item) => item.accounts && !item.sewer).length,
      clandestine: businessPoints.filter((item) => item.clandestine).length,
      zones: zoneRows
        .filter((zone) => zone.businesses > 0)
        .map((zone) => ({
          label: zone.label,
          businesses: zone.businesses,
          accounts: zone.accounts,
          total: zone.total,
          average: zone.average
        }))
        .sort((a, b) => b.businesses - a.businesses || b.total - a.total)
    },
    quality: {
      accuracy: {
        mean: accuracyValues.length
          ? Number((accuracyValues.reduce((sum, value) => sum + value, 0) / accuracyValues.length).toFixed(2))
          : null,
        median: accuracyValues.length ? median(accuracyValues) : null,
        best: accuracyValues.length ? Math.min(...accuracyValues) : null,
        worst: accuracyValues.length ? Math.max(...accuracyValues) : null
      },
      buckets: GPS_ACCURACY_BUCKETS.map((bucket) => ({
        id: bucket.id,
        label: bucket.label,
        count: bucketCounts.get(bucket.id) ?? 0
      })),
      withoutKey: flags.sin_clave.length,
      duplicatedKeys: duplicates.length,
      duplicatedPoints: flags.clave_repetida.length
    },
    services: {
      withWater: decorated.filter((item) => item.water).length,
      withoutWater: decorated.filter((item) => item.accounts && !item.water).length,
      withSewer: decorated.filter((item) => item.sewer).length,
      withoutSewer: decorated.filter((item) => item.accounts && !item.sewer).length,
      withoutAccount: flags.sin_abonado.length
    },
    zones: zoneRows,
    technicians: technicianRows,
    duplicates: duplicates.slice(0, 200),
    anomalies: buildAnomalies(points, duplicates, decorated),
    selection: { flags, ranges: rangesIndex },
    points: includePoints ? decorated : []
  };
};

const normalizeList = (value) =>
  Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter(Boolean) : [];

const loadClandestinosByBase = async () => {
  if (env.useMemoryDb) return new Map();
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT clave_catastral, estado_padron, estado_operativo, conexion_agua, conexion_alcantarillado, updated_at
       FROM inmuebles_clandestinos
       WHERE clave_catastral <> ''`
    );
    return rows.reduce((map, row) => {
      const base = buildClaveBase(row.clave_catastral);
      if (base && !map.has(base)) map.set(base, row);
      return map;
    }, new Map());
  } catch (error) {
    // El cruce con clandestinos es informativo: si falla, la analitica sigue respondiendo.
    console.error("No fue posible cruzar clandestinos en la analitica territorial:", error.message);
    return new Map();
  }
};

export const getFieldAnalytics = async (payload = {}) => {
  const startedAt = Date.now();
  const filters = {
    date: String(payload.date ?? "").trim(),
    technicians: normalizeList(payload.technicians),
    pointTypes: normalizeList(payload.pointTypes),
    validationStatuses: normalizeList(payload.validationStatuses),
    zones: normalizeList(payload.zones),
    search: String(payload.search ?? "").trim()
  };

  const [rawPoints, catalog] = await Promise.all([listFieldPointsForAnalytics(filters), listBarrioCodes()]);
  const barrioCatalog = buildBarrioCatalog(catalog);
  const zoneFilter = new Set(filters.zones);
  const search = normalizeSearchText(filters.search);

  // zonas y busqueda se resuelven en memoria porque el barrio y la clave se derivan del texto,
  // no son columnas de map_points.
  const points = rawPoints.filter((point) => {
    if (zoneFilter.size && !zoneFilter.has(resolveFieldZone(point, barrioCatalog).label)) return false;
    if (!search) return true;
    return normalizeSearchText(
      [
        point.reference_note,
        point.description,
        point.created_by_name,
        point.created_by_username,
        resolveFieldZone(point, barrioCatalog).label
      ]
        .filter(Boolean)
        .join(" ")
    ).includes(search);
  });

  const clandestinosByBase = await loadClandestinosByBase();
  const analytics = computeFieldAnalytics({
    points,
    padronIndex: getPadronIndex(),
    catalog,
    clandestinosByBase,
    includePoints: payload.includePoints !== false
  });

  return {
    ...analytics,
    meta: {
      generated_at: new Date().toISOString(),
      filters,
      points_scanned: rawPoints.length,
      points_analyzed: points.length,
      padron: getPadronIndexStats(),
      duplicate_threshold_meters: DUPLICATE_DISTANCE_METERS,
      took_ms: Date.now() - startedAt
    }
  };
};
