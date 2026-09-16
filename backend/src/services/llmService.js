import { env } from "../config/env.js";

const ACTIONS = {
  comment: {
    label: "comentario tecnico",
    instruction:
      "Redacta un comentario tecnico breve para una ficha catastral de posible inmueble clandestino. Debe ser claro, formal y util para personal de campo. Maximo 45 palabras."
  },
  summary: {
    label: "resumen ejecutivo",
    instruction:
      "Redacta un resumen ejecutivo de la ficha para supervision. Incluye estado, ubicacion, servicios observados y accion recomendada. Maximo 70 palabras."
  },
  notice: {
    label: "texto de aviso",
    instruction:
      "Redacta dos parrafos formales para un aviso al abonado sobre regularizacion de inmueble posiblemente clandestino. Mantén tono institucional, sin inventar leyes ni montos."
  },
  quality: {
    label: "revision de ficha",
    instruction:
      "Revisa la calidad de la ficha antes de imprimir o notificar. Devuelve una lista breve de campos faltantes, inconsistencias y acciones concretas de correccion. Maximo 90 palabras."
  },
  followup: {
    label: "plan de seguimiento",
    instruction:
      "Propone un plan operativo breve para dar seguimiento a esta ficha. Incluye prioridad, siguiente accion de campo/oficina y evidencia a confirmar. Maximo 80 palabras."
  }
};

const compactRecord = (record = {}) => ({
  clave_catastral: record.clave_catastral || "",
  estado_padron: record.estado_padron || "clandestino",
  barrio_colonia: record.barrio_colonia || "",
  abonado: record.abonado || "",
  nombre_catastral: record.nombre_catastral || "",
  inquilino: record.inquilino || "",
  identidad: record.identidad || "",
  situacion_inmueble: record.situacion_inmueble || "",
  uso_suelo: record.uso_suelo || "",
  actividad: record.actividad || "",
  codigo_sector: record.codigo_sector || "",
  conexion_agua: record.conexion_agua || "",
  conexion_alcantarillado: record.conexion_alcantarillado || "",
  recoleccion_desechos: record.recoleccion_desechos || "",
  comentarios: record.comentarios || "",
  clave_alcaldia: record.clave_alcaldia || "",
  nombre_alcaldia: record.nombre_alcaldia || "",
  barrio_alcaldia: record.barrio_alcaldia || ""
});

const extractContent = (payload) => {
  const content = payload?.choices?.[0]?.message?.content ?? payload?.choices?.[0]?.text ?? "";
  return String(content).trim();
};

const resolveLlmConfig = () => {
  if (env.llmProvider === "cerebras" || env.cerebrasApiKey) {
    return {
      provider: "cerebras",
      apiKey: env.cerebrasApiKey || env.llmApiKey,
      baseUrl: env.cerebrasApiBaseUrl,
      model: env.cerebrasModel
    };
  }

  return {
    provider: env.llmProvider || "openrouter",
    apiKey: env.llmApiKey,
    baseUrl: env.llmApiBaseUrl,
    model: env.llmModel
  };
};

