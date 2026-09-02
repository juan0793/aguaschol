import { checkGisConnection, getGisPool } from "../../config/gisDb.js";
import { getPool } from "../../config/db.js";
import { buildClaveBase } from "./gisImportUtils.js";
import { getMasterRecords } from "../../services/claveLookupService.js";
import { classifyGpsAccuracy, getPointClave, matchesBarrioCode, resolveFieldZone } from "../../utils/claveField.js";
import { listBarrioCodes } from "../../services/barrioCodeService.js";
import { deriveLoteVinculo } from "./gis.lote.js";

export const getGisHealth = async () => checkGisConnection();

export const listBarrios = async () => {
  const { rows } = await getGisPool().query(`
    SELECT id, clave, clave_sufijo, nombre, tipo, area_m2, source_fid
    FROM gis_barrios
    WHERE activo = TRUE
    ORDER BY COALESCE(clave, ''), nombre NULLS LAST, source_fid
  `);
  return rows;
};

export const getBarriosGeoJson = async () => {
  const { rows } = await getGisPool().query(`
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(json_build_object(
        'type', 'Feature',
        'id', id,
        'properties', json_build_object(
          'id', id,
          'clave', clave,
          'clave_sufijo', clave_sufijo,
          'nombre', nombre,
          'tipo', tipo,
          'area_m2', area_m2
        ),
        'geometry', ST_AsGeoJSON(ST_Transform(geom, 4326), 6)::json
      ) ORDER BY COALESCE(clave, ''), nombre NULLS LAST), '[]'::json)
    ) AS geojson
    FROM gis_barrios
    WHERE activo = TRUE
  `);
  return rows[0].geojson;
};

export const getBarrio = async (id) => {
  const { rows } = await getGisPool().query(`
    SELECT id, clave, clave_sufijo, nombre, tipo, area_m2, source_fid,
           ST_AsGeoJSON(ST_Transform(geom, 4326), 6)::json geometry,
           ARRAY[
             ST_XMin(Box3D(ST_Transform(geom, 4326))),
             ST_YMin(Box3D(ST_Transform(geom, 4326))),
             ST_XMax(Box3D(ST_Transform(geom, 4326))),
             ST_YMax(Box3D(ST_Transform(geom, 4326)))
           ] bbox
    FROM gis_barrios
    WHERE id = $1 AND activo = TRUE
  `, [id]);
  return rows[0] ?? null;
};

export const getBarrioSummary = async (id) => {
  const { rows } = await getGisPool().query(`
    SELECT b.id, b.clave, b.clave_sufijo, b.nombre, b.tipo, b.area_m2,
           COUNT(DISTINCT m.id)::int manzanas,
           COUNT(DISTINCT q.id)::int quebradas
    FROM gis_barrios b
    LEFT JOIN gis_manzanas m ON m.barrio_id = b.id AND m.activo = TRUE
    LEFT JOIN gis_quebradas q ON ST_Intersects(q.geom, b.geom) AND q.activo = TRUE
    WHERE b.id = $1 AND b.activo = TRUE
    GROUP BY b.id
  `, [id]);
  return rows[0] ?? null;
};

export const listManzanas = async (barrioId) => {
  const params = [];
  const filter = barrioId ? "WHERE m.barrio_id = $1 AND m.activo = TRUE" : "WHERE m.activo = TRUE";
  if (barrioId) params.push(barrioId);
  const { rows } = await getGisPool().query(`
    SELECT m.id, m.barrio_id, m.numero, m.source_fid,
           ST_AsGeoJSON(ST_Transform(m.geom, 4326), 6)::json geometry
    FROM gis_manzanas m
    ${filter}
    ORDER BY m.source_fid
    LIMIT 2000
  `, params);
  return rows;
};

export const listQuebradas = async () => {
  const { rows } = await getGisPool().query(`
    SELECT id, nombre, source_fid,
           ST_AsGeoJSON(ST_Transform(geom, 4326), 6)::json geometry
    FROM gis_quebradas
    WHERE activo = TRUE
    ORDER BY source_fid
  `);
  return rows;
};

