import { queryInspecciones, INSPECCION_STATES } from "./inspeccionesService.js";

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const isAdmin = (user) => user?.role === "admin";

const GROUP_BY_OPTIONS = ["tecnico", "barrio", "motivo", "estado", "periodo"];

const emptyCounts = () => Object.fromEntries([...INSPECCION_STATES.map((estado) => [estado, 0]), ["total", 0]]);

const periodoKey = (fechaAsignacion) => String(fechaAsignacion ?? "").slice(0, 7) || "sin-fecha";

const applyPeriodoFilter = (items, periodo) => {
  if (!periodo || periodo === "todo") return items;
  const now = new Date();
  const cutoff = new Date(now);
  if (periodo === "mes") cutoff.setMonth(now.getMonth() - 1);
  else if (periodo === "trimestre") cutoff.setMonth(now.getMonth() - 3);
  else if (periodo === "anio") cutoff.setFullYear(now.getFullYear() - 1);
  else return items;
  return items.filter((item) => new Date(item.fecha_asignacion) >= cutoff);
};

const groupKeyFor = (item, agrupar) => {
  if (agrupar === "tecnico") return item.tecnico_responsable_nombre || "Sin responsable";
  if (agrupar === "barrio") return item.barrio_snapshot || "Sin barrio";
  if (agrupar === "motivo") return item.motivo || "Sin motivo";
  if (agrupar === "estado") return item.estado;
  if (agrupar === "periodo") return periodoKey(item.fecha_asignacion);
  return "Total";
};

