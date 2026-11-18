-- Plan del dia siguiente: al cerrar un lote, el tecnico anota que barrios trabajara
-- en la proxima jornada. Una fila por dia, responsable y barrio; guardar reemplaza
-- lo anotado para ese dia. El Avance del mes marca esos barrios.
CREATE TABLE IF NOT EXISTS entrega_plan_barrios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fecha DATE NOT NULL,
  responsable_id INT UNSIGNED NOT NULL,
  barrio_codigo VARCHAR(10) NOT NULL,
  lote_id INT UNSIGNED NULL,
  anotado_por INT UNSIGNED NULL,
  anotado_por_nombre VARCHAR(160) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_entrega_plan_barrios (fecha, responsable_id, barrio_codigo),
  KEY idx_entrega_plan_barrios_responsable (responsable_id, fecha),
  CONSTRAINT fk_entrega_plan_barrios_responsable FOREIGN KEY (responsable_id) REFERENCES personal_campo(id) ON DELETE CASCADE,
  CONSTRAINT fk_entrega_plan_barrios_usuario FOREIGN KEY (anotado_por) REFERENCES app_users(id) ON DELETE SET NULL
);
