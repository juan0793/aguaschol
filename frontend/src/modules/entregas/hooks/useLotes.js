import { useCallback, useMemo } from "react";
import { useEntregasList } from "./useEntregasList.js";

const FILTROS_INICIALES = {
  q: "",
  estado: "",
  tipo_documento: "",
  barrio_codigo: "",
  responsable_id: "",
  fecha_desde: "",
  fecha_hasta: ""
};

export const useLotes = (api, active = true) => {
  const fetcher = useCallback((params) => api.lotes(params), [api]);
  return useEntregasList({
    fetcher,
    storageKey: "aguas.entregas.lotes.v1",
    defaultFilters: useMemo(() => ({ ...FILTROS_INICIALES }), []),
    active
  });
};

export const LOTES_FILTROS_INICIALES = FILTROS_INICIALES;
