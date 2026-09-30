// Agrupa la actividad del equipo por trabajo: lo que una misma persona hizo sobre
// el mismo registro (misma ficha, inspección, lote…) en pocos minutos va en una sola
// línea. "Ficha creada" + "Banco → ficha" + "Observaciones" de 42-46-02 = un trabajo.
export const VENTANA_MIN = 30;
const CLAVE_RE = /\b\d{2,3}-\d{2}-\d{2}(?:-\d{2})?\b/;

// Frase corta de cada acción dentro de un trabajo agrupado.
const FRASES = {
  "banco_clandestinos.sent_to_ficha": "pasó del banco a ficha",
  "banco_clandestinos.discarded": "descartó del banco",
  "banco_clandestinos.restored": "devolvió al banco",
  "inmueble.created": "creó la ficha",
  "inmueble.updated": "actualizó datos",
  "inmueble.internal_notes_updated": "escribió observaciones",
  "inmueble.state_changed": "cambió la etapa",
  "inmueble.printed": "imprimió",
  "inmueble.photo_attached": "agregó foto",
  "inmueble.archived": "archivó",
  "inmueble.restored": "restauró",
  "inspeccion.created": "creó la inspección",
  "inspeccion.gps_registered": "registró GPS",
  "inspeccion.details_updated": "actualizó detalles",
  "inspeccion.state_changed": "cambió el estado",
  "inspeccion.finalized": "finalizó la inspección",
  "technical_report.created": "reportó hallazgo",
  "technical_report.evidence_added": "agregó evidencia",
  "map_point.created": "creó punto GPS",
  "map_point.updated": "actualizó punto GPS",
  "map_point.validated": "validó punto GPS",
  DOCUMENTO_REENTREGADO: "entregó documento",
  INTENTO_REGISTRADO: "registró intento",
  LOTE_CERRADO: "cerró el lote"
};
export const fraseDe = (item) => FRASES[item.action] || item.summary;

// Sobre qué registro fue la acción: la ficha, inspección o lote; sin registro no se agrupa.
const claveDe = (item) => String(item.summary || "").match(CLAVE_RE)?.[0] || "";
const registroDe = (item) => {
  const id = String(item.entity_id ?? "");
  if (item.entity_type && id && id !== "0") return `${item.entity_type}:${id}`;
  const clave = claveDe(item);
  return clave ? `clave:${clave}` : "";
};
const tituloDe = (item) => {
  const clave = claveDe(item);
  if (clave) return clave;
  if (item.entity_type === "inspeccion") return `Inspección #${item.entity_id}`;
  if (item.entity_type === "entrega") return `Lote #${item.entity_id}`;
  return "";
};

/**
 * items: actividad de la más reciente a la más vieja. Devuelve trabajos con
 * { id, actor, titulo, items (del más reciente al más viejo), final, enlace, desde, hasta }.
 * Un trabajo de una sola acción conserva su resumen completo.
 */
export const agruparActividad = (items = [], ventanaMin = VENTANA_MIN) => {
  const ventana = ventanaMin * 60000;
  const trabajos = [];
  const abiertos = new Map();
  for (const item of items) {
    const registro = registroDe(item);
    const llave = registro ? `${item.actor_id}|${registro}` : "";
    const tiempo = new Date(item.created_at).getTime();
    const abierto = llave ? abiertos.get(llave) : null;
    if (abierto && abierto.ultimoTiempo - tiempo <= ventana) {
      abierto.items.push(item);
      abierto.ultimoTiempo = tiempo;
      abierto.desde = item.created_at;
      if (item.final) abierto.final = true;
      if (!abierto.enlace && item.enlace) abierto.enlace = item.enlace;
      if (!abierto.titulo) abierto.titulo = tituloDe(item);
      continue;
    }
    const trabajo = { id: `t-${item.id}`, actor_id: item.actor_id, actor_name: item.actor_name, categoria: item.categoria, titulo: tituloDe(item), items: [item], final: Boolean(item.final), enlace: item.enlace || null, hasta: item.created_at, desde: item.created_at, ultimoTiempo: tiempo };
    trabajos.push(trabajo);
    if (llave) abiertos.set(llave, trabajo);
  }
  return trabajos;
};

// Texto del trabajo: la acción que cierra primero y luego las demás, sin repetir.
export const resumenTrabajo = (trabajo) => {
  if (trabajo.items.length === 1) return trabajo.items[0].summary;
  const ordenadas = [...trabajo.items].reverse();
  // Si pasó del banco a ficha, "creó la ficha" sobra: es la misma acción vista desde la ficha.
  const desdeBanco = ordenadas.some((item) => item.action === "banco_clandestinos.sent_to_ficha");
  const utiles = ordenadas.filter((item) => !(desdeBanco && item.action === "inmueble.created"));
  const frases = [...new Set([...utiles.filter((item) => item.final), ...utiles.filter((item) => !item.final)].map(fraseDe))];
  return frases.join(" · ");
};
