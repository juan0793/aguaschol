import { getMasterRecords, getMasterVersion } from "./claveLookupService.js";
import { listCandidatosSeguimiento, soloLoSuyo } from "./bancoClandestinosService.js";
import { listFichasSeguimiento } from "./inmuebleService.js";
import { claveCanonica } from "../utils/claveCanonica.js";
import { armarCasos, indicePadron, indicePorClave, resumirCasos } from "./seguimientoClandestinosRules.js";

// Seguimiento único de clandestinos: la lectura. Junta los candidatos principales del
// banco y las fichas en casos (uno por clave canónica) con las reglas de
// seguimientoClandestinosRules.js. Solo lee: no cambia candidatos ni fichas.
// Diseño: docs/DISENO_SEGUIMIENTO_CLANDESTINOS.md.

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

// Índice del padrón de Aguas por clave canónica; se rehace solo si cambia el padrón.
let padronCache = { version: undefined, indice: null };
const padronActual = () => {
  const version = getMasterVersion();
  if (padronCache.indice && padronCache.version === version) return padronCache.indice;
  padronCache = { version, indice: indicePadron(getMasterRecords()) };
  return padronCache.indice;
};

/** Todos los casos. fuentes se puede inyectar en pruebas. */
export const leerCasos = async ({ candidatos, fichas } = {}) => {
  const [filasBanco, filasFichas] = await Promise.all([
    candidatos ? Promise.resolve(candidatos) : listCandidatosSeguimiento(),
    fichas ? Promise.resolve(fichas) : listFichasSeguimiento()
  ]);
  return armarCasos(filasBanco, filasFichas);
};

/**
 * Las cifras del seguimiento para quien pregunta. Administración y Gerencia ven todo;
 * cada técnico, solo los casos de los candidatos que le asignaron.
 */
export const resumenCasos = async (user, fuentes = {}) => {
  if (!user) throw fail("Sesión requerida.", 401);
  const casos = await leerCasos(fuentes);
  const propio = soloLoSuyo(user);
  const visibles = propio ? casos.filter((caso) => caso.asignado_a != null && caso.asignado_a === Number(user.id)) : casos;
  return {
    ...resumirCasos(visibles, { padron: padronActual() }),
    alcance: propio ? "propio" : "todo",
    padron_version: getMasterVersion()
  };
};

/**
 * En qué va cada clave pedida (escrita de cualquier forma). Devuelve un Map de clave
 * canónica a su caso; las que no tienen caso no aparecen.
 */
export const estadoPorClave = async (claves = [], fuentes = {}) => {
  const pedidas = new Set((Array.isArray(claves) ? claves : []).map(claveCanonica).filter(Boolean));
  const resultado = new Map();
  if (!pedidas.size) return resultado;
  const indice = indicePorClave(await leerCasos(fuentes));
  for (const clave of pedidas) if (indice.has(clave)) resultado.set(clave, indice.get(clave));
  return resultado;
};
