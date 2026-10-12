// Formato y paginación de los informes de Gerencia. Sin dependencias de React para
// poder probarlo con node --test.
export const formatCount = (value) => Number(value || 0).toLocaleString("es-HN");

// Lempiras compactos, igual que el tablero: "L 235.4 M", "L 12.3 mil", "L 950.00".
export function formatLempiras(value) {
  const amount = Number(value || 0);
  const abs = Math.abs(amount);
  if (abs >= 1e6) return `L ${(amount / 1e6).toFixed(1)} M`;
  if (abs >= 1e3) return `L ${(amount / 1e3).toFixed(1)} mil`;
  return `L ${amount.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const formatShare = (part, whole) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");

export function monthLabel(month) {
  const date = new Date(`${month}-01T12:00:00`);
  return Number.isNaN(date.getTime()) ? month : date.toLocaleDateString("es-HN", { month: "long", year: "numeric" });
}

export function shortMonth(periodo) {
  const date = new Date(`${String(periodo).slice(0, 7)}-01T12:00:00`);
  return Number.isNaN(date.getTime()) ? String(periodo) : date.toLocaleDateString("es-HN", { month: "short" }).replace(".", "");
}

export function dayLabel(fecha) {
  const date = new Date(`${fecha}T12:00:00`);
  return Number.isNaN(date.getTime()) ? String(fecha) : date.toLocaleDateString("es-HN", { weekday: "short", day: "numeric" }).replace(".", "");
}

// Filas de la tabla de detalle que contienen el texto buscado en cualquier columna.
export function filterRows(rows, query) {
  const term = String(query || "").trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((row) => row.some((cell) => String(cell ?? "").toLowerCase().includes(term)));
}

export function paginate(rows, page, size) {
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * size;
  return { page: current, totalPages, items: rows.slice(start, start + size), from: rows.length ? start + 1 : 0, to: Math.min(start + size, rows.length), total: rows.length };
}

// Números de página con huecos: 1 … 4 5 6 … 12.
export function pageNumbers(page, totalPages) {
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((value) => value >= 1 && value <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((value, index) => (index && value - sorted[index - 1] > 1 ? ["…", value] : [value]));
}
