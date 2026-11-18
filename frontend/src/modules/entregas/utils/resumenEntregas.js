// Reglas del Resumen de Entregas para la oficina: cómo va cada técnico hoy y quién
// todavía no anotó qué barrio trabaja en la próxima jornada.

const nombreDe = (barrio) => barrio?.responsable_nombre || "Sin nombre";

// Técnicos con barrios que faltan (pendiente o lote abierto) y sin ningún barrio
// anotado para la próxima jornada.
export const sinPlanParaManana = (mes) => {
  if (!mes?.barrios?.length || !mes.proxima_jornada) return [];
  const porTecnico = new Map();
  for (const barrio of mes.barrios) {
    const id = Number(barrio.responsable_id);
    const fila = porTecnico.get(id) || { id, nombre: nombreDe(barrio), faltan: 0, anotados: 0 };
    if (barrio.estado !== "entregado") fila.faltan += 1;
    if (barrio.plan?.fecha === mes.proxima_jornada) fila.anotados += 1;
    porTecnico.set(id, fila);
  }
  return [...porTecnico.values()]
    .filter((fila) => fila.faltan > 0 && fila.anotados === 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
};

// Una fila por técnico del reparto (y por quien tenga lote hoy aunque no esté en
// él): sus lotes de hoy y lo que anotó para la próxima jornada.
export const equipoHoy = ({ barrios = [], lotesHoy = [], proxima = "" } = {}) => {
  const filas = new Map();
  const asegurar = (id, nombre) => {
    const clave = Number(id);
    if (!filas.has(clave)) filas.set(clave, { id: clave, nombre: nombre || "Sin nombre", lotes: [], abiertos: 0, cerrados: 0, asignadas: 0, entregadas: 0, manana: [], faltan: 0 });
    return filas.get(clave);
  };
  for (const barrio of barrios) {
    const fila = asegurar(barrio.responsable_id, nombreDe(barrio));
    if (barrio.estado !== "entregado") fila.faltan += 1;
    if (proxima && barrio.plan?.fecha === proxima) fila.manana.push(barrio.nombre);
  }
  for (const lote of lotesHoy) {
    if (lote.responsable_id == null) continue;
    const fila = asegurar(lote.responsable_id, lote.responsable_nombre);
    const asignadas = Number(lote.total_asignadas) || 0;
    const abierto = lote.estado === "ABIERTO";
    fila.lotes.push({ id: lote.id, barrio: lote.barrio_nombre || "Sin barrio", abierto, asignadas, entregadas: abierto ? null : Math.max(asignadas - (Number(lote.total_sobrantes) || 0), 0) });
    if (abierto) fila.abiertos += 1;
    else {
      fila.cerrados += 1;
      fila.entregadas += Math.max(asignadas - (Number(lote.total_sobrantes) || 0), 0);
    }
    fila.asignadas += asignadas;
  }
  const estado = (fila) => (fila.abiertos ? "abierto" : fila.cerrados ? "cerrado" : "sin_lote");
  const orden = { abierto: 0, cerrado: 1, sin_lote: 2 };
  return [...filas.values()]
    // Quien no tiene nada que hacer en el ciclo ni lote hoy no ocupa lugar.
    .filter((fila) => fila.lotes.length || fila.faltan)
    .map((fila) => ({ ...fila, estado: estado(fila) }))
    .sort((a, b) => orden[a.estado] - orden[b.estado] || a.nombre.localeCompare(b.nombre, "es"));
};

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const diaCorto = (iso) => DIAS[new Date(`${iso}T12:00:00`).getDay()];

// "lun–mié de la semana pasada" cuando la semana va a medias.
export const textoComparacion = (periodoAnterior) => {
  if (!periodoAnterior?.fecha_inicio || !periodoAnterior?.fecha_fin) return "";
  const desde = diaCorto(periodoAnterior.fecha_inicio);
  const hasta = diaCorto(periodoAnterior.fecha_fin);
  if (periodoAnterior.parcial) return desde === hasta ? `frente al ${desde} de la semana pasada` : `frente a ${desde}–${hasta} de la semana pasada`;
  return "frente al periodo anterior";
};
