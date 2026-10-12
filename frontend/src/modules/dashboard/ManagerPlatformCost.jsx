import { useEffect, useState } from "react";
import { readCycle } from "./platformCost.js";

// Consumo del ciclo en Railway para el indicador de Gerencia.
export function usePlatformCost(apiFetch) {
  const [state, setState] = useState({ loading: true, summary: null, error: "" });
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await apiFetch("/railway/summary");
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "No se pudo consultar Railway.");
        if (active) setState({ loading: false, summary: body, error: "" });
      } catch (error) {
        if (active) setState({ loading: false, summary: null, error: error.message || "No se pudo consultar Railway." });
      }
    })();
    return () => { active = false; };
  }, [apiFetch]);
  return { ...state, cycle: state.summary ? readCycle(state.summary) : null };
}
