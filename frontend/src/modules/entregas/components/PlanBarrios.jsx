import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../../../components/Icon";
import { formatNumber } from "../utils/entregasFormatters";
import { cargaDe, textoJornadas } from "../utils/avanceMes.js";
import { mismoPlan, opcionesPlan, resumenPlan, textoFechaPlan } from "../utils/planBarrios.js";
import "../styles/planBarrios.css";

// Plan de la próxima jornada: qué barrios trabaja un responsable. Se pregunta al
// cerrar un lote (LoteCerradoAviso) y también se puede anotar en cualquier momento:
// el técnico desde Hoy y la oficina desde "El equipo hoy" del Resumen.

// Carga, elección y guardado del plan de un responsable. `plan` queda en null si no
// cargó o si el responsable no tiene barrios pendientes en el reparto.
export function usePlanBarrios({ api, responsableId, loteId = null, notify, activo = true }) {
  const [plan, setPlan] = useState(null);
  const [cargado, setCargado] = useState(false);
  const [elegidos, setElegidos] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!activo || !api?.planBarrios || !responsableId) { setCargado(true); return undefined; }
    let vivo = true;
    setCargado(false);
    api.planBarrios({ responsable_id: responsableId })
      .then((respuesta) => {
        if (!vivo) return;
        const conOpciones = opcionesPlan(respuesta?.barrios).length > 0;
        setPlan(conOpciones ? respuesta : null);
        setElegidos(conOpciones ? respuesta.barrios.filter((barrio) => barrio.anotado).map((barrio) => barrio.codigo) : []);
      })
      .catch(() => { if (vivo) setPlan(null); })
      .finally(() => { if (vivo) setCargado(true); });
    return () => { vivo = false; };
  }, [activo, api, responsableId, version]);

  const anotados = plan ? plan.barrios.filter((barrio) => barrio.anotado).map((barrio) => barrio.codigo) : [];
  const cambiado = Boolean(plan) && !mismoPlan(elegidos, anotados);

  const guardar = useCallback(async () => {
    setGuardando(true);
    setError("");
    try {
      await api.guardarPlan({ responsable_id: responsableId, fecha: plan.fecha, barrios: elegidos, lote_id: loteId });
      notify?.(elegidos.length ? `Plan de ${textoFechaPlan(plan.fecha, plan.hoy)} guardado.` : "Plan borrado.");
      setGuardando(false);
      return true;
    } catch (problema) {
      setError(problema?.message || "No se pudo guardar el plan. Intenta de nuevo.");
      setGuardando(false);
      return false;
    }
  }, [api, elegidos, loteId, notify, plan, responsableId]);

  return { plan, cargado, elegidos, setElegidos, anotados, cambiado, guardando, error, guardar, recargar: () => setVersion((valor) => valor + 1) };
}

export function PlanManana({ plan, elegidos, onCambiar }) {
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

// Diálogo para anotar el plan sin cerrar un lote.
export function PlanBarriosDialog({ api, responsableId, notify, onCerrar, onGuardado }) {
  const estado = usePlanBarrios({ api, responsableId, notify });
  const { plan, cargado, elegidos, setElegidos, cambiado, guardando, error, guardar, anotados } = estado;
  const caja = useRef(null);

  useEffect(() => {
    if (cargado) caja.current?.querySelector(".ent-plan-barrio, button")?.focus({ preventScroll: true });
  }, [cargado]);

  useEffect(() => {
    const cerrar = (event) => { if (event.key === "Escape" && !guardando) onCerrar(); };
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [onCerrar, guardando]);

  const alGuardar = async () => {
    if (await guardar()) { onGuardado?.(); onCerrar(); }
  };

  return (
    <div className="ent-exito-capa" role="presentation" onClick={() => { if (!cambiado && !guardando) onCerrar(); }}>
      <section ref={caja} className="ent-exito con-plan ent-plan-dialogo" role="dialog" aria-modal="true" aria-labelledby="ent-plan-dialogo-titulo" onClick={(event) => event.stopPropagation()}>
        <h2 id="ent-plan-dialogo-titulo">Plan de la próxima jornada</h2>
        {!cargado ? <p>Cargando barrios…</p> : null}
        {cargado && !plan ? <p>No tiene barrios pendientes en el reparto de este ciclo.</p> : null}
        {plan ? <PlanManana plan={plan} elegidos={elegidos} onCambiar={setElegidos} /> : null}
        {error ? <p className="ent-plan-error" role="alert">{error}</p> : null}
        <div className="ent-exito-acciones">
          {plan ? (
            <button type="button" className="cl-primary" onClick={alGuardar} disabled={!cambiado || guardando}>
              {guardando ? "Guardando…" : !elegidos.length && anotados.length ? "Borrar plan" : "Guardar plan"}
            </button>
          ) : null}
          <button type="button" className="cl-secondary" onClick={onCerrar} disabled={guardando}>{plan ? "Cancelar" : "Cerrar"}</button>
        </div>
      </section>
    </div>
  );
}

// Tarjeta del técnico en Hoy: dice qué anotó para la próxima jornada y abre el
// diálogo para anotarlo o cambiarlo, sin esperar a cerrar un lote.
export function PlanMananaTarjeta({ api, responsableId, notify, onGuardado }) {
  const [abierto, setAbierto] = useState(false);
  const { plan, cargado, recargar } = usePlanBarrios({ api, responsableId, notify });
  if (!cargado || !plan) return null;
  const anotados = plan.barrios.filter((barrio) => barrio.anotado);
  const cuando = textoFechaPlan(plan.fecha, plan.hoy);
  return (
    <section className={`ent-plan-tarjeta${anotados.length ? "" : " is-pendiente"}`} aria-label="Plan de la próxima jornada">
      <Icon name="calendar" />
      <p>
        {anotados.length
          ? <>Para {cuando}: <strong>{anotados.map((barrio) => barrio.nombre).join(", ")}</strong></>
          : <>Todavía no anotas qué barrio trabajas {cuando}.</>}
      </p>
      <button type="button" className="cl-secondary" onClick={() => setAbierto(true)}>{anotados.length ? "Cambiar" : "Anotar plan"}</button>
      {abierto ? (
        <PlanBarriosDialog api={api} responsableId={responsableId} notify={notify} onCerrar={() => setAbierto(false)} onGuardado={() => { recargar(); onGuardado?.(); }} />
      ) : null}
    </section>
  );
}
