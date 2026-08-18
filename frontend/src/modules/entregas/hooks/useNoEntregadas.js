import { useCallback, useMemo } from "react";
import { useEntregasList } from "./useEntregasList.js";

const FILTROS_INICIALES = {
  numero_abonado: "",
  clave_catastral: "",
  barrio_codigo: "",
  responsable_id: "",
  tipo_documento: "",
  motivo: "",
  estado: "PENDIENTE",
  fecha_desde: "",
  fecha_hasta: "",
  dias_minimos: ""
};

export const useNoEntregadas = (api, active = true) => {
  const fetcher = useCallback((params) => api.noEntregadas(params), [api]);
  return useEntregasList({
    fetcher,
    storageKey: "aguas.entregas.noentregadas.v1",
    defaultFilters: useMemo(() => ({ ...FILTROS_INICIALES }), []),
    active
  });
};

export const NO_ENTREGADAS_FILTROS_INICIALES = FILTROS_INICIALES;
