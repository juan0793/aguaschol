CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS gis_barrios (
  id BIGSERIAL PRIMARY KEY,
  clave VARCHAR(10) UNIQUE,
  nombre VARCHAR(150),
  tipo VARCHAR(40),
  geom geometry(MultiPolygon,32616) NOT NULL,
  area_m2 DOUBLE PRECISION,
  source_fid BIGINT UNIQUE,
  source_text TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gis_barrios_geom ON gis_barrios USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_gis_barrios_clave ON gis_barrios (clave);
CREATE INDEX IF NOT EXISTS idx_gis_barrios_nombre ON gis_barrios (nombre);

CREATE TABLE IF NOT EXISTS gis_barrio_etiquetas (
  id BIGSERIAL PRIMARY KEY,
  barrio_id BIGINT REFERENCES gis_barrios(id),
  tipo VARCHAR(40),
  nombre VARCHAR(150),
  clave VARCHAR(10),
  source_fid BIGINT UNIQUE,
  source_text TEXT,
  geom geometry(Point,32616) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gis_barrio_etiquetas_geom ON gis_barrio_etiquetas USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_gis_barrio_etiquetas_barrio ON gis_barrio_etiquetas (barrio_id);
CREATE INDEX IF NOT EXISTS idx_gis_barrio_etiquetas_clave ON gis_barrio_etiquetas (clave);

CREATE TABLE IF NOT EXISTS gis_manzanas (
  id BIGSERIAL PRIMARY KEY,
  barrio_id BIGINT REFERENCES gis_barrios(id),
  numero VARCHAR(30),
  geom geometry(MultiPolygon,32616) NOT NULL,
  source_fid BIGINT UNIQUE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gis_manzanas_geom ON gis_manzanas USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_gis_manzanas_barrio ON gis_manzanas (barrio_id);

CREATE TABLE IF NOT EXISTS gis_quebradas (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(255),
  geom geometry(MultiLineString,32616) NOT NULL,
  source_fid BIGINT UNIQUE,
  activo BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_gis_quebradas_geom ON gis_quebradas USING GIST (geom);
