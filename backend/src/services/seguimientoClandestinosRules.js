import { claveCanonica, loteDeClave } from "../utils/claveCanonica.js";

// Seguimiento único de clandestinos: reglas puras (sin base de datos).
// Diseño: docs/DISENO_SEGUIMIENTO_CLANDESTINOS.md.
//
// Un caso es una clave catastral canónica. Tiene dos mitades que no se pisan: el
// candidato del banco manda hasta que se envía a ficha y, desde ahí, manda la ficha.
// Aquí está la única definición de en qué va un caso y de qué cuenta como pendiente o
// resuelto; las pantallas no deben calcularlo por su cuenta.

export const ESTADOS_CASO = ["por_revisar", "por_depurar", "en_ficha", "regularizado", "descartado", "en_aguas"];
// pendiente: falta trabajo de campo u oficina. aparte: "Verificar" lo saca del banco.
export const GRUPO_DE_ESTADO = {
  por_revisar: "pendiente",
  en_ficha: "pendiente",
  por_depurar: "aparte",
  regularizado: "resuelto",
  descartado: "resuelto",
  en_aguas: "resuelto"
};
export const ETAPAS_ABIERTAS = ["draft", "pending", "visit", "confirmed", "regularization"];

const MOTIVO_AUTOMATICO = /^Aparece en Aguas \(verificación automática\)/;

// Quién descartó un candidato: una persona ("manual"), la verificación contra el padrón
// ("en_aguas") o la agrupación de la misma clave ("copia"). Mientras no exista la
// columna descarte_tipo (paso 4 del diseño) se deduce de lo que ya se guarda.
export const tipoDescarte = (candidato = {}) => {
  if (candidato.estado !== "descartado") return "";
  if (candidato.descarte_tipo) return candidato.descarte_tipo;
  if (candidato.duplicado_de != null) return "copia";
  return MOTIVO_AUTOMATICO.test(String(candidato.motivo_descarte || "")) ? "en_aguas" : "manual";
};

/**
 * En qué va un caso, a partir de su candidato principal y su ficha (cualquiera puede
 * faltar). Si hay ficha, manda la ficha; archivarla no cambia su etapa.
 * Devuelve null si no hay caso (ni ficha ni candidato, o el candidato es una copia).
 */
export const casoDe = (candidato = null, ficha = null) => {
  if (ficha) {
    const etapa = ficha.estado_operativo || "pending";
    const estado = etapa === "regularized" ? "regularizado" : etapa === "discarded" ? "descartado" : "en_ficha";
    return { estado, grupo: GRUPO_DE_ESTADO[estado], etapa, archivada: Boolean(ficha.archived_at), sin_ficha: false };
  }
  if (!candidato) return null;
  const base = { etapa: null, archivada: false, sin_ficha: false };
  if (candidato.estado === "pendiente") {
    const estado = candidato.dictamen === "registrado" ? "por_depurar" : "por_revisar";
    return { ...base, estado, grupo: GRUPO_DE_ESTADO[estado] };
  }
  if (candidato.estado === "descartado") {
    const tipo = tipoDescarte(candidato);
    if (tipo === "copia") return null;
    const estado = tipo === "en_aguas" ? "en_aguas" : "descartado";
    return { ...base, estado, grupo: GRUPO_DE_ESTADO[estado] };
  }
  // Enviado a ficha y la ficha ya no existe (se eliminó): el caso queda descartado y la
  // clave no vuelve al banco (decisión 2 del diseño).
  return { ...base, estado: "descartado", grupo: "resuelto", sin_ficha: true };
};

// Entre varios candidatos de un mismo caso, el que lo representa: el que llegó más lejos
// (enviado, luego descartado), el asignado y, a igualdad, el más antiguo.
const AVANCE = { enviado: 2, descartado: 1, pendiente: 0 };
const representante = (candidatos) => [...candidatos].sort((a, b) =>
  (AVANCE[b.estado] ?? 0) - (AVANCE[a.estado] ?? 0)
  || Number(b.asignado_a != null) - Number(a.asignado_a != null)
  || Number(a.id) - Number(b.id))[0];

