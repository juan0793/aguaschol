import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../../components/Icon";
import InspeccionGpsPanel from "./InspeccionGpsPanel";
import InspeccionPrintPreview from "./InspeccionPrintPreview";
import { estadoClass, estadoLabel, formatDateTime, printStatusLabel } from "../utils/inspeccionesFormatters";
import { createInspectionAutosave } from "../utils/inspectionAutosave";

const ESTADO_SIGUIENTE = { ASIGNADA: "EN_PROCESO", EN_PROCESO: "SEGUIMIENTO" };
const ESTADO_SIGUIENTE_LABEL = { ASIGNADA: "Iniciar inspección", EN_PROCESO: "Marcar seguimiento" };

export default function InspeccionDetallePanel({ api, session, id, tecnicosElegibles = [], notify, onClose, onChanged }) {
  const [inspeccion, setInspeccion] = useState(null);
  const [gpsPuntos, setGpsPuntos] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [printTipo, setPrintTipo] = useState(null);
  const [nuevoApoyoId, setNuevoApoyoId] = useState("");
  const [nuevoResponsableId, setNuevoResponsableId] = useState("");
  const [seguimientoDetalle, setSeguimientoDetalle] = useState("");
  const [seguimientoFecha, setSeguimientoFecha] = useState("");
  const debounceRef = useRef(null);
  const inspeccionRef = useRef(null);
  const autosaveRef = useRef(null);

  if (!autosaveRef.current) {
    autosaveRef.current = createInspectionAutosave(async (patch, getPending) => {
      const current = inspeccionRef.current;
      const updated = await api.update(id, { ...patch, expected_updated_at: current?.updated_at });
      const visible = { ...updated, ...getPending() };
      inspeccionRef.current = visible;
      setInspeccion(visible);
      onChanged();
    });
  }

  const userId = session?.user?.id;
  const isAdmin = session?.user?.role === "admin";
  const participantes = inspeccion?.participantes || [];
  const responsable = participantes.find((item) => item.rol === "RESPONSABLE");
  const apoyos = participantes.filter((item) => item.rol === "APOYO");
  const isResponsable = responsable?.tecnico_id === userId;
  const isApoyo = apoyos.some((item) => item.tecnico_id === userId);
  const puedeGestionar = isAdmin || isResponsable;
  const finalizada = inspeccion?.estado === "FINALIZADA";

  const cargar = async () => {
    if (!inspeccionRef.current) setLoading(true);
    try {
      const [detail, puntos, bitacora] = await Promise.all([api.detail(id), api.gps(id), api.historial(id)]);
      const visible = { ...detail, ...autosaveRef.current.getPending() };
      inspeccionRef.current = visible;
      setInspeccion(visible);
      setGpsPuntos(puntos);
      setHistorial(bitacora);
      setSeguimientoDetalle(visible.seguimiento_detalle || "");
      setSeguimientoFecha(visible.seguimiento_fecha_sugerida || "");
    } catch (error) {
      notify(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const guardarCampo = (patch) => {
    if (!inspeccion) return;
    autosaveRef.current.enqueue(patch);
    const visible = { ...inspeccionRef.current, ...patch };
    inspeccionRef.current = visible;
    setInspeccion(visible);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSaving(true);
      autosaveRef.current.flush()
        .catch((error) => notify(`${error.message} El texto se conserva para reintentar.`))
        .finally(() => setSaving(false));
    }, 800);
  };

  const guardarPendiente = async () => {
    clearTimeout(debounceRef.current);
    setSaving(true);
    try {
      await autosaveRef.current.flush();
      return true;
    } catch (error) {
      notify(`${error.message} El texto se conserva para reintentar.`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const cambiarEstado = async (estado) => {
    try {
      const updated = await api.changeEstado(id, estado);
      setInspeccion(updated);
      cargar();
      onChanged();
    } catch (error) {
      notify(error.message);
    }
  };

  const finalizar = async () => {
    if (finalizing || !(await guardarPendiente())) return;
    setFinalizing(true);
    try {
      const current = inspeccionRef.current;
      const updated = await api.finalizar(id, {
        requiere_seguimiento: current.requiere_seguimiento,
        seguimiento_detalle: seguimientoDetalle,
        seguimiento_fecha_sugerida: seguimientoFecha
      });
      inspeccionRef.current = updated;
      setInspeccion(updated);
      cargar();
      onChanged();
      notify("Inspección finalizada.");
    } catch (error) {
      notify(error.message);
    } finally {
      setFinalizing(false);
    }
  };

  const cerrar = async () => {
    if (await guardarPendiente()) onClose();
  };

  const agregarApoyo = async () => {
    if (!nuevoApoyoId) return;
    try {
      await api.addTecnico(id, Number(nuevoApoyoId));
      setNuevoApoyoId("");
      cargar();
      notify("Técnico de apoyo agregado.");
    } catch (error) {
      notify(error.message);
    }
  };

  const quitarApoyo = async (tecnicoId) => {
    try {
      await api.removeTecnico(id, tecnicoId);
      cargar();
    } catch (error) {
      notify(error.message);
    }
  };

  const reasignar = async () => {
    if (!nuevoResponsableId) return;
    try {
      await api.reasignar(id, Number(nuevoResponsableId));
      setNuevoResponsableId("");
      cargar();
      onChanged();
      notify("Inspección reasignada.");
    } catch (error) {
      notify(error.message);
    }
  };

  const opcionesApoyo = useMemo(
    () => tecnicosElegibles.filter((tecnico) => !participantes.some((item) => item.tecnico_id === tecnico.id)),
    [tecnicosElegibles, participantes]
  );

  if (loading || !inspeccion) {
    return (
      <div className="cl-drawer-backdrop">
        <div className="cl-drawer"><div className="cl-module-loading"><Icon name="refresh" />Cargando inspección…</div></div>
      </div>
    );
  }

  return (
    <div className="cl-drawer-backdrop" role="dialog" aria-modal="true" aria-label={`Inspección ${inspeccion.numero_inspeccion}`}>
      <div className="cl-drawer">
        <header>
          <div>
            <span className="cl-kicker">{inspeccion.numero_inspeccion}</span>
            <h2>{inspeccion.abonado_nombre_snapshot || "Inspección general"}</h2>
            <span className={`cl-status ${estadoClass(inspeccion.estado)}`}><i />{estadoLabel(inspeccion.estado)}</span>
          </div>
          <button type="button" className="cl-icon-button" onClick={cerrar} aria-label="Cerrar"><Icon name="logout" /></button>
        </header>
        <div className="cl-drawer-scroll">
          <div className="cl-padron-result">
            <strong>{inspeccion.clave_catastral}</strong>
            <span>Barrio</span><span>{inspeccion.barrio_snapshot || "—"}</span>
            <span>Motivo</span><span>{inspeccion.motivo}</span>
            <span>Responsable</span><span>{responsable?.tecnico_nombre || "—"}</span>
            <span>Apoyo</span><span>{apoyos.map((item) => item.tecnico_nombre).join(", ") || "Sin apoyo"}</span>
          </div>

          <section className="ins-form-section">
            <h3>Trabajo solicitado</h3>
            <p>{inspeccion.trabajo_solicitado}</p>
          </section>

          <section className="ins-form-section">
            <h3>Información encontrada</h3>
            <textarea
              rows={4}
              disabled={finalizada || (!isAdmin && !isResponsable && !isApoyo)}
              defaultValue={inspeccion.informacion_encontrada}
              placeholder="Describe lo verificado en campo…"
              onChange={(event) => guardarCampo({ informacion_encontrada: event.target.value })}
            />
            <h3>Observaciones adicionales</h3>
            <textarea
              rows={2}
              disabled={finalizada || (!isAdmin && !isResponsable && !isApoyo)}
              defaultValue={inspeccion.observaciones}
              placeholder="Observaciones opcionales…"
              onChange={(event) => guardarCampo({ observaciones: event.target.value })}
            />
            {saving ? <small className="cl-muted">Guardando…</small> : null}
          </section>

          <section className="ins-form-section">
            <h3>Ubicaciones registradas</h3>
            <InspeccionGpsPanel
              api={api}
              inspeccionId={id}
              puntos={gpsPuntos}
              readOnly={finalizada || (!isAdmin && !isResponsable && !isApoyo)}
              onRegistered={cargar}
              notify={notify}
            />
          </section>

          <section className="ins-form-section">
            <h3>Seguimiento</h3>
            <label className="ins-apoyo-chip">
              <input
                type="checkbox"
                disabled={finalizada || !puedeGestionar}
                checked={Boolean(inspeccion.requiere_seguimiento)}
                onChange={(event) => guardarCampo({ requiere_seguimiento: event.target.checked })}
              />
              <span><strong>Requiere seguimiento</strong></span>
            </label>
            {inspeccion.requiere_seguimiento ? (
              <div className="cl-fields">
                <label className="cl-field is-wide">
                  <span>Detalle del seguimiento</span>
                  <textarea rows={2} disabled={finalizada || !puedeGestionar} value={seguimientoDetalle} onChange={(event) => { setSeguimientoDetalle(event.target.value); guardarCampo({ seguimiento_detalle: event.target.value }); }} />
                </label>
                <label className="cl-field">
                  <span>Fecha sugerida</span>
                  <input type="date" disabled={finalizada || !puedeGestionar} value={seguimientoFecha || ""} onChange={(event) => { setSeguimientoFecha(event.target.value); guardarCampo({ seguimiento_fecha_sugerida: event.target.value }); }} />
                </label>
              </div>
            ) : null}
          </section>

          {puedeGestionar && !finalizada ? (
            <section className="ins-form-section">
              <h3>Estado</h3>
              <div className="cl-state-actions">
                {ESTADO_SIGUIENTE[inspeccion.estado] ? (
                  <button type="button" className="cl-secondary" onClick={() => cambiarEstado(ESTADO_SIGUIENTE[inspeccion.estado])}>
                    {ESTADO_SIGUIENTE_LABEL[inspeccion.estado]}
                  </button>
                ) : null}
                {inspeccion.estado === "SEGUIMIENTO" ? (
                  <button type="button" className="cl-secondary" onClick={() => cambiarEstado("EN_PROCESO")}>Retomar (en proceso)</button>
                ) : null}
                <button type="button" className="cl-primary" onClick={finalizar} disabled={saving || finalizing}>
                  {finalizing ? "Finalizando…" : "Finalizar inspección"}
                </button>
              </div>
            </section>
          ) : null}

          {puedeGestionar && !finalizada ? (
            <section className="ins-form-section">
              <h3>Técnicos de apoyo</h3>
              <div className="ins-clave-search">
                <select value={nuevoApoyoId} onChange={(event) => setNuevoApoyoId(event.target.value)}>
                  <option value="">Agregar técnico de apoyo…</option>
                  {opcionesApoyo.map((tecnico) => (
                    <option key={tecnico.id} value={tecnico.id}>{tecnico.full_name}</option>
                  ))}
                </select>
                <button type="button" className="cl-secondary" onClick={agregarApoyo} disabled={!nuevoApoyoId}><Icon name="plus" />Agregar</button>
              </div>
              {apoyos.length ? (
                <ul className="cl-history">
                  {apoyos.map((item) => (
                    <li key={item.id}>
                      <i />
                      <div>
                        <strong>{item.tecnico_nombre}</strong>
                        <button type="button" className="cl-danger" style={{ minHeight: 32, marginTop: 4 }} onClick={() => quitarApoyo(item.tecnico_id)}>Quitar</button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {isAdmin && !finalizada ? (
            <section className="ins-form-section">
              <h3>Reasignar responsable</h3>
              <div className="ins-clave-search">
                <select value={nuevoResponsableId} onChange={(event) => setNuevoResponsableId(event.target.value)}>
                  <option value="">Selecciona nuevo responsable…</option>
                  {tecnicosElegibles.filter((tecnico) => tecnico.id !== responsable?.tecnico_id).map((tecnico) => (
                    <option key={tecnico.id} value={tecnico.id}>{tecnico.full_name}</option>
                  ))}
                </select>
                <button type="button" className="cl-secondary" onClick={reasignar} disabled={!nuevoResponsableId}>Reasignar</button>
              </div>
            </section>
          ) : null}

          <section className="ins-form-section">
            <h3>Impresión</h3>
            <div className="ins-print-badges">
              <span className={`cl-print-state ${inspeccion.print_status?.ORDEN?.impreso ? "is-printed" : ""}`}>Orden: {printStatusLabel(inspeccion.print_status?.ORDEN)}</span>
              <span className={`cl-print-state ${inspeccion.print_status?.REPORTE?.impreso ? "is-printed" : ""}`}>Reporte: {printStatusLabel(inspeccion.print_status?.REPORTE)}</span>
            </div>
            <div className="cl-drawer-main-actions" style={{ justifyContent: "flex-start", marginTop: 10 }}>
              <button type="button" className="cl-secondary" onClick={() => setPrintTipo("orden")}><Icon name="print" />Orden de inspección</button>
              <button type="button" className="cl-secondary" onClick={() => setPrintTipo("reporte")}><Icon name="print" />Reporte de inspección</button>
            </div>
          </section>

          <section className="ins-form-section">
            <details>
              <summary><Icon name="history" /> Bitácora ({historial.length})</summary>
              <ul className="cl-history">
                {!historial.length ? (
                  <li className="is-empty">Sin actividad registrada.</li>
                ) : (
                  historial.map((item, index) => (
                    <li key={index}>
                      <i />
                      <div>
                        <strong>{item.resumen}</strong>
                        <span>{item.actor_name || "Sistema"} · {formatDateTime(item.created_at)}</span>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </details>
          </section>
        </div>
        <footer>
          <div className="cl-drawer-main-actions">
            <button type="button" className="cl-secondary" onClick={cerrar} disabled={saving || finalizing}>Cerrar</button>
          </div>
        </footer>
      </div>

      {printTipo ? (
        <InspeccionPrintPreview
          api={api}
          inspeccion={inspeccion}
          gpsPuntos={gpsPuntos}
          tipoInicial={printTipo}
          notify={notify}
          onClose={() => { setPrintTipo(null); cargar(); }}
        />
      ) : null}
    </div>
  );
}