export const getInspeccionesStats = async (params = {}, user) => {
  if (!isAdmin(user)) throw fail("Solo administración puede consultar estadísticas.", 403);
  const agrupar = GROUP_BY_OPTIONS.includes(params.agrupar) ? params.agrupar : "tecnico";
  const all = applyPeriodoFilter(
    await queryInspecciones({ estado: params.estado, tecnico_id: params.tecnico, barrio: params.barrio, motivo: params.motivo }, user),
    params.periodo
  );

  const groups = new Map();
  all.forEach((item) => {
    const key = groupKeyFor(item, agrupar);
    const current = groups.get(key) ?? { key, ...emptyCounts() };
    current[item.estado] = (current[item.estado] ?? 0) + 1;
    current.total += 1;
    groups.set(key, current);
  });

  const rows = Array.from(groups.values()).sort((a, b) => b.total - a.total || a.key.localeCompare(b.key, "es"));

  const finalizadasConTiempo = all.filter((item) => item.estado === "FINALIZADA" && item.fecha_finalizacion && item.fecha_asignacion);
  const tiempoPromedioHoras = finalizadasConTiempo.length
    ? Number(
        (
          finalizadasConTiempo.reduce((sum, item) => sum + (new Date(item.fecha_finalizacion) - new Date(item.fecha_asignacion)), 0) /
          finalizadasConTiempo.length /
          (1000 * 60 * 60)
        ).toFixed(1)
      )
    : 0;

  const reincidenciasPorClave = Array.from(
    all.reduce((map, item) => {
      map.set(item.clave_catastral, (map.get(item.clave_catastral) || 0) + 1);
      return map;
    }, new Map())
  )
    .filter(([, total]) => total > 1)
    .map(([clave_catastral, total]) => ({ clave_catastral, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  return {
    agrupar,
    rows,
    resumen: {
      total_inspecciones: all.length,
      tiempo_promedio_asignacion_finalizacion_horas: tiempoPromedioHoras,
      en_seguimiento: all.filter((item) => item.estado === "SEGUIMIENTO").length,
      reincidencias_por_clave: reincidenciasPorClave
    }
  };
};

// --- Tablero anual -----------------------------------------------------------
// El eje temporal del tablero es SIEMPRE fecha_asignacion (cuando se programó la
// inspección); los conteos por estado son el estado ACTUAL de esas mismas
// inspecciones. Son dos cosas distintas y la UI las declara: sin eso, la barra de
// un mes y su desglose por estado no se pueden reconciliar.

const partesFecha = (valor) => {
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    return { anio: String(valor.getFullYear()), mes: valor.getMonth() + 1 };
  }
  const texto = String(valor ?? "");
  const match = texto.match(/^(\d{4})-(\d{2})/);
  if (match) return { anio: match[1], mes: Number(match[2]) };
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : { anio: String(fecha.getFullYear()), mes: fecha.getMonth() + 1 };
};
const anioDe = (valor) => partesFecha(valor)?.anio || "";
const mesDe = (valor) => partesFecha(valor)?.mes || 0;
const horasEntre = (desde, hasta) => (new Date(hasta) - new Date(desde)) / 3600000;
const diasDesde = (valor, ahora) => Math.floor((ahora - new Date(valor)) / 86400000);

// Reparte 100 puntos por mayor residuo. Redondear cada porcentaje por separado
// hace que la leyenda sume 101% y que los anchos de la barra apilada dejen de ser
// proporcionales a los números impresos al lado.
export const repartirPorcentajes = (valores, total) => {
  if (!total) return valores.map(() => 0);
  const exactos = valores.map((valor) => (valor * 100) / total);
  const piso = exactos.map((valor) => Math.floor(valor));
  const porOrden = exactos
    .map((valor, index) => ({ index, resto: valor - Math.floor(valor) }))
    .sort((a, b) => b.resto - a.resto || a.index - b.index);

  const salida = piso.slice();
  let pendiente = 100 - piso.reduce((suma, valor) => suma + valor, 0);
  for (let i = 0; i < porOrden.length && pendiente > 0; i += 1) {
    salida[porOrden[i].index] += 1;
    pendiente -= 1;
  }
  return salida;
};

const resumenDelMes = (items, ahora) => {
  const enSeguimiento = items.filter((item) => item.estado === "SEGUIMIENTO");
  const finalizadas = items.filter((item) => item.estado === "FINALIZADA" && item.fecha_finalizacion && item.fecha_asignacion);

  const clavesRepetidas = Array.from(
    items.reduce((mapa, item) => mapa.set(item.clave_catastral, (mapa.get(item.clave_catastral) || 0) + 1), new Map())
  ).filter(([, total]) => total > 1);

  const porTecnico = items.reduce(
    (mapa, item) => mapa.set(item.tecnico_responsable_nombre || "Sin responsable", (mapa.get(item.tecnico_responsable_nombre || "Sin responsable") || 0) + 1),
    new Map()
  );

  return {
    seguimiento_dias_mas_antiguo: enSeguimiento.length
      ? Math.max(...enSeguimiento.map((item) => diasDesde(item.fecha_asignacion, ahora)))
      : 0,
    claves_repetidas: clavesRepetidas.length,
    tiempo_promedio_horas: finalizadas.length
      ? Number((finalizadas.reduce((suma, item) => suma + horasEntre(item.fecha_asignacion, item.fecha_finalizacion), 0) / finalizadas.length).toFixed(1))
      : 0,
    tecnicos: Array.from(porTecnico, ([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, "es"))
      .slice(0, 3)
  };
};

export const getInspeccionesTablero = async (params = {}, user) => {
  if (!isAdmin(user)) throw fail("Solo administración puede consultar estadísticas.", 403);

  const todas = await queryInspecciones({}, user);
  const ahora = new Date();
  const anioActual = String(ahora.getFullYear());
  const aniosConDatos = todas.map((item) => anioDe(item.fecha_asignacion)).filter((anio) => anio.length === 4);
  const aniosDisponibles = Array.from(new Set([anioActual, ...aniosConDatos])).sort().reverse();
  const anio = aniosDisponibles.includes(String(params.anio)) ? String(params.anio) : anioActual;

  const delAnio = todas.filter((item) => anioDe(item.fecha_asignacion) === anio);
  // Sólo el año en curso tiene meses futuros; en un año pasado ninguno lo es.
  const mesEnCurso = anio === anioActual ? ahora.getMonth() + 1 : 0;

  const meses = Array.from({ length: 12 }, (unused, indice) => {
    const mes = indice + 1;
    const items = delAnio.filter((item) => mesDe(item.fecha_asignacion) === mes);
    const conteos = INSPECCION_STATES.map((estado) => items.filter((item) => item.estado === estado).length);
    const porcentajes = repartirPorcentajes(conteos, items.length);

    return {
      mes,
      clave: `${anio}-${String(mes).padStart(2, "0")}`,
      total: items.length,
      futuro: mesEnCurso > 0 && mes > mesEnCurso,
      en_curso: mes === mesEnCurso,
      estados: INSPECCION_STATES.map((estado, posicion) => ({
        estado,
        total: conteos[posicion],
        porcentaje: porcentajes[posicion]
      })),
      ...resumenDelMes(items, ahora)
    };
  });

  return { anio, anios_disponibles: aniosDisponibles, mes_en_curso: mesEnCurso, meses };
};
