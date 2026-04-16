CREATE TABLE IF NOT EXISTS app_users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(180) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  username VARCHAR(120) NOT NULL UNIQUE,
  role ENUM('admin', 'operator', 'transport') NOT NULL DEFAULT 'operator',
  password_hash VARCHAR(255) NOT NULL,
  force_password_change TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_auth_sessions_user
    FOREIGN KEY (user_id) REFERENCES app_users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80) NOT NULL DEFAULT '',
  summary VARCHAR(255) NOT NULL DEFAULT '',
  details_json LONGTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_logs_actor
    FOREIGN KEY (actor_user_id) REFERENCES app_users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inmuebles_clandestinos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clave_catastral VARCHAR(30) NOT NULL UNIQUE,
  abonado VARCHAR(180) NOT NULL DEFAULT '',
  nombre_catastral VARCHAR(180) NOT NULL DEFAULT '',
  inquilino VARCHAR(180) NOT NULL DEFAULT '',
  barrio_colonia VARCHAR(180) NOT NULL DEFAULT '',
  identidad VARCHAR(40) NOT NULL DEFAULT '',
  telefono VARCHAR(40) NOT NULL DEFAULT '',
  accion_inspeccion TEXT NOT NULL,
  situacion_inmueble VARCHAR(80) NOT NULL DEFAULT '',
  tendencia_inmueble VARCHAR(80) NOT NULL DEFAULT '',
  uso_suelo VARCHAR(80) NOT NULL DEFAULT '',
  actividad VARCHAR(120) NOT NULL DEFAULT '',
  codigo_sector VARCHAR(40) NOT NULL DEFAULT '',
  comentarios TEXT NOT NULL,
  conexion_agua ENUM('Si', 'No') NOT NULL DEFAULT 'No',
  conexion_alcantarillado ENUM('Si', 'No') NOT NULL DEFAULT 'No',
  recoleccion_desechos ENUM('Si', 'No') NOT NULL DEFAULT 'No',
  foto_path VARCHAR(255) NOT NULL DEFAULT '',
  fecha_aviso DATE NULL,
  firmante_aviso VARCHAR(180) NOT NULL DEFAULT '',
  cargo_firmante VARCHAR(180) NOT NULL DEFAULT '',
  levantamiento_datos VARCHAR(180) NOT NULL DEFAULT '',
  analista_datos VARCHAR(180) NOT NULL DEFAULT '',
  archived_at TIMESTAMP NULL DEFAULT NULL,
  archived_reason VARCHAR(255) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS map_points (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  point_type VARCHAR(60) NOT NULL DEFAULT 'caja_registro',
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  accuracy_meters DECIMAL(8,2) NULL DEFAULT NULL,
  description TEXT NOT NULL,
  reference_note VARCHAR(255) NOT NULL DEFAULT '',
  marker_color VARCHAR(20) NOT NULL DEFAULT '#1576d1',
  is_terminal_point TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_map_points_creator
    FOREIGN KEY (created_by) REFERENCES app_users(id)
    ON DELETE SET NULL,
  KEY idx_map_points_created_at (created_at),
  KEY idx_map_points_creator (created_by)
);

CREATE TABLE IF NOT EXISTS transport_routes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('draft', 'active', 'completed') NOT NULL DEFAULT 'draft',
  assigned_user_id INT UNSIGNED NULL,
  route_path_json LONGTEXT NOT NULL,
  allowed_deviation_meters DECIMAL(8,2) NOT NULL DEFAULT 35.00,
  started_at TIMESTAMP NULL DEFAULT NULL,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_transport_routes_assigned_user
    FOREIGN KEY (assigned_user_id) REFERENCES app_users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_transport_routes_created_by
    FOREIGN KEY (created_by) REFERENCES app_users(id)
    ON DELETE SET NULL,
  KEY idx_transport_routes_status (status),
  KEY idx_transport_routes_assigned_user (assigned_user_id)
);

CREATE TABLE IF NOT EXISTS transport_route_positions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  route_id INT UNSIGNED NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  accuracy_meters DECIMAL(8,2) NULL DEFAULT NULL,
  deviation_meters DECIMAL(8,2) NULL DEFAULT NULL,
  is_on_route TINYINT(1) NOT NULL DEFAULT 1,
  captured_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  CONSTRAINT fk_transport_route_positions_route
    FOREIGN KEY (route_id) REFERENCES transport_routes(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_transport_route_positions_user
    FOREIGN KEY (created_by) REFERENCES app_users(id)
    ON DELETE SET NULL,
  KEY idx_transport_route_positions_route (route_id, captured_at),
  KEY idx_transport_route_positions_user (created_by)
);

INSERT INTO inmuebles_clandestinos (
  clave_catastral,
  abonado,
  nombre_catastral,
  inquilino,
  barrio_colonia,
  identidad,
  telefono,
  accion_inspeccion,
  situacion_inmueble,
  tendencia_inmueble,
  uso_suelo,
  actividad,
  codigo_sector,
  comentarios,
  conexion_agua,
  conexion_alcantarillado,
  recoleccion_desechos,
  fecha_aviso,
  firmante_aviso,
  cargo_firmante,
  levantamiento_datos,
  analista_datos
) VALUES (
  '10-22-23',
  '',
  '10-22-23',
  '',
  'Barrio San Juan Bosco',
  '',
  '',
  'Inspeccion realizada por Oscar Ivan Alvarez, tiene activos los tres servicios y se visualiza la conexion de agua potable y alcantarillado sanitario.',
  'Habitado',
  '',
  'Residencial',
  'Vivienda',
  '',
  'Clandestino',
  'Si',
  'Si',
  'Si',
  '2026-03-17',
  'Maria Eugenia Berrios',
  'Jefe de Facturacion',
  'LUIS FERNANDO HERRERA SOLIZ',
  'Ing. Juan Ordoñez Bonilla'
)
ON DUPLICATE KEY UPDATE
  barrio_colonia = VALUES(barrio_colonia),
  accion_inspeccion = VALUES(accion_inspeccion),
  comentarios = VALUES(comentarios),
  analista_datos = VALUES(analista_datos);