const buildProviderHeaders = (config) => {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`
  };

  if (config.provider !== "cerebras") {
    headers["HTTP-Referer"] = env.llmSiteUrl || env.frontendUrl || "http://localhost";
    headers["X-Title"] = env.llmAppName;
  }

  return headers;
};

const fail = (message, status) => Object.assign(new Error(message), { status });

// Llamada comun al endpoint /chat/completions (Cerebras u OpenRouter, ambos compatibles con OpenAI).
const requestChatCompletion = async ({ messages, temperature, maxTokens, emptyMessage }) => {
  const llmConfig = resolveLlmConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.llmTimeoutMs);

  try {
    const response = await fetch(`${llmConfig.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: buildProviderHeaders(llmConfig),
      body: JSON.stringify({ model: llmConfig.model, temperature, max_tokens: maxTokens, messages })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw fail(payload?.error?.message || payload?.message || emptyMessage, response.status);
    }

    const text = extractContent(payload);
    if (!text) throw fail("El proveedor de IA no devolvio contenido.", 502);
    return text;
  } catch (error) {
    if (error.name === "AbortError") throw fail("La API de IA tardo demasiado en responder.", 504);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const getLlmStatus = () => {
  const config = resolveLlmConfig();
  return {
    configured: Boolean(config.apiKey && config.baseUrl && config.model),
    provider: config.provider,
    model: config.model
  };
};

export const isLlmConfigured = () => getLlmStatus().configured;

export const generateRecordAssistance = async ({ action, record }) => {
  const config = ACTIONS[action];
  if (!config) {
    const error = new Error("Accion de IA no soportada.");
    error.status = 400;
    throw error;
  }

  if (!isLlmConfigured()) {
    const error = new Error("La API de IA no esta configurada. Agrega CEREBRAS_API_KEY o LLM_API_KEY en el backend.");
    error.status = 503;
    throw error;
  }

  const text = await requestChatCompletion({
    temperature: 0.25,
    maxTokens: action === "notice" ? 380 : action === "quality" || action === "followup" ? 260 : 220,
    messages: [
      {
        role: "system",
        content:
          "Eres asistente tecnico de Aguas de Choluteca. Responde solo en espanol, sin markdown, sin datos inventados y sin exponer informacion sensible innecesaria."
      },
      {
        role: "user",
        content: `${config.instruction}\n\nFicha:\n${JSON.stringify(compactRecord(record), null, 2)}`
      }
    ],
    emptyMessage: "No fue posible generar la asistencia con IA."
  });
  const llmConfig = resolveLlmConfig();

  return {
    action,
    label: config.label,
    provider: llmConfig.provider,
    model: llmConfig.model,
    text
  };
};

const SPELLING_MAX_CHARS = 4000;

const SPELLING_INSTRUCTION = [
  "Corrige la ortografia de un texto escrito por un tecnico de campo de Aguas de Choluteca (Honduras).",
  "Corrige solo: faltas de ortografia, tildes, signos de puntuacion, mayusculas al inicio de oracion y abreviaturas de mensajeria (q, xq, pq, x, tmb) escritas en palabras completas.",
  "Si el texto viene todo en mayusculas, conservalo en mayusculas.",
  "No cambies el significado, no agregues ni quites informacion, no resumas, no cambies el orden ni el estilo de redaccion.",
  "Conserva exactamente numeros, fechas, telefonos, claves catastrales, codigos, medidas, nombres propios y saltos de linea.",
  "Devuelve unicamente el texto corregido, sin comillas, sin explicaciones y sin markdown."
].join(" ");

/**
 * Corrige ortografia de un texto libre. Lanza 503 si la IA no esta configurada, para que el
 * frontend use la correccion basica local.
 */
export const correctSpelling = async (value) => {
  const original = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  if (!original) return { text: "", changed: false, provider: "none" };
  if (original.length > SPELLING_MAX_CHARS) throw fail(`El texto supera ${SPELLING_MAX_CHARS} caracteres.`, 413);
  if (!isLlmConfigured()) throw fail("La corrección con IA no está configurada.", 503);

  const text = (await requestChatCompletion({
    temperature: 0,
    maxTokens: Math.min(2000, Math.ceil(original.length / 2) + 200),
    messages: [
      { role: "system", content: SPELLING_INSTRUCTION },
      { role: "user", content: original }
    ],
    emptyMessage: "No fue posible corregir el texto."
  }))
    .replace(/^["'`\s]+|["'`\s]+$/g, "")
    .trim();

  // Salvaguarda: una "correccion" que cambia mucho la longitud ya no es ortografia.
  // En textos cortos ("q" -> "que") se tolera una diferencia fija de caracteres.
  const tolerance = Math.max(20, original.length * 0.35);
  if (!text || Math.abs(text.length - original.length) > tolerance) throw fail("La corrección con IA cambió demasiado el texto; se descartó.", 422);

  const { model, provider } = resolveLlmConfig();
  return { text, changed: text !== original, provider, model };
};
