ALTER TABLE gis_barrios
ADD COLUMN IF NOT EXISTS clave_sufijo VARCHAR(40);

ALTER TABLE gis_barrio_etiquetas
ADD COLUMN IF NOT EXISTS clave_sufijo VARCHAR(40);

CREATE TABLE IF NOT EXISTS gis_geometrias_originales (
  id BIGSERIAL PRIMARY KEY,
  tabla VARCHAR(80) NOT NULL,
  row_id BIGINT NOT NULL,
  source_fid BIGINT,
  reason_before TEXT NOT NULL,
  area_before_m2 DOUBLE PRECISION,
  geom geometry(Geometry,32616) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tabla, row_id)
);
