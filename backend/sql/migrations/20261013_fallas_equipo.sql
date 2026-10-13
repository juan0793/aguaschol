-- Registro de fallas del equipo (2026-10-13). El inicializador la crea sola desde schema.sql.
CREATE TABLE IF NOT EXISTS fallas_equipo (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  user_nombre VARCHAR(160) NOT NULL DEFAULT '',
  user_rol VARCHAR(32) NOT NULL DEFAULT '',
  origen ENUM('servidor', 'dispositivo') NOT NULL,
  tipo ENUM('sin_conexion', 'rechazada', 'error_servidor') NOT NULL,
  metodo VARCHAR(8) NOT NULL,
  ruta VARCHAR(200) NOT NULL,
  accion VARCHAR(160) NOT NULL,
  codigo SMALLINT UNSIGNED NULL,
  mensaje VARCHAR(300) NOT NULL DEFAULT '',
  veces INT UNSIGNED NOT NULL DEFAULT 1,
  ocurrido_en DATETIME NOT NULL,
  registrado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revisada_en TIMESTAMP NULL DEFAULT NULL,
  revisada_por INT UNSIGNED NULL,
  KEY idx_fallas_equipo_revisada (revisada_en),
  KEY idx_fallas_equipo_user (user_id, ocurrido_en),
  CONSTRAINT fk_fallas_equipo_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE SET NULL
);
