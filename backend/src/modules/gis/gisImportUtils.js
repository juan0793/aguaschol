export const parseBarrioLabel = (text = "") => {
  const parts = String(text).split(/\r?\n/).map((part) => part.trim()).filter(Boolean);
  const compact = parts.length === 1
    ? parts[0].match(/^(BARRIO|COLONIA|RESIDENCIAL|LOTIFICACION|LOTIFICADORA)\s+(.+?)\s+(\d{2,3})(?:\s+(.+))?$/i)
    : null;
  if (compact) {
    return {
      tipo: compact[1].toUpperCase(),
      nombre: compact[2].trim(),
      clave: compact[3],
      claveSufijo: compact[4]?.trim() || null,
      sourceText: text
    };
  }

  const clave = parts.at(-1)?.match(/^\d{2,3}$/) ? parts.at(-1) : null;
  const body = clave ? parts.slice(0, -1) : parts;
  return {
    tipo: body[0] || null,
    nombre: body.slice(1).join(" ") || null,
    clave,
    claveSufijo: null,
    sourceText: text
  };
};

export const stripGpkgHeader = (value) => {
  const buffer = Buffer.from(value);
  if (buffer[0] !== 0x47 || buffer[1] !== 0x50) return buffer;
  const envelopeIndicator = (buffer[3] >> 1) & 7;
  const envelopeBytes = [0, 32, 48, 48, 64][envelopeIndicator] ?? 0;
  return buffer.subarray(8 + envelopeBytes);
};

export const quoteSqliteIdentifier = (value = "") =>
  `"${String(value).replaceAll('"', '""')}"`;

export const normalizeClaveText = (value = "") =>
  String(value ?? "")
    .trim()
    .replace(/[^\d-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export const buildClaveBase = (clave = "") => {
  const parts = String(clave ?? "").split("-").filter(Boolean);
  return parts.length >= 3 ? parts.slice(0, 3).join("-") : "";
};

export const cleanLoteNumber = (value = "") => {
  const text = String(value ?? "").trim();
  return /^[A-Za-z0-9-]{1,30}$/.test(text) ? text : "";
};

export const chooseCanonicalFeatureLayer = (layers = []) =>
  [...layers]
    .filter((layer) => layer.data_type === "features")
    .sort((left, right) =>
      Number(right.count || 0) - Number(left.count || 0) ||
      Number(right.column_count || 0) - Number(left.column_count || 0) ||
      String(left.table_name).localeCompare(String(right.table_name), "es")
    )[0] ?? null;
