import { getPool } from "../config/db.js";
import { env } from "../config/env.js";
import { getClaveLookupMeta, getMasterRecords, normalizeMasterRecords } from "./claveLookupService.js";
import { foxProRowsToMaster } from "./foxProImportService.js";
import { r2PadronService } from "./r2PadronService.js";

// Diferencias entre dos cortes del padrón (el lote FoxPro activo contra el anterior).
// Cada cuenta se reconoce por su abonado (o por la clave si no tiene abonado). La mora se
// explica como un puente exacto:
//   mora anterior + cuentas nuevas + aumentos − cuentas que salieron − bajas − saldadas = mora actual.

export const MORA_ALTA = 1000;
const SERVICIOS = ["agua", "alcantarillado", "barrido", "recoleccion", "desechos_peligrosos"];
const redondear = (valor) => Math.round((Number(valor) || 0) * 100) / 100;
const llave = (record) => String(record.abonado || "").trim() || `clave:${String(record.clave_catastral || "").trim()}`;
const deudaDe = (record) => Number(record.total || 0);
const vacio = () => ({ cuentas: 0, con_mora: 0, mora_alta: 0, capital: 0, intereses: 0, total: 0 });

export const resumirPadron = (records = []) => {
  const resumen = vacio();
  const barrios = new Set();
  for (const record of records) {
    const total = deudaDe(record);
    resumen.cuentas += 1;
    resumen.capital += Number(record.valor || 0);
    resumen.intereses += Number(record.intereses || 0);
    resumen.total += total;
    if (total > 0) resumen.con_mora += 1;
    if (total >= MORA_ALTA) resumen.mora_alta += 1;
    if (record.barrio_colonia) barrios.add(record.barrio_colonia);
  }
  return { ...resumen, capital: redondear(resumen.capital), intereses: redondear(resumen.intereses), total: redondear(resumen.total), barrios: barrios.size };
};

// Una cuenta repetida en el mismo padrón suma su deuda, para que el puente cuadre siempre.
const indexar = (records) => {
  const mapa = new Map();
  for (const record of records) {
    const key = llave(record);
    const actual = mapa.get(key);
    if (actual) actual.total += deudaDe(record);
    else mapa.set(key, { total: deudaDe(record), barrio: record.barrio_colonia || "Sin barrio", servicios: SERVICIOS.map((campo) => record[campo]).join("") });
  }
  return mapa;
};

const movimiento = () => ({ cuentas: 0, monto: 0 });
const sumar = (destino, monto) => { destino.cuentas += 1; destino.monto += monto; };

export const compararPadrones = (anteriores = [], actuales = [], { barriosLimite = 8 } = {}) => {
  const antes = indexar(anteriores);
  const ahora = indexar(actuales);
  const m = {
    nuevas: movimiento(), salieron: movimiento(), aumentaron: movimiento(), bajaron: movimiento(), saldaron: movimiento(),
    cayeron_en_mora: movimiento(), sin_cambio: 0, cambio_servicio: 0, cambio_barrio: 0
  };
  const porBarrio = new Map();
  const barrio = (nombre) => {
    if (!porBarrio.has(nombre)) porBarrio.set(nombre, { barrio: nombre, antes: 0, ahora: 0, cuentas_antes: 0, cuentas_ahora: 0 });
    return porBarrio.get(nombre);
  };

  for (const [key, previo] of antes) {
    const fila = barrio(previo.barrio);
    fila.antes += previo.total;
    fila.cuentas_antes += 1;
    if (!ahora.has(key)) sumar(m.salieron, previo.total);
  }
  for (const [key, actual] of ahora) {
    const fila = barrio(actual.barrio);
    fila.ahora += actual.total;
    fila.cuentas_ahora += 1;
    const previo = antes.get(key);
    if (!previo) { sumar(m.nuevas, actual.total); continue; }
    const diferencia = actual.total - previo.total;
    if (Math.abs(diferencia) < 0.005) m.sin_cambio += 1;
    else if (diferencia > 0) sumar(m.aumentaron, diferencia);
    else if (actual.total <= 0) sumar(m.saldaron, -diferencia);
    else sumar(m.bajaron, -diferencia);
    if (previo.total <= 0 && actual.total > 0) sumar(m.cayeron_en_mora, actual.total);
    if (previo.servicios !== actual.servicios) m.cambio_servicio += 1;
    if (previo.barrio !== actual.barrio) m.cambio_barrio += 1;
  }

  for (const clave of ["nuevas", "salieron", "aumentaron", "bajaron", "saldaron", "cayeron_en_mora"]) m[clave].monto = redondear(m[clave].monto);
  const filas = [...porBarrio.values()]
    .map((fila) => ({ ...fila, antes: redondear(fila.antes), ahora: redondear(fila.ahora), diferencia: redondear(fila.ahora - fila.antes), cuentas: fila.cuentas_ahora - fila.cuentas_antes }))
    .filter((fila) => fila.diferencia !== 0 || fila.cuentas !== 0);
  const orden = (a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia) || a.barrio.localeCompare(b.barrio, "es");
  return {
    anterior: resumirPadron(anteriores),
    actual: resumirPadron(actuales),
    movimientos: m,
    barrios: {
      subieron: filas.filter((fila) => fila.diferencia > 0).sort(orden).slice(0, barriosLimite),
      bajaron: filas.filter((fila) => fila.diferencia < 0).sort(orden).slice(0, barriosLimite),
      con_cambios: filas.length
    }
  };
};

