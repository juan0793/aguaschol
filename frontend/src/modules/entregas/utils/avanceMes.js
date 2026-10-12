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
