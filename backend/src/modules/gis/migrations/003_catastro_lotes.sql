CREATE TABLE IF NOT EXISTS gis_import_batches (
  id BIGSERIAL PRIMARY KEY,
  source_file VARCHAR(255),
  source_hash VARCHAR(128),
  source_type VARCHAR(50),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status VARCHAR(30),
  records_read INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_rejected INTEGER DEFAULT 0,
  created_by BIGINT,
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS gis_import_errors (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT REFERENCES gis_import_batches(id),
  source_fid VARCHAR(100),
  reason TEXT,
  raw_data JSONB
);

CREATE TABLE IF NOT EXISTS gis_lotes (
  id BIGSERIAL PRIMARY KEY,
  barrio_id BIGINT REFERENCES gis_barrios(id),
  manzana_id BIGINT REFERENCES gis_manzanas(id),
  numero_lote VARCHAR(30),
  clave_catastral VARCHAR(100),
  source_dataset VARCHAR(100) NOT NULL,
  source_fid BIGINT NOT NULL,
  geom geometry(MultiPolygon,32616) NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source_dataset, source_fid)
);

CREATE INDEX IF NOT EXISTS idx_gis_lotes_geom ON gis_lotes USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_gis_lotes_clave ON gis_lotes (clave_catastral);
CREATE INDEX IF NOT EXISTS idx_gis_lotes_barrio ON gis_lotes (barrio_id);
CREATE INDEX IF NOT EXISTS idx_gis_lotes_manzana ON gis_lotes (manzana_id);

CREATE TABLE IF NOT EXISTS gis_lote_etiquetas (
  id BIGSERIAL PRIMARY KEY,
  lote_id BIGINT REFERENCES gis_lotes(id),
  numero_lote VARCHAR(30),
  source_fid BIGINT UNIQUE,
  source_text TEXT,
  geom geometry(Point,32616) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gis_lote_etiquetas_geom ON gis_lote_etiquetas USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_gis_lote_etiquetas_lote ON gis_lote_etiquetas (lote_id);

CREATE TABLE IF NOT EXISTS gis_catastro_puntos (
  id BIGSERIAL PRIMARY KEY,
  clave_catastral VARCHAR(100),
  clave_base VARCHAR(100),
  abonado VARCHAR(255),
  inquilino VARCHAR(255),
  direccion VARCHAR(500),
  colonia_origen VARCHAR(255),
  uso_inmueble VARCHAR(255),
  actividad VARCHAR(255),
  observacion TEXT,
  barrio_id BIGINT REFERENCES gis_barrios(id),
  manzana_id BIGINT REFERENCES gis_manzanas(id),
  lote_id BIGINT REFERENCES gis_lotes(id),
  geom geometry(Point,32616) NOT NULL,
  source_fid BIGINT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gis_catastro_geom ON gis_catastro_puntos USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_gis_catastro_clave ON gis_catastro_puntos (clave_catastral);
CREATE INDEX IF NOT EXISTS idx_gis_catastro_base ON gis_catastro_puntos (clave_base);
CREATE INDEX IF NOT EXISTS idx_gis_catastro_lote ON gis_catastro_puntos (lote_id);
