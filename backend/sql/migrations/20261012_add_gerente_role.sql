-- Fase 2: agrega Gerente General sin cambiar roles de cuentas existentes.
-- Ejecutar primero en una copia aislada de MySQL; no aplica cambios a producción.
-- Se agrega al final para conservar los índices internos del ENUM existente.
-- El inicializador en config/db.js debe desplegarse con la misma definición.
ALTER TABLE app_users
  MODIFY COLUMN role ENUM('admin', 'operator', 'transport', 'validadora_campo', 'gerente')
  NOT NULL DEFAULT 'operator';
