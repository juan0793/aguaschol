import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../../components/Icon";
import { emptyForm } from "../../../constants/formsAndUi";
import FichaSections from "./FichaSections";

const LABELS = { draft: "Borrador", pending: "Pendiente", visit: "Visita", confirmed: "Confirmada", regularization: "Regularización", regularized: "Regularizada", discarded: "Descartada" };

export default function FichaDrawer({ record, api, config, onClose, onSaved, onValidatePadron, notify }) {
  const [form, setForm] = useState({ ...emptyForm });
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  useEffect(() => { setForm(record ? { ...emptyForm, ...record, estado_operativo: record.estado_operativo || "pending" } : { ...emptyForm, estado_operativo: "draft", comentarios: "" }); setReason(""); }, [record]);
  useEffect(() => { if (!record?.id) { setHistory([]); return; } api.history("ficha", record.id).then(setHistory).catch(() => setHistory([])); }, [api, record?.id]);
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const save = async (event) => { event.preventDefault(); setSaving(true); try { const saved = await api.saveFicha(form); if (saved.id && config.permissions.can_manage_ficha_state && form.observaciones_internas !== (record?.observaciones_internas || "")) await api.internalNotes(saved.id, form.observaciones_internas || ""); notify(record?.id ? "Ficha actualizada." : "Ficha creada en la bandeja."); onSaved(saved); } catch (error) { notify(error.message); } finally { setSaving(false); } };
  const setState = async (state) => { if (!form.id) return; if (state === "discarded" && !reason.trim()) { notify("Indica el motivo para descartar."); return; } setSaving(true); try { const saved = await api.fichaState(form.id, state, reason); setForm((current) => ({ ...current, ...saved })); setHistory(await api.history("ficha", form.id)); setReason(""); notify("Estado actualizado y auditado."); onSaved(saved, false); } catch (error) { notify(error.message); } finally { setSaving(false); } };
  const transitions = config.ficha_transitions[form.estado_operativo] || [];

  return createPortal(<div className="cl-drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="cl-drawer" role="dialog" aria-modal="true" aria-labelledby="cl-drawer-title">
    <header><div><span className="cl-kicker">{form.id ? `Expediente #${form.id}` : "Nuevo expediente"}</span><h2 id="cl-drawer-title">{form.clave_catastral || "Ficha clandestina"}</h2><span className={`cl-status is-${form.estado_operativo || "draft"}`}><i />{LABELS[form.estado_operativo] || "Borrador"}</span></div><button type="button" className="cl-icon-button" onClick={onClose} aria-label="Cerrar ficha">×</button></header>
    {form.id ? <div className="cl-progress" aria-label="Progreso de la ficha">{["pending","visit","confirmed","regularization","regularized"].map((item, index, values) => { const current = values.indexOf(form.estado_operativo); return <span key={item} className={index <= current ? "is-done" : ""}>{index + 1}<small>{LABELS[item]}</small></span>; })}</div> : null}
    <form onSubmit={save}><div className="cl-drawer-scroll"><fieldset className="cl-drawer-fieldset" disabled={!config.permissions.can_manage_ficha_state}><FichaSections form={form} onChange={change} onValidatePadron={onValidatePadron} history={history} canEditInternal={config.permissions.can_manage_ficha_state} /></fieldset></div>
      <footer><div>{form.id && config.permissions.can_manage_ficha_state && transitions.length ? <><label className="cl-reason"><span>Motivo (obligatorio al descartar)</span><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo del cambio" /></label><div className="cl-state-actions">{transitions.map((item) => <button type="button" key={item} className={item === "discarded" ? "cl-danger" : "cl-secondary"} disabled={saving || (["confirmed","regularization","regularized","discarded"].includes(item) && !config.permissions.can_confirm_or_regularize)} onClick={() => setState(item)}>{LABELS[item]}</button>)}</div></> : null}</div><div className="cl-drawer-main-actions"><button type="button" className="cl-secondary" onClick={() => window.print()}><Icon name="print" />Imprimir</button>{config.permissions.can_manage_ficha_state ? <button type="submit" className="cl-primary" disabled={saving}><Icon name="success" />{saving ? "Guardando…" : "Guardar ficha"}</button> : null}</div></footer>
    </form>
  </aside></div>, document.body);
}
