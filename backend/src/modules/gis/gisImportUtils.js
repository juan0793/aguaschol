export const parseBarrioLabel = (text = "") => {
  const parts = String(text).split(/\r?\n/).map((part) => part.trim()).filter(Boolean);
  const clave = parts.at(-1)?.match(/^\d{1,10}$/) ? parts.at(-1) : null;
  const body = clave ? parts.slice(0, -1) : parts;
  return {
    tipo: body[0] || null,
    nombre: body.slice(1).join(" ") || null,
    clave,
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
