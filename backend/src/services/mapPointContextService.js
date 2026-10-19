import { env } from "../config/env.js";
import { getPool } from "../config/db.js";

// Barrio y referencia cercana de cada punto GPS, sacados de Nominatim (OpenStreetMap).
//
// Nominatim pide como máximo una consulta por segundo, así que las consultas pasan por
// una sola cola que las espacia. Lo que se responde queda guardado en memoria y en la
// tabla map_point_contexts, y se guarda por celda de ~11 m (4 decimales): casas vecinas
// comparten referencia y un punto ya consultado no se vuelve a pedir nunca.
//
// Quien pide contextos espera solo unos segundos: lo que no alcanzó a llegar se omite
// (el informe usa el barrio de la clave) y la cola lo sigue buscando para la próxima vez.

const toKey = (latitude, longitude) => `${Number(latitude).toFixed(6)},${Number(longitude).toFixed(6)}`;
const toCell = (latitude, longitude) => `${Number(latitude).toFixed(4)},${Number(longitude).toFixed(4)}`;

const normalizeZone = (address = {}) =>
  address.neighbourhood ||
  address.suburb ||
  address.city_district ||
  address.quarter ||
  address.hamlet ||
  address.village ||
  address.town ||
  address.city ||
  address.municipality ||
  address.county ||
  "";

const normalizeReference = (payload = {}) => {
  const address = payload.address ?? {};
  const direct =
    payload.name ||
    address.amenity ||
    address.tourism ||
    address.shop ||
    address.building ||
    address.road ||
    "";

  if (direct) {
    return direct;
  }

  const displayParts = String(payload.display_name ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return displayParts.slice(0, 2).join(", ");
};

const consultarNominatim = async (latitude, longitude) => {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "es");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "aguaschol-field-report/1.0"
    },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    const error = new Error("No fue posible consultar la referencia geografica.");
    error.status = 502;
    throw error;
  }

  const payload = await response.json();
  return {
    zone: normalizeZone(payload.address) || "Zona no identificada",
    reference: normalizeReference(payload) || "Referencia no disponible",
    display_name: payload.display_name || ""
  };
};

const leerDeBase = async (celdas) => {
  if (env.useMemoryDb || !celdas.length) return [];
  const [rows] = await getPool().query(
    "SELECT cell_key, zone, reference, display_name FROM map_point_contexts WHERE cell_key IN (?)",
    [celdas]
  );
  return rows;
};

const guardarEnBase = async (celda, contexto) => {
  if (env.useMemoryDb) return;
  await getPool().query(
    `INSERT INTO map_point_contexts (cell_key, zone, reference, display_name) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE zone = VALUES(zone), reference = VALUES(reference), display_name = VALUES(display_name)`,
    [celda, contexto.zone.slice(0, 255), contexto.reference.slice(0, 255), contexto.display_name.slice(0, 600)]
  );
};

export const crearServicioContextos = ({
  geocodificar = consultarNominatim,
  leer = leerDeBase,
  guardar = guardarEnBase,
  intervaloMs = 1100,
  esperaMs = 6000
} = {}) => {
  const cache = new Map(); // celda -> { zone, reference, display_name }
  const enCola = new Map(); // celda -> { latitude, longitude, avisos: [] }
  let trabajando = false;
  let ultimaConsulta = 0;

  const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const trabajar = async () => {
    if (trabajando) return;
    trabajando = true;
    try {
      while (enCola.size) {
        const [celda, tarea] = enCola.entries().next().value;
        const espera = ultimaConsulta + intervaloMs - Date.now();
        if (espera > 0) await dormir(espera);
        ultimaConsulta = Date.now();
        let contexto = null;
        try {
          contexto = await geocodificar(tarea.latitude, tarea.longitude);
          cache.set(celda, contexto);
          await guardar(celda, contexto).catch(() => {});
        } catch {
          // Falló esta consulta: se omite; se volverá a intentar cuando alguien la pida.
        }
        enCola.delete(celda);
        tarea.avisos.forEach((avisar) => avisar(contexto));
      }
    } finally {
      trabajando = false;
    }
  };

  const encolar = (celda, latitude, longitude) => {
    if (cache.has(celda)) return Promise.resolve(cache.get(celda));
    let tarea = enCola.get(celda);
    if (!tarea) {
      tarea = { latitude: Number(latitude), longitude: Number(longitude), avisos: [] };
      enCola.set(celda, tarea);
    }
    const promesa = new Promise((resolve) => tarea.avisos.push(resolve));
    trabajar();
    return promesa;
  };

  const validos = (points = []) =>
    points.filter((point) => Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude)));

  // Trae de la base las celdas que aún no están en memoria.
  const completarDesdeBase = async (celdas) => {
    const faltan = celdas.filter((celda) => !cache.has(celda));
    if (!faltan.length) return;
    try {
      for (let inicio = 0; inicio < faltan.length; inicio += 500) {
        const filas = await leer(faltan.slice(inicio, inicio + 500));
        filas.forEach((fila) => cache.set(fila.cell_key, { zone: fila.zone, reference: fila.reference, display_name: fila.display_name }));
      }
    } catch {
      // Sin base: se consulta a Nominatim.
    }
  };

  // Deja buscando en segundo plano los puntos nuevos (p. ej. al guardarlos).
  const precargar = async (points = []) => {
    const lista = validos(points);
    const celdas = [...new Set(lista.map((point) => toCell(point.latitude, point.longitude)))];
    await completarDesdeBase(celdas);
    lista.forEach((point) => encolar(toCell(point.latitude, point.longitude), point.latitude, point.longitude));
  };

  const obtener = async (points = [], { espera = esperaMs } = {}) => {
    const unicos = Array.from(new Map(validos(points).slice(0, 5000).map((point) => [toKey(point.latitude, point.longitude), point])).values());
    const celdas = [...new Set(unicos.map((point) => toCell(point.latitude, point.longitude)))];
    await completarDesdeBase(celdas);

    const pendientes = unicos
      .filter((point) => !cache.has(toCell(point.latitude, point.longitude)))
      .map((point) => encolar(toCell(point.latitude, point.longitude), point.latitude, point.longitude));
    if (pendientes.length && espera > 0) {
      let reloj;
      await Promise.race([Promise.all(pendientes), new Promise((resolve) => { reloj = setTimeout(resolve, espera); })]);
      clearTimeout(reloj);
    }

    return unicos.flatMap((point) => {
      const contexto = cache.get(toCell(point.latitude, point.longitude));
      if (!contexto) return [];
      return [{ key: toKey(point.latitude, point.longitude), latitude: Number(point.latitude), longitude: Number(point.longitude), ...contexto }];
    });
  };

  return { obtener, precargar, pendientes: () => enCola.size };
};

const servicio = crearServicioContextos();

export const fetchMapPointContexts = (points = []) => servicio.obtener(points);
export const prefetchMapPointContexts = (points = []) => servicio.precargar(points).catch(() => {});
