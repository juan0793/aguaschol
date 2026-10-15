// Reglas puras de los reclamos de entrega: buscar al abonado en el padron, decidir
// que tecnico responde por esa entrega y validar lo que llega por la API. Sin BD,
// para probarlas sin MySQL.

import { codigoBarrioDeClave } from "./entregasRepartoRules.js";
import { fail, toEntero } from "./entregasRules.js";

const clean = (value) => String(value ?? "").trim();
const soloDigitos = (value) => clean(value).replace(/\D/g, "");

export const MOTIVOS_RECLAMO = [
  { codigo: "NO_LLEGO", etiqueta: "No le llegó" },
  { codigo: "OTRA_CASA", etiqueta: "La dejaron en otra casa" },
  { codigo: "TARDE", etiqueta: "Le llegó tarde" },
  { codigo: "DANADA", etiqueta: "Llegó dañada o mojada" },
  { codigo: "OTRO", etiqueta: "Otro" }
];
const CODIGOS_MOTIVO = new Set(MOTIVOS_RECLAMO.map((motivo) => motivo.codigo));

export const ESTADOS_RECLAMO = ["SIN_RESPUESTA", "RESPONDIDO", "CERRADO"];
export const MAX_COINCIDENCIAS = 8;
export const MAX_CANTIDAD = 24;

// Una clave lleva guiones o tiene 3-4 bloques; un abonado son solo digitos. Con solo
// digitos primero se busca como abonado y, si no aparece, como clave sin guiones.
export const buscarEnPadron = (registros = [], texto = "", normalizarClave = (valor) => valor) => {
  const entrada = clean(texto);
  if (!entrada) throw fail("Escribe la clave catastral o el número de abonado.");
  const digitos = soloDigitos(entrada);
  if (!digitos) throw fail("La clave o el abonado deben llevar números.");

  const porAbonado = () => registros.filter((item) => soloDigitos(item?.abonado) === digitos);
  const porClave = () => {
    let clave;
    try { clave = normalizarClave(entrada); } catch { return { clave: "", coincidencias: [] }; }
    const exacta = clave.split("-").length === 4;
    return {
      clave,
      coincidencias: registros.filter((item) => (exacta ? item?.clave_catastral === clave : item?.clave_base === clave))
    };
  };

  if (!entrada.includes("-")) {
    const abonados = porAbonado();
    if (abonados.length) return { campo: "abonado", consulta: digitos, coincidencias: abonados };
  }
  const { clave, coincidencias } = porClave();
  if (coincidencias.length || clave) return { campo: "clave", consulta: clave || entrada, coincidencias };
  return { campo: "abonado", consulta: digitos, coincidencias: [] };
};

// Datos del abonado que viajan al reclamo y a la pantalla. Nunca la deuda.
export const resumirAbonado = (registro = {}) => ({
  clave_catastral: clean(registro.clave_catastral),
  numero_abonado: clean(registro.abonado),
  abonado_nombre: clean(registro.inquilino || registro.nombre),
  barrio_colonia: clean(registro.barrio_colonia),
  barrio_codigo: codigoBarrioDeClave(registro.clave_catastral)
});

// Quien responde por la entrega: quien entrego ese barrio en el ciclo (el lote mas
// reciente, primero los ya cerrados) y, si no hay lote, quien lo tiene en el reparto.
// lotes: [{ id, fecha, estado, responsable_id, tipo_documento }]
export const elegirResponsable = ({ lotes = [], repartoResponsableId = null, tipoDocumento = "" } = {}) => {
  const delTipo = tipoDocumento ? lotes.filter((lote) => lote.tipo_documento === tipoDocumento) : [];
  const candidatos = delTipo.length ? delTipo : lotes;
  const ordenados = [...candidatos].sort((a, b) => {
    const cerradoA = a.estado === "ABIERTO" ? 0 : 1;
    const cerradoB = b.estado === "ABIERTO" ? 0 : 1;
    if (cerradoA !== cerradoB) return cerradoB - cerradoA;
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
    return toEntero(b.id) - toEntero(a.id);
  });
  const lote = ordenados[0];
  if (lote?.responsable_id) return { origen: "LOTE", responsable_id: toEntero(lote.responsable_id), lote_id: toEntero(lote.id) };
  if (repartoResponsableId) return { origen: "REPARTO", responsable_id: toEntero(repartoResponsableId), lote_id: null };
  return { origen: "NINGUNO", responsable_id: null, lote_id: null };
};

const texto = (value, max) => clean(value).slice(0, max);

