export const formatClaveInput = (value = "", prefixMode = "auto") => {
  const raw = String(value ?? "");
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  const explicitPrefixLength = raw.includes("-")
    ? raw
        .replace(/[^\d-]/g, "")
        .split("-")
        .filter(Boolean)[0]?.length ?? 0
    : 0;
  const useThreeDigitPrefix =
    prefixMode === "three" ||
    (prefixMode !== "two" && (explicitPrefixLength === 3 || (!explicitPrefixLength && [7, 9].includes(digits.length))));
  const chunkSizes = useThreeDigitPrefix ? [3, 2, 2, 2] : [2, 2, 2, 2];
  const groups = [];
  let cursor = 0;

  for (const size of chunkSizes) {
    if (cursor >= digits.length) break;
    groups.push(digits.slice(cursor, cursor + size));
    cursor += size;
  }

  return groups.join("-");
};

export const isLookupKeyComplete = (value = "") => {
  const parts = value.split("-").filter(Boolean);
  if (![3, 4].includes(parts.length)) return false;
  const [firstPart, ...rest] = parts;
  return /^\d{2,3}$/.test(firstPart) && rest.every((part) => /^\d{2}$/.test(part));
};

export const sanitizeLookupInput = (value = "", mode = "clave", prefixMode = "auto") => {
  if (mode === "clave") {
    return formatClaveInput(value, prefixMode);
  }

  if (mode === "abonado") {
    return String(value ?? "").replace(/\D/g, "").slice(0, 18);
  }

  return String(value ?? "").replace(/\s+/g, " ").replace(/^\s+/, "");
};

export const extractPadronLookupReferences = (value = "") => {
  const source = String(value ?? "");
  const references = [];
  const seen = new Set();
  const addReference = (field, rawValue, index) => {
    const normalizedValue =
      field === "abonado" ? String(rawValue ?? "").replace(/\D/g, "") : String(rawValue ?? "").trim();
    const key = `${field}:${normalizedValue}`;

    if (!normalizedValue || seen.has(key)) return;
    seen.add(key);
    references.push({
      field,
      value: normalizedValue,
      key,
      label: field === "abonado" ? `Abonado ${normalizedValue}` : normalizedValue,
      index
    });
  };

  for (const match of source.matchAll(/\b\d{2,3}-\d{2}-\d{2}(?:-\d{2})?\b/g)) {
    addReference("clave", match[0], match.index ?? 0);
  }

  const normalizedSource = source.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const abonadoPattern =
    /\b(?:abonado|codigo\s+(?:de\s+)?abonado|cod\.?\s*(?:de\s+)?abonado|numero\s+(?:de\s+)?abonado|num\.?\s*(?:de\s+)?abonado|no\.?\s*(?:de\s+)?abonado|cuenta)\s*[:#-]?\s*(\d{3,18})\b/gi;

  for (const match of normalizedSource.matchAll(abonadoPattern)) {
    addReference("abonado", match[1], match.index ?? 0);
  }

  const bareAbonado = normalizedSource.trim().match(/^#?\s*(\d{3,18})$/);
  if (!references.length && bareAbonado) {
    addReference("abonado", bareAbonado[1], 0);
  }

  return references.sort((left, right) => left.index - right.index);
};

export const isLookupQueryReady = (value = "", mode = "clave") => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return false;
  if (mode === "clave") return isLookupKeyComplete(trimmed);
  if (mode === "nombre" || mode === "alcaldia") return trimmed.length >= 3;
  return trimmed.replace(/\D/g, "").length >= 3;
};

export const getLookupValidationMessage = (mode = "clave") => {
  if (mode === "nombre") {
    return "Escribe al menos 3 caracteres para buscar por nombre.";
  }

  if (mode === "abonado") {
    return "El numero de abonado debe tener al menos 3 digitos.";
  }

  if (mode === "alcaldia") {
    return "Escribe al menos 3 caracteres para buscar en el padron de alcaldia.";
  }

  return "La clave debe tener formato 00-00-00, 000-00-00, 00-00-00-00 o 000-00-00-00.";
};

export const getLookupServiceMeta = (value = "") => {
  const normalized = String(value ?? "").trim().toUpperCase();

  if (normalized === "S") {
    return { label: "Si", tone: "is-on", icon: "success" };
  }

  if (normalized === "N") {
    return { label: "No", tone: "is-off", icon: "logout" };
  }

  return { label: normalized || "--", tone: "is-neutral", icon: "activity" };
};
