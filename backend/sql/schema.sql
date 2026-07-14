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

CREATE TABLE IF NOT EXISTS importacion_padron_lotes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo_lote VARCHAR(80) NOT NULL UNIQUE,
  origen VARCHAR(80) NOT NULL DEFAULT 'FOXPRO',
  fecha_extraccion DATETIME NULL,
  fecha_recepcion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado VARCHAR(40) NOT NULL DEFAULT 'RECIBIENDO',
  total_bloques INT UNSIGNED NOT NULL DEFAULT 0,
  total_registros INT UNSIGNED NOT NULL DEFAULT 0,
  registros_nuevos INT UNSIGNED NOT NULL DEFAULT 0,
  registros_modificados INT UNSIGNED NOT NULL DEFAULT 0,
  registros_sin_cambios INT UNSIGNED NOT NULL DEFAULT 0,
  registros_conflicto INT UNSIGNED NOT NULL DEFAULT 0,
  registros_error INT UNSIGNED NOT NULL DEFAULT 0,
  registros_aplicados INT UNSIGNED NOT NULL DEFAULT 0,
  registros_descartados INT UNSIGNED NOT NULL DEFAULT 0,
  usuario_aplicacion INT UNSIGNED NULL,
  fecha_aplicacion DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_importacion_lotes_estado_fecha (estado, fecha_recepcion),
  CONSTRAINT fk_importacion_lotes_usuario FOREIGN KEY (usuario_aplicacion) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS importacion_padron_registros (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lote_id BIGINT UNSIGNED NOT NULL,
  numero_fila INT UNSIGNED NOT NULL,
  codigo_abonado VARCHAR(80) NOT NULL DEFAULT '',
  clave_catastral VARCHAR(80) NOT NULL DEFAULT '',
  nombre VARCHAR(255) NOT NULL DEFAULT '',
  colonia VARCHAR(255) NOT NULL DEFAULT '',
  agua_original VARCHAR(40) NOT NULL DEFAULT '', agua_normalizada CHAR(1) NULL,
  alcantarillado_original VARCHAR(40) NOT NULL DEFAULT '', alcantarillado_normalizado CHAR(1) NULL,
  barrido_original VARCHAR(40) NOT NULL DEFAULT '', barrido_normalizado CHAR(1) NULL,
  tren_aseo_original VARCHAR(40) NOT NULL DEFAULT '', tren_aseo_normalizado CHAR(1) NULL,
  bombeo_original VARCHAR(40) NOT NULL DEFAULT '', bombeo_normalizado CHAR(1) NULL,
  valor DECIMAL(16,2) NULL,
  intereses DECIMAL(16,2) NULL,
  saldo_total DECIMAL(16,2) NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'RECIBIDO',
  diferencias LONGTEXT NULL,
  dato_original LONGTEXT NOT NULL,
  mensaje_error TEXT NULL,
  padron_maestro_id VARCHAR(80) NULL,
  fecha_aplicacion DATETIME NULL,
  usuario_aplicacion INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_importacion_registro_fila (lote_id, numero_fila),
  KEY idx_importacion_registros_abonado (codigo_abonado),
  KEY idx_importacion_registros_clave (clave_catastral),
  KEY idx_importacion_registros_nombre (nombre),
  KEY idx_importacion_registros_colonia (colonia),
  KEY idx_importacion_registros_estado (estado),
  CONSTRAINT fk_importacion_registros_lote FOREIGN KEY (lote_id) REFERENCES importacion_padron_lotes(id) ON DELETE CASCADE,
  CONSTRAINT fk_importacion_registros_usuario FOREIGN KEY (usuario_aplicacion) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS importacion_padron_bloques (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lote_id BIGINT UNSIGNED NOT NULL,
  numero_bloque INT UNSIGNED NOT NULL,
  total_bloques INT UNSIGNED NOT NULL,
  hash_bloque CHAR(64) NOT NULL,
  cantidad_registros INT UNSIGNED NOT NULL,
  fecha_recepcion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_importacion_bloque (lote_id, numero_bloque),
  KEY idx_importacion_bloques_hash (hash_bloque),
  CONSTRAINT fk_importacion_bloques_lote FOREIGN KEY (lote_id) REFERENCES importacion_padron_lotes(id) ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS telegram_chat_access (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  chat_id VARCHAR(32) NOT NULL UNIQUE,
  display_name VARCHAR(180) NOT NULL DEFAULT 'Chat de Telegram',
  username VARCHAR(120) NOT NULL DEFAULT '',
  chat_type VARCHAR(30) NOT NULL DEFAULT 'private',
  status ENUM('pending', 'allowed', 'revoked') NOT NULL DEFAULT 'pending',
  allowed_by INT UNSIGNED NULL,
  allowed_at TIMESTAMP NULL DEFAULT NULL,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_telegram_chat_access_allowed_by
    FOREIGN KEY (allowed_by) REFERENCES app_users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS profile_general_messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sender_user_id INT UNSIGNED NULL,
  reply_to_message_id INT UNSIGNED NULL,
  channel VARCHAR(40) NOT NULL DEFAULT 'general',
  body TEXT NOT NULL,
  attachment_url VARCHAR(500) NOT NULL DEFAULT '',
  attachment_type VARCHAR(40) NOT NULL DEFAULT '',
  pinned_at TIMESTAMP NULL DEFAULT NULL,
  pinned_by INT UNSIGNED NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_profile_general_messages_sender
    FOREIGN KEY (sender_user_id) REFERENCES app_users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_profile_general_messages_reply
    FOREIGN KEY (reply_to_message_id) REFERENCES profile_general_messages(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_profile_general_messages_pinned_by
    FOREIGN KEY (pinned_by) REFERENCES app_users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS profile_general_message_reads (
  message_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id, user_id),
  CONSTRAINT fk_profile_general_message_reads_message
    FOREIGN KEY (message_id) REFERENCES profile_general_messages(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_profile_general_message_reads_user
    FOREIGN KEY (user_id) REFERENCES app_users(id)
    ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS planos_barrios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo_barrio VARCHAR(20) NOT NULL UNIQUE,
  nombre_barrio VARCHAR(180) NOT NULL,
  archivo_pdf VARCHAR(500) NOT NULL DEFAULT '',
  estado ENUM('pendiente', 'asignado', 'en_edicion', 'borrador', 'enviado_revision', 'devuelto', 'aprobado', 'publicado') NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_planos_barrios_estado (estado),
  KEY idx_planos_barrios_nombre (nombre_barrio)
);

CREATE TABLE IF NOT EXISTS planos_asignaciones (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  barrio_id INT UNSIGNED NOT NULL,
  tecnico_id INT UNSIGNED NOT NULL,
  asignado_por INT UNSIGNED NULL,
  estado ENUM('pendiente', 'asignado', 'en_edicion', 'borrador', 'enviado_revision', 'devuelto', 'aprobado', 'publicado') NOT NULL DEFAULT 'asignado',
  fecha_asignacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_limite DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_planos_asignaciones_barrio
    FOREIGN KEY (barrio_id) REFERENCES planos_barrios(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_planos_asignaciones_tecnico
    FOREIGN KEY (tecnico_id) REFERENCES app_users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_planos_asignaciones_asignador
    FOREIGN KEY (asignado_por) REFERENCES app_users(id)
    ON DELETE SET NULL,
  KEY idx_planos_asignaciones_barrio (barrio_id),
  KEY idx_planos_asignaciones_tecnico (tecnico_id),
  KEY idx_planos_asignaciones_estado (estado)
);

CREATE TABLE IF NOT EXISTS planos_versiones (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  barrio_id INT UNSIGNED NOT NULL,
  numero_version INT UNSIGNED NOT NULL DEFAULT 1,
  estado ENUM('borrador', 'enviado_revision', 'devuelto', 'aprobado', 'publicado') NOT NULL DEFAULT 'borrador',
  creado_por INT UNSIGNED NULL,
  aprobado_por INT UNSIGNED NULL,
  observacion_revision TEXT NULL,
  fecha_envio_revision TIMESTAMP NULL DEFAULT NULL,
  fecha_aprobacion TIMESTAMP NULL DEFAULT NULL,
  archivo_pdf_final VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_planos_versiones_barrio
    FOREIGN KEY (barrio_id) REFERENCES planos_barrios(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_planos_versiones_creador
    FOREIGN KEY (creado_por) REFERENCES app_users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_planos_versiones_aprobador
    FOREIGN KEY (aprobado_por) REFERENCES app_users(id)
    ON DELETE SET NULL,
  UNIQUE KEY uq_planos_versiones_barrio_numero (barrio_id, numero_version),
  KEY idx_planos_versiones_estado (estado),
  KEY idx_planos_versiones_barrio (barrio_id)
);

CREATE TABLE IF NOT EXISTS planos_elementos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  barrio_id INT UNSIGNED NOT NULL,
  version_id INT UNSIGNED NOT NULL,
  tecnico_id INT UNSIGNED NULL,
  tipo_elemento ENUM('linea', 'poligono', 'texto', 'codigo', 'punto', 'tapado', 'foto', 'observacion') NOT NULL,
  data_json LONGTEXT NOT NULL,
  estado ENUM('pendiente', 'asignado', 'en_edicion', 'borrador', 'enviado_revision', 'devuelto', 'aprobado', 'publicado') NOT NULL DEFAULT 'borrador',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_planos_elementos_barrio
    FOREIGN KEY (barrio_id) REFERENCES planos_barrios(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_planos_elementos_version
    FOREIGN KEY (version_id) REFERENCES planos_versiones(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_planos_elementos_tecnico
    FOREIGN KEY (tecnico_id) REFERENCES app_users(id)
    ON DELETE SET NULL,
  KEY idx_planos_elementos_barrio (barrio_id),
  KEY idx_planos_elementos_version (version_id),
  KEY idx_planos_elementos_tipo (tipo_elemento)
);

CREATE TABLE IF NOT EXISTS planos_observaciones_revision (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  version_id INT UNSIGNED NOT NULL,
  supervisor_id INT UNSIGNED NULL,
  observacion TEXT NOT NULL,
  estado ENUM('pendiente_revision', 'aprobado', 'devuelto', 'publicado') NOT NULL DEFAULT 'pendiente_revision',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_planos_observaciones_version
    FOREIGN KEY (version_id) REFERENCES planos_versiones(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_planos_observaciones_supervisor
    FOREIGN KEY (supervisor_id) REFERENCES app_users(id)
    ON DELETE SET NULL,
  KEY idx_planos_observaciones_version (version_id)
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
