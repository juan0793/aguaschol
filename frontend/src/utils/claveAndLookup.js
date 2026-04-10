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

export const isLookupQueryReady = (value = "", mode = "clave") => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return false;
  if (mode === "clave") return isLookupKeyComplete(trimmed);
  if (mode === "nombre") return trimmed.length >= 3;
  return trimmed.replace(/\D/g, "").length >= 3;
};

export const getLookupValidationMessage = (mode = "clave") => {
  if (mode === "nombre") {
    return "Escribe al menos 3 caracteres para buscar por nombre.";
  }

  if (mode === "abonado") {
    return "El numero de abonado debe tener al menos 3 digitos.";
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
