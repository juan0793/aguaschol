import { env } from "../config/env.js";
import { getPool } from "../config/db.js";
import { emitToRoles } from "./profileRealtimeService.js";
import { TECNICO_ROLES } from "./bancoClandestinosService.js";

// Mapa del equipo: dónde andan los técnicos (GPS del teléfono, mientras tienen la
// app abierta) y los candidatos del banco que tienen asignados o revisaron.
// La ubicación solo la ven administración y Gerencia.

const MIN_SEGUNDOS = 110; // entre dos lecturas guardadas del mismo técnico (el teléfono manda cada 2 min si está quieto)…
const MIN_METROS = 15; // …salvo que se haya movido más que esto
const DIAS_GUARDADOS = 30;
const MAX_RASTRO = 400; // puntos del recorrido del día por técnico
const MAX_CANDIDATOS = 4000;
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const numero = (value) => (value === null || value === undefined || value === "" ? NaN : Number(value));
const isoDia = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "");

const ultimas = new Map(); // user_id → última lectura recibida (guardada o no)
const guardadas = new Map(); // user_id → última lectura guardada en la base
const memoria = []; // modo de memoria (pruebas)
let ultimaPurga = 0;

export const distanciaMetros = (a, b) => {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

/** Valida la lectura del teléfono. Devuelve null si no sirve. */
export const lecturaValida = (body = {}, ahora = new Date()) => {
  const latitude = numero(body.latitude);
  const longitude = numero(body.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) return null;
  const accuracy = numero(body.accuracy);
  const heading = numero(body.heading);
  const speed = numero(body.speed);
  return {
    latitude: Number(latitude.toFixed(7)),
    longitude: Number(longitude.toFixed(7)),
    accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? Math.min(Math.round(accuracy), 99999) : null,
    heading: Number.isFinite(heading) && heading >= 0 ? Math.round(heading) % 360 : null,
    speed: Number.isFinite(speed) && speed >= 0 ? Number(speed.toFixed(1)) : null,
    at: ahora.toISOString()
  };
};

/** Se guarda si es la primera, si pasó el tiempo mínimo o si se movió lo suficiente. */
export const debeGuardar = (anterior, nueva) => {
  if (!anterior) return true;
  const segundos = (new Date(nueva.at) - new Date(anterior.at)) / 1000;
  return segundos >= MIN_SEGUNDOS || distanciaMetros(anterior, nueva) >= MIN_METROS;
};

/** Recorta el recorrido a `max` puntos repartidos, conservando el primero y el último. */
export const muestrearRastro = (puntos = [], max = MAX_RASTRO) => {
  if (puntos.length <= max) return puntos;
  const paso = (puntos.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => puntos[Math.round(i * paso)]);
};

const purgar = async () => {
  if (Date.now() - ultimaPurga < 3600000) return;
  ultimaPurga = Date.now();
  await getPool().query("DELETE FROM tecnico_ubicaciones WHERE created_at < (CURRENT_TIMESTAMP - INTERVAL ? DAY)", [DIAS_GUARDADOS]).catch(() => {});
};

export const registrarUbicacion = async (body, user) => {
  if (!TECNICO_ROLES.includes(user?.role) || user?.preview) throw fail("Tu rol no comparte ubicación.", 403);
  const lectura = lecturaValida(body);
  if (!lectura) throw fail("Ubicación no válida.");
  const id = Number(user.id);
  ultimas.set(id, lectura);
  const guardar = debeGuardar(guardadas.get(id), lectura);
  if (guardar) {
    if (env.useMemoryDb) memoria.push({ user_id: id, ...lectura });
    else {
      await getPool().query(
        "INSERT INTO tecnico_ubicaciones (user_id, latitude, longitude, accuracy_m, heading, speed) VALUES (?, ?, ?, ?, ?, ?)",
        [id, lectura.latitude, lectura.longitude, lectura.accuracy, lectura.heading, lectura.speed]
      );
      purgar();
    }
    guardadas.set(id, lectura);
  }
  emitToRoles({ type: "team.location", location: { user_id: id, nombre: user.full_name || user.username || "", ...lectura } }, ["admin"]);
  return { ok: true, guardada: guardar };
};

const fila = (row) => ({
  latitude: Number(row.latitude),
  longitude: Number(row.longitude),
  accuracy: row.accuracy_m == null ? null : Number(row.accuracy_m),
  at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at
});

/**
 * Datos del mapa para un día (por defecto hoy): técnicos con su última ubicación y
 * recorrido, y los candidatos del banco con coordenadas que tienen asignados o que
 * revisaron ese día. `tz` es el desfase del navegador en minutos (getTimezoneOffset).
 */
export const mapaDelEquipo = async ({ fecha = "", tz = 0 } = {}, user) => {
  if (!["admin", "gerente"].includes(user?.role)) throw fail("Tu rol no puede ver el mapa del equipo.", 403);
  const offset = Number.isFinite(Number(tz)) ? Math.max(-840, Math.min(840, Number(tz))) : 0;
  const hoy = new Date(Date.now() - offset * 60000).toISOString().slice(0, 10);
  const dia = isoDia(fecha) || hoy;
  const desde = new Date(new Date(`${dia}T00:00:00Z`).getTime() + offset * 60000);
  const hasta = new Date(desde.getTime() + 86400000);

  if (env.useMemoryDb) {
    const delDia = memoria.filter((item) => new Date(item.at) >= desde && new Date(item.at) < hasta);
    const ids = [...new Set(delDia.map((item) => item.user_id))];
    return { fecha: dia, hoy: dia === hoy, tecnicos: ids.map((id) => ({ id, nombre: `Técnico ${id}`, rastro: delDia.filter((item) => item.user_id === id).map(({ latitude, longitude, accuracy, at }) => ({ latitude, longitude, accuracy, at })) })).map((item) => ({ ...item, ubicacion: item.rastro.at(-1) || null })), candidatos: [] };
  }

  const pool = getPool();
  const [[usuarios], [puntos], [candidatos]] = await Promise.all([
    pool.query("SELECT id, full_name, username, role FROM app_users WHERE is_active = 1 AND role IN (?) ORDER BY full_name", [TECNICO_ROLES]),
    pool.query(
      "SELECT user_id, latitude, longitude, accuracy_m, created_at FROM tecnico_ubicaciones WHERE created_at >= ? AND created_at < ? ORDER BY user_id, created_at",
      [desde, hasta]
    ),
    pool.query(
      `SELECT id, clave_catastral, barrio_colonia, dictamen, estado, asignado_a, procesado_por, procesado_at, latitude, longitude
       FROM banco_clandestinos
       WHERE latitude IS NOT NULL AND longitude IS NOT NULL
         AND ((estado = 'pendiente' AND asignado_a IS NOT NULL) OR (estado IN ('enviado','descartado') AND procesado_por IS NOT NULL AND duplicado_de IS NULL AND procesado_at >= ? AND procesado_at < ?))
       ORDER BY id LIMIT ?`,
      [desde, hasta, MAX_CANDIDATOS]
    )
  ]);

  const porUsuario = new Map();
  for (const row of puntos) {
    const id = Number(row.user_id);
    if (!porUsuario.has(id)) porUsuario.set(id, []);
    porUsuario.get(id).push(fila(row));
  }
  const tecnicos = usuarios.map((row) => {
    const id = Number(row.id);
    const rastro = porUsuario.get(id) || [];
    // Hoy manda la lectura en vivo más reciente aunque no se haya guardado.
    const enVivo = dia === hoy ? ultimas.get(id) : null;
    const ultima = rastro.at(-1) || null;
    const ubicacion = enVivo && (!ultima || new Date(enVivo.at) > new Date(ultima.at)) ? { latitude: enVivo.latitude, longitude: enVivo.longitude, accuracy: enVivo.accuracy, at: enVivo.at } : ultima;
    return { id, nombre: row.full_name || row.username, role: row.role, ubicacion, rastro: muestrearRastro(rastro) };
  });

  return {
    fecha: dia,
    hoy: dia === hoy,
    tecnicos,
    candidatos: candidatos.map((row) => ({
      id: Number(row.id),
      clave: row.clave_catastral,
      barrio: row.barrio_colonia,
      dictamen: row.dictamen,
      estado: row.estado,
      // De quién es en el mapa: a quien está asignado o quien lo revisó.
      tecnico_id: Number(row.estado === "pendiente" ? row.asignado_a : row.procesado_por),
      procesado_at: row.procesado_at instanceof Date ? row.procesado_at.toISOString() : row.procesado_at,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude)
    })),
    limite: MAX_CANDIDATOS
  };
};
