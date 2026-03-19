export const normalizeKey = (value = "") =>
  value
    .toString()
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();

export const likeValue = (value = "") => `%${value.trim()}%`;
