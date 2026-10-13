import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Icon } from "../components/Icon";
import { FALLAS_CAMBIARON, haceCuanto, tipoFalla } from "../utils/fallasFormato";
import "./fallas.css";

const REVISAR_MS = 60000;

// Icono de fallas del equipo para administración y Gerencia: tenue sin pendientes, rojo con
// su contador cuando algo del equipo no se pudo guardar. Abre las últimas y lleva a la pantalla.
export default function FallasIndicator({ apiFetch, onOpenView }) {
  const [data, setData] = useState({ items: [], sin_revisar: 0 });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const cargar = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const response = await apiFetch("/fallas?limit=6");
      if (!response.ok) return;
      const body = await response.json();
      setData({ items: body.items || [], sin_revisar: Number(body.sin_revisar || 0) });
    } catch { /* sin conexión: se reintenta en la siguiente vuelta */ }
  }, [apiFetch]);

  useEffect(() => {
    cargar();
    const timer = window.setInterval(cargar, REVISAR_MS);
    document.addEventListener("visibilitychange", cargar);
    window.addEventListener(FALLAS_CAMBIARON, cargar);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", cargar); window.removeEventListener(FALLAS_CAMBIARON, cargar); };
  }, [cargar]);

  useEffect(() => {
    if (!open) return undefined;
    const cerrar = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", cerrar);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", cerrar); document.removeEventListener("keydown", escape); };
  }, [open]);

  const pendientes = data.sin_revisar;
  const ir = () => { setOpen(false); onOpenView("fallas"); };
  return <div className="fi" ref={ref}>
    <button type="button" className={`fi-button${pendientes ? " has-fallas" : ""}`} onClick={() => setOpen((value) => !value)} aria-haspopup="dialog" aria-expanded={open}
      aria-label={pendientes ? `Fallas del equipo: ${pendientes} sin revisar` : "Fallas del equipo: ninguna pendiente"} title={pendientes ? `${pendientes} fallas sin revisar` : "Sin fallas pendientes"}>
      <AlertTriangle size={18} strokeWidth={1.9} aria-hidden="true" />
      {pendientes ? <b key={pendientes}>{pendientes > 99 ? "99+" : pendientes}</b> : null}
    </button>
    {open ? <section className="fi-panel" role="dialog" aria-label="Fallas del equipo">
      <header>
        <h2>Fallas del equipo</h2>
        <p>{pendientes ? `${pendientes} sin revisar` : "Nada pendiente de revisar"}</p>
      </header>
      {!data.items.length ? <p className="fi-empty">Todo lo que el equipo envió se guardó bien.</p> : <ul>
        {data.items.map((falla) => {
          const tipo = tipoFalla(falla.tipo);
          return <li key={falla.id}><button type="button" onClick={ir}>
            <span className={`fi-dot is-${tipo.tono}`} aria-hidden="true" />
            <span className="fi-text"><strong>{falla.accion}</strong><span>{falla.user_nombre} · {tipo.label}{falla.veces > 1 ? ` · ${falla.veces} veces` : ""}</span></span>
            <span className="fi-time">{haceCuanto(falla.ocurrido_en)}</span>
          </button></li>;
        })}
      </ul>}
      <footer><button type="button" onClick={ir}>Ver todas las fallas<Icon name="arrowRight" /></button></footer>
    </section> : null}
  </div>;
}
