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
// Lo que falta empieza por los barrios con lote abierto, que ya están en camino.
export const listaAvance = (barrios = [], tecnicoId = null) => {
  const delTecnico = tecnicoId == null ? barrios : barrios.filter((barrio) => barrio.responsable_id === tecnicoId);
  return {
    entregados: delTecnico.filter((barrio) => barrio.estado === "entregado"),
    faltan: delTecnico.filter((barrio) => barrio.estado !== "entregado").sort((a, b) => (a.estado === "en_curso" ? 0 : 1) - (b.estado === "en_curso" ? 0 : 1))
  };
};
