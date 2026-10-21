-- Avisos de documentos no entregados (2026-10-21). El inicializador la crea sola desde schema.sql.
-- Administracion o Gerencia avisan al tecnico del lote con un mensaje predefinido:
-- que mensaje de la campana corresponde a que documento, quien lo mando y con que plantilla.
CREATE TABLE IF NOT EXISTS entrega_documento_avisos (
  message_id INT UNSIGNED NOT NULL PRIMARY KEY,
  no_entregada_id INT UNSIGNED NOT NULL,
  recipient_user_id INT UNSIGNED NOT NULL,
  sender_user_id INT UNSIGNED NULL,
  plantilla VARCHAR(30) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_entrega_documento_avisos_documento (no_entregada_id),
  KEY idx_entrega_documento_avisos_recipient (recipient_user_id)
);
