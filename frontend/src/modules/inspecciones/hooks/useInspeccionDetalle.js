import { useCallback, useEffect, useState } from "react";

export const useInspeccionDetalle = (api, id) => {
  const [inspeccion, setInspeccion] = useState(null);
  const [gpsPuntos, setGpsPuntos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [detail, puntos] = await Promise.all([api.detail(id), api.gps(id)]);
      setInspeccion(detail);
      setGpsPuntos(puntos);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }, [api, id]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { inspeccion, gpsPuntos, loading, error, reload };
};
