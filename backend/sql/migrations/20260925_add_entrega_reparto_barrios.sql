-- Control de Entregas: reparto de barrios por persona de campo.
-- La tabla tambien se crea desde backend/sql/schema.sql al arrancar.
-- Reparto de barrios: que persona de campo entrega cada barrio. El barrio se
-- identifica por su codigo (primer segmento de la clave catastral), el mismo que
-- guarda entrega_lotes.barrio_codigo. Sin fila = barrio sin responsable.
CREATE TABLE IF NOT EXISTS entrega_reparto_barrios (
  barrio_codigo VARCHAR(10) NOT NULL PRIMARY KEY,
  responsable_id INT UNSIGNED NULL,
  orden_ruta SMALLINT UNSIGNED NULL,
  actualizado_por INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_entrega_reparto_responsable (responsable_id),
  CONSTRAINT fk_entrega_reparto_responsable FOREIGN KEY (responsable_id) REFERENCES personal_campo(id) ON DELETE SET NULL,
  CONSTRAINT fk_entrega_reparto_usuario FOREIGN KEY (actualizado_por) REFERENCES app_users(id) ON DELETE SET NULL
);
