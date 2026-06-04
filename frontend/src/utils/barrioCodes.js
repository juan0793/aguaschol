export const normalizeBarrioCode = (value = "") => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length <= 2 ? digits.padStart(2, "0") : digits;
};

export const extractClaveFromText = (value = "") =>
  String(value ?? "").match(/\b\d{2,3}-\d{2}-\d{2}(?:-\d{2})?\b/)?.[0] || "";

export const getBarrioCodeFromClave = (clave = "") =>
  normalizeBarrioCode(String(clave ?? "").split("-").filter(Boolean)[0] || "");

export const getBarrioNameFromClave = (clave = "", barrios = []) => {
  const code = getBarrioCodeFromClave(clave);
  if (!code) return "";
  const match = barrios.find((item) => item.activo !== false && item.codigo === code);
  return match?.barrio || "";
};

export const getBarrioNameFromText = (value = "", barrios = []) =>
  getBarrioNameFromClave(extractClaveFromText(value), barrios);

export const resolveBarrioFromPayload = (payload = {}, barrios = [], fallback = "") => {
  const existing = String(payload.barrio_colonia || "").trim();
  if (existing) return existing;

  return (
    getBarrioNameFromClave(payload.clave_catastral, barrios) ||
    getBarrioNameFromClave(payload.clave_alcaldia, barrios) ||
    getBarrioNameFromClave(payload.clave_aguas_formato, barrios) ||
    getBarrioNameFromText([payload.reference, payload.reference_note, payload.description, payload.comentarios].filter(Boolean).join(" "), barrios) ||
    fallback
  );
};

export const withBarrioFromPrefix = (payload = {}, barrios = []) => {
  const barrio = resolveBarrioFromPayload(payload, barrios, "");
  return barrio ? { ...payload, barrio_colonia: barrio } : payload;
};

export const withReferenceBarrioPrefix = (draft = {}, barrios = []) => {
  const source = [draft.reference, draft.description].filter(Boolean).join(" ");
  const barrio = getBarrioNameFromText(source, barrios);
  if (!barrio) return draft;

  const reference = String(draft.reference || "").trim();
  if (!reference) {
    return { ...draft, reference: barrio };
  }

  if (reference.toLowerCase().includes(barrio.toLowerCase())) {
    return draft;
  }

  return { ...draft, reference: `${barrio} - ${reference}` };
};
