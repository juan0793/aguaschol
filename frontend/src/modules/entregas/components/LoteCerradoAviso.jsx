import { useEffect, useRef, useState } from "react";
import { formatNumber, formatPercent, tipoDocumentoLabel } from "../utils/entregasFormatters";
import { PlanManana, usePlanBarrios } from "./PlanBarrios";

// Confirmación al cerrar un lote: en el celular el técnico necesita ver, sin
// buscarlo, que el cierre quedó guardado y con qué resultado. Se va sola a los
// pocos segundos (se pausa si la toca o la enfoca) o con "Listo".
// Si el responsable tiene barrios en el reparto, pregunta cuáles trabajará en la
// próxima jornada; mientras pregunta no se cierra sola ni al tocar fuera, y lo
// principal es guardar: "Ahora no" queda como enlace. Si lo salta, lo puede anotar
// después desde Hoy (y la oficina desde el Resumen).
const DURACION_MS = 7000;

export default function LoteCerradoAviso({ lote, api, notify, onListo, onVerLote, onPlanGuardado }) {
  const listoRef = useRef(null);
  const [pausado, setPausado] = useState(false);
  const { plan, elegidos, setElegidos, anotados, cambiado, guardando, error, guardar } = usePlanBarrios({ api, responsableId: lote.responsable_id, loteId: lote.id, notify });
  const esperando = pausado || Boolean(plan);

  useEffect(() => {
    listoRef.current?.focus({ preventScroll: true });
    // Un pulso corto en el teléfono confirma el cierre aunque no esté mirando la pantalla.
    try { navigator.vibrate?.(40); } catch { /* sin vibración */ }
  }, []);

  // Cuando llega la pregunta del plan, el foco pasa al primer barrio para elegir.
  const conPlan = Boolean(plan);
  useEffect(() => {
    if (conPlan) document.querySelector(".ent-exito .ent-plan-barrio")?.focus({ preventScroll: true });
  }, [conPlan]);

  useEffect(() => {
    const cerrar = (event) => { if (event.key === "Escape" && !guardando) onListo(); };
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [onListo, guardando]);

  useEffect(() => {
    if (esperando) return undefined;
    const timer = setTimeout(onListo, DURACION_MS);
    return () => clearTimeout(timer);
  }, [onListo, esperando]);

  const alGuardar = async () => {
    if (await guardar()) { onPlanGuardado?.(); onListo(); }
  };

  const asignadas = Number(lote.total_asignadas) || 0;
  const sobrantes = Number(lote.total_sobrantes) || 0;
  const entregadas = Number(lote.total_entregadas ?? asignadas - sobrantes) || 0;
  const efectividad = lote.efectividad ?? (asignadas ? (entregadas / asignadas) * 100 : 0);

  return (
    // Mientras pregunta el plan, tocar fuera no lo cierra: era la forma más fácil de saltarlo.
    <div className="ent-exito-capa" role="presentation" onClick={() => { if (!plan && !guardando) onListo(); }}>
      <section
        className={`ent-exito ${esperando ? "is-paused" : ""}${plan ? " con-plan" : ""}`.trim()}
        role={plan ? "dialog" : "status"}
        aria-modal={plan ? "true" : undefined}
        aria-live={plan ? undefined : "polite"}
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
        {plan ? <PlanManana plan={plan} elegidos={elegidos} onCambiar={setElegidos} /> : null}
        {error ? <p className="ent-plan-error" role="alert">{error}</p> : null}
        <div className="ent-exito-acciones">
          {plan ? (
            <button ref={listoRef} type="button" className="cl-primary" onClick={cambiado ? alGuardar : onListo} disabled={guardando || (!cambiado && !anotados.length)}>
              {guardando ? "Guardando…" : cambiado ? (elegidos.length ? "Guardar plan" : "Borrar plan") : anotados.length ? "Listo" : "Guardar plan"}
            </button>
          ) : (
            <button ref={listoRef} type="button" className="cl-primary" onClick={onListo}>Listo</button>
          )}
          {onVerLote ? <button type="button" className="cl-secondary" onClick={onVerLote} disabled={guardando}>Ver lote</button> : null}
        </div>
        {plan && !anotados.length ? (
          <button type="button" className="ent-plan-saltar" onClick={onListo} disabled={guardando}>Ahora no, lo anoto después</button>
        ) : null}
        <i className="ent-exito-tiempo" aria-hidden="true" style={{ animationDuration: `${DURACION_MS}ms` }} />
      </section>
    </div>
  );
}
