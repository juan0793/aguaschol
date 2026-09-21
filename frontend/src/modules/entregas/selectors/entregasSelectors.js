// Selectors puros del modulo Control de Entregas.
// No hacen peticiones ni tocan el DOM: solo derivan datos ya cargados.

export const calculateDeliveryRate = (entregadas = 0, asignadas = 0) => {
  const base = Number(asignadas) || 0;
  if (base <= 0) return 0;
  return Math.round(((Number(entregadas) || 0) / base) * 10000) / 100;
};

export const sumLotes = (lotes = []) =>
  lotes.reduce(
    (totales, lote) => {
      const asignadas = Number(lote.total_asignadas) || 0;
      const sobrantes = Number(lote.total_sobrantes) || 0;
      return {
        lotes: totales.lotes + 1,
        asignadas: totales.asignadas + asignadas,
        sobrantes: totales.sobrantes + sobrantes,
        entregadas: totales.entregadas + Math.max(asignadas - sobrantes, 0),
        abiertos: totales.abiertos + (lote.estado === "ABIERTO" ? 1 : 0)
      };
    },
    { lotes: 0, asignadas: 0, sobrantes: 0, entregadas: 0, abiertos: 0 }
  );

const groupBy = (rows, getKey, getBase) => {
  const mapa = new Map();
  rows.forEach((row) => {
    const key = getKey(row);
    if (!mapa.has(key)) mapa.set(key, getBase(row));
    const acumulado = mapa.get(key);
    const asignadas = Number(row.total_asignadas) || 0;
    const sobrantes = Number(row.total_sobrantes) || 0;
    acumulado.lotes += 1;
    acumulado.asignadas += asignadas;
    acumulado.sobrantes += sobrantes;
    acumulado.entregadas += Math.max(asignadas - sobrantes, 0);
  });
  return [...mapa.values()]
    .map((fila) => ({ ...fila, efectividad: calculateDeliveryRate(fila.entregadas, fila.asignadas) }))
    .sort((left, right) => right.asignadas - left.asignadas);
};

export const groupByResponsible = (lotes = []) =>
  groupBy(
    lotes,
    (lote) => String(lote.responsable_id),
    (lote) => ({
      responsable_id: lote.responsable_id,
      responsable_nombre: lote.responsable_nombre || "—",
      lotes: 0,
      asignadas: 0,
      sobrantes: 0,
      entregadas: 0
    })
  );

export const groupByNeighborhood = (lotes = []) =>
  groupBy(
    lotes,
    (lote) => String(lote.barrio_codigo || lote.barrio_nombre || ""),
    (lote) => ({
      barrio_codigo: lote.barrio_codigo || "",
      barrio_nombre: lote.barrio_nombre || "Sin barrio",
      lotes: 0,
      asignadas: 0,
      sobrantes: 0,
      entregadas: 0
    })
  );

export const groupByReason = (noEntregadas = []) => {
  const mapa = new Map();
  noEntregadas.forEach((item) => {
    const key = item.motivo || "OTRO";
    if (!mapa.has(key)) mapa.set(key, { motivo: key, motivo_etiqueta: item.motivo_etiqueta || key, total: 0 });
    mapa.get(key).total += 1;
  });
  const total = noEntregadas.length;
  return [...mapa.values()]
    .map((fila) => ({ ...fila, porcentaje: total ? Math.round((fila.total / total) * 1000) / 10 : 0 }))
    .sort((left, right) => right.total - left.total);
};

export const getAttentionIndicators = (noEntregadas = [], lotes = []) => {
  const pendientes = noEntregadas.filter((item) => item.estado === "PENDIENTE");
  return {
    pendientes: pendientes.length,
    mas_3_dias: pendientes.filter((item) => Number(item.dias_pendiente) > 3).length,
    mas_7_dias: pendientes.filter((item) => Number(item.dias_pendiente) > 7).length,
    multiples_intentos: pendientes.filter((item) => Number(item.intentos) >= 2).length,
    lotes_abiertos: lotes.filter((lote) => lote.estado === "ABIERTO").length
  };
};

