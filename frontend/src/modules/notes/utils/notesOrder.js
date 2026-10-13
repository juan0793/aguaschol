export const NOTE_COLORS = [
  { key: "default", label: "Sin color" },
  { key: "azul", label: "Azul" },
  { key: "crema", label: "Crema" },
  { key: "verde", label: "Verde" },
  { key: "violeta", label: "Violeta" },
  { key: "gris", label: "Gris" }
];

export const NOTE_SORTS = [
  { key: "manual", label: "Orden manual" },
  { key: "updated", label: "Últimos editados" },
  { key: "created", label: "Más recientes" }
];

export const compareNotes = (sort) => (a, b) => {
  if (sort === "updated") return new Date(b.updated_at) - new Date(a.updated_at) || b.id - a.id;
  if (sort === "created") return new Date(b.created_at) - new Date(a.created_at) || b.id - a.id;
  return a.sort_order - b.sort_order || a.id - b.id;
};

export const matchesView = (note, view) => {
  if (view === "archived") return note.is_archived;
  if (note.is_archived) return false;
  return view === "pinned" ? note.is_pinned : true;
};

const fold = (value) => String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Filtro local inmediato; el resultado del servidor lo reemplaza cuando llega. */
export const matchesQuery = (note, query) => {
  const needle = fold(query).trim();
  if (!needle) return true;
  return [note.title, note.content, note.category].some((field) => fold(field).includes(needle));
};

/**
 * Vecinos para soltar una nota en `targetIndex` de `list` (la seccion ya sin la nota
 * arrastrada). Devuelve los ids para la API y un sort_order optimista.
 */
export const neighborsForDrop = (list, targetIndex, dragged) => {
  const index = Math.max(0, Math.min(targetIndex, list.length));
  const before = list[index - 1] || null;
  const after = list[index] || null;
  let sortOrder = dragged.sort_order;
  if (before && after) sortOrder = (before.sort_order + after.sort_order) / 2;
  else if (before) sortOrder = before.sort_order + 1000;
  else if (after) sortOrder = after.sort_order - 1000;
  return { before_id: before?.id ?? null, after_id: after?.id ?? null, sort_order: sortOrder };
};

const LONG_DATE = new Intl.DateTimeFormat("es-HN", { timeZone: "America/Tegucigalpa", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DAY_PARTS = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa", year: "numeric", month: "2-digit", day: "2-digit" });

/** "16 sep" en el año en curso, "16 sep 2025" en otro año. */
export const formatNoteShortDate = (value, now = new Date()) => {
  if (!value) return "";
  const [year, month, day] = DAY_PARTS.format(new Date(value)).split("-").map(Number);
  const currentYear = Number(DAY_PARTS.format(now).slice(0, 4));
  return `${day} ${MONTHS[month - 1]}${year === currentYear ? "" : ` ${year}`}`;
};

export const formatNoteLongDate = (value) => (value ? LONG_DATE.format(new Date(value)) : "");

export const noteLinkLabel = (link) => {
  const destino = { inspeccion: "Inspección", ficha: "Ficha", recordatorio: "Recordatorio" }[link.target_type] || link.target_type;
  return `${destino} ${link.target_label || `#${link.target_id}`}`;
};

// --- Tablero dinamico ------------------------------------------------------------------------

const dayNumber = (value) => {
  const [year, month, day] = DAY_PARTS.format(new Date(value)).split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
};

/** "Ahora", "Hace 5 min", "Hace 3 h", "Ayer" y despues la fecha corta. */
export const formatNoteRelative = (value, now = new Date()) => {
  if (!value) return "";
  const minutes = Math.floor((now - new Date(value)) / 60000);
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  const days = dayNumber(now) - dayNumber(value);
  if (days === 0) return `Hace ${Math.floor(minutes / 60)} h`;
  if (days === 1) return "Ayer";
  return formatNoteShortDate(value, now);
};

const TIME_GROUPS = [
  { key: "today", title: "Hoy", test: (days) => days <= 0 },
  { key: "yesterday", title: "Ayer", test: (days) => days === 1 },
  { key: "week", title: "Esta semana", test: (days) => days < 7 },
  { key: "month", title: "Este mes", test: (days, sameMonth) => sameMonth },
  { key: "older", title: "Anteriores", test: () => true }
];

/** Con orden por fecha, agrupa los apuntes por cercania: Hoy, Ayer, Esta semana, Este mes, Anteriores. */
export const groupNotesByTime = (notes, sort, now = new Date()) => {
  const field = sort === "created" ? "created_at" : "updated_at";
  const today = dayNumber(now);
  const currentMonth = DAY_PARTS.format(now).slice(0, 7);
  const groups = new Map();
  for (const note of notes) {
    const days = today - dayNumber(note[field]);
    const sameMonth = DAY_PARTS.format(new Date(note[field])).slice(0, 7) === currentMonth;
    const group = TIME_GROUPS.find((item) => item.test(days, sameMonth));
    if (!groups.has(group.key)) groups.set(group.key, { key: group.key, title: group.title, notes: [] });
    groups.get(group.key).notes.push(note);
  }
  return TIME_GROUPS.filter((group) => groups.has(group.key)).map((group) => groups.get(group.key));
};

/**
 * Parte un texto en tramos que coinciden con la busqueda, sin distinguir tildes ni mayusculas.
 * Las posiciones se calculan sobre el texto original, asi el resaltado no corre letras.
 */
export const highlightParts = (text, query) => {
  const value = String(text ?? "");
  const needle = fold(query).trim();
  if (!needle || !value) return [{ text: value, match: false }];
  let folded = "";
  const origin = [];
  for (let index = 0; index < value.length; index += 1) {
    const piece = fold(value[index]);
    for (let step = 0; step < piece.length; step += 1) origin.push(index);
    folded += piece;
  }
  const parts = [];
  let cursor = 0;
  let from = folded.indexOf(needle);
  while (from !== -1) {
    const start = origin[from];
    const end = origin[from + needle.length - 1] + 1;
    if (start > cursor) parts.push({ text: value.slice(cursor, start), match: false });
    parts.push({ text: value.slice(start, end), match: true });
    cursor = end;
    from = folded.indexOf(needle, from + needle.length);
  }
  if (cursor < value.length) parts.push({ text: value.slice(cursor), match: false });
  return parts;
};

export const matchesFilters = (note, { color = "", category = "" } = {}) =>
  (!color || (note.color || "default") === color) && (!category || fold(note.category) === fold(category));
