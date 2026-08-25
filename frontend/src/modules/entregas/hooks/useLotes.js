import { useCallback, useMemo } from "react";
import { useEntregasList } from "./useEntregasList.js";
import { toLocalIsoDate } from "../utils/entregasDate.js";

const crearFiltrosIniciales = () => {
  const hoy = toLocalIsoDate();
  return {
    q: "",
    estado: "",
    tipo_documento: "",
    barrio_codigo: "",
    responsable_id: "",
    fecha_desde: hoy,
    fecha_hasta: hoy
  };
};

export const useLotes = (api, active = true) => {
  const fetcher = useCallback((params) => api.lotes(params), [api]);
  return useEntregasList({
    fetcher,
    storageKey: "aguas.entregas.lotes.v2",
    defaultFilters: useMemo(() => crearFiltrosIniciales(), []),
    active
  });
};

export const LOTES_FILTROS_INICIALES = crearFiltrosIniciales();
