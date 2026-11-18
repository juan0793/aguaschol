// Agrupa los barrios por técnico conservando el orden que ya trae el servidor.
export const gruposPorTecnico = (barrios = []) => {
  const grupos = [];
  for (const barrio of barrios) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.id === barrio.responsable_id) ultimo.barrios.push(barrio);
    else grupos.push({ id: barrio.responsable_id, nombre: barrio.responsable_nombre, barrios: [barrio] });
  }
  return grupos.map((grupo) => ({ ...grupo, entregados: grupo.barrios.filter((barrio) => barrio.estado === "entregado").length }));
};

// Lista del avance del mes: lo entregado y lo que falta, de todos o de un técnico.
// Lo que falta empieza por los barrios con lote abierto, que ya están en camino, y
// sigue con los que el técnico anotó para los próximos días (el más cercano primero).
const turno = (barrio) => (barrio.estado === "en_curso" ? "0" : barrio.plan?.fecha ? `1${barrio.plan.fecha}` : "2");
export const listaAvance = (barrios = [], tecnicoId = null) => {
  const delTecnico = tecnicoId == null ? barrios : barrios.filter((barrio) => barrio.responsable_id === tecnicoId);
  return {
    entregados: delTecnico.filter((barrio) => barrio.estado === "entregado"),
    faltan: delTecnico.filter((barrio) => barrio.estado !== "entregado").sort((a, b) => turno(a).localeCompare(turno(b)))
  };
};

// Barrios anotados para una fecha (de todos o de un técnico).
export const anotadosPara = (barrios = [], fecha = "") => barrios.filter((barrio) => fecha && barrio.plan?.fecha === fecha);

// Carga histórica de un barrio (documentos por ciclo). Los datos viejos del servidor
// no la traen: entonces vale cero.
export const cargaDe = (barrio) => Math.max(Number(barrio?.carga?.documentos) || 0, 0);

// La barra de carga se mide contra el barrio más pesado del reparto.
export const cargaMaxima = (barrios = []) => barrios.reduce((max, barrio) => Math.max(max, cargaDe(barrio)), 0);

export const ritmoPorTecnico = (ritmo = []) => new Map(ritmo.map((fila) => [fila.responsable_id, fila]));

// Jornadas que le toma a un técnico repartir `documentos`, en cuartos de jornada.
export const jornadasNecesarias = (documentos, ritmo) => {
  const porJornada = Number(ritmo?.documentos_por_jornada) || 0;
  if (!porJornada || !documentos) return 0;
  return Math.max(Math.round((documentos / porJornada) * 4), 1) / 4;
};

const CUARTOS = { 0: "", 1: "¼", 2: "½", 3: "¾" };
export const textoJornadas = (jornadas) => {
  if (!jornadas) return "";
  const enteras = Math.floor(jornadas);
  const cuarto = CUARTOS[Math.round((jornadas - enteras) * 4)];
  const numero = `${enteras || ""}${cuarto}` || "0";
  return `${numero} ${jornadas > 1 ? "jornadas" : "jornada"}`;
};

// Lo que le queda por repartir a un técnico (o a todos): documentos y jornadas.
export const cargaPendiente = (faltan = [], ritmo = null) => {
  const documentos = faltan.reduce((suma, barrio) => suma + cargaDe(barrio), 0);
  return { documentos, barrios: faltan.length, jornadas: jornadasNecesarias(documentos, ritmo) };
};
