export const normalizeKey = (value = "") =>
  value
    .toString()
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();

export const likeValue = (value = "") => `%${value.trim()}%`;

export const normalizeDateField = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const normalized = String(value).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;

  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== normalized) return null;

  return normalized;
};