const fecha = (valor) => (valor ? new Date(valor).toISOString() : null);
const describirLote = (lote) => lote && ({
  codigo: lote.codigo_lote,
  fecha_extraccion: fecha(lote.fecha_extraccion),
  fecha_aplicacion: fecha(lote.fecha_aplicacion),
  fecha_recepcion: fecha(lote.fecha_recepcion),
  total_registros: Number(lote.total_registros || 0),
  nuevos: Number(lote.registros_nuevos || 0),
  modificados: Number(lote.registros_modificados || 0),
  estado: lote.estado
});

// Los registros de un lote ya aplicado: del detalle en MySQL si todavía lo conserva (los
// últimos lotes) y si no, de su copia histórica en R2.
const cargarLote = async (lote, { pool, r2 }) => {
  const [rows] = await pool.query(
    "SELECT * FROM importacion_padron_registros WHERE lote_id=? AND estado NOT IN ('ERROR','DESCARTADO') ORDER BY numero_fila",
    [lote.id]
  );
  if (rows.length) return { origen: "mysql", records: normalizeMasterRecords(foxProRowsToMaster(rows)) };
  if (!r2.configured) return null;
  let key = lote.r2_historico_key;
  if (!key) {
    const versiones = await r2.listHistorical(100);
    key = versiones.find((item) => String(item.key).endsWith(`-${lote.codigo_lote}.json.gz`))?.key || "";
  }
  if (!key) return null;
  const historico = await r2.loadHistorical(key);
  return { origen: "r2", records: historico.records };
};

const cache = new Map();

export const compararLotesPadron = async ({ anterior: codigoAnterior = "", pool = null, r2 = r2PadronService, memoria = env.useMemoryDb } = {}) => {
  if (memoria && !pool) return { ok: true, disponible: false, motivo: "Sin base de datos de lotes en este entorno." };
  pool ||= getPool();
  const meta = (await getClaveLookupMeta()).meta;
  const codigoActivo = String(meta.last_import_summary?.codigo_lote || "").trim();
  const [aplicados] = await pool.query(
    `SELECT id, codigo_lote, estado, fecha_extraccion, fecha_recepcion, fecha_aplicacion, total_registros,
       registros_nuevos, registros_modificados, r2_historico_key
     FROM importacion_padron_lotes WHERE estado='APLICADO'
     ORDER BY COALESCE(fecha_aplicacion, fecha_recepcion) DESC, id DESC LIMIT 12`
  );
  // Si el código del padrón activo no es de un lote (p. ej. se restauró de R2), el activo es
  // el último lote aplicado: así nunca se compara un lote consigo mismo.
  const activo = aplicados.find((lote) => lote.codigo_lote === codigoActivo) || aplicados[0] || null;
  const candidatos = aplicados.filter((lote) => lote !== activo);
  const anterior = (codigoAnterior && candidatos.find((lote) => lote.codigo_lote === codigoAnterior)) || candidatos[0] || null;
  // Un lote ya recibido y revisado, más nuevo que el activo, que todavía no se activa.
  const [pendientes] = await pool.query(
    `SELECT codigo_lote, estado, fecha_extraccion, fecha_recepcion, fecha_aplicacion, total_registros, registros_nuevos, registros_modificados
     FROM importacion_padron_lotes WHERE estado IN ('LISTO','PARCIALMENTE_APLICADO')
     ORDER BY fecha_recepcion DESC, id DESC LIMIT 1`
  );
  const base = {
    ok: true,
    actual: { ...(describirLote(activo) || { codigo: codigoActivo || "Padrón activo" }), fecha_corte: meta.updated_at || null },
    // El lote anterior se elige entre estos (los más recientes primero).
    lotes: candidatos.map(describirLote),
    pendiente: describirLote(pendientes[0]) || null
  };
  if (!anterior) return { ...base, disponible: false, motivo: "Todavía no hay un lote anterior aplicado para comparar." };

  const actuales = getMasterRecords();
  const cacheKey = `${activo?.codigo_lote || codigoActivo}|${meta.updated_at}|${actuales.length}|${anterior.codigo_lote}`;
  if (!cache.has(cacheKey)) {
    const cargado = await cargarLote(anterior, { pool, r2 });
    if (!cargado) return { ...base, anterior: describirLote(anterior), disponible: false, motivo: `El lote ${anterior.codigo_lote} ya no conserva sus registros para comparar.` };
    cache.clear();
    cache.set(cacheKey, { origen: cargado.origen, ...compararPadrones(cargado.records, actuales) });
  }
  const resultado = cache.get(cacheKey);
  return { ...base, anterior: { ...describirLote(anterior), origen: resultado.origen }, disponible: true, comparacion: resultado, calculado_at: new Date().toISOString() };
};
