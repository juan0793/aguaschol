import { formatClaveInput } from "./claveAndLookup.js";

const CLAVE_WITH_DASHES_PATTERN = /\b\d{2,3}-\d{2}-\d{2}(?:-\d{2})?\b/;

const normalizeText = (value = "") =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const hasAny = (source, words = []) => words.some((word) => source.includes(word));

const removeNoiseWords = (value = "") => {
  const noisePattern =
    /\b(busca|buscame|buscar|verificame|verificar|mirame|mira|quien|es|la|el|esta|este|clave|abonado|numero|cuenta|saldo|debe|deuda|agua|aguas|negra|alcantarillado|alcaldia|catastro|catastral|municipal|informacion|por|favor|del|de|a)\b/gi;
  return String(value ?? "")
    .replace(noisePattern, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const detectIntent = (normalized = "") => {
  if (
    hasAny(normalized, [
      "no esta en aguas",
      "no aparece en aguas",
      "no sale en aguas",
      "sin abonado",
      "no tiene abonado",
      "no tiene numero de abonado",
      "existe pero no tiene abonado",
      "esta en alcaldia pero no en aguas"
    ])
  ) {
    return "missing_in_aguas";
  }

  if (hasAny(normalized, ["saldo", "debe", "deuda", "mora", "pendiente", "cuanto debe"])) {
    return "saldo";
  }

  if (hasAny(normalized, ["agua", "aguas", "alcantarillado", "agua negra", "aguas negras", "servicio", "servicios"])) {
    return "servicios";
  }

  if (hasAny(normalized, ["alcaldia", "catastro", "catastral", "municipal", "informacion municipal"])) {
    return "municipal_check";
  }

  return "general";
};

const isLikelyPersonName = (value = "") => {
  const cleaned = removeNoiseWords(value);
  const lettersOnly = cleaned.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "").trim();
  const normalized = normalizeText(value);
  const hasNameHint = hasAny(normalized, ["nombre", "inquilino", "busca a", "buscar a"]);
  return /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(cleaned) && lettersOnly.length >= 3 && (hasNameHint || /\s/.test(lettersOnly));
};

export const parseLookupChatMessage = (message = "") => {
  const originalText = String(message ?? "").trim();
  const normalized = normalizeText(originalText);
  const intent = detectIntent(normalized);

  if (!originalText) {
    return { mode: null, query: "", originalText, intent };
  }

  const dashedKey = originalText.match(CLAVE_WITH_DASHES_PATTERN)?.[0] || "";
  if (dashedKey) {
    return { mode: "clave", query: dashedKey, originalText, intent };
  }

  const digitGroups = originalText.match(/\d+/g) || [];
  const compactDigits = digitGroups.join("");
  const hasClaveWords = hasAny(normalized, ["clave", "catastral", "catastro", "alcaldia", "municipal"]);
  const hasAbonadoWords = hasAny(normalized, [
    "abonado",
    "numero",
    "cuenta",
    "cod abonado",
    "codigo abonado"
  ]);

  if (compactDigits) {
    if (hasAbonadoWords) {
      return { mode: "abonado", query: compactDigits, originalText, intent };
    }

    if (hasClaveWords && compactDigits.length >= 6) {
      return { mode: "clave", query: formatClaveInput(compactDigits), originalText, intent };
    }

    if (!hasClaveWords && compactDigits.length >= 3 && compactDigits.length <= 5) {
      return { mode: "abonado", query: compactDigits, originalText, intent };
    }

    if (compactDigits.length >= 6 && compactDigits.length <= 9) {
      return { mode: "clave", query: formatClaveInput(compactDigits), originalText, intent };
    }
  }

  if (isLikelyPersonName(originalText)) {
    return { mode: "nombre", query: removeNoiseWords(originalText), originalText, intent };
  }

  return { mode: null, query: "", originalText, intent };
};

const serviceStatus = (value) => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "S") return "Sí";
  if (normalized === "N") return "No";
  return "--";
};

const money = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? new Intl.NumberFormat("es-HN", {
        style: "currency",
        currency: "HNL",
        currencyDisplay: "narrowSymbol"
      }).format(numeric)
    : "";
};

