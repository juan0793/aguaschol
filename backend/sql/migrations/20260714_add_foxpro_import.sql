CREATE TABLE IF NOT EXISTS importacion_padron_lotes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, codigo_lote VARCHAR(80) NOT NULL UNIQUE,
  origen VARCHAR(80) NOT NULL DEFAULT 'FOXPRO', fecha_extraccion DATETIME NULL,
  fecha_recepcion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, estado VARCHAR(40) NOT NULL DEFAULT 'RECIBIENDO',
  total_bloques INT UNSIGNED NOT NULL DEFAULT 0, total_registros INT UNSIGNED NOT NULL DEFAULT 0,
  registros_nuevos INT UNSIGNED NOT NULL DEFAULT 0, registros_modificados INT UNSIGNED NOT NULL DEFAULT 0,
  registros_sin_cambios INT UNSIGNED NOT NULL DEFAULT 0, registros_conflicto INT UNSIGNED NOT NULL DEFAULT 0,
  registros_error INT UNSIGNED NOT NULL DEFAULT 0, registros_aplicados INT UNSIGNED NOT NULL DEFAULT 0,
  registros_descartados INT UNSIGNED NOT NULL DEFAULT 0, usuario_aplicacion INT UNSIGNED NULL,
  fecha_aplicacion DATETIME NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_importacion_lotes_estado_fecha (estado, fecha_recepcion),
  CONSTRAINT fk_importacion_lotes_usuario FOREIGN KEY (usuario_aplicacion) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS importacion_padron_registros (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, lote_id BIGINT UNSIGNED NOT NULL, numero_fila INT UNSIGNED NOT NULL,
  codigo_abonado VARCHAR(80) NOT NULL DEFAULT '', clave_catastral VARCHAR(80) NOT NULL DEFAULT '',
  nombre VARCHAR(255) NOT NULL DEFAULT '', colonia VARCHAR(255) NOT NULL DEFAULT '',
  agua_original VARCHAR(40) NOT NULL DEFAULT '', agua_normalizada CHAR(1) NULL,
  alcantarillado_original VARCHAR(40) NOT NULL DEFAULT '', alcantarillado_normalizado CHAR(1) NULL,
  barrido_original VARCHAR(40) NOT NULL DEFAULT '', barrido_normalizado CHAR(1) NULL,
  tren_aseo_original VARCHAR(40) NOT NULL DEFAULT '', tren_aseo_normalizado CHAR(1) NULL,
  bombeo_original VARCHAR(40) NOT NULL DEFAULT '', bombeo_normalizado CHAR(1) NULL,
  valor DECIMAL(16,2) NULL, intereses DECIMAL(16,2) NULL, saldo_total DECIMAL(16,2) NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'RECIBIDO', diferencias LONGTEXT NULL, dato_original LONGTEXT NOT NULL,
  mensaje_error TEXT NULL, padron_maestro_id VARCHAR(80) NULL, fecha_aplicacion DATETIME NULL,
  usuario_aplicacion INT UNSIGNED NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_importacion_registro_fila (lote_id, numero_fila),
  KEY idx_importacion_registros_abonado (codigo_abonado), KEY idx_importacion_registros_clave (clave_catastral),
  KEY idx_importacion_registros_nombre (nombre), KEY idx_importacion_registros_colonia (colonia),
  KEY idx_importacion_registros_estado (estado),
  CONSTRAINT fk_importacion_registros_lote FOREIGN KEY (lote_id) REFERENCES importacion_padron_lotes(id) ON DELETE CASCADE,
  CONSTRAINT fk_importacion_registros_usuario FOREIGN KEY (usuario_aplicacion) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS importacion_padron_bloques (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, lote_id BIGINT UNSIGNED NOT NULL,
  numero_bloque INT UNSIGNED NOT NULL, total_bloques INT UNSIGNED NOT NULL, hash_bloque CHAR(64) NOT NULL,
  cantidad_registros INT UNSIGNED NOT NULL, fecha_recepcion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_importacion_bloque (lote_id, numero_bloque), KEY idx_importacion_bloques_hash (hash_bloque),
  CONSTRAINT fk_importacion_bloques_lote FOREIGN KEY (lote_id) REFERENCES importacion_padron_lotes(id) ON DELETE CASCADE
);
