const REPLACEMENTS = [
  // Abreviaturas de mensajería frecuentes en campo. "q" solo en minúscula para no tocar
  // referencias como "Bloque Q".
  [/\bq\b/g, "que"],
  [/\b(?:xq|pq|porq)\b/gi, "porque"],
  [/\btmb\b/gi, "también"],
  [/\bdisen\b/gi, "dicen"],
  [/\balcantarrillado\b/gi, "alcantarillado"],
  [/\bderivacion(es)?\b/gi, (value) => value.toLowerCase().endsWith("es") ? "derivaciones" : "derivación"],
  [/\bconeccion\b/gi, "conexión"],
  [/\bse\s+en\s+contro\b/gi, "se encontró"],
  [/\bse encontro\b/gi, "se encontró"],
  [/\ben abando(?:no)?\b/gi, "en abandono"],
  [/\bverificar como\b/gi, "verificar cómo"],
  [/\bal dia\b/gi, "al día"],
  [/\bconexion\b/gi, "conexión"],
  [/\binspeccion\b/gi, "inspección"],
  [/\binformacion\b/gi, "información"],
  [/\bobservaciones\b/gi, "observaciones"],
  [/\bcodigos\b/gi, "códigos"],
  [/\btecnico(?:s)?\b/gi, (value) => value.toLowerCase().endsWith("s") ? "técnicos" : "técnico"],
  [/\bubicacion\b/gi, "ubicación"],
  [/\bdescripcion\b/gi, "descripción"],
  [/\btelefono\b/gi, "teléfono"],
  [/\bnumero(?:s)?\b/gi, (value) => value.toLowerCase().endsWith("s") ? "números" : "número"],
  [/\bmas\b/gi, "más"]
];

// Conserva la capitalización de lo que escribió el técnico: "CONEXION" -> "CONEXIÓN",
// "Conexion" -> "Conexión", "conexion" -> "conexión". Antes se forzaba la minúscula y un texto
// en mayúsculas salía como "VERIFICAR conexión DE ALCANTARILLADO".
const matchCase = (original, replacement) => {
  if (original.length > 1 && original === original.toUpperCase()) return replacement.toUpperCase();
  // En frases ("En abando") manda la regla de mayúscula al inicio de oración, no el original.
  const isWord = !/\s/.test(original);
  if (isWord && original[0] !== original[0].toLowerCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
};

const capitalizeSentences = (value) => value.replace(/(^|[.!?]\s+)([a-záéíóúñ])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);

export const polishInspectionText = (value) => {
  let text = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join("\n");
  REPLACEMENTS.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, (...args) => matchCase(args[0], typeof replacement === "function" ? replacement(...args) : replacement));
  });
  text = capitalizeSentences(text).replace(/\s+([,.;:!?])/g, "$1");
  if (text && !/[.!?)]$/.test(text)) text += ".";
  return text;
};
