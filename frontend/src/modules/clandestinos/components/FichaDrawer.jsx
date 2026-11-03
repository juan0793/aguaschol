import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../../components/Icon";
import { emptyForm } from "../../../constants/formsAndUi";
import FichaSections from "./FichaSections";
import AvisoEditor from "./AvisoEditor";
import { buildPadronValidation } from "../services/padronValidation";
import { clearFichaDraft, readFichaDraft, saveFichaDraft } from "../services/fichaDraftStorage";

const LABELS = { draft: "Borrador", pending: "Pendiente", visit: "Visita", confirmed: "Confirmada", regularization: "Regularización", regularized: "Regularizada", discarded: "Descartada" };
const FLOW_STEPS = [
  { state: "pending", label: "Preparar", title: "Completar datos y programar la visita", action: "Iniciar visita" },
  { state: "visit", label: "Visita", title: "Registrar los hallazgos de campo", action: "Confirmar hallazgo" },
  { state: "confirmed", label: "Confirmar", title: "Revisar la ficha y preparar el aviso", action: "Iniciar regularización" },
  { state: "regularization", label: "Seguimiento", title: "Dar seguimiento al aviso entregado", action: "Marcar regularizada" },
  { state: "regularized", label: "Cierre", title: "Expediente regularizado y finalizado", action: "" }
];

