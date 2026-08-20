import { getGisPool } from "../../../config/gisDb.js";

const pool = getGisPool();

try {
  const { rows } = await pool.query(`
    SELECT json_build_object(
      'barrios', (SELECT COUNT(*)::int FROM gis_barrios),
      'etiquetas', (SELECT COUNT(*)::int FROM gis_barrio_etiquetas),
      'etiquetas_emparejadas', (SELECT COUNT(*)::int FROM gis_barrio_etiquetas WHERE barrio_id IS NOT NULL),
      'barrios_con_clave', (SELECT COUNT(*)::int FROM gis_barrios WHERE clave IS NOT NULL),
      'barrios_sin_etiqueta', (
        SELECT COUNT(*)::int
        FROM gis_barrios b
        WHERE NOT EXISTS (SELECT 1 FROM gis_barrio_etiquetas e WHERE e.barrio_id = b.id)
      ),
      'barrios_sin_clave', (SELECT COUNT(*)::int FROM gis_barrios WHERE clave IS NULL),
      'etiquetas_fuera_de_poligono', (SELECT COUNT(*)::int FROM gis_barrio_etiquetas WHERE barrio_id IS NULL),
      'claves_duplicadas', (
        SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json)
        FROM (
          SELECT clave, COUNT(*)::int total
          FROM gis_barrio_etiquetas
          WHERE clave IS NOT NULL
          GROUP BY clave
          HAVING COUNT(*) > 1
          ORDER BY clave
        ) d
      ),
      'manzanas', (SELECT COUNT(*)::int FROM gis_manzanas),
      'manzanas_emparejadas_a_barrio', (SELECT COUNT(*)::int FROM gis_manzanas WHERE barrio_id IS NOT NULL),
      'quebradas', (SELECT COUNT(*)::int FROM gis_quebradas),
      'geometrias_invalidas', json_build_object(
        'barrios', (SELECT COUNT(*)::int FROM gis_barrios WHERE NOT ST_IsValid(geom)),
        'etiquetas', (SELECT COUNT(*)::int FROM gis_barrio_etiquetas WHERE NOT ST_IsValid(geom)),
        'manzanas', (SELECT COUNT(*)::int FROM gis_manzanas WHERE NOT ST_IsValid(geom)),
        'quebradas', (SELECT COUNT(*)::int FROM gis_quebradas WHERE NOT ST_IsValid(geom))
      )
    ) AS resumen
  `);
  console.log(JSON.stringify(rows[0].resumen, null, 2));
} finally {
  await pool.end();
}
