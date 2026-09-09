import { getPool } from "../config/db.js";
import { env } from "../config/env.js";
import { emitProfileMessage } from "./profileRealtimeService.js";
import { toIsoDate } from "./entregasRules.js";

export const jornadaEntregas = (now = new Date()) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: env.entregasTimezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  return { fecha: `${parts.year}-${parts.month}-${parts.day}`, hora: `${parts.hour}:${parts.minute}` };
};

// Solo la fase vigente: reiniciar después del cierre no envía las fases vencidas.
export const faseRecordatorio = (lote, jornada, config = env) => {
  if (lote.estado !== "ABIERTO" || toIsoDate(lote.fecha) > jornada.fecha) return "";
  if (toIsoDate(lote.fecha) < jornada.fecha) return "ATRASADO";
  if (jornada.hora >= config.entregasFin) return "FIN";
  if (jornada.hora >= config.entregasPreaviso) return "PREAVISO";
  if (jornada.hora >= config.entregasRecordatorio) return "JORNADA";
  return "";
};

// Destinatarios del aviso, en una sola condición reutilizada por el pre-filtro y
// por el envío: siempre el responsable con usuario activo; los gestores entran
// solo si el lote ya viene atrasado o nadie más puede cerrarlo. El primer
// parámetro es la fase.
const DESTINATARIOS = `
  FROM entrega_lotes lote
  LEFT JOIN personal_campo personal ON personal.id = lote.responsable_id
  LEFT JOIN app_users responsable ON responsable.id = personal.user_id AND responsable.is_active = 1
  INNER JOIN app_users usuario ON usuario.is_active = 1 AND (usuario.id = responsable.id
    OR (usuario.role IN ('admin', 'operator') AND (? = 'ATRASADO' OR responsable.id IS NULL)))`;

// Pre-filtro barato: una consulta por fase (cuatro como máximo) deja solo los
// lotes a los que todavía les falta algún destinatario. Sin esto cada tick abría
// una transacción por lote abierto, incluso con todos los avisos ya enviados.
const lotesPendientes = async (pool, porFase, jornada) => {
  const pendientes = new Set();
  for (const [fase, ids] of porFase) {
    const [filas] = await pool.query(
      `SELECT DISTINCT lote.id AS lote_id ${DESTINATARIOS}
       LEFT JOIN entrega_recordatorios aviso ON aviso.lote_id = lote.id
         AND aviso.recipient_user_id = usuario.id AND aviso.jornada = ? AND aviso.fase = ?
       WHERE lote.id IN (?) AND aviso.id IS NULL`,
      [fase, jornada.fecha, fase, ids]
    );
    filas.forEach((fila) => pendientes.add(Number(fila.lote_id)));
  }
  return pendientes;
};

export const enviarRecordatoriosEntregas = async (now = new Date()) => {
  const pool = getPool();
  const jornada = jornadaEntregas(now);
  const [lotes] = await pool.query("SELECT id, fecha, estado FROM entrega_lotes WHERE estado = 'ABIERTO' AND fecha <= ? ORDER BY fecha, id", [jornada.fecha]);
  const porFase = new Map();
  for (const candidato of lotes) {
    const fase = faseRecordatorio(candidato, jornada);
    if (!fase) continue;
    if (!porFase.has(fase)) porFase.set(fase, []);
    porFase.get(fase).push(candidato.id);
  }
  if (!porFase.size) return 0;

  const pendientes = await lotesPendientes(pool, porFase, jornada);
  let enviados = 0;
  for (const candidato of lotes) {
    if (!pendientes.has(Number(candidato.id))) continue;
    const connection = await pool.getConnection();
    const messages = [];
    try {
      await connection.beginTransaction();
      const [[lote]] = await connection.query(
        `SELECT lote.*, personal.user_id, personal.nombre_completo AS responsable_nombre
         FROM entrega_lotes lote LEFT JOIN personal_campo personal ON personal.id = lote.responsable_id
         WHERE lote.id = ? FOR UPDATE`, [candidato.id]);
      const fase = lote && faseRecordatorio(lote, jornada);
      if (!fase) { await connection.rollback(); continue; }
      const [recipients] = await connection.query(
        `SELECT usuario.id ${DESTINATARIOS} WHERE lote.id = ?`, [fase, lote.id]);
      for (const recipient of recipients) {
        const [[existing]] = await connection.query(
          "SELECT message_id FROM entrega_recordatorios WHERE lote_id = ? AND recipient_user_id = ? AND jornada = ? AND fase = ?",
          [lote.id, recipient.id, jornada.fecha, fase]);
        if (existing) continue;
        // El bloqueo del lote serializa réplicas y cierre; el índice único persiste la deduplicación.
        await connection.query(
          `UPDATE user_profile_messages messages INNER JOIN entrega_recordatorios aviso ON aviso.message_id = messages.id
           SET messages.read_at = COALESCE(messages.read_at, CURRENT_TIMESTAMP)
           WHERE aviso.lote_id = ? AND aviso.recipient_user_id = ?`, [lote.id, recipient.id]);
        const body = `${fase === "ATRASADO" ? "Crítico: lote de una jornada anterior" : fase === "FIN" ? "Jornada finalizada: cierre pendiente" : "Recordatorio de cierre diario"}. Lote #${lote.id} · ${toIsoDate(lote.fecha)} · ${lote.responsable_nombre || "Sin responsable"} · ${lote.barrio_nombre}. Registra los sobrantes y cierra el lote.`;
        const [result] = await connection.query("INSERT INTO user_profile_messages (recipient_user_id, body) VALUES (?, ?)", [recipient.id, body]);
        await connection.query(
          "INSERT INTO entrega_recordatorios (lote_id, recipient_user_id, jornada, fase, message_id) VALUES (?, ?, ?, ?, ?)",
          [lote.id, recipient.id, jornada.fecha, fase, result.insertId]);
        messages.push({ id: result.insertId, sender_user_id: null, sender_name: "Control de entregas", recipient_user_id: recipient.id, body, entrega_lote_id: lote.id, read_at: null, created_at: now.toISOString() });
      }
      await connection.commit();
      messages.forEach(emitProfileMessage);
      enviados += messages.length;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  }
  return enviados;
};

export const startEntregasReminders = () => {
  if (env.useMemoryDb || !env.entregasRecordatoriosEnabled) return;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await enviarRecordatoriosEntregas(); }
    catch (error) { console.error("Recordatorios de entregas:", error.message); }
    finally { running = false; }
  };
  tick();
  const timer = setInterval(tick, 60_000);
  timer.unref();
  return timer;
};
