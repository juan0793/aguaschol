import { useCallback, useEffect, useMemo, useState } from "react";
import {
  colorPorResponsable,
  metaPorPersona,
  participantesDelReparto,
  totalesPorResponsable
} from "../utils/repartoUtils";

// Estado de "Reparto por barrio": barrios con su responsable, mapa del SIG y los
// derivados (meta, totales, colores). Las asignaciones se guardan al momento y
// la lista se actualiza en sitio, sin volver a pedir todo al servidor.
export function useReparto(api, activo, personal = []) {
  const [barrios, setBarrios] = useState([]);
  const [mapa, setMapa] = useState(null);
  const [actualizadoEn, setActualizadoEn] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState("");

  const reload = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const data = await api.reparto();
      setBarrios(Array.isArray(data?.barrios) ? data.barrios : []);
      setActualizadoEn(data?.actualizado_en || null);
    } catch (err) {
      setError(err.message || "No se pudo cargar el reparto.");
    } finally {
      setCargando(false);
    }
  }, [api]);

  useEffect(() => {
    if (!activo) return;
    reload();
  }, [activo, reload]);

  // El mapa es un archivo fijo del SIG: se pide una sola vez.
  useEffect(() => {
    if (!activo || mapa) return;
    api.repartoMapa().then(setMapa).catch(() => setMapa({ poligonos: [], puntos: [], ancho: 0, alto: 0 }));
  }, [activo, api, mapa]);

  const asignar = useCallback(async (codigo, cambios) => {
    const actual = barrios.find((barrio) => barrio.codigo === codigo);
    if (!actual) return null;
    const payload = {
      responsable_id: "responsable_id" in cambios ? cambios.responsable_id || "" : actual.responsable_id || "",
      orden_ruta: "orden_ruta" in cambios ? cambios.orden_ruta || "" : actual.orden_ruta || ""
    };
    setGuardando(codigo);
    try {
      const guardado = await api.asignarBarrio(codigo, payload);
      setBarrios((lista) => lista.map((barrio) => (barrio.codigo === codigo
        ? { ...barrio, responsable_id: guardado.responsable_id, orden_ruta: guardado.orden_ruta }
        : barrio)));
      setActualizadoEn(new Date().toISOString());
      return guardado;
    } finally {
      setGuardando("");
    }
  }, [api, barrios]);

  const aplicarLote = useCallback(async (asignaciones, origen = "") => {
    setGuardando("lote");
    try {
      const resultado = await api.asignarBarrios({ asignaciones, origen });
      await reload();
      return resultado;
    } finally {
      setGuardando("");
    }
  }, [api, reload]);

  const derivados = useMemo(() => {
    const participantes = participantesDelReparto(barrios, personal);
    const { totales, sinAsignar } = totalesPorResponsable(barrios);
    return {
      participantes,
      totales,
      sinAsignar,
      colores: colorPorResponsable(participantes),
      meta: metaPorPersona(barrios, participantes)
    };
  }, [barrios, personal]);

  return { barrios, mapa, actualizadoEn, cargando, error, guardando, reload, asignar, aplicarLote, ...derivados };
}
