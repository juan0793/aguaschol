import { useCallback, useEffect, useState } from "react";

// Datos de la pestaña Resumen. `mes` vacío = mes en curso (lo decide el backend en hora de Honduras).
export const useResumenInspecciones = (api, { mes = "", active = true } = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!active) return;
      if (!silent) setLoading(true);
      try {
        setData(await api.resumen(mes ? { mes } : {}));
        setError("");
      } catch (reason) {
        setError(reason.message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [active, api, mes]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!active) return undefined;
    const refresh = () => {
      if (document.visibilityState === "visible") load({ silent: true });
    };
    const timer = setInterval(refresh, 30000);
    addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      removeEventListener("visibilitychange", refresh);
    };
  }, [active, load]);

  return { data, loading, error, reload: () => load({ silent: true }) };
};
