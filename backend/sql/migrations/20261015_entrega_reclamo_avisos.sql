-- Avisos de reclamos de entrega en la campana (2026-10-15). El inicializador la crea sola desde schema.sql.
-- Avisos de reclamo: que mensaje de la campana corresponde a que reclamo, para que
-- al tocarlo se abra la pantalla de reclamos y no el perfil de quien lo envio.
CREATE TABLE IF NOT EXISTS entrega_reclamo_avisos (
  message_id INT UNSIGNED NOT NULL PRIMARY KEY,
  reclamo_id INT UNSIGNED NOT NULL,
  recipient_user_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_entrega_reclamo_avisos_reclamo (reclamo_id),
  KEY idx_entrega_reclamo_avisos_recipient (recipient_user_id)
);