const buildAguasCard = (match = {}) => ({
  status: "En Aguas",
  tone: "success",
  fields: [
    ["Número de abonado", match.abonado],
    ["Abonado", match.nombre || match.inquilino],
    ["Inquilino", match.nombre && match.inquilino !== match.nombre ? match.inquilino : ""],
    ["Clave catastral", match.clave_catastral],
    ["Barrio/Colonia", match.barrio_colonia],
    ["Dirección", match.direccion],
    ["Saldo", money(match.total)],
    ["Agua", serviceStatus(match.agua)],
    ["Alcantarillado", serviceStatus(match.alcantarillado)],
    ["Barrido", serviceStatus(match.barrido)],
    ["Recolección", serviceStatus(match.recoleccion)],
    ["Desechos peligrosos", serviceStatus(match.desechos_peligrosos)]
  ]
    .filter(([, value]) => String(value ?? "").trim())
    .map(([label, value]) => ({ label, value }))
});

const buildMunicipalCard = (match = {}) => ({
  status: match.exists_in_aguas ? "En Alcaldia y Aguas" : "Solo Catastro",
  tone: match.exists_in_aguas ? "success" : "warning",
  fields: [
    ["Clave catastral", match.clave_catastral],
    ["Nombre catastral", match.nombre],
    ["Barrio/Caserío", match.caserio],
    ["Dirección", match.direccion],
    ["Estado en Aguas", match.exists_in_aguas ? "Con registro asociado" : "Sin registro asociado"],
    ["Clave Aguas", match.clave_aguas_formato]
  ]
    .filter(([, value]) => String(value ?? "").trim())
    .map(([label, value]) => ({ label, value }))
});

const first = (items = []) => (Array.isArray(items) ? items[0] : null);

export const buildLookupNoResultsResponse = (queryMeta = {}) => ({
  tone: queryMeta.intent === "municipal_check" || queryMeta.intent === "missing_in_aguas" ? "warning" : "empty",
  title: "Sin resultados",
  text:
    queryMeta.intent === "municipal_check" || queryMeta.intent === "missing_in_aguas"
      ? "No encontré esta clave ni en la información catastral ni en el padrón de Aguas de Choluteca. Revisa si la clave está completa o si tiene errores de escritura."
      : "No encontré registros con esa búsqueda. Prueba con la clave completa, número de abonado o nombre.",
  cards: [],
  actions: []
});

export const buildLookupErrorResponse = (error, queryMeta = {}) => ({
  tone: "warning",
  title: "No pude completar la búsqueda",
  text: error?.message || `No fue posible consultar ${queryMeta.query || "la búsqueda"}.`,
  cards: [],
  actions: []
});

export const buildLookupChatResponse = (result = {}, queryMeta = {}) => {
  const aguasMatches = result.aguas?.matches || [];
  const alcaldiaMatches = result.alcaldia?.matches || [];
  const aguasMatch = first(aguasMatches);
  const alcaldiaMatch = first(alcaldiaMatches);

  if (aguasMatches.length > 1) {
    return {
      tone: "success",
      title: "Varios registros encontrados",
      text: "Encontré varios registros parecidos. Te muestro los más relevantes.",
      cards: aguasMatches.slice(0, 6).map(buildAguasCard),
      actions: ["Copiar clave", "Copiar abonado"]
    };
  }

  if (aguasMatch) {
    const total = money(aguasMatch.total);
    const title =
      queryMeta.intent === "saldo"
        ? "Saldo del abonado"
        : queryMeta.intent === "servicios"
          ? "Servicios registrados"
          : "Registro encontrado";
    const text =
      queryMeta.intent === "saldo"
        ? total
          ? `El abonado ${aguasMatch.abonado || ""} tiene un saldo pendiente de ${total}.`
          : "No encontré saldo pendiente registrado para este abonado."
        : queryMeta.intent === "servicios"
          ? "Servicios registrados para este abonado:"
          : alcaldiaMatch
            ? `Su clave ${aguasMatch.clave_catastral || queryMeta.query} aparece en Aguas de Choluteca y también en la información municipal/catastral.`
            : `La clave ${aguasMatch.clave_catastral || queryMeta.query} sí tiene registro en Aguas de Choluteca.`;

    return {
      tone: "success",
      title,
      text,
      cards: [buildAguasCard(aguasMatch)],
      actions: ["Copiar clave", "Copiar abonado"]
    };
  }

  if (alcaldiaMatch) {
    return {
      tone: "warning",
      title: "Resultado de verificación",
      text:
        "La clave catastral sí aparece en la información municipal/catastral, pero no encontré un abonado asociado en Aguas de Choluteca. Esto puede significar que el inmueble existe en Catastro/Alcaldía, pero todavía no está vinculado al padrón de Aguas. Conviene validar en campo o remitir esta clave para revisión.",
      cards: [buildMunicipalCard(alcaldiaMatch)],
      actions: ["Copiar clave"]
    };
  }

  return buildLookupNoResultsResponse(queryMeta);
};
