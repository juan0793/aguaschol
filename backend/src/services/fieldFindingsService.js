import { env } from "../config/env.js";
import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";
import { getMasterRecords, getMasterVersion } from "./claveLookupService.js";
import { candidatoDesdeFila, guardarCandidatos } from "./bancoClandestinosService.js";
import { buildBarrioCatalog, buildClaveBase, getPointClave, resolveFieldZone, roundMoney } from "../utils/claveField.js";
import { listBarrioCodes } from "./barrioCodeService.js";

// Hallazgos del levantamiento: qué produjo el trabajo de campo, en plata y en
// acciones. Cada predio levantado (clave base) cae en UNA categoría, de la más
// accionable a la menos:
//   sin_cuenta   → la clave no tiene ninguna cuenta en Aguas: posible clandestino.
//   sin_facturar → se levantó una caja de registro o descarga (aguas negras) en
//                  un predio cuyas cuentas no pagan alcantarillado.
//   con_mora     → tiene cuentas y alguna debe.
//   al_dia       → tiene cuentas y ninguna debe.
// Los puntos sin clave no se pueden cruzar y se cuentan aparte (sin_clave).

export const CATEGORIAS = ["sin_cuenta", "sin_facturar", "con_mora", "al_dia", "sin_clave"];
// Tipos de punto que prueban conexión a aguas negras.
export const TIPOS_ALCANTARILLADO = ["caja_registro", "descarga"];
const MAX_PUNTOS = 50000;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const activo = (value) => String(value ?? "").trim().toUpperCase() === "S";

// Índice del padrón por clave base, recalculado solo si cambia la versión del padrón.
let padronCache = { version: null, porBase: new Map() };
const padronPorBase = () => {
  const version = getMasterVersion();
  if (padronCache.version === version && padronCache.porBase.size) return padronCache.porBase;
  const porBase = new Map();
  for (const row of getMasterRecords()) {
    const base = row.clave_base || buildClaveBase(row.clave_catastral);
    if (!base) continue;
    const lista = porBase.get(base);
    if (lista) lista.push(row); else porBase.set(base, [row]);
  }
  padronCache = { version, porBase };
  return porBase;
};

/**
 * Clasifica puntos GPS (ya leídos) contra el padrón. Pura: se prueba sin BD.
 * seguimiento: Map base → { banco: estado, ficha: id } de lo que ya está en proceso.
 */
export const clasificarHallazgos = (puntos = [], porBase = new Map(), seguimiento = new Map(), catalogo = []) => {
  const predios = new Map();
  let sinClave = 0;
  for (const punto of puntos) {
    const clave = getPointClave(punto);
    const base = buildClaveBase(clave);
    if (!base) { sinClave += 1; continue; }
    // El barrio sale del código de la clave (igual que Control territorial), así
    // también lo tienen los predios que no están en el padrón.
    const predio = predios.get(base) || { base, clave, zona: resolveFieldZone(punto, catalogo).label, puntos: [], tipos: new Set(), lat: null, lng: null };
    predio.puntos.push(Number(punto.id));
    predio.tipos.add(punto.point_type || "caja_registro");
    if (predio.lat == null && punto.latitude != null) { predio.lat = Number(punto.latitude); predio.lng = Number(punto.longitude); }
    // La clave de 4 bloques del punto es más precisa que la base.
    if (clave.split("-").length > predio.clave.split("-").length) predio.clave = clave;
    if (!predio.nota && (punto.description || punto.reference_note)) predio.nota = String(punto.description || punto.reference_note).slice(0, 240);
    predios.set(base, predio);
  }

  const items = [];
  for (const predio of predios.values()) {
    const cuentas = (porBase.get(predio.base) || []).map((row) => ({
      abonado: String(row.abonado || ""),
      clave: row.clave_catastral,
      nombre: row.inquilino || row.nombre || "",
      agua: activo(row.agua),
      alcantarillado: activo(row.alcantarillado),
      deuda: roundMoney(row.total)
    }));
    const deuda = roundMoney(cuentas.reduce((sum, cuenta) => sum + cuenta.deuda, 0));
    const tipos = [...predio.tipos];
    const conCaja = tipos.some((tipo) => TIPOS_ALCANTARILLADO.includes(tipo));
    const categoria = !cuentas.length ? "sin_cuenta"
      : conCaja && !cuentas.some((cuenta) => cuenta.alcantarillado) ? "sin_facturar"
        : deuda > 0 ? "con_mora" : "al_dia";
    items.push({
      base: predio.base,
      clave: predio.clave,
      barrio: predio.zona,
      categoria,
      tipos,
      puntos: predio.puntos,
      latitude: predio.lat,
      longitude: predio.lng,
      nota: predio.nota || "",
      cuentas,
      deuda,
      seguimiento: seguimiento.get(predio.base) || null
    });
  }
  const orden = Object.fromEntries(CATEGORIAS.map((key, index) => [key, index]));
  items.sort((a, b) => orden[a.categoria] - orden[b.categoria] || b.deuda - a.deuda || a.base.localeCompare(b.base, "es", { numeric: true }));

  const conteo = Object.fromEntries(CATEGORIAS.map((key) => [key, 0]));
  items.forEach((item) => { conteo[item.categoria] += 1; });
  conteo.sin_clave = sinClave;
  return {
    items,
    conteo,
    totales: {
      puntos: puntos.length,
      predios: items.length,
      mora: roundMoney(items.filter((item) => item.categoria === "con_mora").reduce((sum, item) => sum + item.deuda, 0)),
      cuentas_sin_alcantarillado: items.filter((item) => item.categoria === "sin_facturar").reduce((sum, item) => sum + item.cuentas.length, 0),
      nuevos_para_banco: items.filter((item) => item.categoria === "sin_cuenta" && !item.seguimiento).length
    }
  };
};

