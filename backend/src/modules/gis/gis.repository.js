import { checkGisConnection, getGisPool } from "../../config/gisDb.js";

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
