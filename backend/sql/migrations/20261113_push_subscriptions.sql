-- El inicializador la crea sola al arrancar (db.js) y desde schema.sql.
-- Web Push (2026-11-13): suscripciones por usuario y dispositivo para avisar con la
-- app cerrada. endpoint_hash es el SHA-256 del endpoint (unico).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  endpoint_hash CHAR(64) NOT NULL,
  endpoint VARCHAR(1000) NOT NULL,
  p256dh VARCHAR(200) NOT NULL,
  auth VARCHAR(80) NOT NULL,
  user_agent VARCHAR(255) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_success_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uq_push_subscriptions_endpoint (endpoint_hash),
  KEY idx_push_subscriptions_usuario (user_id),
  CONSTRAINT fk_push_subscriptions_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
);
