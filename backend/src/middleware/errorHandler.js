// Nombres legibles de las columnas que más se llenan a mano, para el aviso de texto largo.
const CAMPOS = {
  actividad: "Actividad / descripción",
  telefono: "Teléfono",
  identidad: "Identidad",
  codigo_sector: "Código sector",
  nombre_catastral: "Nombre catastral",
  inquilino: "Inquilino",
  barrio_colonia: "Barrio / colonia",
  abonado: "Abonado",
  motivo_descarte: "Motivo del descarte",
  levantamiento_datos: "Técnico",
  firmante_aviso: "Firmante",
  cargo_firmante: "Cargo"
};

// MySQL rechaza un texto que no cabe con un mensaje en inglés ("Data too long for
// column 'x'"); se responde 400 diciendo qué campo acortar.
const textoLargo = (error) => {
  if (error?.code !== "ER_DATA_TOO_LONG") return null;
  const columna = String(error.sqlMessage || error.message || "").match(/column '([^']+)'/)?.[1] || "";
  const campo = CAMPOS[columna] || columna;
  return `El texto de «${campo || "un campo"}» es demasiado largo para guardarlo. Acórtalo e intenta de nuevo.`;
};

export const errorHandler = (error, _req, res, _next) => {
  const largo = textoLargo(error);
  const status = error.status ?? (largo ? 400 : error.code === "LIMIT_FILE_SIZE" ? 413 : error.name === "MulterError" ? 400 : 500);
  res.status(status).json({
    message: largo || (error.message ?? "Error interno del servidor.")
  });
};
