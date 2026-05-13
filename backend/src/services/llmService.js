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

  const llmConfig = resolveLlmConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.llmTimeoutMs);

  try {
    const response = await fetch(`${llmConfig.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: buildProviderHeaders(llmConfig),
      body: JSON.stringify({
        model: llmConfig.model,
        temperature: 0.25,
        max_tokens: action === "notice" ? 380 : action === "quality" || action === "followup" ? 260 : 220,
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
        ]
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error?.message || payload?.message || "No fue posible generar la asistencia con IA.");
      error.status = response.status;
      throw error;
    }

    const text = extractContent(payload);
    if (!text) {
      const error = new Error("El proveedor de IA no devolvio contenido.");
      error.status = 502;
      throw error;
    }

    return {
      action,
      label: config.label,
      provider: llmConfig.provider,
      model: llmConfig.model,
      text
    };
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("La API de IA tardo demasiado en responder.");
      timeoutError.status = 504;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};
