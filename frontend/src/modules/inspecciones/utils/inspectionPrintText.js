const REPLACEMENTS = [
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

const capitalizeSentences = (value) => value.replace(/(^|[.!?]\s+)([a-záéíóúñ])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);

export const polishInspectionText = (value) => {
  let text = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join("\n");
  REPLACEMENTS.forEach(([pattern, replacement]) => { text = text.replace(pattern, replacement); });
  text = capitalizeSentences(text).replace(/\s+([,.;:!?])/g, "$1");
  if (text && !/[.!?)]$/.test(text)) text += ".";
  return text;
};
