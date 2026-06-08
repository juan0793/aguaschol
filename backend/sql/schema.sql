CREATE TABLE IF NOT EXISTS app_users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(180) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  username VARCHAR(120) NOT NULL UNIQUE,
  role ENUM('admin', 'operator', 'transport', 'validadora_campo') NOT NULL DEFAULT 'operator',
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

CREATE TABLE IF NOT EXISTS user_profile_messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sender_user_id INT UNSIGNED NULL,
  recipient_user_id INT UNSIGNED NOT NULL,
  parent_message_id INT UNSIGNED NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_profile_messages_sender
    FOREIGN KEY (sender_user_id) REFERENCES app_users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_user_profile_messages_recipient
    FOREIGN KEY (recipient_user_id) REFERENCES app_users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_user_profile_messages_parent
    FOREIGN KEY (parent_message_id) REFERENCES user_profile_messages(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS profile_general_messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sender_user_id INT UNSIGNED NULL,
  body TEXT NOT NULL,
  pinned_at TIMESTAMP NULL DEFAULT NULL,
  pinned_by INT UNSIGNED NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_profile_general_messages_sender
    FOREIGN KEY (sender_user_id) REFERENCES app_users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_profile_general_messages_pinned_by
    FOREIGN KEY (pinned_by) REFERENCES app_users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  achievement_code VARCHAR(80) NULL,
  awarded_by INT UNSIGNED NULL,
  title VARCHAR(120) NOT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  icon VARCHAR(40) NOT NULL DEFAULT 'success',
  badge_color VARCHAR(20) NOT NULL DEFAULT '#1576d1',
  awarded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_achievements_user
    FOREIGN KEY (user_id) REFERENCES app_users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_user_achievements_awarded_by
    FOREIGN KEY (awarded_by) REFERENCES app_users(id)
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
  estado_padron VARCHAR(40) NOT NULL DEFAULT 'clandestino',
  clave_alcaldia VARCHAR(40) NOT NULL DEFAULT '',
  nombre_alcaldia VARCHAR(180) NOT NULL DEFAULT '',
  barrio_alcaldia VARCHAR(180) NOT NULL DEFAULT '',
  conexion_agua ENUM('Si', 'No') NOT NULL DEFAULT 'No',
  conexion_alcantarillado ENUM('Si', 'No') NOT NULL DEFAULT 'No',
  recoleccion_desechos ENUM('Si', 'No') NOT NULL DEFAULT 'No',
  foto_path VARCHAR(255) NOT NULL DEFAULT '',
  fecha_aviso DATE NULL,
  firmante_aviso VARCHAR(180) NOT NULL DEFAULT '',
  cargo_firmante VARCHAR(180) NOT NULL DEFAULT '',
  levantamiento_datos VARCHAR(180) NOT NULL DEFAULT '',
  analista_datos VARCHAR(180) NOT NULL DEFAULT '',
  printed_at TIMESTAMP NULL DEFAULT NULL,
  archived_at TIMESTAMP NULL DEFAULT NULL,
  archived_reason VARCHAR(255) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS barrio_codigo_catalogo (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(10) NOT NULL UNIQUE,
  barrio VARCHAR(180) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO barrio_codigo_catalogo (codigo, barrio, activo) VALUES
  ('01', 'Barrio Suyapa', 1),
  ('02', 'Lotificacion Carranza', 1),
  ('03', 'Barrio Nueva Esperanza', 1),
  ('04', 'Brisas del Sur', 1),
  ('05', 'Barrio Campo Sol', 1),
  ('06', 'Barrio La Ceiba', 1),
  ('07', 'Barrio Campo Luna', 1),
  ('08', 'Barrio Piedras Azules', 1),
  ('09', 'Barrio Santa Lucia', 1),
  ('10', 'Barrio San Juan Bosco', 1),
  ('11', 'Barrio Los Graneros', 1),
  ('12', 'Barrio El Hospital', 1),
  ('13', 'Barrio Corbeta', 1),
  ('14', 'Barrio El Centro', 1),
  ('15', 'Barrio La Cruz', 1),
  ('16', 'Barrio Los Mangos', 1),
  ('17', 'Barrio Morazan', 1),
  ('18', 'Barrio Los Fuertes', 1),
  ('19', 'Aterrizaje', 1),
  ('20', 'Barrio Alegria', 1),
  ('21', 'Barrio El Cortijo', 1),
  ('22', 'Barrio Cabanas', 1),
  ('23', 'Barrio El Estadio', 1),
  ('24', 'La Libertad', 1),
  ('25', 'Barrio Guadalupe', 1),
  ('26', 'Barrio Tamarindo', 1),
  ('27', 'Barrio La Esperanza', 1),
  ('28', 'Barrio El Porvenir', 1),
  ('29', 'Barrio Valle', 1),
  ('30', 'Las Colinas', 1),
  ('31', 'Barrio El Brasil', 1),
  ('33', 'Colonia 9 de Enero', 1),
  ('34', 'Barrio Gracias a Dios', 1),
  ('35', 'Barrio San Pedro Sur', 1),
  ('36', 'Las Acacias', 1),
  ('37', 'Colonia Santa Marta', 1),
  ('38', 'Barrio El Recreo', 1),
  ('39', 'Buenos Aires', 1),
  ('40', 'Las Vegas', 1),
  ('42', 'Barrio El Estruendo', 1),
  ('43', 'La Venecia', 1),
  ('44', 'Colonia Monsenor Marcelo Gerin', 1),
  ('45', 'Barrio Sagrado Corazon', 1),
  ('46', 'Barrio La Providencia', 1),
  ('47', 'Colonia Iberia', 1),
  ('48', 'Colonia Victor Argenal', 1),
  ('49', 'Colonia 15 de Septiembre', 1),
  ('50', 'Las Arenas', 1),
  ('51', 'Barrio El Progreso', 1),
  ('54', 'Barrio San Fco del Palomar', 1),
  ('55', 'Colonia Miramonte', 1),
  ('56', 'Julio Midence', 1),
  ('59', 'Colonia Maria Milagrosa', 1),
  ('62', 'Barrio Los Llanos', 1),
  ('64', 'Colonia Isidro Pineda', 1),
  ('70', 'Colonia El Eden', 1),
  ('81', 'Barrio San Luis', 1),
  ('90', 'Barrio Nueva Jerusalen', 1),
  ('91', 'Villas del Cortijo', 1),
  ('96', 'Cumbre Chorotega', 1),
  ('100', 'Stybis', 1),
  ('114', 'Lotificacion Beel', 1),
  ('115', 'Barrio San Pedro del Norte', 1),
  ('117', 'Colonia Luis Alonso Narvaez', 1),
  ('125', 'Colonia Rotaria', 1),
  ('136', 'Colonia Cristo de Esquipulas', 1),
  ('141', 'Nueva Bella Vista', 1)
ON DUPLICATE KEY UPDATE
  barrio = VALUES(barrio),
  activo = VALUES(activo);

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
  housing_units INT UNSIGNED NOT NULL DEFAULT 1,
  diary_date DATE NULL DEFAULT NULL,
  validation_status ENUM('pending', 'approved', 'needs_correction', 'corrected') NOT NULL DEFAULT 'pending',
  validated_by INT UNSIGNED NULL,
  validated_at TIMESTAMP NULL DEFAULT NULL,
  validation_notes TEXT NULL,
  correction_notes TEXT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_map_points_creator
    FOREIGN KEY (created_by) REFERENCES app_users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_map_points_validator
    FOREIGN KEY (validated_by) REFERENCES app_users(id)
    ON DELETE SET NULL,
  KEY idx_map_points_created_at (created_at),
  KEY idx_map_points_diary_date (diary_date),
  KEY idx_map_points_creator (created_by),
  KEY idx_map_points_validation_status (validation_status),
  KEY idx_map_points_validated_by (validated_by)
);

CREATE TABLE IF NOT EXISTS map_point_validation_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  map_point_id INT UNSIGNED NOT NULL,
  validator_user_id INT UNSIGNED NULL,
  previous_status VARCHAR(40) NOT NULL DEFAULT '',
  next_status VARCHAR(40) NOT NULL DEFAULT '',
  previous_payload_json LONGTEXT NULL,
  next_payload_json LONGTEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_map_point_validation_logs_point
    FOREIGN KEY (map_point_id) REFERENCES map_points(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_map_point_validation_logs_validator
    FOREIGN KEY (validator_user_id) REFERENCES app_users(id)
    ON DELETE SET NULL,
  KEY idx_map_point_validation_logs_point (map_point_id, created_at),
  KEY idx_map_point_validation_logs_validator (validator_user_id)
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
