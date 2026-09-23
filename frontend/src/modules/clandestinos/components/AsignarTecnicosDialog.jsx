import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../../components/Icon";

/**
 * Asignar candidatos del banco a uno o varios técnicos. Con uno se le dan
 * todos; con varios se reparten en partes iguales por barrio. Antes de
 * confirmar se ve cuántos y de qué barrios le tocan a cada uno.
 */
export default function AsignarTecnicosDialog({ api, ids, notify, onClose, onDone }) {
  const [tecnicos, setTecnicos] = useState(null);
  const [elegidos, setElegidos] = useState([]);
  const [plan, setPlan] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { api.bancoTecnicos().then(setTecnicos).catch((reason) => setError(reason.message)); }, [api]);
  useEffect(() => {
    const escape = (event) => { if (event.key === "Escape" && !saving) onClose(); };
    addEventListener("keydown", escape);
    return () => removeEventListener("keydown", escape);
  }, [onClose, saving]);
  // Vista previa del reparto cada vez que cambia la elección.
  useEffect(() => {
    if (!elegidos.length) { setPlan(null); return undefined; }
    let vigente = true;
    const timer = setTimeout(() => {
      api.bancoAssign({ ids, tecnico_ids: elegidos, preview: true })
        .then((data) => { if (vigente) { setPlan(data); setError(""); } })
        .catch((reason) => { if (vigente) setError(reason.message); });
    }, 160);
    return () => { vigente = false; clearTimeout(timer); };
  }, [api, elegidos, ids]);

  const toggle = (id) => setElegidos((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const confirmar = async () => {
    setSaving(true);
    try {
      const result = await api.bancoAssign({ ids, tecnico_ids: elegidos });
      const detalle = result.plan.map((item) => `${item.tecnico.nombre}: ${item.total}`).join(" · ");
      notify(`${result.asignables} ${result.asignables === 1 ? "candidato asignado" : "candidatos asignados"} (${detalle}).${result.notificados ? ` Se notificó a ${result.notificados} ${result.notificados === 1 ? "técnico" : "técnicos"}.` : ""}${result.omitidos ? ` ${result.omitidos} no estaban pendientes y se omitieron.` : ""}`);
      onDone();
    } catch (reason) { setError(reason.message); } finally { setSaving(false); }
  };
  const reparto = elegidos.length > 1;

  return createPortal(<div className="cl-assign-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className="cl-assign" role="dialog" aria-modal="true" aria-labelledby="cl-assign-title">
      <header>
        <span className="cl-assign-emblem"><Icon name="users" /></span>
        <div>
          <h2 id="cl-assign-title">{reparto ? "Repartir entre técnicos" : "Asignar a un técnico"}</h2>
          <p>{ids.length} {ids.length === 1 ? "candidato seleccionado" : "candidatos seleccionados"} para convertir en ficha. Cada técnico recibe una notificación.</p>
        </div>
        <button type="button" className="cl-assign-close" aria-label="Cerrar" disabled={saving} onClick={onClose}><Icon name="close" /></button>
      </header>
      <div className="cl-assign-body">
        <div className="cl-assign-col">
          <h3>Técnicos <small>elige uno para asignar, o varios para repartir</small></h3>
          {tecnicos == null ? <p className="cl-assign-muted">Cargando técnicos…</p> : !tecnicos.length ? <p className="cl-assign-muted">No hay técnicos activos (roles operador o validadora de campo).</p> : <ul className="cl-assign-list">
            {tecnicos.map((tecnico) => {
              const activo = elegidos.includes(tecnico.id);
              return <li key={tecnico.id}><button type="button" aria-pressed={activo} className={activo ? "is-active" : ""} onClick={() => toggle(tecnico.id)}>
                <span className="cl-assign-check">{activo ? <Icon name="success" /> : null}</span>
                <span className="cl-assign-name"><strong>{tecnico.nombre}</strong><small>{tecnico.role === "validadora_campo" ? "Validadora de campo" : "Operador"}</small></span>
                <span className="cl-assign-load" title="Candidatos que ya tiene pendientes">{tecnico.pendientes} pend.</span>
              </button></li>;
            })}
          </ul>}
          {tecnicos?.length > 1 ? <div className="cl-assign-quick"><button type="button" className="cl-quiet" onClick={() => setElegidos(tecnicos.map((item) => item.id))}>Elegir todos</button>{elegidos.length ? <button type="button" className="cl-quiet" onClick={() => setElegidos([])}>Ninguno</button> : null}</div> : null}
        </div>
        <div className="cl-assign-col is-plan">
          <h3>{reparto ? "Así quedaría el reparto" : "Resumen"}</h3>
          {!elegidos.length ? <p className="cl-assign-muted">Elige un técnico para ver qué le tocaría.</p> : !plan ? <p className="cl-assign-muted">Calculando…</p> : <>
            <ul className="cl-assign-plan">
              {plan.plan.map((item) => <li key={item.tecnico.id}>
                <div><strong>{item.tecnico.nombre}</strong><span>{item.total} {item.total === 1 ? "candidato" : "candidatos"}</span></div>
                <p>{item.barrios.slice(0, 5).map((barrio) => <em key={barrio.barrio}>{barrio.barrio} · {barrio.total}</em>)}{item.barrios.length > 5 ? <em>+{item.barrios.length - 5} barrios</em> : null}</p>
                {item.reasignados ? <small><Icon name="warning" />{item.reasignados} estaban asignados a otra persona y pasan a {item.tecnico.nombre}</small> : null}
              </li>)}
            </ul>
            {reparto ? <p className="cl-assign-muted">Se ordenan por barrio y clave y se dividen en partes iguales: a cada técnico le tocan predios vecinos.</p> : null}
            {plan.omitidos ? <p className="cl-assign-warn"><Icon name="warning" />{plan.omitidos} no se asignan porque ya no están pendientes o aparecen en Aguas.</p> : null}
          </>}
        </div>
      </div>
      {error ? <p className="cl-assign-error" role="alert">{error}</p> : null}
      <footer>
        <button type="button" className="cl-quiet" disabled={saving} onClick={onClose}>Cancelar</button>
        <button type="button" className="cl-primary" disabled={saving || !plan || !elegidos.length} onClick={confirmar}><Icon name="send" />{saving ? "Asignando…" : reparto ? `Repartir y notificar a ${elegidos.length}` : "Asignar y notificar"}</button>
      </footer>
    </section>
  </div>, document.body);
}
