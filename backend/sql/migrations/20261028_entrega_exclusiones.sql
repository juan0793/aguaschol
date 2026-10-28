-- El inicializador la crea sola desde schema.sql.
-- Exclusiones de entrega (2026-10-28): claves catastrales y numeros de abonado cuya
-- factura la entrega otro departamento. El cierre avisa al tecnico si anota uno como
-- sobrante. llave es lo que se compara: cifras de la clave o abonado sin ceros iniciales.
CREATE TABLE IF NOT EXISTS entrega_exclusiones (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tipo ENUM('CLAVE', 'ABONADO') NOT NULL,
  valor VARCHAR(40) NOT NULL,
  llave VARCHAR(40) NOT NULL,
  nota VARCHAR(120) NULL,
  created_by INT UNSIGNED NULL,
  created_by_nombre VARCHAR(160) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_entrega_exclusiones_tipo_llave (tipo, llave)
);
