// Reglas de pantalla de "Barrios por prioridad". El orden y el nivel vienen del
// servidor (entregasPrioridadRules.js); aquí se filtra, se agrupa y se escriben
// los textos que comparten la pantalla, la hoja impresa y el PDF.

export const NIVELES = Object.freeze({ alta: "Alta", media: "Media", baja: "Baja" });
export const ESTADOS_PRIORIDAD = Object.freeze({ en_curso: "Lote abierto", pendiente: "Pendiente" });

export const CRITERIOS = Object.freeze([
  { valor: "combinado", titulo: "Prioridad combinada", descripcion: "Lote abierto y anotado para la próxima jornada primero; después más días sin entrega y más mora; a igualdad, la ruta." },
  { valor: "dias", titulo: "Más días sin entrega", descripcion: "Desde el último lote cerrado en ese barrio." },
  { valor: "mora", titulo: "Mayor mora", descripcion: "Intereses atrasados del padrón en el barrio.", soloConMora: true },
  { valor: "carga", titulo: "Más carga", descripcion: "Documentos por ciclo (promedio de los últimos ciclos)." },
  { valor: "ruta", titulo: "Orden de ruta", descripcion: "Por técnico, en el orden de su reparto." }
]);

export const criteriosPara = (conMora) => CRITERIOS.filter((criterio) => conMora || !criterio.soloConMora);
// Sin permiso de ver montos, la descripción no habla de la mora.
export const descripcionCriterio = (valor, conMora = true) => {
  if (valor === "combinado" && !conMora) return "Lote abierto y anotado para la próxima jornada primero; después más días sin entrega; a igualdad, la ruta.";
  return CRITERIOS.find((criterio) => criterio.valor === valor)?.descripcion || "";
};
export const tituloCriterio = (valor) => CRITERIOS.find((criterio) => criterio.valor === valor)?.titulo || CRITERIOS[0].titulo;

// tecnicoId null = todos. sinAbiertos deja fuera los barrios con lote abierto.
export const filtrarPrioridad = (barrios = [], { tecnicoId = null, sinAbiertos = false } = {}) => barrios.filter((barrio) =>
  (tecnicoId == null || Number(barrio.responsable_id) === Number(tecnicoId))
  && (!sinAbiertos || barrio.estado !== "en_curso"));

// Grupos por técnico en el orden en que aparece cada uno en la lista ya ordenada.
export const agruparPorTecnico = (barrios = []) => {
  const grupos = new Map();
  for (const barrio of barrios) {
    const id = barrio.responsable_id ?? "sin";
    if (!grupos.has(id)) grupos.set(id, { id, nombre: barrio.responsable_nombre || "Sin nombre", barrios: [], documentos: 0 });
    const grupo = grupos.get(id);
    grupo.barrios.push(barrio);
    grupo.documentos += Number(barrio.carga?.documentos) || 0;
  }
  return [...grupos.values()];
};

export const resumenPrioridad = (barrios = []) => ({
  barrios: barrios.length,
  documentos: barrios.reduce((suma, barrio) => suma + (Number(barrio.carga?.documentos) || 0), 0),
  alta: barrios.filter((barrio) => barrio.nivel === "alta").length,
  media: barrios.filter((barrio) => barrio.nivel === "media").length,
  baja: barrios.filter((barrio) => barrio.nivel === "baja").length,
  en_curso: barrios.filter((barrio) => barrio.estado === "en_curso").length,
  mora: Math.round(barrios.reduce((suma, barrio) => suma + (Number(barrio.mora?.mora) || 0), 0) * 100) / 100
});

// "≈1,240" con historial; "~1,285" si la carga se estima con las claves del padrón.
export const textoCarga = (barrio, formatear = String) => {
  const documentos = Number(barrio?.carga?.documentos) || 0;
  if (!documentos) return "—";
  return `${barrio.carga.fuente === "historial" ? "≈" : "~"}${formatear(documentos)}`;
};

export const textoMotivos = (barrio) => (barrio?.motivos || []).join(" · ");

export const textoUltimaEntrega = (barrio) => {
  if (!barrio?.ultima_entrega) return "Sin entregas registradas";
  const [anio, mes, dia] = barrio.ultima_entrega.split("-");
  return `Última entrega: ${dia}/${mes}/${anio}`;
};

// Línea con lo que la hoja aplica, para que el papel diga qué se filtró.
export const textoFiltros = ({ criterio, tecnicoNombre = "", sinAbiertos = false, agrupar = false } = {}) => [
  `Orden: ${tituloCriterio(criterio).toLowerCase()}`,
  tecnicoNombre ? `Técnico: ${tecnicoNombre}` : "",
  sinAbiertos ? "Sin los barrios con lote abierto" : "",
  agrupar ? "Agrupado por técnico" : ""
].filter(Boolean).join(" · ");
