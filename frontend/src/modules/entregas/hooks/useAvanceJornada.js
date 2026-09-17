import { useCallback, useEffect, useRef, useState } from "react";
import { addDaysIso } from "../utils/entregasDate.js";

// Datos de la barra de avance. Va aparte del listado a proposito: la barra
// siempre habla de la jornada de hoy, sin importar que rango tenga puesto la
// tabla. Son dos llamadas al mismo endpoint de lotes:
//  - hoy: los lotes del dia (se necesitan uno por uno para la fila del tecnico).
//  - anterior: solo el `resumen` ya sumado por el servidor (limit 1), porque de
//    lo anterior interesa el acumulado, no el desglose dia por dia.
const LIMITE_LOTES_HOY = 100;

export const useAvanceJornada = (api, { activo = true, fecha = "", desdeAnterior = "" } = {}) => {
  const [data, setData] = useState({ lotesHoy: [], resumenHoy: null, totalHoy: 0, anterior: null, totalAnterior: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!activo || !fecha) return;
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const [hoy, anterior] = await Promise.all([
        api.lotes({ fecha_desde: fecha, fecha_hasta: fecha, limit: LIMITE_LOTES_HOY }),
        api.lotes({ fecha_desde: desdeAnterior, fecha_hasta: addDaysIso(fecha, -1), limit: 1 })
      ]);
      if (id !== requestId.current) return; // respuesta obsoleta
      setData({
        lotesHoy: hoy.items || [],
        resumenHoy: hoy.resumen || null,
        totalHoy: Number(hoy.total) || 0,
        anterior: anterior.resumen || null,
        totalAnterior: Number(anterior.total) || 0
      });
    } catch (reason) {
      if (id === requestId.current) setError(reason.message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [activo, api, desdeAnterior, fecha]);

  useEffect(() => { load(); }, [load]);

  return { ...data, desdeAnterior, loading, error, reload: load };
};
