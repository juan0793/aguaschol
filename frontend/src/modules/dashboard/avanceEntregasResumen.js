// Resumen del avance de entregas para el contador del Tablero. Parte de lo que
// devuelve /entregas/avance-mes; todo lo que falte vale cero.
const entero = (valor) => Math.max(0, Math.round(Number(valor) || 0));
const parte = (cuanto, total) => (total ? (cuanto / total) * 100 : 0);

export const resumenEntregas = (mes) => {
  if (!mes) return null;
  const barrios = Array.isArray(mes.barrios) ? mes.barrios : [];
  const total = entero(mes.total ?? barrios.length);
  const entregados = entero(mes.entregados);
  const enCurso = entero(mes.en_curso);
  const pendientes = Math.max(0, total - entregados - enCurso);

  // Un renglón por técnico, en el orden del servidor (por nombre).
  const porTecnico = new Map();
  for (const barrio of barrios) {
    const fila = porTecnico.get(barrio.responsable_id) || {
      id: barrio.responsable_id, nombre: barrio.responsable_nombre || "Sin nombre",
      total: 0, entregados: 0, enCurso: 0, facturas: 0
    };
    fila.total += 1;
    if (barrio.estado === "entregado") fila.entregados += 1;
    if (barrio.estado === "en_curso") fila.enCurso += 1;
    fila.facturas += entero(barrio.entregadas);
    porTecnico.set(barrio.responsable_id, fila);
  }
  const tecnicos = [...porTecnico.values()].map((fila) => ({
    ...fila,
    parteEntregada: parte(fila.entregados, fila.total),
    parteEnCurso: parte(fila.enCurso, fila.total)
  }));

  const hoy = mes.hoy || {};
  return {
    desde: mes.desde || "",
    cicloDeclarado: Boolean(mes.ciclo_declarado),
    facturas: entero(mes.documentos_entregados),
    total, entregados, enCurso, pendientes,
    porcentaje: Math.round(parte(entregados, total) * 10) / 10,
    parteEntregada: parte(entregados, total),
    parteEnCurso: parte(enCurso, total),
    tecnicos,
    hoy: { lotes: entero(hoy.lotes), abiertos: entero(hoy.abiertos), entregadas: entero(hoy.entregadas) },
    // Hay reparto en la calle si hoy quedó algún lote abierto.
    enVivo: entero(hoy.abiertos) > 0
  };
};

// "1 barrio" / "3 barrios".
export const plural = (cuanto, uno, varios) => `${Number(cuanto).toLocaleString("es-HN")} ${cuanto === 1 ? uno : varios}`;