export const getImportReport = async () => {
  const { rows } = await getGisPool().query(`
    SELECT
      (SELECT COUNT(*)::int FROM gis_barrios WHERE nombre IS NULL) sin_nombre,
      (SELECT COUNT(*)::int FROM gis_barrios WHERE clave IS NULL) sin_clave,
      (SELECT COUNT(*)::int FROM gis_barrios b WHERE NOT EXISTS (SELECT 1 FROM gis_barrio_etiquetas e WHERE e.barrio_id = b.id)) sin_etiqueta,
      (SELECT COUNT(*)::int FROM gis_barrio_etiquetas WHERE barrio_id IS NULL) fuera_de_poligono,
      (SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json) FROM (
        SELECT clave, COUNT(*)::int total
        FROM gis_barrio_etiquetas
        WHERE clave IS NOT NULL
        GROUP BY clave
        HAVING COUNT(*) > 1
        ORDER BY clave
      ) d) duplicados
  `);
  return rows[0];
};

const bboxSql = (alias = "geom") => `ST_Transform(ST_MakeEnvelope($1, $2, $3, $4, 4326), 32616) && ${alias}`;

export const listLotesInBbox = async ({ bbox, limit = 800 }) => {
  const { rows } = await getGisPool().query(`
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(json_build_object(
        'type', 'Feature',
        'id', l.id,
        'properties', json_build_object(
          'id', l.id,
          'barrio_id', l.barrio_id,
          'manzana_id', l.manzana_id,
          'numero_lote', l.numero_lote,
          'clave_catastral', l.clave_catastral
        ),
        'geometry', ST_AsGeoJSON(ST_Transform(l.geom, 4326), 6)::json
      ) ORDER BY l.id), '[]'::json)
    ) geojson
    FROM (
      SELECT id, barrio_id, manzana_id, numero_lote, clave_catastral, geom
      FROM gis_lotes
      WHERE activo = TRUE AND ${bboxSql("geom")}
      ORDER BY id
      LIMIT $5
    ) l
  `, [...bbox, limit]);
  return rows[0].geojson;
};

export const listCatastroInBbox = async ({ bbox, zoom = 15, limit = 1000 }) => {
  if (Number(zoom) < 17) {
    const grid = Number(zoom) < 15 ? 450 : 180;
    const { rows } = await getGisPool().query(`
      WITH clustered AS (
        SELECT COUNT(*)::int total, ST_Centroid(ST_Collect(geom)) geom
        FROM gis_catastro_puntos
        WHERE ${bboxSql("geom")}
        GROUP BY ST_SnapToGrid(geom, $5)
        LIMIT $6
      )
      SELECT json_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(json_agg(json_build_object(
          'type', 'Feature',
          'properties', json_build_object('cluster', TRUE, 'total', total),
          'geometry', ST_AsGeoJSON(ST_Transform(geom, 4326), 6)::json
        )), '[]'::json)
      ) geojson
      FROM clustered
    `, [...bbox, grid, limit]);
    return rows[0].geojson;
  }

  const { rows } = await getGisPool().query(`
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(json_build_object(
        'type', 'Feature',
        'id', id,
        'properties', json_build_object(
          'id', id,
          'clave_catastral', clave_catastral,
          'abonado', abonado,
          'lote_id', lote_id
        ),
        'geometry', ST_AsGeoJSON(ST_Transform(geom, 4326), 6)::json
      ) ORDER BY id), '[]'::json)
    ) geojson
    FROM (
      SELECT id, clave_catastral, abonado, lote_id, geom
      FROM gis_catastro_puntos
      WHERE ${bboxSql("geom")}
      ORDER BY id
      LIMIT $5
    ) p
  `, [...bbox, limit]);
  return rows[0].geojson;
};