const rango = ({ from = "", to = "" } = {}) => {
  from = String(from || "").trim(); to = String(to || "").trim();
  if ((from && !FECHA.test(from)) || (to && !FECHA.test(to))) throw fail("Las fechas deben tener el formato AAAA-MM-DD.");
  if (from && to && from > to) [from, to] = [to, from];
  return { from, to };
};

const leerPuntos = async ({ from, to }) => {
  const where = [];
  const params = [];
  if (from) { where.push("COALESCE(diary_date, DATE(created_at)) >= ?"); params.push(from); }
  if (to) { where.push("COALESCE(diary_date, DATE(created_at)) <= ?"); params.push(to); }
  const [rows] = await getPool().query(
    `SELECT id, point_type, latitude, longitude, description, reference_note, validation_status
     FROM map_points ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY id LIMIT ?`,
    [...params, MAX_PUNTOS]
  );
  return rows;
};

// Lo que ya está en proceso (banco o ficha) no se vuelve a proponer como nuevo.
const leerSeguimiento = async () => {
  const seguimiento = new Map();
  const [[banco], [fichas]] = await Promise.all([
    getPool().query("SELECT clave_catastral, estado FROM banco_clandestinos WHERE clave_catastral <> ''"),
    getPool().query("SELECT id, clave_catastral FROM inmuebles_clandestinos WHERE archived_at IS NULL")
  ]);
  banco.forEach((row) => { const base = buildClaveBase(row.clave_catastral); if (base) seguimiento.set(base, { ...(seguimiento.get(base) || {}), banco: row.estado }); });
  fichas.forEach((row) => { const base = buildClaveBase(row.clave_catastral); if (base) seguimiento.set(base, { ...(seguimiento.get(base) || {}), ficha: Number(row.id) }); });
  return seguimiento;
};

export const getFieldFindings = async (filtros = {}) => {
  const periodo = rango(filtros);
  if (env.useMemoryDb) return { periodo, ...clasificarHallazgos([], padronPorBase()), padron_version: getMasterVersion() };
  const [puntos, seguimiento, barrios] = await Promise.all([leerPuntos(periodo), leerSeguimiento(), listBarrioCodes()]);
  return { periodo, ...clasificarHallazgos(puntos, padronPorBase(), seguimiento, buildBarrioCatalog(barrios)), limite: MAX_PUNTOS, padron_version: getMasterVersion() };
};

// Candidato del banco a partir de un predio sin cuenta: un candidato por predio.
export const candidatoDesdeHallazgo = (item) => candidatoDesdeFila({
  origen_ref: item.base,
  clave_catastral: item.clave,
  clave_origen: "gps",
  comentario_campo: [item.nota, `Puntos GPS: ${item.puntos.map((id) => `#${id}`).join(", ")}`].filter(Boolean).join(" · "),
  barrio_colonia: String(item.barrio || "").replace(/^\s*\d{1,3}\s*-\s*/, "").replace("Barrio sin nombre", "").replace("Sin barrio", ""),
  alcantarillado: item.tipos.some((tipo) => TIPOS_ALCANTARILLADO.includes(tipo)) ? "1" : "0",
  latitude: item.latitude,
  longitude: item.longitude
});

/**
 * Manda al banco de clandestinos los predios "sin cuenta" elegidos del periodo.
 * Se recalcula del lado del servidor: el cliente solo dice qué claves.
 */
export const enviarHallazgosAlBanco = async ({ bases = [], from = "", to = "" } = {}, user) => {
  if (!["admin", "operator"].includes(user?.role)) throw fail("Tu rol no puede enviar al banco.", 403);
  const elegidas = new Set((Array.isArray(bases) ? bases : []).map((base) => buildClaveBase(base)).filter(Boolean));
  if (!elegidas.size) throw fail("Elige al menos un predio.");
  const hallazgos = await getFieldFindings({ from, to });
  const candidatos = hallazgos.items.filter((item) => item.categoria === "sin_cuenta" && !item.seguimiento && elegidas.has(item.base));
  if (!candidatos.length) throw fail("Ninguno de los elegidos es un predio nuevo sin cuenta (ya están en el banco o tienen ficha).", 409);
  const lote = `GPS ${hallazgos.periodo.from || "inicio"} a ${hallazgos.periodo.to || "hoy"}`;
  const resumen = await guardarCandidatos(candidatos.map(candidatoDesdeHallazgo), { origen: "gps", lote }, user);
  await createAuditLog({ actorUserId: user?.id, action: "field_findings.sent_to_banco", entityType: "banco_clandestinos", entityId: 0, summary: `${resumen.nuevos} predios de puntos GPS enviados al banco (${lote})`, details: { bases: candidatos.map((item) => item.base) } });
  return { ...resumen, enviados: candidatos.length, omitidos: elegidas.size - candidatos.length };
};
