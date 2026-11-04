import { env } from "../config/env.js";
import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";

export const USOS_POZO = [
  "domiciliario", "comunitario", "industrial_comercial", "purificadora",
  "agroforestal", "sanitario", "turistico", "otro", "sin_dato"
];
export const TAMANOS_EMPRESA = ["micro_pequena", "mediana_grande", "no_aplica"];
export const TIPOS_PERMISO = ["ninguno", "permiso_municipal", "licencia_municipal", "concesion", "en_tramite", "sin_dato"];

const USOS_SIN_PERMISO = new Set(["domiciliario", "comunitario"]);
const TIPOS_VALIDOS = new Set(["permiso_municipal", "licencia_municipal", "concesion"]);
const memory = new Map();

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const clean = (value) => String(value ?? "").trim();
const own = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
const numberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
};

const dateParts = (value) => {
  if (!value) return null;
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day, date, iso: text };
};

const addMonths = (parts, months) => {
  const month = parts.month - 1 + months;
  const year = parts.year + Math.floor(month / 12);
  const normalizedMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, normalizedMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, normalizedMonth, Math.min(parts.day, lastDay)));
};

const addYears = (parts, years) => {
  const lastDay = new Date(Date.UTC(parts.year + years, parts.month, 0)).getUTCDate();
  return new Date(Date.UTC(parts.year + years, parts.month - 1, Math.min(parts.day, lastDay)));
};

const isoDate = (date) => date.toISOString().slice(0, 10);
const asIso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const defaults = () => ({
  pozo_codigo: "",
  pozo_nombre: "",
  uso: "sin_dato",
  tamano_empresa: "no_aplica",
  clave_catastral: "",
  titular: "",
  permiso_tipo: "sin_dato",
  permiso_numero: "",
  permiso_fecha: null,
  permiso_vence: null,
  caudal_autorizado_lps: null,
  caudal_lps: null,
  horas_bombeo_dia: null,
  dias_mes: null,
  volumen_declarado_m3: null,
  anio_declarado: null,
  notas: "",
  actualizado_por: null,
  actualizado_at: null
});

const mapRow = (row = {}) => ({
  ...defaults(),
  ...row,
  pozo_id: row.pozo_id == null ? undefined : Number(row.pozo_id),
  pozo_codigo: clean(row.pozo_codigo),
  pozo_nombre: clean(row.pozo_nombre),
  permiso_fecha: dateParts(row.permiso_fecha)?.iso || null,
  permiso_vence: dateParts(row.permiso_vence)?.iso || null,
  caudal_autorizado_lps: numberOrNull(row.caudal_autorizado_lps),
  caudal_lps: numberOrNull(row.caudal_lps),
  horas_bombeo_dia: numberOrNull(row.horas_bombeo_dia),
  dias_mes: numberOrNull(row.dias_mes),
  volumen_declarado_m3: numberOrNull(row.volumen_declarado_m3),
  anio_declarado: numberOrNull(row.anio_declarado),
  actualizado_por: numberOrNull(row.actualizado_por),
  actualizado_at: asIso(row.actualizado_at)
});

export const requierePermiso = (uso) => {
  if (USOS_SIN_PERMISO.has(uso)) return false;
  if (USOS_POZO.includes(uso) && uso !== "sin_dato") return true;
  return "por_definir";
};

export const fechaVencimientoPermiso = (registro = {}) => {
  const manual = dateParts(registro.permiso_vence);
  if (manual) return manual.iso;
  const fecha = dateParts(registro.permiso_fecha);
  return fecha ? isoDate(addYears(fecha, 10)) : null;
};

const tieneDeclaracionDelAnio = (registro, year) =>
  Number.isInteger(Number(registro?.anio_declarado)) && Number(registro.anio_declarado) === year && numberOrNull(registro?.volumen_declarado_m3) !== null;

