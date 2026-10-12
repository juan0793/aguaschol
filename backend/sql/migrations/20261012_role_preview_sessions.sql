-- Ejecutar una sola vez en entorno aislado antes de desplegar.
ALTER TABLE auth_sessions
  ADD COLUMN preview_role VARCHAR(32) NULL,
  ADD COLUMN preview_expires_at TIMESTAMP NULL;
-- Las sesiones antiguas con token sin hash dejan de ser válidas: iniciar sesión de nuevo.
