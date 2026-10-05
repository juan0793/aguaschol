import { useEffect, useRef, useState } from "react";
import { formatNumber, formatPercent, tipoDocumentoLabel } from "../utils/entregasFormatters";

// Confirmación al cerrar un lote: en el celular el técnico necesita ver, sin
// buscarlo, que el cierre quedó guardado y con qué resultado. Se va sola a los
// pocos segundos (se pausa si la toca o la enfoca) o con "Listo".
const DURACION_MS = 7000;

export default function LoteCerradoAviso({ lote, onListo, onVerLote }) {
  const listoRef = useRef(null);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    listoRef.current?.focus({ preventScroll: true });
    // Un pulso corto en el teléfono confirma el cierre aunque no esté mirando la pantalla.
    try { navigator.vibrate?.(40); } catch { /* sin vibración */ }
    const cerrar = (event) => { if (event.key === "Escape") onListo(); };
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [onListo]);

  useEffect(() => {
    if (pausado) return undefined;
    const timer = setTimeout(onListo, DURACION_MS);
    return () => clearTimeout(timer);
  }, [onListo, pausado]);

  const asignadas = Number(lote.total_asignadas) || 0;
  const sobrantes = Number(lote.total_sobrantes) || 0;
  const entregadas = Number(lote.total_entregadas ?? asignadas - sobrantes) || 0;
  const efectividad = lote.efectividad ?? (asignadas ? (entregadas / asignadas) * 100 : 0);

  return (
    <div className="ent-exito-capa" role="presentation" onClick={onListo}>
      <section
        className={`ent-exito ${pausado ? "is-paused" : ""}`.trim()}
        role="status"
        aria-live="polite"
        aria-labelledby="ent-exito-titulo"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={() => setPausado(true)}
        onFocus={() => setPausado(true)}
      >
        <svg className="ent-exito-check" viewBox="0 0 52 52" aria-hidden="true" focusable="false">
          <circle cx="26" cy="26" r="24" />
          <path d="M15 27.5 22.5 35 37.5 19" />
        </svg>
        <h2 id="ent-exito-titulo">Listo, lote cerrado</h2>
        <p>Lote #{lote.id} · {lote.barrio_nombre || "Sin barrio"} · {tipoDocumentoLabel(lote.tipo_documento)}</p>
        <dl>
          <div><dt>Entregadas</dt><dd>{formatNumber(entregadas)}</dd></div>
          <div><dt>No entregadas</dt><dd>{formatNumber(sobrantes)}</dd></div>
          <div><dt>Efectividad</dt><dd>{formatPercent(efectividad)}</dd></div>
        </dl>
        <div className="ent-exito-acciones">
          <button ref={listoRef} type="button" className="cl-primary" onClick={onListo}>Listo</button>
          {onVerLote ? <button type="button" className="cl-secondary" onClick={onVerLote}>Ver lote</button> : null}
        </div>
        <i className="ent-exito-tiempo" aria-hidden="true" style={{ animationDuration: `${DURACION_MS}ms` }} />
      </section>
    </div>
  );
}
