// Deteccion simple de datos en un apunte. Es solo de presentacion: el texto se guarda plano y
// React escapa cada segmento; aqui no se genera HTML.

// Telefono hondureño con formato reconocible: guion (9988-4455) o prefijo +504. Ocho digitos
// seguidos sin guion ni prefijo no se transforman: pueden ser un medidor o una clave.
const PHONE = /(?<![\w+-])(?:\+504[\s-]?)?[2-9]\d{3}-\d{4}(?![\w-])|(?<![\w+-])\+504[\s-]?[2-9]\d{7}(?![\w-])/g;
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?\]}]$/;

const toHttpUrl = (raw) => {
  try {
    const url = new URL(raw.toLowerCase().startsWith("www.") ? `https://${raw}` : raw);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};

// Quita puntuacion final que pertenece a la frase, no a la URL. Un ")" final solo se conserva
// si la URL abrio mas parentesis de los que cerro antes (p. ej. enlaces de Wikipedia).
const trimUrl = (value) => {
  let url = value;
  for (;;) {
    if (TRAILING_PUNCTUATION.test(url)) {
      url = url.slice(0, -1);
    } else if (url.endsWith(")") && (url.match(/\(/g) || []).length < (url.match(/\)/g) || []).length) {
      url = url.slice(0, -1);
    } else {
      return url;
    }
  }
};

/** Parte un texto en segmentos { type: "text" | "url" | "phone", value, href? }. */
export const tokenizeNoteContent = (text = "") => {
  const source = String(text ?? "");
  const matches = [];
  for (const match of source.matchAll(URL_PATTERN)) {
    const value = trimUrl(match[0]);
    const href = toHttpUrl(value);
    if (href) matches.push({ index: match.index, value, type: "url", href });
  }
  for (const match of source.matchAll(PHONE)) {
    const digits = match[0].replace(/\D/g, "").replace(/^504(?=\d{8}$)/, "");
    matches.push({ index: match.index, value: match[0], type: "phone", href: `tel:+504${digits}`, digits });
  }
  matches.sort((a, b) => a.index - b.index);

  const segments = [];
  let cursor = 0;
  for (const { index, ...match } of matches) {
    if (index < cursor) continue;
    if (index > cursor) segments.push({ type: "text", value: source.slice(cursor, index) });
    segments.push(match);
    cursor = index + match.value.length;
  }
  if (cursor < source.length) segments.push({ type: "text", value: source.slice(cursor) });
  return segments;
};

/** Solo los datos detectados (telefonos y URLs), en orden de aparicion. */
export const detectedItems = (text = "") => tokenizeNoteContent(text).filter((segment) => segment.type !== "text");

/** Formatea 99884455 como 9988-4455. */
export const formatPhone = (digits) => `${String(digits).slice(0, 4)}-${String(digits).slice(4)}`;
