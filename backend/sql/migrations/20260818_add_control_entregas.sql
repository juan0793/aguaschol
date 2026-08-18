-- Modulo Control de Entregas: distribucion fisica de facturas y notas de cobro.
-- Las tablas se crean tambien desde backend/sql/schema.sql; esta migracion permite
-- aplicar el modulo sobre una base ya existente sin recrear el esquema completo.

CREATE TABLE IF NOT EXISTS personal_campo (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre_completo VARCHAR(180) NOT NULL,
  tipo_personal ENUM('TECNICO', 'COBRADOR', 'ENTREGA_FACTURAS', 'OTRO') NOT NULL DEFAULT 'OTRO',
  user_id INT UNSIGNED NULL,
  telefono VARCHAR(40) NOT NULL DEFAULT '',
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_personal_campo_activo (activo),
  KEY idx_personal_campo_tipo (tipo_personal),
  KEY idx_personal_campo_user (user_id),
  CONSTRAINT fk_personal_campo_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS entrega_motivos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  etiqueta VARCHAR(120) NOT NULL,
  requiere_observacion TINYINT(1) NOT NULL DEFAULT 0,
  orden INT UNSIGNED NOT NULL DEFAULT 0,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_entrega_motivos_activo (activo, orden)
);

INSERT INTO entrega_motivos (codigo, etiqueta, requiere_observacion, orden, activo) VALUES
  ('CASA_CERRADA', 'Casa cerrada', 0, 1, 1),
  ('DIRECCION_NO_ENCONTRADA', 'Direccion no encontrada', 0, 2, 1),
  ('PREDIO_DESHABITADO', 'Predio deshabitado', 0, 3, 1),
  ('ABONADO_NO_LOCALIZADO', 'Abonado no localizado', 0, 4, 1),
  ('DATOS_INCONSISTENTES', 'Datos inconsistentes', 0, 5, 1),
  ('RECHAZO_RECEPCION', 'Rechazo de recepcion', 0, 6, 1),
  ('OTRO', 'Otro', 1, 7, 1)
ON DUPLICATE KEY UPDATE etiqueta = VALUES(etiqueta), orden = VALUES(orden);

CREATE TABLE IF NOT EXISTS entrega_lotes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fecha DATE NOT NULL,
  responsable_id INT UNSIGNED NOT NULL,
  barrio_codigo VARCHAR(10) NOT NULL DEFAULT '',
  barrio_nombre VARCHAR(180) NOT NULL DEFAULT '',
  tipo_documento ENUM('FACTURA', 'NOTA_COBRO') NOT NULL,
  total_asignadas INT UNSIGNED NOT NULL DEFAULT 0,
  total_sobrantes INT UNSIGNED NOT NULL DEFAULT 0,
  estado ENUM('ABIERTO', 'CERRADO', 'REVISADO') NOT NULL DEFAULT 'ABIERTO',
  observacion_inicial TEXT NULL,
  observacion_responsable TEXT NULL,
  created_by INT UNSIGNED NULL,
  closed_by INT UNSIGNED NULL,
  closed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_entrega_lotes_fecha (fecha),
  KEY idx_entrega_lotes_responsable_fecha (responsable_id, fecha),
  KEY idx_entrega_lotes_estado (estado),
  KEY idx_entrega_lotes_tipo_fecha (tipo_documento, fecha),
  KEY idx_entrega_lotes_barrio (barrio_codigo),
  CONSTRAINT fk_entrega_lotes_responsable FOREIGN KEY (responsable_id) REFERENCES personal_campo(id) ON DELETE RESTRICT,
  CONSTRAINT fk_entrega_lotes_creador FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
  CONSTRAINT fk_entrega_lotes_cierre FOREIGN KEY (closed_by) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS entrega_no_entregadas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lote_id INT UNSIGNED NOT NULL,
  numero_abonado VARCHAR(80) NOT NULL DEFAULT '',
  clave_catastral VARCHAR(30) NOT NULL DEFAULT '',
  abonado_nombre VARCHAR(180) NOT NULL DEFAULT '',
  motivo VARCHAR(40) NOT NULL,
  observacion TEXT NULL,
  estado ENUM('PENDIENTE', 'REENTREGADA', 'NO_LOCALIZADA', 'CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
  fecha_ultimo_intento DATE NULL DEFAULT NULL,
  fecha_entrega_final DATE NULL DEFAULT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_entrega_no_entregadas_lote (lote_id),
  KEY idx_entrega_no_entregadas_abonado (numero_abonado),
  KEY idx_entrega_no_entregadas_clave (clave_catastral),
  KEY idx_entrega_no_entregadas_motivo (motivo),
  KEY idx_entrega_no_entregadas_estado (estado),
  CONSTRAINT fk_entrega_no_entregadas_lote FOREIGN KEY (lote_id) REFERENCES entrega_lotes(id) ON DELETE CASCADE,
  CONSTRAINT fk_entrega_no_entregadas_creador FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS entrega_intentos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  no_entregada_id INT UNSIGNED NOT NULL,
  fecha DATE NOT NULL,
  responsable_id INT UNSIGNED NULL,
  resultado ENUM('SIN_RESPUESTA', 'CASA_CERRADA', 'NO_LOCALIZADO', 'ENTREGADO', 'OTRO') NOT NULL,
  observacion TEXT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_entrega_intentos_documento (no_entregada_id, fecha),
  KEY idx_entrega_intentos_responsable (responsable_id),
  CONSTRAINT fk_entrega_intentos_documento FOREIGN KEY (no_entregada_id) REFERENCES entrega_no_entregadas(id) ON DELETE CASCADE,
  CONSTRAINT fk_entrega_intentos_responsable FOREIGN KEY (responsable_id) REFERENCES personal_campo(id) ON DELETE SET NULL,
  CONSTRAINT fk_entrega_intentos_creador FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS reportes_semanales_entregas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  fecha_generacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  generado_por INT UNSIGNED NULL,
  generado_por_nombre VARCHAR(180) NOT NULL DEFAULT '',
  tipo_documento VARCHAR(20) NOT NULL DEFAULT '',
  total_asignadas INT UNSIGNED NOT NULL DEFAULT 0,
  total_entregadas INT UNSIGNED NOT NULL DEFAULT 0,
  total_no_entregadas INT UNSIGNED NOT NULL DEFAULT 0,
  total_reentregadas INT UNSIGNED NOT NULL DEFAULT 0,
  total_pendientes INT UNSIGNED NOT NULL DEFAULT 0,
  efectividad DECIMAL(6, 2) NOT NULL DEFAULT 0,
  resumen_json LONGTEXT NULL,
  estado ENUM('GENERADO', 'CORREGIDO', 'ANULADO') NOT NULL DEFAULT 'GENERADO',
  version INT UNSIGNED NOT NULL DEFAULT 1,
  reporte_origen_id INT UNSIGNED NULL,
  motivo_correccion VARCHAR(255) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_reportes_semanales_rango (fecha_inicio, fecha_fin),
  KEY idx_reportes_semanales_estado (estado),
  KEY idx_reportes_semanales_origen (reporte_origen_id),
  CONSTRAINT fk_reportes_semanales_generador FOREIGN KEY (generado_por) REFERENCES app_users(id) ON DELETE SET NULL
);
