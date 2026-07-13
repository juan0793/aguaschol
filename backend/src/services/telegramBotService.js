import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { searchClaveCatastral } from "./claveLookupService.js";
import { findByAbonadoOrClave } from "./inmuebleService.js";

const fields = [
  ["id", "Registro"],
  ["clave_catastral", "Clave catastral"],
  ["abonado", "Abonado"],
  ["nombre_catastral", "Nombre catastral"],
  ["inquilino", "Inquilino"],
  ["barrio_colonia", "Barrio o colonia"],
  ["identidad", "Identidad"],
  ["telefono", "Teléfono"],
  ["accion_inspeccion", "Acción de inspección"],
  ["situacion_inmueble", "Situación del inmueble"],
  ["tendencia_inmueble", "Tenencia del inmueble"],
  ["uso_suelo", "Uso de suelo"],
  ["actividad", "Actividad"],
  ["codigo_sector", "Código de sector"],
  ["comentarios", "Comentarios"],
  ["estado_padron", "Estado del padrón"],
  ["clave_alcaldia", "Clave de alcaldía"],
  ["nombre_alcaldia", "Nombre en alcaldía"],
  ["barrio_alcaldia", "Barrio en alcaldía"],
  ["conexion_agua", "Conexión de agua"],
  ["conexion_alcantarillado", "Conexión de alcantarillado"],
  ["recoleccion_desechos", "Recolección de desechos"],
  ["fecha_aviso", "Fecha del aviso"],
  ["firmante_aviso", "Firmante del aviso"],
  ["cargo_firmante", "Cargo del firmante"],
  ["levantamiento_datos", "Levantamiento de datos"],
  ["analista_datos", "Analista de datos"],
  ["printed_at", "Fecha de impresión"],
  ["created_at", "Fecha de registro"],
  ["updated_at", "Última actualización"]
];

const display = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (value instanceof Date) return value.toLocaleString("es-HN");
  return String(value);
};

export const formatInmuebleForTelegram = (record) =>
  ["INFORMACIÓN DEL INMUEBLE", ...fields.map(([key, label]) => `${label}: ${display(record[key])}`)].join("\n");

const serviceStatus = (value) => ({ S: "Sí", N: "No" })[String(value ?? "").toUpperCase()] ?? display(value);
const money = (value) =>
  new Intl.NumberFormat("es-HN", { style: "currency", currency: "HNL" }).format(Number(value) || 0);

export const formatPadronForTelegram = (record) =>
  [
    "INFORMACIÓN DEL PADRÓN DE AGUAS",
    `Clave catastral: ${display(record.clave_catastral)}`,
    `Abonado: ${display(record.abonado)}`,
    `Nombre: ${display(record.nombre)}`,
    `Inquilino: ${display(record.inquilino)}`,
    `Barrio o colonia: ${display(record.barrio_colonia)}`,
    `Agua potable: ${serviceStatus(record.agua)}`,
    `Alcantarillado: ${serviceStatus(record.alcantarillado)}`,
    `Barrido: ${serviceStatus(record.barrido)}`,
    `Recolección: ${serviceStatus(record.recoleccion)}`,
    `Desechos peligrosos: ${serviceStatus(record.desechos_peligrosos)}`,
    `Valor: ${money(record.valor)}`,
    `Intereses: ${money(record.intereses)}`,
    `Total: ${money(record.total)}`
  ].join("\n");

export const findPadronForTelegram = async (query) => {
  const digits = query.replace(/\D/g, "");
  const field = query.includes("-") || digits.length >= 6 ? "clave" : "abonado";
  const result = await searchClaveCatastral(query, { field });
  return field === "abonado"
    ? result.matches.filter((record) => String(record.abonado) === digits)
    : result.matches;
};

export const splitTelegramMessage = (text, limit = 3900) =>
  Array.from({ length: Math.ceil(text.length / limit) }, (_, index) =>
    text.slice(index * limit, (index + 1) * limit)
  );

const telegram = async (method, body) => {
  const multipart = body instanceof FormData;
  const response = await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/${method}`, {
    method: "POST",
    headers: multipart ? undefined : { "Content-Type": "application/json" },
    body: multipart ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(35000)
  });
  const data = await response.json();
  if (!data.ok) throw new Error(data.description || `Telegram rechazó ${method}.`);
  return data.result;
};

const sendText = async (chatId, text) => {
  for (const chunk of splitTelegramMessage(text)) {
    await telegram("sendMessage", { chat_id: chatId, text: chunk });
  }
};

const sendPhoto = async (chatId, record) => {
  if (!record.foto_path) return;
  if (/^https?:\/\//i.test(record.foto_path)) {
    await telegram("sendPhoto", { chat_id: chatId, photo: record.foto_path });
    return;
  }

  const fileName = path.basename(record.foto_path);
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("photo", new Blob([await fs.readFile(path.join(env.uploadDir, fileName))]), fileName);
  await telegram("sendPhoto", form);
};

const handleMessage = async (message) => {
  const chatId = String(message.chat?.id ?? "");
  if (!chatId || !message.text) return;
  if (!env.telegramAllowedChatIds.has(chatId)) {
    await sendText(chatId, `Chat no autorizado. ID para habilitar: ${chatId}`);
    return;
  }

  const query = message.text.trim();
  if (!query || query === "/start" || query === "/help") {
    await sendText(chatId, "Escriba únicamente el número de abonado o la clave catastral.");
    return;
  }
  if (query.length > 100) {
    await sendText(chatId, "La consulta es demasiado larga.");
    return;
  }

  const padronRecords = await findPadronForTelegram(query);
  const records = await findByAbonadoOrClave(query).catch(() => []);
  if (!padronRecords.length && !records.length) {
    await sendText(chatId, "No se encontró un inmueble con ese abonado o clave catastral.");
    return;
  }

  for (const record of padronRecords) {
    await sendText(chatId, formatPadronForTelegram(record));
  }

  for (const record of records) {
    await sendText(chatId, formatInmuebleForTelegram(record));
    await sendPhoto(chatId, record).catch((error) =>
      sendText(chatId, `La ficha tiene fotografía, pero no pudo enviarse: ${error.message}`)
    );
  }
};

export const startTelegramBot = () => {
  if (!env.telegramBotToken) return;

  void (async () => {
    let offset = 0;
    console.log("Bot de Telegram activo.");
    while (true) {
      try {
        const updates = await telegram("getUpdates", { offset, timeout: 25, allowed_updates: ["message"] });
        for (const update of updates) {
          offset = update.update_id + 1;
          await handleMessage(update.message).catch((error) =>
            sendText(update.message?.chat?.id, `No fue posible consultar la ficha: ${error.message}`).catch(() => {})
          );
        }
      } catch (error) {
        console.error("Error del bot de Telegram:", error.message);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  })();
};
