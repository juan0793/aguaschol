-- Reclamos de entrega (2026-10-15). El inicializador la crea sola desde schema.sql.
-- Reclamos de entrega: un abonado dice que no recibio su factura o nota de cobro.
-- La oficina lo registra con la clave o el abonado; el sistema anota quien entrego
-- ese barrio en el ciclo (o, sin lote, quien lo tiene en el reparto). Todo el equipo
-- de campo los ve y el tecnico escribe que paso; la oficina lo cierra.
CREATE TABLE IF NOT EXISTS entrega_reclamos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  numero_abonado VARCHAR(80) NOT NULL DEFAULT '',
  clave_catastral VARCHAR(30) NOT NULL DEFAULT '',
  abonado_nombre VARCHAR(180) NOT NULL DEFAULT '',
  barrio_codigo VARCHAR(10) NOT NULL DEFAULT '',
  barrio_nombre VARCHAR(180) NOT NULL DEFAULT '',
  tipo_documento ENUM('FACTURA', 'NOTA_COBRO') NOT NULL DEFAULT 'FACTURA',
  cantidad SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  motivo VARCHAR(40) NOT NULL,
  detalle TEXT NULL,
  responsable_id INT UNSIGNED NULL,
  responsable_origen ENUM('LOTE', 'REPARTO', 'OFICINA', 'NINGUNO') NOT NULL DEFAULT 'NINGUNO',
  lote_id INT UNSIGNED NULL,
  estado ENUM('SIN_RESPUESTA', 'RESPONDIDO', 'CERRADO') NOT NULL DEFAULT 'SIN_RESPUESTA',
  respuesta TEXT NULL,
  respondido_por INT UNSIGNED NULL,
  respondido_por_nombre VARCHAR(180) NOT NULL DEFAULT '',
  respondido_en TIMESTAMP NULL DEFAULT NULL,
  cerrado_por_nombre VARCHAR(180) NOT NULL DEFAULT '',
  cerrado_en TIMESTAMP NULL DEFAULT NULL,
  created_by INT UNSIGNED NULL,
  created_by_nombre VARCHAR(180) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_entrega_reclamos_estado (estado, created_at),
  KEY idx_entrega_reclamos_responsable (responsable_id, estado),
  KEY idx_entrega_reclamos_clave (clave_catastral),
  KEY idx_entrega_reclamos_abonado (numero_abonado),
  CONSTRAINT fk_entrega_reclamos_responsable FOREIGN KEY (responsable_id) REFERENCES personal_campo(id) ON DELETE SET NULL,
  CONSTRAINT fk_entrega_reclamos_lote FOREIGN KEY (lote_id) REFERENCES entrega_lotes(id) ON DELETE SET NULL,
  CONSTRAINT fk_entrega_reclamos_respondio FOREIGN KEY (respondido_por) REFERENCES app_users(id) ON DELETE SET NULL,
  CONSTRAINT fk_entrega_reclamos_creador FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL
);

