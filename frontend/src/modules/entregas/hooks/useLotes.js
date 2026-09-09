import { useCallback, useMemo } from "react";
import { useEntregasList } from "./useEntregasList.js";
import { addDaysIso, toLocalIsoDate } from "../utils/entregasDate.js";

// Dos bandejas con la misma tabla pero distinto encuadre: la diaria abre en la
// jornada de hoy y el historial en todo lo anterior. Cada una recuerda sus
// propios filtros, para que entrar al historial no borre lo que estabas mirando.
const crearFiltrosIniciales = (historial = false) => {
  const hoy = toLocalIsoDate();
  return {
    q: "",
    estado: "",
    tipo_documento: "",
    barrio_codigo: "",
    responsable_id: "",
    fecha_desde: historial ? "" : hoy,
    fecha_hasta: historial ? addDaysIso(hoy, -1) : hoy
  };
};

export const useLotes = (api, active = true, { historial = false } = {}) => {
  const fetcher = useCallback((params) => api.lotes(params), [api]);
  return useEntregasList({
    fetcher,
    storageKey: historial ? "aguas.entregas.lotes-historial.v1" : "aguas.entregas.lotes.v2",
    defaultFilters: useMemo(() => crearFiltrosIniciales(historial), [historial]),
    active
  });
};

export const LOTES_FILTROS_INICIALES = crearFiltrosIniciales();