/**
 * Une candidatos principales y fichas en casos, uno por clave canónica.
 * candidatos: filas del banco que no son copia (duplicado_de nulo).
 * fichas: todas las fichas, también las archivadas.
 * Un candidato se une a su ficha por inmueble_id y, si no, por clave. Sin clave (o
 * devuelto con "no es duplicado" y sin ficha) es un caso por sí solo.
 */
export const armarCasos = (candidatos = [], fichas = []) => {
  const fichaPorId = new Map();
  const fichaPorClave = new Map();
  const fichasDeClave = new Map();
  for (const ficha of fichas) {
    const clave = ficha.clave_norm || claveCanonica(ficha.clave_catastral);
    const item = { ...ficha, id: Number(ficha.id), clave_norm: clave };
    fichaPorId.set(item.id, item);
    if (clave) fichasDeClave.set(clave, (fichasDeClave.get(clave) || 0) + 1);
    // Dos fichas de la misma clave (escritas distinto): manda la activa y, entre iguales, la más antigua.
    const previa = fichaPorClave.get(clave);
    if (clave && (!previa || (previa.archived_at && !item.archived_at))) fichaPorClave.set(clave, item);
  }

  const grupos = new Map();
  const agregar = (llave, parte) => {
    const grupo = grupos.get(llave) || { llave, ficha: null, candidatos: [] };
    if (parte.ficha) grupo.ficha = parte.ficha;
    if (parte.candidato) grupo.candidatos.push(parte.candidato);
    grupos.set(llave, grupo);
  };
  // La llave de una ficha: su clave canónica; si no se puede leer, la ficha misma.
  const llaveDeFicha = (ficha) => ficha.clave_norm || `ficha:${ficha.id}`;

  for (const fila of candidatos) {
    if (fila.duplicado_de != null) continue;
    const candidato = { ...fila, id: Number(fila.id), clave_catastral: String(fila.clave_catastral || "") };
    const clave = candidato.clave_catastral;
    const ficha = (candidato.inmueble_id != null && fichaPorId.get(Number(candidato.inmueble_id))) || (clave && fichaPorClave.get(clave)) || null;
    if (ficha) agregar(llaveDeFicha(ficha), { candidato });
    else if (clave && !Number(candidato.no_duplicado)) agregar(clave, { candidato });
    else agregar(`punto:${candidato.id}`, { candidato });
  }
  for (const ficha of fichaPorId.values()) {
    // Una segunda ficha de la misma clave no abre otro caso: se cuenta en el aviso.
    const principal = ficha.clave_norm ? fichaPorClave.get(ficha.clave_norm) : ficha;
    if (principal === ficha) agregar(llaveDeFicha(ficha), { ficha });
  }

  const casos = [];
  for (const grupo of grupos.values()) {
    const candidato = grupo.candidatos.length ? representante(grupo.candidatos) : null;
    const estado = casoDe(candidato, grupo.ficha);
    if (!estado) continue;
    const clave = grupo.ficha?.clave_norm || candidato?.clave_catastral || "";
    casos.push({
      llave: grupo.llave,
      clave,
      lote: clave ? loteDeClave(clave) : "",
      ...estado,
      ficha_id: grupo.ficha ? grupo.ficha.id : null,
      candidato_id: candidato ? candidato.id : null,
      candidatos: grupo.candidatos.length,
      // Lo que el diseño corrige en los pasos 3 y 4: candidatos que siguen pendientes
      // aunque la clave ya tiene ficha, y fichas repetidas de una misma clave.
      pendientes_con_ficha: grupo.ficha ? grupo.candidatos.filter((item) => item.estado === "pendiente").length : 0,
      fichas: grupo.ficha ? fichasDeClave.get(grupo.ficha.clave_norm) || 1 : 0,
      asignado_a: candidato?.asignado_a == null ? null : Number(candidato.asignado_a),
      dictamen: candidato?.dictamen || "",
      motivo: !grupo.ficha && candidato?.estado === "descartado" ? String(candidato.motivo_descarte || "") : ""
    });
  }
  return casos;
};