/* -------------------------------------------------------------------------- */
/* Avance de la jornada                                                        */
/* -------------------------------------------------------------------------- */

// Un lote aporta tres tramos excluyentes a la barra de avance:
//  - confirmadas: solo lotes ya cerrados (asignadas - sobrantes).
//  - no_entregadas: sobrantes de lotes cerrados.
//  - en_ruta: todo lo de un lote abierto, porque nada esta confirmado hasta el cierre.
// Contar un lote abierto como entregado (asignadas - 0 sobrantes) inflaria el avance
// justo cuando el tecnico todavia anda en la calle.
export const splitLoteAvance = (lote = {}) => {
  const asignadas = Math.max(Number(lote.total_asignadas) || 0, 0);
  if (lote.estado === "ABIERTO") return { asignadas, confirmadas: 0, no_entregadas: 0, en_ruta: asignadas };
  const sobrantes = Math.min(Math.max(Number(lote.total_sobrantes) || 0, 0), asignadas);
  return { asignadas, confirmadas: asignadas - sobrantes, no_entregadas: sobrantes, en_ruta: 0 };
};

const conAvance = (fila) => {
  const asignadas = Math.max(Number(fila.asignadas) || 0, 0);
  const confirmadas = Math.max(Number(fila.confirmadas) || 0, 0);
  const noEntregadas = Math.max(Number(fila.no_entregadas) || 0, 0);
  const enRuta = Math.max(asignadas - confirmadas - noEntregadas, 0);
  const lotes = Math.max(Number(fila.lotes) || 0, 0);
  const abiertos = Math.min(Math.max(Number(fila.abiertos) || 0, 0), lotes);
  return {
    ...fila,
    lotes,
    abiertos,
    cerrados: lotes - abiertos,
    asignadas,
    confirmadas,
    no_entregadas: noEntregadas,
    en_ruta: enRuta,
    avance: calculateDeliveryRate(confirmadas, asignadas),
    // Anchos de la barra apilada: siempre suman 100 cuando hay asignadas.
    tramos: {
      confirmadas: calculateDeliveryRate(confirmadas, asignadas),
      no_entregadas: calculateDeliveryRate(noEntregadas, asignadas),
      en_ruta: calculateDeliveryRate(enRuta, asignadas)
    }
  };
};

// Normaliza el `resumen` que devuelve /entregas/lotes (ya sumado en el servidor,
// asi no depende de la pagina que se este viendo) a la forma de la barra.
export const avanceDeResumen = (resumen, lotes = null) => {
  const datos = resumen || {};
  return conAvance({
    lotes: Number(lotes ?? datos.total ?? datos.lotes) || 0,
    abiertos: Number(datos.abiertos ?? datos.lotes_abiertos) || 0,
    asignadas: Number(datos.asignadas) || 0,
    confirmadas: Number(datos.entregadas) || 0,
    no_entregadas: Number(datos.sobrantes) || 0
  });
};

