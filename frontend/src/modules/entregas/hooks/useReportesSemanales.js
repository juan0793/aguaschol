import { useCallback, useEffect, useState } from "react";

// Historico de informes semanales. Se carga bajo demanda; el detalle siempre
// viene del snapshot guardado, nunca se recalcula en el navegador.
export const useReportesSemanales = (api, active = true) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.reportes({ limit: 40 });
      setItems(data.items || []);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }, [active, api]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, error, reload: load };
};
