ALTER TABLE planos_elementos
MODIFY COLUMN tipo_elemento ENUM(
  'linea',
  'poligono',
  'texto',
  'codigo',
  'punto',
  'tapado',
  'foto',
  'observacion'
) NOT NULL;