export const estadoLegal = (registro = {}, hoy = new Date()) => {
  const fechaActual = dateParts(hoy) || dateParts(new Date());
  const requiere = requierePermiso(registro?.uso);
  let estado;

  if (requiere === "por_definir") {
    estado = "por_definir";
  } else if (!requiere) {
    estado = "no_requiere";
  } else if (registro?.permiso_tipo === "en_tramite") {
    estado = "en_tramite";
  } else if (!TIPOS_VALIDOS.has(registro?.permiso_tipo)) {
    estado = "sin_permiso";
  } else {
    const vence = dateParts(fechaVencimientoPermiso(registro));
    if (!vence) {
      estado = "por_definir";
    } else if (vence.date < fechaActual.date) {
      estado = "vencido";
    } else if (vence.date <= addMonths(fechaActual, 4)) {
      estado = "por_vencer";
    } else {
      estado = "al_dia";
    }
  }

  return {
    estado,
    falta_declaracion: requiere === true && fechaActual.month >= 12 && !tieneDeclaracionDelAnio(registro, fechaActual.year)
  };
};

export const volumenAnualEstimado = (registro = {}) => {
  const values = [registro.caudal_lps, registro.horas_bombeo_dia, registro.dias_mes].map(numberOrNull);
  if (values.some((value) => value === null)) return null;
  return values[0] * 3.6 * values[1] * values[2] * 12;
};

export const canonEstimado = (volumenORegistro) => {
  const volumen = typeof volumenORegistro === "object" ? volumenAnualEstimado(volumenORegistro) : numberOrNull(volumenORegistro);
  return volumen === null ? null : volumen * 0.0025;
};

export const sugerirUso = (nombre) => {
  const text = clean(nombre).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/purificadora/.test(text)) return "purificadora";
  if (/comunitari/.test(text)) return "comunitario";
  if (/casa(?:\s+de)?\s+habitacion|\bcasa\b/.test(text)) return "domiciliario";
  if (/gasolinera|shell|puma|taller|tienda|panaderia|restaurante|banco/.test(text)) return "industrial_comercial";
  return "sin_dato";
};

const articulosAplicables = (registro, situacion) => {
  const requiere = requierePermiso(registro.uso);
  const articulos = ["Art. 57", "Art. 135"];
  if (requiere === true) {
    articulos.push("Arts. 136 y 152–161", "Art. 220", "Art. 222 b");
    if (["industrial_comercial", "purificadora", "agroforestal", "sanitario", "turistico", "otro"].includes(registro.uso)) articulos.push("Art. 140");
    if (["por_vencer", "vencido"].includes(situacion.estado)) articulos.push("Art. 157");
    if (situacion.falta_declaracion) articulos.push("Art. 155");
    if (situacion.estado === "sin_permiso") articulos.push("Art. 236");
  }
  return articulos;
};

// El registro se guardó para otro pozo si su código o nombre ya no coinciden con el inventario
// (el shapefile se regeneró y los ids se corrieron). Entonces no se confía en su estado.
export const registroDesfasado = (legal = {}, pozo = {}) =>
  Boolean(legal.pozo_codigo) && (legal.pozo_codigo !== clean(pozo.codigo) || legal.pozo_nombre !== clean(pozo.nombre));

export const presentarSituacionLegal = (registro, pozo = {}, hoy = new Date()) => {
  const legal = mapRow(registro);
  const desfasado = registroDesfasado(legal, pozo);
  const situacion = desfasado ? { estado: "por_definir", falta_declaracion: false } : estadoLegal(legal, hoy);
  const articulos = articulosAplicables(legal, situacion);
  return {
    ...legal,
    // permiso_vence es la fecha que rige (la escrita o la del permiso + 10 años, art. 157);
    // permiso_vence_manual es solo la escrita, la que edita el formulario.
    permiso_vence_manual: legal.permiso_vence,
    permiso_vence: fechaVencimientoPermiso(legal),
    desfasado,
    registrado_para: desfasado ? { codigo: legal.pozo_codigo, nombre: legal.pozo_nombre } : null,
    uso_sugerido: sugerirUso(pozo.nombre),
    requiere_permiso: requierePermiso(legal.uso),
    ...situacion,
    volumen_estimado_m3: volumenAnualEstimado(legal),
    canon_estimado_l: canonEstimado(legal),
    articulos,
    articulo: articulos.join(" · ")
  };
};