const normalizeText = (value = "") =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export const searchGis = async (query = "") => {
  const text = normalizeText(query);
  if (text.length < 2) return { query, groups: [] };
  const like = `%${text}%`;
  const pg = getGisPool();
  const [barrios, manzanas, lotes, catastro] = await Promise.all([
    pg.query(`SELECT 'barrio' type, id, nombre label, clave detail FROM gis_barrios WHERE activo = TRUE AND (LOWER(nombre) LIKE $1 OR clave LIKE $2) ORDER BY clave NULLS LAST LIMIT 8`, [like, `%${query}%`]),
    pg.query(`SELECT 'manzana' type, id, COALESCE(numero, source_fid::text) label, barrio_id::text detail FROM gis_manzanas WHERE activo = TRUE AND COALESCE(numero, source_fid::text) ILIKE $1 ORDER BY id LIMIT 8`, [`%${query}%`]),
    pg.query(`SELECT 'lote' type, id, COALESCE(numero_lote, id::text) label, clave_catastral detail FROM gis_lotes WHERE activo = TRUE AND (COALESCE(numero_lote,'') ILIKE $1 OR COALESCE(clave_catastral,'') ILIKE $1) ORDER BY id LIMIT 8`, [`%${query}%`]),
    pg.query(`SELECT 'abonado' type, id, COALESCE(inquilino, abonado, clave_catastral) label, clave_catastral detail FROM gis_catastro_puntos WHERE COALESCE(clave_catastral,'') ILIKE $1 OR COALESCE(abonado,'') ILIKE $1 OR LOWER(COALESCE(inquilino,'')) LIKE $2 ORDER BY id LIMIT 8`, [`%${query}%`, like])
  ]);

  const padron = getMasterRecords()
    .filter((item) => item.search_target?.includes(text) || String(item.abonado || "").includes(query))
    .slice(0, 8)
    .map((item) => ({ type: "padron", id: item.clave_catastral || item.abonado, label: item.inquilino || item.nombre || item.abonado, detail: item.clave_catastral }));

  const groups = [
    ["barrios", barrios.rows],
    ["manzanas", manzanas.rows],
    ["lotes", lotes.rows],
    ["abonados", catastro.rows],
    ["padron", padron]
  ].filter(([, items]) => items.length).map(([key, items]) => ({ key, items }));
  return { query, groups };
};

export const resolveClaveGis = async (clave = "") => {
  const trimmed = String(clave ?? "").trim();
  if (!trimmed) return null;
  const base = buildClaveBase(trimmed);
  const pg = getGisPool();

  const catastro = await pg.query(
    `SELECT id FROM gis_catastro_puntos
     WHERE clave_catastral = $1 OR ($2 <> '' AND clave_catastral LIKE $2 || '-%')
     ORDER BY clave_catastral = $1 DESC, id LIMIT 1`,
    [trimmed, base]
  );
  if (catastro.rows[0]) return { type: "catastro", id: catastro.rows[0].id };

  const lote = await pg.query(
    `SELECT id FROM gis_lotes
     WHERE activo = TRUE AND (clave_catastral = $1 OR ($2 <> '' AND clave_catastral LIKE $2 || '-%'))
     ORDER BY clave_catastral = $1 DESC, id LIMIT 1`,
    [trimmed, base]
  );
  if (lote.rows[0]) return { type: "lote", id: lote.rows[0].id };

  return null;
};

const findPadron = (clave = "", abonado = "") => {
  const base = buildClaveBase(clave);
  return getMasterRecords().find((item) =>
    (clave && item.clave_catastral === clave) ||
    (base && item.clave_base === base) ||
    (abonado && String(item.abonado || "") === String(abonado))
  ) ?? null;
};

const relatedMysql = async ({ clave = "", base = "" }) => {
  if (!clave && !base) return { puntos_control: [], inspecciones: [], fichas_relacionadas: [] };
  const pool = getPool();
  const like = `%${base || clave}%`;
  const [points, inspecciones, fichas] = await Promise.all([
    pool.query(
      `SELECT id, point_type, reference_note, description, latitude, longitude, created_at
       FROM map_points
       WHERE reference_note LIKE ? OR description LIKE ?
       ORDER BY created_at DESC LIMIT 8`,
      [like, like]
    ).then(([rows]) => rows),
    pool.query(
      `SELECT id, numero_inspeccion, clave_catastral, estado, motivo, fecha_asignacion
       FROM inspecciones
       WHERE clave_catastral LIKE ?
       ORDER BY fecha_asignacion DESC LIMIT 8`,
      [like]
    ).then(([rows]) => rows),
    pool.query(
      `SELECT id, clave_catastral, abonado, nombre_catastral, inquilino, barrio_colonia, estado_operativo
       FROM inmuebles_clandestinos
       WHERE archived_at IS NULL AND clave_catastral LIKE ?
       ORDER BY id DESC LIMIT 8`,
      [like]
    ).then(([rows]) => rows).catch(() => [])
  ]);
  return { puntos_control: points, inspecciones, fichas_relacionadas: fichas };
};

