import { getGisPool } from "../../../config/gisDb.js";

const pool = getGisPool();

try {
  const { rows } = await pool.query(`
    SELECT json_build_object(
      'lotes', (SELECT COUNT(*)::int FROM gis_lotes),
      'lotes_con_barrio', (SELECT COUNT(*)::int FROM gis_lotes WHERE barrio_id IS NOT NULL),
      'lotes_sin_barrio', (SELECT COUNT(*)::int FROM gis_lotes WHERE barrio_id IS NULL),
      'lotes_con_manzana', (SELECT COUNT(*)::int FROM gis_lotes WHERE manzana_id IS NOT NULL),
      'lotes_sin_manzana', (SELECT COUNT(*)::int FROM gis_lotes WHERE manzana_id IS NULL),
      'lotes_con_numero', (SELECT COUNT(*)::int FROM gis_lotes WHERE numero_lote IS NOT NULL),
      'lotes_con_clave', (SELECT COUNT(*)::int FROM gis_lotes WHERE clave_catastral IS NOT NULL),
      'etiquetas_lote', (SELECT COUNT(*)::int FROM gis_lote_etiquetas),
      'etiquetas_lote_emparejadas', (SELECT COUNT(*)::int FROM gis_lote_etiquetas WHERE lote_id IS NOT NULL),
      'catastro_puntos', (SELECT COUNT(*)::int FROM gis_catastro_puntos),
      'catastro_con_barrio', (SELECT COUNT(*)::int FROM gis_catastro_puntos WHERE barrio_id IS NOT NULL),
      'catastro_sin_barrio', (SELECT COUNT(*)::int FROM gis_catastro_puntos WHERE barrio_id IS NULL),
      'catastro_con_manzana', (SELECT COUNT(*)::int FROM gis_catastro_puntos WHERE manzana_id IS NOT NULL),
      'catastro_con_lote', (SELECT COUNT(*)::int FROM gis_catastro_puntos WHERE lote_id IS NOT NULL),
      'catastro_sin_lote', (SELECT COUNT(*)::int FROM gis_catastro_puntos WHERE lote_id IS NULL),
      'catastro_con_clave', (SELECT COUNT(*)::int FROM gis_catastro_puntos WHERE clave_catastral IS NOT NULL),
      'claves_catastro_duplicadas', (
        SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json)
        FROM (
          SELECT clave_catastral, COUNT(*)::int total
          FROM gis_catastro_puntos
          WHERE clave_catastral IS NOT NULL
          GROUP BY clave_catastral
          HAVING COUNT(*) > 1
          ORDER BY total DESC, clave_catastral
          LIMIT 25
        ) d
      ),
      'lotes_solapados_muestra', (
        SELECT COALESCE(json_agg(row_to_json(o)), '[]'::json)
        FROM (
          SELECT lote_a, lote_b, ROUND(ST_Area(ST_Intersection(geom_a, geom_b))::numeric, 2) area_m2
          FROM (
            SELECT a.id lote_a, b.id lote_b, a.geom geom_a, b.geom geom_b
            FROM gis_lotes a
            JOIN gis_lotes b ON a.id < b.id AND a.geom && b.geom AND ST_Overlaps(a.geom, b.geom)
            LIMIT 50
          ) pairs
          LIMIT 20
        ) o
      ),
      'geometrias_invalidas', json_build_object(
        'lotes', (SELECT COUNT(*)::int FROM gis_lotes WHERE NOT ST_IsValid(geom)),
        'catastro', (SELECT COUNT(*)::int FROM gis_catastro_puntos WHERE NOT ST_IsValid(geom))
      )
    ) AS resumen
  `);
  console.log(JSON.stringify(rows[0].resumen, null, 2));
} finally {
  await pool.end();
}