export const __resetPozosLegalMemoryForTests = () => memory.clear();

const getRecord = async (pozoId) => {
  if (env.useMemoryDb) return mapRow(memory.get(Number(pozoId)));
  const [[row]] = await getPool().query("SELECT * FROM pozos_situacion_legal WHERE pozo_id = ? LIMIT 1", [pozoId]);
  return row ? mapRow(row) : null;
};

export const listarSituacionesLegales = async () => {
  const rows = env.useMemoryDb
    ? [...memory.values()]
    : (await getPool().query("SELECT * FROM pozos_situacion_legal"))[0];
  return new Map(rows.map((row) => {
    const legal = mapRow(row);
    return [legal.pozo_id, legal];
  }));
};

export const agregarSituacionLegal = async (inventario, hoy = new Date()) => {
  const legales = await listarSituacionesLegales();
  const pozos = (inventario?.pozos || []).map((pozo) => ({
    ...pozo,
    legal: presentarSituacionLegal(legales.get(Number(pozo.id)), pozo, hoy)
  }));
  const actualizadoLegal = [...legales.values()].map((legal) => legal.actualizado_at).filter(Boolean).sort().at(-1) || null;
  const actualizado = [inventario?.actualizado, actualizadoLegal].filter(Boolean).sort().at(-1) || null;
  return { ...inventario, actualizado, actualizado_legal: actualizadoLegal, pozos };
};

const enumValue = (payload, current, field, allowed, fallback) => {
  const value = own(payload, field) ? clean(payload[field]) || fallback : current?.[field] ?? fallback;
  if (!allowed.includes(value)) throw fail(`${field} no es válido.`);
  return value;
};

const textValue = (payload, current, field, max, fallback = "") => {
  const value = own(payload, field) ? clean(payload[field]) : current?.[field] ?? fallback;
  if (value.length > max) throw fail(`${field} supera ${max} caracteres.`);
  return value;
};

const dateValue = (payload, current, field) => {
  const value = own(payload, field) ? payload[field] : current?.[field];
  if (value === null || value === undefined || value === "") return null;
  const parsed = dateParts(value);
  if (!parsed) throw fail(`${field} debe ser una fecha válida.`);
  return parsed.iso;
};

const numericValue = (payload, current, field, { min = 0, max = Infinity, integer = false } = {}) => {
  const value = own(payload, field) ? payload[field] : current?.[field];
  if (value === null || value === undefined || value === "") return null;
  const number = numberOrNull(value);
  if (number === null || number < min || number > max || (integer && !Number.isInteger(number))) throw fail(`${field} no es válido.`);
  return number;
};

export const normalizarSituacionLegal = (payload = {}, current = null) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw fail("Los datos legales no son válidos.");
  const permisoFecha = dateValue(payload, current, "permiso_fecha");
  const permisoVence = own(payload, "permiso_vence")
    ? dateValue(payload, current, "permiso_vence")
    : (own(payload, "permiso_fecha") && !permisoFecha ? null : dateValue(payload, current, "permiso_vence"));
  return {
    uso: enumValue(payload, current, "uso", USOS_POZO, "sin_dato"),
    tamano_empresa: enumValue(payload, current, "tamano_empresa", TAMANOS_EMPRESA, "no_aplica"),
    clave_catastral: textValue(payload, current, "clave_catastral", 80),
    titular: textValue(payload, current, "titular", 180),
    permiso_tipo: enumValue(payload, current, "permiso_tipo", TIPOS_PERMISO, "sin_dato"),
    permiso_numero: textValue(payload, current, "permiso_numero", 120),
    permiso_fecha: permisoFecha,
    permiso_vence: permisoVence,
    caudal_autorizado_lps: numericValue(payload, current, "caudal_autorizado_lps"),
    caudal_lps: numericValue(payload, current, "caudal_lps"),
    horas_bombeo_dia: numericValue(payload, current, "horas_bombeo_dia", { max: 24 }),
    dias_mes: numericValue(payload, current, "dias_mes", { max: 31 }),
    volumen_declarado_m3: numericValue(payload, current, "volumen_declarado_m3"),
    anio_declarado: numericValue(payload, current, "anio_declarado", { min: 1900, max: 2200, integer: true }),
    notas: textValue(payload, current, "notas", 5000)
  };
};

