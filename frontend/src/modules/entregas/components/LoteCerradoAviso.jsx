import { useEffect, useRef, useState } from "react";
import { formatNumber, formatPercent, tipoDocumentoLabel } from "../utils/entregasFormatters";
import { cargaDe, textoJornadas } from "../utils/avanceMes.js";
import { mismoPlan, opcionesPlan, resumenPlan, textoFechaPlan } from "../utils/planBarrios.js";

// Confirmación al cerrar un lote: en el celular el técnico necesita ver, sin
// buscarlo, que el cierre quedó guardado y con qué resultado. Se va sola a los
// pocos segundos (se pausa si la toca o la enfoca) o con "Listo".
// Si el responsable tiene barrios en el reparto, pregunta cuáles trabajará en la
// próxima jornada; mientras pregunta no se cierra sola.
const DURACION_MS = 7000;

function PlanManana({ plan, elegidos, onCambiar }) {
  const opciones = opcionesPlan(plan.barrios);
  const resumen = resumenPlan(elegidos, plan.barrios, plan.ritmo);
  const cuando = textoFechaPlan(plan.fecha, plan.hoy);
  const pregunta = plan.propio ? `¿Qué barrio trabajas ${cuando}?` : `¿Qué barrio trabaja ${plan.responsable.nombre} ${cuando}?`;
  const alternar = (codigo) => onCambiar(elegidos.includes(codigo) ? elegidos.filter((item) => item !== codigo) : [...elegidos, codigo]);

  return (
    <fieldset className="ent-plan">
      <legend>{pregunta}</legend>
      <small className="ent-plan-ayuda">Puedes marcar varios. Así la oficina ve qué viene en el avance del mes.</small>
      <div className="ent-plan-opciones">
        {opciones.map((barrio) => {
          const marcado = elegidos.includes(barrio.codigo);
          const documentos = cargaDe(barrio);
          return (
            <button key={barrio.codigo} type="button" className={`ent-plan-barrio${marcado ? " is-marcado" : ""}`} aria-pressed={marcado} onClick={() => alternar(barrio.codigo)}>
              <strong>{barrio.nombre}</strong>
              <small>
                {barrio.estado === "en_curso" ? "Lote abierto" : barrio.estado === "entregado" ? "Ya entregado" : "Pendiente"}
                {documentos ? ` · ${barrio.carga?.fuente === "historial" ? "≈" : "~"}${formatNumber(documentos)} doc.` : ""}
              </small>
            </button>
          );
        })}
      </div>
      <p className="ent-plan-total" aria-live="polite">
        {elegidos.length
          ? <>≈{formatNumber(resumen.documentos)} documentos{resumen.jornadas ? <> · <strong>{textoJornadas(resumen.jornadas)}</strong></> : null}{resumen.pista ? ` · ${resumen.pista}` : ""}</>
          : "Ningún barrio marcado."}
      </p>
    </fieldset>
  );
}

export default function LoteCerradoAviso({ lote, api, notify, onListo, onVerLote }) {
  const listoRef = useRef(null);
  const [pausado, setPausado] = useState(false);
  const [plan, setPlan] = useState(null);
  const [elegidos, setElegidos] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listoRef.current?.focus({ preventScroll: true });
    // Un pulso corto en el teléfono confirma el cierre aunque no esté mirando la pantalla.
    try { navigator.vibrate?.(40); } catch { /* sin vibración */ }
  }, []);

  // El plan es un extra: si no carga o el responsable no tiene barrios, el aviso sigue como siempre.
  useEffect(() => {
    if (!api?.planBarrios || !lote.responsable_id) return undefined;
    let vivo = true;
    api.planBarrios({ responsable_id: lote.responsable_id })
      .then((respuesta) => {
        if (!vivo || !opcionesPlan(respuesta?.barrios).length) return;
        setPlan(respuesta);
        setElegidos(respuesta.barrios.filter((barrio) => barrio.anotado).map((barrio) => barrio.codigo));
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [api, lote.responsable_id]);

  const anotados = plan ? plan.barrios.filter((barrio) => barrio.anotado).map((barrio) => barrio.codigo) : [];
  const cambiado = Boolean(plan) && !mismoPlan(elegidos, anotados);
  const esperando = pausado || Boolean(plan);

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

  const guardar = async () => {
    setGuardando(true);
    setError("");
    try {
      await api.guardarPlan({ responsable_id: lote.responsable_id, fecha: plan.fecha, barrios: elegidos, lote_id: lote.id });
      notify?.(elegidos.length ? `Plan de ${textoFechaPlan(plan.fecha, plan.hoy)} guardado.` : "Plan borrado.");
      onListo();
    } catch (problema) {
      setError(problema?.message || "No se pudo guardar el plan. Intenta de nuevo.");
      setGuardando(false);
    }
  };

  const asignadas = Number(lote.total_asignadas) || 0;
  const sobrantes = Number(lote.total_sobrantes) || 0;
  const entregadas = Number(lote.total_entregadas ?? asignadas - sobrantes) || 0;
  const efectividad = lote.efectividad ?? (asignadas ? (entregadas / asignadas) * 100 : 0);

  return (
    // Con barrios marcados sin guardar, tocar fuera no descarta la elección.
    <div className="ent-exito-capa" role="presentation" onClick={() => { if (!cambiado && !guardando) onListo(); }}>
      <section
        className={`ent-exito ${esperando ? "is-paused" : ""}${plan ? " con-plan" : ""}`.trim()}
        role={plan ? "dialog" : "status"}
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
          {cambiado ? (
            <button ref={listoRef} type="button" className="cl-primary" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando…" : elegidos.length ? "Guardar plan" : "Borrar plan"}
            </button>
          ) : (
            <button ref={listoRef} type="button" className="cl-primary" onClick={onListo}>{plan && !anotados.length ? "Ahora no" : "Listo"}</button>
          )}
          {onVerLote ? <button type="button" className="cl-secondary" onClick={onVerLote} disabled={guardando}>Ver lote</button> : null}
        </div>
        <i className="ent-exito-tiempo" aria-hidden="true" style={{ animationDuration: `${DURACION_MS}ms` }} />
      </section>
    </div>
  );
}
