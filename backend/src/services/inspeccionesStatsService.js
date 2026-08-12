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
