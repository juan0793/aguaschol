-- Diagnostico del Control Territorial GPS - SOLO LECTURA
-- Aguas de Choluteca | generado el 14/08/2026
--
-- Ninguna consulta modifica datos: son todas SELECT.
-- Correr sobre la base de produccion (servicio MySQL en Railway).
-- El patron de clave es el mismo que usa el frontend y backend/src/utils/claveField.js.

-- ---------------------------------------------------------------------------
-- 1. Tamano real del universo de puntos
-- ---------------------------------------------------------------------------
SELECT
  COUNT(*)                                                           AS puntos_totales,
  SUM(REGEXP_LIKE(CONCAT(reference_note, ' ', description),
      '[0-9]{2,3}-[0-9]{2}-[0-9]{2}'))                               AS con_clave,
  SUM(NOT REGEXP_LIKE(CONCAT(reference_note, ' ', description),
      '[0-9]{2,3}-[0-9]{2}-[0-9]{2}'))                               AS sin_clave,
  COUNT(DISTINCT COALESCE(diary_date, DATE(created_at)))             AS jornadas,
  COUNT(DISTINCT created_by)                                         AS tecnicos,
  MIN(COALESCE(diary_date, DATE(created_at)))                        AS primera_jornada,
  MAX(COALESCE(diary_date, DATE(created_at)))                        AS ultima_jornada
FROM map_points;

-- ---------------------------------------------------------------------------
-- 2. Negocios: tipo vs color
--    Responde si "negocio" siempre se marca con point_type o si hay puntos
--    marcados solo poniendo el color rojo (#ef4444) a mano.
-- ---------------------------------------------------------------------------
SELECT
  point_type,
  LOWER(marker_color) AS color,
  COUNT(*)            AS puntos
FROM map_points
GROUP BY point_type, LOWER(marker_color)
ORDER BY puntos DESC;

-- Resumen directo de la pregunta anterior
SELECT
  SUM(point_type = 'negocio_local_comercial')                                          AS negocios_por_tipo,
  SUM(LOWER(marker_color) = '#ef4444')                                                 AS puntos_rojos,
  SUM(LOWER(marker_color) = '#ef4444' AND point_type <> 'negocio_local_comercial')     AS rojos_sin_tipo_negocio,
  SUM(point_type = 'negocio_local_comercial' AND LOWER(marker_color) <> '#ef4444')     AS tipo_negocio_sin_rojo
FROM map_points;

-- ---------------------------------------------------------------------------
-- 3. Calidad del GPS (cortes 5 / 10 / 20 / 30 m)
-- ---------------------------------------------------------------------------
SELECT
  CASE
    WHEN accuracy_meters IS NULL OR accuracy_meters <= 0 THEN 'sin_dato'
    WHEN accuracy_meters <= 5  THEN 'excelente'
    WHEN accuracy_meters <= 10 THEN 'buena'
    WHEN accuracy_meters <= 20 THEN 'aceptable'
    WHEN accuracy_meters <= 30 THEN 'baja'
    ELSE 'deficiente'
  END                          AS rango,
  COUNT(*)                     AS puntos,
  ROUND(AVG(accuracy_meters), 2) AS precision_media
FROM map_points
GROUP BY rango
ORDER BY FIELD(rango, 'excelente', 'buena', 'aceptable', 'baja', 'deficiente', 'sin_dato');

-- ---------------------------------------------------------------------------
-- 4. Claves repetidas (clave base = tres primeros bloques)
--    Es la senal de duplicados / inconsistencia territorial.
-- ---------------------------------------------------------------------------
SELECT
  SUBSTRING_INDEX(
    REGEXP_SUBSTR(CONCAT(reference_note, ' ', description), '[0-9]{2,3}-[0-9]{2}-[0-9]{2}(-[0-9]{2})?'),
    '-', 3
  )                                        AS clave_base,
  COUNT(*)                                 AS registros,
  COUNT(DISTINCT created_by)               AS tecnicos,
  ROUND(MAX(latitude) - MIN(latitude), 6)  AS delta_lat,
  ROUND(MAX(longitude) - MIN(longitude), 6) AS delta_lng
FROM map_points
WHERE REGEXP_LIKE(CONCAT(reference_note, ' ', description), '[0-9]{2,3}-[0-9]{2}-[0-9]{2}')
GROUP BY clave_base
HAVING registros > 1
ORDER BY registros DESC, delta_lat DESC
LIMIT 40;

-- Cuantas claves base estan repetidas en total
SELECT COUNT(*) AS claves_repetidas FROM (
  SELECT SUBSTRING_INDEX(
           REGEXP_SUBSTR(CONCAT(reference_note, ' ', description), '[0-9]{2,3}-[0-9]{2}-[0-9]{2}(-[0-9]{2})?'),
           '-', 3) AS clave_base
  FROM map_points
  WHERE REGEXP_LIKE(CONCAT(reference_note, ' ', description), '[0-9]{2,3}-[0-9]{2}-[0-9]{2}')
  GROUP BY clave_base
  HAVING COUNT(*) > 1
) AS repetidas;

-- ---------------------------------------------------------------------------
-- 5. Volumen por jornada y por tecnico (para dimensionar la pantalla)
-- ---------------------------------------------------------------------------
SELECT
  COALESCE(diary_date, DATE(created_at)) AS jornada,
  COUNT(*)                               AS puntos,
  COUNT(DISTINCT created_by)             AS tecnicos
FROM map_points
GROUP BY jornada
ORDER BY puntos DESC
LIMIT 15;

SELECT
  u.full_name                                            AS tecnico,
  COUNT(*)                                               AS puntos,
  COUNT(DISTINCT COALESCE(p.diary_date, DATE(p.created_at))) AS jornadas,
  ROUND(AVG(p.accuracy_meters), 2)                       AS precision_media,
  SUM(p.point_type = 'negocio_local_comercial')          AS negocios,
  SUM(p.validation_status = 'approved')                  AS aprobados,
  SUM(p.validation_status = 'pending')                   AS pendientes
FROM map_points p
LEFT JOIN app_users u ON u.id = p.created_by
GROUP BY p.created_by, u.full_name
ORDER BY puntos DESC;

-- ---------------------------------------------------------------------------
-- 6. Estado de validacion y peso del historico
-- ---------------------------------------------------------------------------
SELECT validation_status, COUNT(*) AS puntos
FROM map_points
GROUP BY validation_status;

-- Tamano aproximado de lo que hoy viaja en cada carga de la pantalla
SELECT
  COUNT(*)                                                                     AS filas,
  ROUND(SUM(LENGTH(description) + LENGTH(reference_note) +
            LENGTH(COALESCE(validation_notes, '')) +
            LENGTH(COALESCE(correction_notes, ''))) / 1024 / 1024, 2)          AS mb_solo_texto
FROM map_points;

-- ---------------------------------------------------------------------------
-- 7. Cruce disponible con clandestinos (por clave base)
-- ---------------------------------------------------------------------------
SELECT COUNT(*) AS fichas_clandestinos_con_clave
FROM inmuebles_clandestinos
WHERE clave_catastral <> '';