// ¿La clave ya aparece en Aguas? La misma regla del dictamen: coincidencia exacta o,
// si la clave es de 3 bloques, cualquier cuenta de ese lote. Una clave de 4 bloques
// (unidad) solo coincide con ella misma.
export const indicePadron = (registros = []) => {
  const exactas = new Set();
  const lotes = new Set();
  for (const registro of registros) {
    const clave = claveCanonica(registro.clave_catastral);
    if (!clave) continue;
    exactas.add(clave);
    lotes.add(loteDeClave(clave));
  }
  return { exactas, lotes };
};
export const apareceEnAguas = (clave, indice) => {
  if (!clave || !indice) return false;
  return indice.exactas.has(clave) || (clave.split("-").length === 3 && indice.lotes.has(clave));
};

const ceros = (keys) => Object.fromEntries(keys.map((key) => [key, 0]));

/**
 * Las cifras de todas las pantallas. Pendiente = por revisar + en ficha.
 * Resuelto = regularizado + descartado + ya en Aguas. "Por depurar" va aparte.
 * padron: índice de indicePadron (opcional) para avisar de fichas abiertas que ya
 * aparecen en Aguas.
 */
export const resumirCasos = (casos = [], { padron = null } = {}) => {
  const estados = ceros(ESTADOS_CASO);
  const etapas = ceros(ETAPAS_ABIERTAS);
  const resumen = {
    total: casos.length,
    pendiente: 0,
    resuelto: 0,
    aparte: 0,
    estados,
    por_revisar: { total: 0, sin_asignar: 0, asignados: 0, sin_clave: 0 },
    etapas,
    avisos: { fichas_archivadas_abiertas: 0, fichas_eliminadas: 0, fichas_abiertas_en_aguas: 0, casos_con_varios_candidatos: 0, pendientes_con_ficha: 0, claves_con_varias_fichas: 0 }
  };
  for (const caso of casos) {
    estados[caso.estado] += 1;
    resumen[caso.grupo] += 1;
    if (caso.estado === "por_revisar") {
      resumen.por_revisar.total += 1;
      resumen.por_revisar[caso.asignado_a == null ? "sin_asignar" : "asignados"] += 1;
      if (!caso.clave) resumen.por_revisar.sin_clave += 1;
    }
    if (caso.estado === "en_ficha") {
      if (caso.etapa in etapas) etapas[caso.etapa] += 1;
      if (caso.archivada) resumen.avisos.fichas_archivadas_abiertas += 1;
      if (apareceEnAguas(caso.clave, padron)) resumen.avisos.fichas_abiertas_en_aguas += 1;
    }
    if (caso.sin_ficha) resumen.avisos.fichas_eliminadas += 1;
    if (caso.candidatos > 1) resumen.avisos.casos_con_varios_candidatos += 1;
    resumen.avisos.pendientes_con_ficha += caso.pendientes_con_ficha || 0;
    if (caso.fichas > 1) resumen.avisos.claves_con_varias_fichas += 1;
  }
  return resumen;
};

// En qué va cada clave: Map clave canónica -> caso. Si un punto devuelto con "no es
// duplicado" comparte la clave, manda el caso de la clave, no el del punto suelto.
export const indicePorClave = (casos = []) => {
  const indice = new Map();
  for (const caso of casos) {
    if (!caso.clave) continue;
    if (!indice.has(caso.clave) || caso.llave === caso.clave) indice.set(caso.clave, caso);
  }
  return indice;
};