export const getLoteDetail = async (id) => {
  const { rows } = await getGisPool().query(`
    SELECT l.id, l.numero_lote, l.clave_catastral, l.source_dataset, l.source_fid,
           b.id barrio_id, b.nombre barrio, b.clave barrio_clave,
           m.id manzana_id, COALESCE(m.numero, m.source_fid::text) manzana,
           ARRAY[
             ST_XMin(Box3D(ST_Transform(l.geom, 4326))),
             ST_YMin(Box3D(ST_Transform(l.geom, 4326))),
             ST_XMax(Box3D(ST_Transform(l.geom, 4326))),
             ST_YMax(Box3D(ST_Transform(l.geom, 4326)))
           ] bbox
    FROM gis_lotes l
    LEFT JOIN gis_barrios b ON b.id = l.barrio_id
    LEFT JOIN gis_manzanas m ON m.id = l.manzana_id
    WHERE l.id = $1 AND l.activo = TRUE
  `, [id]);
  const lote = rows[0];
  if (!lote) return null;
  const { rows: catastro } = await getGisPool().query(`
    SELECT id, clave_catastral, abonado, inquilino, direccion
    FROM gis_catastro_puntos
    WHERE lote_id = $1
    ORDER BY source_fid
    LIMIT 20
  `, [id]);
  const unico = catastro.length === 1 ? catastro[0] : null;
  const clave = unico?.clave_catastral || lote.clave_catastral || "";
  const padron = findPadron(clave, unico?.abonado);
  const related = await relatedMysql({ clave: padron?.clave_catastral || clave, base: padron?.clave_base || buildClaveBase(clave) });
  return {
    ...lote,
    catastro_id: unico?.id || null,
    catastro_clave: unico?.clave_catastral || null,
    abonado: unico?.abonado || null,
    inquilino: unico?.inquilino || null,
    direccion: unico?.direccion || null,
    catastro_relacionados: catastro,
    vinculo: deriveLoteVinculo({ lote, catastro, padron }),
    abonado_actual: padron ? {
      clave_catastral: padron.clave_catastral,
      abonado: padron.abonado,
      nombre: padron.inquilino || padron.nombre,
      servicios: {
        agua: padron.agua,
        alcantarillado: padron.alcantarillado,
        barrido: padron.barrido,
        recoleccion: padron.recoleccion,
        desechos_peligrosos: padron.desechos_peligrosos
      },
      mora: { capital: padron.valor, intereses: padron.intereses, total: padron.total }
    } : null,
    ...related
  };
};

export const getCatastroDetail = async (id) => {
  const { rows } = await getGisPool().query(`
    SELECT c.*, b.nombre barrio, b.clave barrio_clave, l.numero_lote, l.id lote_id,
           ARRAY[ST_X(ST_Transform(c.geom, 4326)), ST_Y(ST_Transform(c.geom, 4326))] lnglat
    FROM gis_catastro_puntos c
    LEFT JOIN gis_barrios b ON b.id = c.barrio_id
    LEFT JOIN gis_lotes l ON l.id = c.lote_id
    WHERE c.id = $1
  `, [id]);
  const item = rows[0];
  if (!item) return null;
  const padron = findPadron(item.clave_catastral, item.abonado);
  const related = await relatedMysql({ clave: padron?.clave_catastral || item.clave_catastral, base: padron?.clave_base || item.clave_base });
  return { ...item, abonado_actual: padron, ...related };
};

export const getCatastroReport = async () => {
  const { rows } = await getGisPool().query(`
    SELECT json_build_object(
      'lotes', (SELECT COUNT(*)::int FROM gis_lotes),
      'lotes_con_barrio', (SELECT COUNT(*)::int FROM gis_lotes WHERE barrio_id IS NOT NULL),
      'lotes_con_manzana', (SELECT COUNT(*)::int FROM gis_lotes WHERE manzana_id IS NOT NULL),
      'lotes_con_numero', (SELECT COUNT(*)::int FROM gis_lotes WHERE numero_lote IS NOT NULL),
      'lotes_con_clave', (SELECT COUNT(*)::int FROM gis_lotes WHERE clave_catastral IS NOT NULL),
      'etiquetas_lote', (SELECT COUNT(*)::int FROM gis_lote_etiquetas),
      'etiquetas_lote_emparejadas', (SELECT COUNT(*)::int FROM gis_lote_etiquetas WHERE lote_id IS NOT NULL),
      'catastro_puntos', (SELECT COUNT(*)::int FROM gis_catastro_puntos),
      'catastro_con_barrio', (SELECT COUNT(*)::int FROM gis_catastro_puntos WHERE barrio_id IS NOT NULL),
      'catastro_con_manzana', (SELECT COUNT(*)::int FROM gis_catastro_puntos WHERE manzana_id IS NOT NULL),
      'catastro_con_lote', (SELECT COUNT(*)::int FROM gis_catastro_puntos WHERE lote_id IS NOT NULL),
      'catastro_con_clave', (SELECT COUNT(*)::int FROM gis_catastro_puntos WHERE clave_catastral IS NOT NULL),
      'geometrias_invalidas', json_build_object(
        'lotes', (SELECT COUNT(*)::int FROM gis_lotes WHERE NOT ST_IsValid(geom)),
        'catastro', (SELECT COUNT(*)::int FROM gis_catastro_puntos WHERE NOT ST_IsValid(geom))
      )
    ) resumen
  `);
  return rows[0].resumen;
};

