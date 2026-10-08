// Sugerencia de técnico para una inspección según el reparto de barrios de Control
// de entregas y la ubicación de cada barrio en el mapa del SIG. Reglas puras, sin
// acceso a BD, para poder probarlas sin MySQL.

import { codigoBarrioDeClave } from "./entregasRepartoRules.js";

// backend/data/reparto-mapa.json está en unidades de 10 m (UTM 16N).
const METROS_POR_UNIDAD = 10;
export const MAX_SUGERENCIAS = 3;

const clean = (value) => String(value ?? "").trim();

// Centro aproximado de cada barrio: promedio de los vértices de sus polígonos o,
// si el barrio no tiene polígono en el SIG, su punto GPS.
export const centroidesDeBarrios = (mapa) => {
  const acumulado = new Map();
  const sumar = (codigo, x, y) => {
    const actual = acumulado.get(codigo) || { x: 0, y: 0, n: 0 };
    acumulado.set(codigo, { x: actual.x + x, y: actual.y + y, n: actual.n + 1 });
  };
  for (const poligono of mapa?.poligonos || []) {
    const codigo = clean(poligono?.codigo);
    if (!codigo) continue;
    for (const [, x, y] of String(poligono.d || "").matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)) {
      sumar(codigo, Number(x), Number(y));
    }
  }
  for (const punto of mapa?.puntos || []) {
    const codigo = clean(punto?.codigo);
    if (!codigo || acumulado.has(codigo) || !Number.isFinite(punto.x) || !Number.isFinite(punto.y)) continue;
    sumar(codigo, punto.x, punto.y);
  }
  return new Map([...acumulado].map(([codigo, { x, y, n }]) => [codigo, { x: x / n, y: y / n }]));
};

const distanciaMetros = (a, b) => Math.round((Math.hypot(a.x - b.x, a.y - b.y) * METROS_POR_UNIDAD) / 10) * 10;

// barrios: filas del reparto ({ codigo, nombre, responsable_id }).
// personal: personal de campo ({ id, nombre_completo, user_id, activo }).
// tecnicos: usuarios elegibles para inspecciones ({ id, full_name, inspecciones_activas }).
// excluirId: usuario que no se sugiere (el responsable actual al reasignar).
export const sugerirTecnicos = ({ clave, barrios = [], personal = [], tecnicos = [], centroides = new Map(), excluirId = null } = {}) => {
  const codigo = codigoBarrioDeClave(clave);
  const nombreDe = (cod) => barrios.find((fila) => fila.codigo === cod)?.nombre || `Barrio ${cod}`;
  if (!codigo) {
    return { barrio_codigo: "", barrio_nombre: "", sugerencias: [], aviso: "La clave no trae un código de barrio para buscar técnico cercano." };
  }

  const tecnicosPorId = new Map(tecnicos.map((tecnico) => [Number(tecnico.id), tecnico]));
  const tecnicoDePersona = (persona) =>
    persona && Number(persona.activo) !== 0 && persona.user_id ? tecnicosPorId.get(Number(persona.user_id)) || null : null;
  const barriosDe = (personaId) => barrios.filter((fila) => Number(fila.responsable_id) === Number(personaId));

  const origen = centroides.get(codigo);
  const candidatos = [];
  for (const persona of personal) {
    const tecnico = tecnicoDePersona(persona);
    if (!tecnico || (excluirId && Number(tecnico.id) === Number(excluirId))) continue;
    const suyos = barriosDe(persona.id);
    let mejor = null;
    if (suyos.some((fila) => fila.codigo === codigo)) {
      mejor = { distancia_m: 0, codigo };
    } else if (origen) {
      for (const fila of suyos) {
        const destino = centroides.get(fila.codigo);
        if (!destino) continue;
        const distancia_m = distanciaMetros(origen, destino);
        if (!mejor || distancia_m < mejor.distancia_m) mejor = { distancia_m, codigo: fila.codigo };
      }
    }
    if (!mejor) continue;
    candidatos.push({
      tecnico_id: Number(tecnico.id),
      nombre: tecnico.full_name || persona.nombre_completo,
      inspecciones_activas: Number(tecnico.inspecciones_activas) || 0,
      es_su_zona: mejor.distancia_m === 0 && mejor.codigo === codigo,
      distancia_m: mejor.distancia_m,
      barrio_cercano_codigo: mejor.codigo,
      barrio_cercano_nombre: nombreDe(mejor.codigo)
    });
  }
  candidatos.sort((a, b) =>
    a.distancia_m - b.distancia_m || a.inspecciones_activas - b.inspecciones_activas || a.nombre.localeCompare(b.nombre, "es"));

  const dueno = personal.find((persona) => Number(persona.id) === Number(barrios.find((fila) => fila.codigo === codigo)?.responsable_id));
  let aviso = null;
  if (dueno && !tecnicoDePersona(dueno)) {
    aviso = `${dueno.nombre_completo} tiene este barrio en el reparto, pero no tiene un usuario de inspecciones vinculado en Personal de campo.`;
  } else if (!dueno && !origen) {
    aviso = "Este barrio no está en el reparto ni en el mapa del SIG: no se puede calcular quién está más cerca.";
  } else if (!dueno) {
    aviso = "Este barrio no está en el reparto: se sugiere por cercanía.";
  }
  if (!candidatos.length && !aviso && !personal.some((persona) => tecnicoDePersona(persona))) aviso = "Ningún técnico del reparto tiene un usuario de inspecciones vinculado en Personal de campo.";

  return {
    barrio_codigo: codigo,
    barrio_nombre: nombreDe(codigo),
    sugerencias: candidatos.slice(0, MAX_SUGERENCIAS),
    aviso
  };
};
