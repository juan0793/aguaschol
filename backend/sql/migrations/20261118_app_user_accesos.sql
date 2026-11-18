-- Accesos adicionales por usuario: abren a una persona una pantalla que su perfil
-- no tiene (por ejemplo, Barrios por prioridad de Entregas para un técnico), sin
-- dársela a todos los de su perfil. Una fila por usuario y acceso; `vence` vacío es
-- sin fecha y, al vencer, el acceso deja de valer solo.
CREATE TABLE IF NOT EXISTS app_user_accesos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  acceso VARCHAR(60) NOT NULL,
  alcance VARCHAR(20) NOT NULL DEFAULT 'todos',
  vence DATE NULL,
  otorgado_por INT UNSIGNED NULL,
  otorgado_por_nombre VARCHAR(160) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_app_user_accesos (user_id, acceso),
  CONSTRAINT fk_app_user_accesos_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE,
  CONSTRAINT fk_app_user_accesos_otorgante FOREIGN KEY (otorgado_por) REFERENCES app_users(id) ON DELETE SET NULL
);