// Adaptador de solo lectura sobre map_points (MySQL) para SIG. No duplica el dato: cada request
// consulta map_points en vivo, igual que relatedMysql() de arriba.
export const listLevantamientosInBbox = async ({ bbox, limit = 500 }) => {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, point_type, latitude, longitude, accuracy_meters, reference_note, description,
            validation_status, diary_date, created_at
     FROM map_points
     WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
     ORDER BY id DESC LIMIT ?`,
    [minLat, maxLat, minLng, maxLng, limit]
  );
  return {
    type: "FeatureCollection",
    features: rows.map((row) => ({
      type: "Feature",
      id: row.id,
      properties: {
        id: row.id,
        point_type: row.point_type,
        validation_status: row.validation_status,
        accuracy_meters: row.accuracy_meters,
        gps_accuracy: classifyGpsAccuracy(row.accuracy_meters),
        clave: getPointClave(row),
        diary_date: row.diary_date
      },
      geometry: { type: "Point", coordinates: [Number(row.longitude), Number(row.latitude)] }
    }))
  };
};

export const getLevantamientoDetail = async (id) => {
  const pool = getPool();
  const [rows] = await pool.query(`SELECT * FROM map_points WHERE id = ?`, [id]);
  const point = rows[0];
  if (!point) return null;

  const catalog = await listBarrioCodes();
  const declarado = resolveFieldZone(point, catalog);

  let barrio_geografico = null;
  let manzana_geografico = null;
  let lote_geografico = null;
  const lng = Number(point.longitude);
  const lat = Number(point.latitude);
  const gis = getGisPool();
  if (gis && Number.isFinite(lng) && Number.isFinite(lat)) {
    try {
      const { rows: geoRows } = await gis.query(`
        SELECT b.barrio_id, b.barrio_nombre, b.barrio_clave,
               m.manzana_id, m.manzana,
               l.lote_id, l.numero_lote, l.clave_catastral
        FROM (SELECT ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 32616) AS pt) p
        LEFT JOIN LATERAL (
          SELECT id barrio_id, nombre barrio_nombre, clave barrio_clave
          FROM gis_barrios WHERE activo = TRUE AND ST_Intersects(geom, p.pt) LIMIT 1
        ) b ON TRUE
        LEFT JOIN LATERAL (
          SELECT id manzana_id, COALESCE(numero, source_fid::text) manzana
          FROM gis_manzanas WHERE activo = TRUE AND ST_Intersects(geom, p.pt) LIMIT 1
        ) m ON TRUE
        LEFT JOIN LATERAL (
          SELECT id lote_id, numero_lote, clave_catastral
          FROM gis_lotes WHERE activo = TRUE AND ST_Intersects(geom, p.pt) LIMIT 1
        ) l ON TRUE
      `, [lng, lat]);
      const row = geoRows[0];
      if (row?.barrio_id) barrio_geografico = { id: row.barrio_id, nombre: row.barrio_nombre, clave: row.barrio_clave };
      if (row?.manzana_id) manzana_geografico = { id: row.manzana_id, numero: row.manzana };
      if (row?.lote_id) lote_geografico = { id: row.lote_id, numero_lote: row.numero_lote, clave_catastral: row.clave_catastral };
    } catch {
      // Geometria invalida u otro error GEOS: se degrada a "sin dato geografico" en vez de romper el endpoint.
    }
  }

  const barrio_coincide = matchesBarrioCode(declarado.code, barrio_geografico?.clave);

  return {
    ...point,
    clave: getPointClave(point),
    gps_accuracy: classifyGpsAccuracy(point.accuracy_meters),
    barrio_declarado: declarado,
    barrio_geografico,
    manzana_geografico,
    lote_geografico,
    barrio_coincide
  };
};
