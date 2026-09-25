// Reglas puras del reparto de barrios de Control de Entregas: agrupan el padron
// por codigo de barrio y validan las asignaciones. Sin acceso a BD para poder
// probarlas sin MySQL.

import { fail, toEntero } from "./entregasRules.js";

const clean = (value) => String(value ?? "").trim();

// El codigo de barrio es el primer segmento de la clave catastral (01-02-03-04 -> 01).
// "00" agrupa claves sin barrio real en el padron, asi que no entra al reparto.
export const codigoBarrioDeClave = (clave) => {
  const codigo = clean(clave).split("-")[0];
  return /^\d{1,4}$/.test(codigo) && Number(codigo) > 0 ? codigo : "";
};

// Las formas largas van primero: "RES" tambien es el inicio de "RESIDENCIAL".
const PREFIJOS = [
  [/^BARRIO\s+/i, "Bo. "],
  [/^COLONIA\s+/i, "Col. "],
  [/^RESIDENCIAL\s+/i, "Res. "],
  [/^LOTIFICACION\s+/i, "Lot. "],
  [/^LOTIFICADORA\s+/i, "Lot. "],
  [/^BO(\.\s*|\s+)/i, "Bo. "],
  [/^COL(\.\s*|\s+)/i, "Col. "],
  [/^RES(\.\s*|\s+)/i, "Res. "],
  [/^LOT(\.\s*|\s+)/i, "Lot. "]
];
const MINUSCULAS = new Set(["de", "del", "y", "a", "la", "las", "los", "el"]);

// "BO.  SAN  JUAN BOSCO" -> "Bo. San Juan Bosco". Solo para barrios que no estan
// en el catalogo de codigos; el catalogo manda cuando existe.
export const nombreBarrioLegible = (texto) => {
  let nombre = clean(texto).replace(/\s+/g, " ");
  if (!nombre) return "";
  let prefijo = "";
  for (const [patron, corto] of PREFIJOS) {
    if (patron.test(nombre)) { prefijo = corto; nombre = nombre.replace(patron, ""); break; }
  }
  const palabras = nombre.toLowerCase().split(" ").map((palabra, indice) =>
    indice > 0 && MINUSCULAS.has(palabra) ? palabra : palabra.charAt(0).toUpperCase() + palabra.slice(1)
  );
  return prefijo + palabras.join(" ").replace(/\bIi\b/g, "II").replace(/\bIii\b/g, "III");
};

// Cuenta claves por codigo de barrio y elige el nombre mas repetido del padron
// para ese codigo (un mismo codigo aparece con variantes: "BO. EL CENTRO", ...).
export const agruparPadronPorBarrio = (registros = []) => {
  const grupos = new Map();
  for (const registro of registros) {
    const codigo = codigoBarrioDeClave(registro?.clave_catastral);
    if (!codigo) continue;
    const grupo = grupos.get(codigo) || { codigo, claves: 0, nombres: new Map() };
    grupo.claves += 1;
    const nombre = clean(registro?.barrio_colonia);
    if (nombre) grupo.nombres.set(nombre, (grupo.nombres.get(nombre) || 0) + 1);
    grupos.set(codigo, grupo);
  }
  return [...grupos.values()].map(({ codigo, claves, nombres }) => {
    const [masComun = ""] = [...nombres.entries()].sort((a, b) => b[1] - a[1])[0] || [];
    return { codigo, claves, nombre_padron: masComun };
  });
};

const ordenCodigo = (a, b) => Number(a.codigo) - Number(b.codigo) || a.codigo.localeCompare(b.codigo);

// Une padron, catalogo de codigos y asignaciones guardadas en una sola lista.
// Aparecen todos los barrios con claves y, ademas, los del catalogo o asignados
// aunque hoy no tengan claves, para no perder una asignacion al recargar el padron.
export const armarReparto = ({ padron = [], catalogo = [], asignaciones = [] } = {}) => {
  const porCodigo = new Map();
  const asegurar = (codigo) => {
    if (!porCodigo.has(codigo)) porCodigo.set(codigo, { codigo, nombre: "", claves: 0, responsable_id: null, orden_ruta: null });
    return porCodigo.get(codigo);
  };
  for (const grupo of padron) {
    const fila = asegurar(grupo.codigo);
    fila.claves = grupo.claves;
    fila.nombre = nombreBarrioLegible(grupo.nombre_padron);
  }
  for (const item of catalogo) {
    const codigo = clean(item.codigo);
    if (!codigo || item.activo === false) continue;
    // Solo nombra barrios que ya existen por padron o asignacion: el catalogo trae
    // codigos historicos sin claves que no le sirven al reparto.
    if (porCodigo.has(codigo)) porCodigo.get(codigo).nombre = clean(item.barrio) || porCodigo.get(codigo).nombre;
  }
  for (const asignacion of asignaciones) {
    const codigo = clean(asignacion.barrio_codigo);
    if (!codigo) continue;
    const fila = asegurar(codigo);
    fila.responsable_id = asignacion.responsable_id ? Number(asignacion.responsable_id) : null;
    fila.orden_ruta = asignacion.orden_ruta ? Number(asignacion.orden_ruta) : null;
    if (!fila.nombre) fila.nombre = catalogo.find((item) => clean(item.codigo) === codigo)?.barrio || `Barrio ${codigo}`;
  }
  return [...porCodigo.values()].map((fila) => ({ ...fila, nombre: fila.nombre || `Barrio ${fila.codigo}` })).sort(ordenCodigo);
};

// Normaliza una asignacion recibida por la API. responsable_id vacio = quitar
// responsable (el barrio queda sin asignar).
export const normalizarAsignacion = (payload = {}, codigoRuta = "") => {
  const codigo = clean(codigoRuta || payload.barrio_codigo);
  if (!/^\d{1,4}$/.test(codigo)) throw fail("El código de barrio no es válido.");
  const responsableTexto = clean(payload.responsable_id);
  const responsable_id = responsableTexto ? toEntero(responsableTexto) : null;
  if (responsableTexto && !(responsable_id > 0)) throw fail("El responsable indicado no es válido.");
  const ordenTexto = clean(payload.orden_ruta);
  const orden_ruta = ordenTexto ? toEntero(ordenTexto) : null;
  if (ordenTexto && !(orden_ruta >= 1 && orden_ruta <= 999)) throw fail("El orden de ruta debe ser un número entre 1 y 999.");
  return { barrio_codigo: codigo, responsable_id, orden_ruta };
};

export const MAX_ASIGNACIONES_POR_LOTE = 400;
