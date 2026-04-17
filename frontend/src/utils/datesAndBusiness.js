const HONDURAS_TIME_ZONE = "America/Tegucigalpa";

export const normalizeDateField = (value) => {
  if (!value) return "";
  const normalized = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
};

export const normalizeRecord = (record) => ({
  ...record,
  fecha_aviso: normalizeDateField(record?.fecha_aviso),
  archived_at: record?.archived_at ?? null,
  archived_reason: record?.archived_reason ?? ""
});

export const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("es-HN", {
    timeZone: HONDURAS_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

export const getMapDiaryDateKey = (value) => {
  if (!value) return "";
  if (typeof value === "object" && value !== null) {
    if (typeof value.diary_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.diary_date)) {
      return value.diary_date;
    }
    if (value.diary_date instanceof Date) {
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: HONDURAS_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
      return formatter.format(value.diary_date);
    }
    if (value.created_at) {
      return getMapDiaryDateKey(value.created_at);
    }
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: HONDURAS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(date);
};

export const formatMapDiaryLabel = (dateKey) => {
  if (!dateKey) return "Sin fecha";
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat("es-HN", {
    timeZone: HONDURAS_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
};

export const normalizeAlertDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(12, 0, 0, 0);
  return date;
};

export const isBusinessDay = (date) => {
  const day = date.getDay();
  return day !== 0 && day !== 6;
};

export const addBusinessDays = (value, days) => {
  const base = normalizeAlertDate(value);
  if (!base) return null;
  const next = new Date(base);
  let added = 0;

  while (added < days) {
    next.setDate(next.getDate() + 1);
    if (isBusinessDay(next)) {
      added += 1;
    }
  }

  return next;
};

export const countBusinessDaysBetween = (startValue, endValue) => {
  const start = normalizeAlertDate(startValue);
  const end = normalizeAlertDate(endValue);
  if (!start || !end) return 0;
  if (start.getTime() === end.getTime()) return 0;

  const direction = start < end ? 1 : -1;
  const cursor = new Date(start);
  let count = 0;

  while ((direction === 1 && cursor < end) || (direction === -1 && cursor > end)) {
    cursor.setDate(cursor.getDate() + direction);
    if (isBusinessDay(cursor)) {
      count += direction;
    }
  }

  return count;
};

export const formatSpanishDate = (value) => {
  if (!value) return "--";
  const normalized = normalizeDateField(value);
  if (!normalized) return "--";
  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("es-HN", {
    timeZone: HONDURAS_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
};

export const formatMonthGroup = (value) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-HN", {
    timeZone: HONDURAS_TIME_ZONE,
    month: "long",
    year: "numeric"
  }).format(date);
};