// Una fila por tecnico con los lotes de un solo dia. Primero quienes siguen en
// ruta -son los que hay que mirar- y dentro de cada grupo, por volumen asignado.
export const avancePorResponsable = (lotes = []) => {
  const mapa = new Map();
  lotes.forEach((lote) => {
    const key = String(lote.responsable_id ?? lote.responsable_nombre ?? "");
    if (!mapa.has(key)) {
      mapa.set(key, {
        responsable_id: lote.responsable_id ?? null,
        responsable_nombre: lote.responsable_nombre || "Sin responsable",
        barrios: [],
        // El detalle de cada lote viaja con la fila para que el avance se pueda
        // abrir en su sitio, en vez de mandar a buscarlos a la tabla de abajo.
        detalle: [],
        lotes: 0,
        abiertos: 0,
        asignadas: 0,
        confirmadas: 0,
        no_entregadas: 0
      });
    }
    const fila = mapa.get(key);
    const tramos = splitLoteAvance(lote);
    fila.detalle.push({ ...lote, avance: conAvance({ lotes: 1, abiertos: lote.estado === "ABIERTO" ? 1 : 0, ...tramos }) });
    fila.lotes += 1;
    fila.abiertos += lote.estado === "ABIERTO" ? 1 : 0;
    fila.asignadas += tramos.asignadas;
    fila.confirmadas += tramos.confirmadas;
    fila.no_entregadas += tramos.no_entregadas;
    if (lote.barrio_nombre && !fila.barrios.includes(lote.barrio_nombre)) fila.barrios.push(lote.barrio_nombre);
  });
  return [...mapa.values()]
    .map((fila) => ({
      ...conAvance(fila),
      // Dentro de una persona: primero lo que sigue abierto, que es lo que
      // reclama accion; despues por lote mas reciente.
      detalle: fila.detalle.sort((left, right) =>
        (right.estado === "ABIERTO") - (left.estado === "ABIERTO") ||
        String(right.fecha || "").localeCompare(String(left.fecha || "")) ||
        Number(right.id || 0) - Number(left.id || 0)
      )
    }))
    .sort((left, right) => (right.abiertos > 0) - (left.abiertos > 0) || right.asignadas - left.asignadas);
};

// Tendencia de un indicador frente al periodo anterior de igual longitud.
// prev=0 y current>0 se reporta como "nuevo" en vez de un porcentaje sin sentido (÷0).
export const trendDelta = (current = 0, previous = 0) => {
  const cur = Number(current) || 0;
  const prev = Number(previous) || 0;
  if (cur === prev) return { direction: "flat", label: "sin cambio" };
  if (prev === 0) return { direction: "up", label: "nuevo" };
  const pct = Math.round(((cur - prev) / prev) * 1000) / 10;
  return { direction: pct > 0 ? "up" : "down", label: `${pct > 0 ? "+" : ""}${pct}%` };
};

// Escala util para las barras del grafico "entregadas vs no entregadas por día".
export const scaleSeries = (rows = [], keys = []) => {
  const max = Math.max(1, ...rows.flatMap((row) => keys.map((key) => Number(row[key]) || 0)));
  return rows.map((row) => ({
    ...row,
    _escala: Object.fromEntries(keys.map((key) => [key, Math.round(((Number(row[key]) || 0) / max) * 1000) / 10]))
  }));
};

// Agrupa por lote los documentos sobrantes que devuelve /entregas/no-entregadas,
// para armar el acta consolidada. El backend ya filtra a lotes cerrados; aca
// solo se ordena y se arma la cabecera de cada recorrido.
export const groupSobrantesByLote = (rows = []) => {
  const grupos = new Map();
  for (const fila of rows) {
    const clave = Number(fila?.lote_id || 0);
    if (!clave) continue;
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        lote_id: clave,
        fecha: fila.fecha_lote || "",
        tipo_documento: fila.tipo_documento || "",
        barrio_codigo: fila.barrio_codigo || "",
        barrio_nombre: fila.barrio_nombre || "",
        responsable_nombre: fila.responsable_nombre || "",
        documentos: []
      });
    }
    grupos.get(clave).documentos.push(fila);
  }
  for (const grupo of grupos.values()) {
    grupo.documentos.sort((a, b) =>
      // Los sin nombre capturado cierran la lista, no la abren.
      (a.abonado_nombre ? 0 : 1) - (b.abonado_nombre ? 0 : 1) ||
      String(a.abonado_nombre || "").localeCompare(String(b.abonado_nombre || ""), "es") ||
      Number(a.id || 0) - Number(b.id || 0)
    );
  }
  return [...grupos.values()].sort((a, b) =>
    String(a.fecha).localeCompare(String(b.fecha)) || a.lote_id - b.lote_id
  );
};