const auditar = async (user, pozoId, legal) => {
  if (env.useMemoryDb) return;
  try {
    await createAuditLog({
      actorUserId: user?.id ?? null,
      actorName: user?.full_name || user?.username || "",
      action: "pozos.legal.updated",
      entityType: "pozo_situacion_legal",
      entityId: pozoId,
      summary: `Situación legal actualizada para pozo ${pozoId}`,
      details: { uso: legal.uso, permiso_tipo: legal.permiso_tipo }
    });
  } catch {
    // La auditoría no debe impedir guardar la situación legal.
  }
};

export const guardarSituacionLegal = async (pozoId, payload, user, pozo = {}) => {
  const id = Number(pozoId);
  if (!Number.isInteger(id) || id <= 0) throw fail("Pozo no encontrado.", 404);
  const current = await getRecord(id);
  const legal = { ...normalizarSituacionLegal(payload, current), pozo_codigo: clean(pozo.codigo).slice(0, 80), pozo_nombre: clean(pozo.nombre).slice(0, 180) };
  const actorId = Number.isInteger(Number(user?.id)) ? Number(user.id) : null;

  if (env.useMemoryDb) {
    const row = { pozo_id: id, ...legal, actualizado_por: actorId, actualizado_at: new Date().toISOString() };
    memory.set(id, row);
    return mapRow(row);
  }

  const pool = getPool();
  await pool.query(
    `INSERT INTO pozos_situacion_legal (
      pozo_id, pozo_codigo, pozo_nombre, uso, tamano_empresa, clave_catastral, titular, permiso_tipo, permiso_numero,
      permiso_fecha, permiso_vence, caudal_autorizado_lps, caudal_lps, horas_bombeo_dia,
      dias_mes, volumen_declarado_m3, anio_declarado, notas, actualizado_por
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      pozo_codigo = VALUES(pozo_codigo), pozo_nombre = VALUES(pozo_nombre), uso = VALUES(uso), tamano_empresa = VALUES(tamano_empresa), clave_catastral = VALUES(clave_catastral),
      titular = VALUES(titular), permiso_tipo = VALUES(permiso_tipo), permiso_numero = VALUES(permiso_numero),
      permiso_fecha = VALUES(permiso_fecha), permiso_vence = VALUES(permiso_vence),
      caudal_autorizado_lps = VALUES(caudal_autorizado_lps), caudal_lps = VALUES(caudal_lps),
      horas_bombeo_dia = VALUES(horas_bombeo_dia), dias_mes = VALUES(dias_mes),
      volumen_declarado_m3 = VALUES(volumen_declarado_m3), anio_declarado = VALUES(anio_declarado),
      notas = VALUES(notas), actualizado_por = VALUES(actualizado_por), actualizado_at = CURRENT_TIMESTAMP`,
    [
      id, legal.pozo_codigo, legal.pozo_nombre, legal.uso, legal.tamano_empresa, legal.clave_catastral, legal.titular, legal.permiso_tipo,
      legal.permiso_numero, legal.permiso_fecha, legal.permiso_vence, legal.caudal_autorizado_lps,
      legal.caudal_lps, legal.horas_bombeo_dia, legal.dias_mes, legal.volumen_declarado_m3,
      legal.anio_declarado, legal.notas, actorId
    ]
  );
  const saved = await getRecord(id);
  await auditar(user, id, saved);
  return saved;
};