export default function FichaDrawer({ record, userId, api, apiFetch, config, onClose, onSaved, onPrintFicha, onPrintAviso, notify, readOnly = false }) {
  const [form, setForm] = useState({ ...emptyForm });
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  const [avisoOpen, setAvisoOpen] = useState(false);
  useEffect(() => {
    const previousOverflow = [document.documentElement.style.overflow, document.body.style.overflow];
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      [document.documentElement.style.overflow, document.body.style.overflow] = previousOverflow;
    };
  }, []);
  useEffect(() => {
    const base = record ? { ...emptyForm, ...record, estado_operativo: record.estado_operativo || "pending" } : { ...emptyForm, estado_operativo: "draft", comentarios: "" };
    const draft = readFichaDraft(userId, record);
    setForm(draft ? { ...base, ...draft } : base);
    if (draft) notify("Se recuperaron cambios locales no guardados de esta ficha.");
    setReason("");
  }, [record, userId]);
  useEffect(() => { if (!record?.id) { setHistory([]); return; } api.history("ficha", record.id).then(setHistory).catch(() => setHistory([])); }, [api, record?.id]);
  const updateForm = (nextForm) => setForm((current) => {
    const next = typeof nextForm === "function" ? nextForm(current) : nextForm;
    saveFichaDraft(userId, record, next);
    return next;
  });
  const change = (event) => updateForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const validatePadron = async () => {
    const clave = form.clave_catastral.trim();
    const abonado = form.abonado.trim();
    if (!clave && !abonado) { notify("Escribe la clave catastral o el numero de abonado antes de validar."); return; }
    setSaving(true);
    try {
      const aguasResult = await api.searchAguas(clave || abonado, clave ? "clave" : "abonado");
      const aguasMatch = aguasResult.matches?.[0];
      const lookupKey = aguasMatch?.clave_catastral || clave;
      const alcaldiaResult = lookupKey ? await api.validatePadron(lookupKey) : { matches: [] };
      const validated = buildPadronValidation(form, alcaldiaResult.matches?.[0], aguasMatch);
      updateForm(validated);
      notify(`${validated.comentarios} Guarda la ficha para conservar la validacion.`);
    } catch (error) { notify(error.message); } finally { setSaving(false); }
  };
  const persistForm = async () => {
    let saved = await api.saveFicha(form);
    if (saved.id && config.permissions.can_manage_ficha_state && form.observaciones_internas !== (record?.observaciones_internas || "")) saved = await api.internalNotes(saved.id, form.observaciones_internas || "");
    clearFichaDraft(userId, record);
    return saved;
  };
  const save = async (event) => { event.preventDefault(); setSaving(true); try { const saved = await persistForm(); notify(record?.id ? "Ficha actualizada." : "Ficha creada en la bandeja."); await onSaved(saved); } catch (error) { notify(error.message); } finally { setSaving(false); } };
  const setState = async (state) => { if (!form.id) return; if (state === "discarded" && !reason.trim()) { notify("Indica el motivo para descartar."); return; } setSaving(true); try { const saved = await persistForm(); const changed = await api.fichaState(saved.id, state, reason); setForm((current) => ({ ...current, ...changed })); setHistory(await api.history("ficha", saved.id)); setReason(""); clearFichaDraft(userId, record); notify("Estado actualizado y auditado."); await onSaved(changed, false); } catch (error) { notify(error.message); } finally { setSaving(false); } };
  const transitions = config.ficha_transitions[form.estado_operativo] || [];
  const currentStep = FLOW_STEPS.findIndex((item) => item.state === form.estado_operativo);
  const nextState = transitions.find((state) => FLOW_STEPS.findIndex((item) => item.state === state) > currentStep);
  const previousState = transitions.find((state) => state !== "discarded" && FLOW_STEPS.findIndex((item) => item.state === state) < currentStep);
  const stepCopy = FLOW_STEPS[Math.max(0, currentStep)];
  // Regularizar es de administración: el botón se muestra apagado y dice por qué.
  const soloAdmin = ["regularization", "regularized"].includes(nextState) && !config.permissions.can_confirm_or_regularize;

  return createPortal(<><div className="cl-drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="cl-drawer" role="dialog" aria-modal="true" aria-labelledby="cl-drawer-title">
    <header><div><span className="cl-kicker">{form.id ? `Expediente #${form.id}` : "Nuevo expediente"}</span><h2 id="cl-drawer-title">{form.clave_catastral || "Ficha clandestina"}</h2><span className={`cl-status is-${form.estado_operativo || "draft"}`}><i />{LABELS[form.estado_operativo] || "Borrador"}</span></div><button type="button" className="cl-icon-button" onClick={onClose} aria-label="Cerrar ficha">×</button></header>
    {form.id ? <div className="cl-progress" aria-label="Progreso de la ficha">{FLOW_STEPS.map((item, index) => <span key={item.state} className={index <= currentStep ? "is-done" : ""}>{index + 1}<small>{item.label}</small></span>)}</div> : null}
    <form onSubmit={save}>
      {form.id && stepCopy && !readOnly ? <section className={`cl-next-step ${nextState ? "" : "is-complete"}`} aria-label="Siguiente acción recomendada"><div><span>{nextState ? "Siguiente acción" : "Proceso completado"}</span><strong>{stepCopy.title}</strong><small>{soloAdmin ? "Solo administración puede avanzar esta etapa." : nextState ? "Se guardan los cambios antes de avanzar." :"Puedes consultar, imprimir o revisar el historial de la ficha."}</small></div><div>{previousState ? <button type="button" className="cl-quiet" disabled={saving} onClick={() => setState(previousState)}>Volver a {LABELS[previousState]}</button> : null}{nextState ? <button type="button" className="cl-primary" disabled={saving || soloAdmin} onClick={() => setState(nextState)}>{saving ? "Guardando…" : stepCopy.action}<Icon name="arrowRight" /></button> : null}</div></section> : null}
      <div className="cl-drawer-scroll"><fieldset className="cl-drawer-fieldset" disabled={!config.permissions.can_manage_ficha_state || saving}><FichaSections form={form} apiFetch={apiFetch} onChange={change} onValidatePadron={validatePadron} history={history} canEditInternal={config.permissions.can_manage_ficha_state} /></fieldset></div>
      <footer><div>{form.id && config.permissions.can_manage_ficha_state && transitions.includes("discarded") ? <details className="cl-discard"><summary>Descartar ficha</summary><label className="cl-reason"><span>Motivo obligatorio</span><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explica por qué se descarta" /></label><button type="button" className="cl-danger" disabled={saving || !reason.trim() || !config.permissions.can_confirm_or_regularize} onClick={() => setState("discarded")}>Confirmar descarte</button></details> : null}</div><div className="cl-drawer-main-actions"><button type="button" className="cl-secondary" disabled={readOnly} onClick={() => onPrintFicha(form)}><Icon name="print" />Ficha técnica</button><button type="button" className="cl-secondary" disabled={readOnly} onClick={() => setAvisoOpen(true)}><Icon name="records" />Editar aviso</button>{config.permissions.can_manage_ficha_state ? <button type="submit" className="cl-primary" disabled={saving}><Icon name="success" />{saving ? "Guardando…" : "Guardar ficha"}</button> : null}</div></footer>
    </form>
  </aside></div>{avisoOpen ? <AvisoEditor record={form} api={api} onClose={() => setAvisoOpen(false)} onPreview={(draft) => { setForm(draft); setAvisoOpen(false); onPrintAviso(draft); }} /> : null}</>, document.body);
}