export const normalizarReclamo = (payload = {}) => {
  const clave = texto(payload.clave_catastral, 30);
  const abonado = texto(payload.numero_abonado, 80);
  if (!clave && !abonado) throw fail("El reclamo necesita la clave catastral o el número de abonado.");
  const motivo = clean(payload.motivo).toUpperCase();
  if (!CODIGOS_MOTIVO.has(motivo)) throw fail("Elige el motivo del reclamo.");
  const detalle = texto(payload.detalle, 1000);
  if (motivo === "OTRO" && detalle.length < 5) throw fail("Con el motivo «Otro», cuenta qué pasó (mínimo 5 caracteres).");
  const tipo = clean(payload.tipo_documento).toUpperCase() || "FACTURA";
  if (!["FACTURA", "NOTA_COBRO"].includes(tipo)) throw fail("El tipo de documento no es válido.");
  const cantidad = payload.cantidad === undefined || payload.cantidad === "" ? 1 : toEntero(payload.cantidad);
  if (!(cantidad >= 1 && cantidad <= MAX_CANTIDAD)) throw fail(`La cantidad debe ser de 1 a ${MAX_CANTIDAD} documentos.`);
  const responsableTexto = clean(payload.responsable_id);
  const responsable_id = responsableTexto ? toEntero(responsableTexto) : null;
  if (responsableTexto && !(responsable_id > 0)) throw fail("El técnico indicado no es válido.");
  return {
    clave_catastral: clave,
    numero_abonado: abonado,
    tipo_documento: tipo,
    cantidad,
    motivo,
    detalle,
    responsable_id
  };
};

export const normalizarRespuesta = (payload = {}) => {
  const respuesta = texto(payload.respuesta, 1000);
  if (respuesta.length < 5) throw fail("Escribe qué pasó con la entrega (mínimo 5 caracteres).");
  return respuesta;
};

// Llave del periodo de una fecha en hora de Honduras: "2026-10-15", "2026-10" o "2026".
const PARTES_HN = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa", year: "numeric", month: "2-digit", day: "2-digit" });
export const periodoDe = (fecha, agrupar = "dia") => {
  const instante = fecha instanceof Date ? fecha : new Date(fecha);
  if (!fecha || Number.isNaN(instante.getTime())) return "";
  const dia = PARTES_HN.format(instante);
  return agrupar === "anio" ? dia.slice(0, 4) : agrupar === "mes" ? dia.slice(0, 7) : dia;
};

// [{ periodo, total }] del más reciente al más antiguo.
export const contarPorPeriodo = (fechas = [], agrupar = "dia") => {
  const conteo = new Map();
  for (const fecha of fechas) {
    const periodo = periodoDe(fecha, agrupar);
    if (periodo) conteo.set(periodo, (conteo.get(periodo) || 0) + 1);
  }
  return [...conteo].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([periodo, total]) => ({ periodo, total }));
};

export const etiquetaMotivo = (codigo) => MOTIVOS_RECLAMO.find((motivo) => motivo.codigo === codigo)?.etiqueta || codigo;

// A quién avisa la campana al registrar un reclamo: al responsable (si tiene usuario)
// y a todo el equipo de campo, una vez por persona y nunca a quien lo registró.
// tecnicos: [{ id }] usuarios activos de campo.
export const armarAvisosReclamo = ({ reclamo, responsableUserId = null, tecnicos = [], autorId = null } = {}) => {
  const quien = [
    reclamo.numero_abonado ? `abonado ${reclamo.numero_abonado}` : "",
    reclamo.clave_catastral ? `(${reclamo.clave_catastral})` : ""
  ].filter(Boolean).join(" ") || "sin clave";
  const documentos = reclamo.tipo_documento === "NOTA_COBRO"
    ? `${reclamo.cantidad} ${reclamo.cantidad === 1 ? "nota de cobro" : "notas de cobro"}`
    : `${reclamo.cantidad} ${reclamo.cantidad === 1 ? "factura" : "facturas"}`;
  const resumen = `${quien}${reclamo.barrio_nombre ? `, ${reclamo.barrio_nombre}` : ""} · ${reclamo.motivo_etiqueta} · ${documentos}`;
  const nombre = reclamo.responsable?.nombre;
  const responsable = toEntero(responsableUserId) || null;
  const destinos = new Map();
  if (responsable && responsable !== toEntero(autorId)) {
    destinos.set(responsable, `Reclamo de entrega para ti: ${resumen}. Escribe qué pasó en Reclamos de entrega.`);
  }
  const paraEquipo = nombre
    ? `Nuevo reclamo de entrega para ${nombre}${responsable ? "" : " (no tiene usuario en la app)"}: ${resumen}.`
    : `Nuevo reclamo de entrega sin técnico asignado: ${resumen}.`;
  for (const tecnico of tecnicos) {
    const id = toEntero(tecnico?.id);
    if (!id || id === toEntero(autorId) || destinos.has(id)) continue;
    destinos.set(id, paraEquipo);
  }
  return [...destinos].map(([recipient_user_id, body]) => ({ recipient_user_id, body: body.slice(0, 2000) }));
};
