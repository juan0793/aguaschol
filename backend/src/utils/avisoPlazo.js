// Plazo que el aviso le da al abonado. Se guarda como tipo + valor y la fecha
// límite se calcula siempre aquí, para que el aviso impreso, la columna "Plazo"
// de la bandeja y las alertas digan lo mismo.
//   horas: 24 o 48 horas; vence ceil(h/24) días hábiles después del aviso
//   dias:  N días hábiles (lunes a viernes)
//   fecha: una fecha exacta
// Sin tipo (avisos de antes): la fecha límite manda; si no hay, 7 días calendario.
// El archivo tiene una copia en frontend/src/modules/clandestinos/avisoPlazo.js.

export const PLAZO_TIPOS = ["horas", "dias", "fecha"];
export const PLAZO_LIMITES = { horas: [1, 72], dias: [1, 90] };

const UNIDADES = ["cero", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiún", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];

// "dos", "veinticuatro", "cuarenta y ocho": como se escribe en un documento formal.
export const numeroEnLetras = (value) => {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n < 0 || n > 99) return String(value);
  if (n < 30) return UNIDADES[n];
  const unidad = n % 10;
  return unidad ? `${DECENAS[Math.trunc(n / 10)]} y ${UNIDADES[unidad]}` : DECENAS[n / 10];
};

const pad = (value) => String(value).padStart(2, "0");
// Fechas como "AAAA-MM-DD" sin pasar por UTC, para no correrse un día.
export const parseIsoDate = (value) => {
  const match = String(value ?? "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getMonth() === Number(match[2]) - 1 ? date : null;
};
export const toIsoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const addBusinessDays = (date, days) => {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  let left = Math.max(0, Math.trunc(days));
  while (left > 0) {
    next.setDate(next.getDate() + 1);
    const day = next.getDay();
    if (day !== 0 && day !== 6) left -= 1;
  }
  return next;
};

export const normalizePlazo = ({ tipo, valor, fecha } = {}) => {
  const cleanTipo = String(tipo ?? "").trim();
  if (!PLAZO_TIPOS.includes(cleanTipo)) return null;
  if (cleanTipo === "fecha") return { tipo: "fecha", valor: null, fecha: String(fecha ?? "").slice(0, 10) };
  const [min, max] = PLAZO_LIMITES[cleanTipo];
  const number = Math.trunc(Number(valor));
  if (!Number.isFinite(number) || number < min || number > max) return { tipo: cleanTipo, valor: NaN, fecha: null };
  return { tipo: cleanTipo, valor: number, fecha: null };
};

// Fecha límite (AAAA-MM-DD) a partir de la fecha del aviso, o null si no se puede calcular.
export const computeFechaLimite = (fechaAviso, plazo) => {
  const base = parseIsoDate(fechaAviso);
  const normal = normalizePlazo(plazo);
  if (!base || !normal) return null;
  if (normal.tipo === "fecha") return parseIsoDate(normal.fecha) ? normal.fecha : null;
  if (!Number.isFinite(normal.valor)) return null;
  const dias = normal.tipo === "horas" ? Math.ceil(normal.valor / 24) : normal.valor;
  return toIsoDate(addBusinessDays(base, dias));
};

// Frase del aviso: "...presentarse al Departamento de Comercialización <frase>, debiendo...".
export const describeAvisoPlazo = (record = {}, formatDate = (value) => value) => {
  const tipo = String(record.aviso_plazo_tipo ?? "").trim();
  const valor = Math.trunc(Number(record.aviso_plazo_valor));
  if (tipo === "horas" && valor > 0) return `en un plazo máximo de ${valor} horas a partir de la recepción del presente aviso`;
  if (tipo === "dias" && valor > 0) {
    const unidad = valor === 1 ? "día hábil" : "días hábiles";
    return `en un plazo máximo de ${numeroEnLetras(valor)} (${valor}) ${unidad} a partir de la recepción del presente aviso`;
  }
  if (tipo === "fecha" && record.fecha_limite_aviso) return `a más tardar el ${formatDate(String(record.fecha_limite_aviso).slice(0, 10))}`;
  // Avisos de antes de guardar el plazo.
  if (record.fecha_limite_aviso) return `a más tardar el ${formatDate(String(record.fecha_limite_aviso).slice(0, 10))}`;
  const dias = Math.max(1, Math.min(90, Number(record.aviso_plazo_dias) || 7));
  return `en un plazo máximo de ${dias} (${dias}) días calendario a partir de la recepción del presente aviso`;
};

// Texto corto para listas y diálogos: "24 horas", "2 días hábiles", "hasta el 9 de octubre".
export const etiquetaPlazo = (record = {}, formatDate = (value) => value) => {
  const tipo = String(record.aviso_plazo_tipo ?? "").trim();
  const valor = Math.trunc(Number(record.aviso_plazo_valor));
  if (tipo === "horas" && valor > 0) return `${valor} horas`;
  if (tipo === "dias" && valor > 0) return `${valor} ${valor === 1 ? "día hábil" : "días hábiles"}`;
  if (record.fecha_limite_aviso) return `hasta el ${formatDate(String(record.fecha_limite_aviso).slice(0, 10))}`;
  return "";
};
