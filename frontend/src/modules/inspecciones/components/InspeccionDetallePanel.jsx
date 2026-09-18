import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../../components/Icon";
import HoldButton from "../../../components/micro/HoldButton";
import InspeccionGpsPanel from "./InspeccionGpsPanel";
import InspeccionPrintPreview from "./InspeccionPrintPreview";
import CorregirOrtografia, { SPELLCHECK_PROPS } from "./CorregirOrtografia";
import PrintBadge from "./PrintBadge";
import { estadoClass, estadoLabel, formatDate, formatDateTime } from "../utils/inspeccionesFormatters";
import { createInspectionAutosave } from "../utils/inspectionAutosave";
import LatticeLoader from "../../../components/micro/LatticeLoader";

const ESTADO_SIGUIENTE = { ASIGNADA: "EN_PROCESO", EN_PROCESO: "SEGUIMIENTO" };
const ESTADO_SIGUIENTE_LABEL = { ASIGNADA: "Iniciar inspección", EN_PROCESO: "Marcar seguimiento" };

// Cada bloque del cajón se anuncia con su ícono y una franja al costado. El tono
// dice de qué tipo de trabajo se trata: lo que se llena en campo, lo que decide
// la administración, y lo que solo se consulta. No es decoración: al abrir una
// inspección ajena o ya finalizada, la franja apagada avisa antes de leer.
function Seccion({ icon, title, tone = "campo", meta, children }) {
  return (
    <section className={`ins-form-section ins-section ins-section--${tone}`}>
      <header className="ins-section__head">
        <span className="ins-section__icon" aria-hidden="true"><Icon name={icon} /></span>
        <h3>{title}</h3>
        {meta ? <span className="ins-section__meta">{meta}</span> : null}
      </header>
      <div className="ins-section__body">{children}</div>
    </section>
  );
}

export default function InspeccionDetallePanel({ api, session, id, tecnicosElegibles = [], notify, onClose, onChanged }) {
  const [inspeccion, setInspeccion] = useState(null);
  const [gpsPuntos, setGpsPuntos] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [printTipo, setPrintTipo] = useState(null);
  const [nuevoApoyoId, setNuevoApoyoId] = useState("");
  const [nuevoResponsableId, setNuevoResponsableId] = useState("");
  const [seguimientoDetalle, setSeguimientoDetalle] = useState("");
  const [seguimientoFecha, setSeguimientoFecha] = useState("");
  const debounceRef = useRef(null);
  const inspeccionRef = useRef(null);
  const autosaveRef = useRef(null);
  const informacionRef = useRef(null);
  const observacionesRef = useRef(null);

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
  const puedeFinalizar = puedeGestionar || isApoyo;
  const finalizada = inspeccion?.estado === "FINALIZADA";
  const bloqueadaParaTecnico = finalizada && !isAdmin;
  const textoLibreBloqueado = bloqueadaParaTecnico || (!isAdmin && !isResponsable && !isApoyo);

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

  // La confirmación es el gesto sostenido del HoldButton, no un window.confirm.
  const eliminar = async () => {
    if (deleting || !(await guardarPendiente())) return;
    setDeleting(true);
    try {
      await api.remove(id);
      notify("Inspección eliminada.");
      onClose();
    } catch (error) {
      notify(error.message);
      setDeleting(false);
    }
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
        <div className="cl-drawer"><div className="cl-module-loading"><LatticeLoader label="Cargando inspección…" showTimer /></div></div>
      </div>
    );
  }

  return (
    <div className="cl-drawer-backdrop" role="dialog" aria-modal="true" aria-label={`Inspección ${inspeccion.numero_inspeccion}`}>
      <div className="cl-drawer ins-drawer">
        <header>
          <div>
            <span className="cl-kicker">{inspeccion.numero_inspeccion}</span>
            <h2>{inspeccion.abonado_nombre_snapshot || "Inspección general"}</h2>
            <div className="ins-head-meta">
              <span className={`cl-status ${estadoClass(inspeccion.estado)}`}><i />{estadoLabel(inspeccion.estado)}</span>
              <span className="ins-head-date"><Icon name="calendar" />{formatDate(inspeccion.fecha_asignacion)}</span>
              {saving ? <span className="ins-saving" role="status"><i />Guardando…</span> : null}
            </div>
          </div>
          <button type="button" className="cl-icon-button" onClick={cerrar} aria-label="Cerrar inspección"><Icon name="close" /></button>
        </header>
        <div className="cl-drawer-scroll">
          {/* La clave catastral es como la oficina nombra un predio: va tratada como
              el identificador que es, no como una fila más de la ficha. */}
          <div className="ins-identity">
            <span className="ins-identity__label">Clave catastral</span>
            <strong className="ins-identity__key">{inspeccion.clave_catastral || "Sin clave"}</strong>
            <dl className="ins-identity__data">
              <div><dt><Icon name="map" />Barrio</dt><dd>{inspeccion.barrio_snapshot || "—"}</dd></div>
              <div><dt><Icon name="clipboard" />Motivo</dt><dd>{inspeccion.motivo || "—"}</dd></div>
              <div><dt><Icon name="users" />Responsable</dt><dd>{responsable?.tecnico_nombre || "—"}</dd></div>
              <div><dt><Icon name="userCreated" />Apoyo</dt><dd>{apoyos.map((item) => item.tecnico_nombre).join(", ") || "Sin apoyo"}</dd></div>
            </dl>
          </div>

          <Seccion icon="clipboard" title="Trabajo solicitado" tone="admin">
            {isAdmin ? (
              <>
                <textarea
                  rows={3}
                  {...SPELLCHECK_PROPS}
                  value={inspeccion.trabajo_solicitado || ""}
                  onChange={(event) => guardarCampo({ trabajo_solicitado: event.target.value })}
                />
                <CorregirOrtografia api={api} value={inspeccion.trabajo_solicitado} onApply={(texto) => guardarCampo({ trabajo_solicitado: texto })} />
              </>
            ) : <p>{inspeccion.trabajo_solicitado}</p>}
          </Seccion>

          {isAdmin ? (
            <Seccion icon="edit" title="Motivo" tone="admin">
              <input
                value={inspeccion.motivo || ""}
                onChange={(event) => guardarCampo({ motivo: event.target.value })}
              />
            </Seccion>
          ) : null}

          <Seccion icon="search" title="Información encontrada" tone="campo">
            <textarea
              ref={informacionRef}
              rows={4}
              {...SPELLCHECK_PROPS}
              disabled={textoLibreBloqueado}
              defaultValue={inspeccion.informacion_encontrada}
              placeholder="Describe lo verificado en campo…"
              onChange={(event) => guardarCampo({ informacion_encontrada: event.target.value })}
            />
            <CorregirOrtografia
              api={api}
              value={inspeccion.informacion_encontrada}
              disabled={textoLibreBloqueado}
              onApply={(texto) => { informacionRef.current.value = texto; guardarCampo({ informacion_encontrada: texto }); }}
            />
          </Seccion>

          <Seccion icon="notes" title="Observaciones adicionales" tone="campo">
            <textarea
              ref={observacionesRef}
              rows={2}
              {...SPELLCHECK_PROPS}
              disabled={textoLibreBloqueado}
              defaultValue={inspeccion.observaciones}
              placeholder="Observaciones opcionales…"
              onChange={(event) => guardarCampo({ observaciones: event.target.value })}
            />
            <CorregirOrtografia
              api={api}
              value={inspeccion.observaciones}
              disabled={textoLibreBloqueado}
              onApply={(texto) => { observacionesRef.current.value = texto; guardarCampo({ observaciones: texto }); }}
            />
          </Seccion>

          <Seccion icon="pin" title="Ubicaciones registradas" tone="campo">
            <InspeccionGpsPanel
              api={api}
              inspeccionId={id}
              puntos={gpsPuntos}
              readOnly={finalizada || (!isAdmin && !isResponsable && !isApoyo)}
              onRegistered={cargar}
              notify={notify}
            />
          </Seccion>

          <Seccion icon="flag" title="Seguimiento" tone="campo">
            <label className="ins-apoyo-chip">
              <input
                type="checkbox"
                disabled={bloqueadaParaTecnico || !puedeGestionar}
                checked={Boolean(inspeccion.requiere_seguimiento)}
                onChange={(event) => guardarCampo({ requiere_seguimiento: event.target.checked })}
              />
              <span><strong>Requiere seguimiento</strong></span>
            </label>
            {inspeccion.requiere_seguimiento ? (
              <div className="cl-fields">
                <label className="cl-field is-wide">
                  <span>Detalle del seguimiento</span>
                  <textarea rows={2} {...SPELLCHECK_PROPS} disabled={bloqueadaParaTecnico || !puedeGestionar} value={seguimientoDetalle} onChange={(event) => { setSeguimientoDetalle(event.target.value); guardarCampo({ seguimiento_detalle: event.target.value }); }} />
                  <CorregirOrtografia api={api} value={seguimientoDetalle} disabled={bloqueadaParaTecnico || !puedeGestionar} onApply={(texto) => { setSeguimientoDetalle(texto); guardarCampo({ seguimiento_detalle: texto }); }} />
                </label>
                <label className="cl-field">
                  <span>Fecha sugerida</span>
                  <input type="date" disabled={bloqueadaParaTecnico || !puedeGestionar} value={seguimientoFecha || ""} onChange={(event) => { setSeguimientoFecha(event.target.value); guardarCampo({ seguimiento_fecha_sugerida: event.target.value }); }} />
                </label>
              </div>
            ) : null}
          </Seccion>

          {puedeFinalizar && !finalizada ? (
            <Seccion icon="activity" title="Estado" tone="admin">
              <div className="cl-state-actions">
                {puedeGestionar && ESTADO_SIGUIENTE[inspeccion.estado] ? (
                  <button type="button" className="cl-secondary" onClick={() => cambiarEstado(ESTADO_SIGUIENTE[inspeccion.estado])}>
                    {ESTADO_SIGUIENTE_LABEL[inspeccion.estado]}
                  </button>
                ) : null}
                {puedeGestionar && inspeccion.estado === "SEGUIMIENTO" ? (
                  <button type="button" className="cl-secondary" onClick={() => cambiarEstado("EN_PROCESO")}>Retomar (en proceso)</button>
                ) : null}
                <button type="button" className="cl-primary" onClick={finalizar} disabled={saving || finalizing}>
                  {finalizing ? "Finalizando…" : "Finalizar inspección"}
                </button>
              </div>
            </Seccion>
          ) : null}

          {puedeGestionar && !finalizada ? (
            <Seccion icon="users" title="Técnicos de apoyo" tone="admin">
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
                <ul className="ins-apoyo-list">
                  {apoyos.map((item) => (
                    <li key={item.id}>
                      <span className="ins-apoyo-avatar" aria-hidden="true"><Icon name="users" /></span>
                      <strong>{item.tecnico_nombre}</strong>
                      <button type="button" className="ins-apoyo-quitar" onClick={() => quitarApoyo(item.tecnico_id)} aria-label={`Quitar a ${item.tecnico_nombre} del apoyo`}>
                        <Icon name="close" />Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Seccion>
          ) : null}

          {isAdmin && !finalizada ? (
            <Seccion icon="userCreated" title="Reasignar responsable" tone="admin">
              <div className="ins-clave-search">
                <select value={nuevoResponsableId} onChange={(event) => setNuevoResponsableId(event.target.value)}>
                  <option value="">Selecciona nuevo responsable…</option>
                  {tecnicosElegibles.filter((tecnico) => tecnico.id !== responsable?.tecnico_id).map((tecnico) => (
                    <option key={tecnico.id} value={tecnico.id}>{tecnico.full_name}</option>
                  ))}
                </select>
                <button type="button" className="cl-secondary" onClick={reasignar} disabled={!nuevoResponsableId}>Reasignar</button>
              </div>
            </Seccion>
          ) : null}

          <Seccion icon="print" title="Impresión" tone="quiet">
            <div className="ins-print-badges">
              <PrintBadge etiqueta="Orden" estado={inspeccion.print_status?.ORDEN} />
              <PrintBadge etiqueta="Reporte" estado={inspeccion.print_status?.REPORTE} />
            </div>
            <div className="cl-drawer-main-actions" style={{ justifyContent: "flex-start", marginTop: 10 }}>
              <button type="button" className="cl-secondary" onClick={() => setPrintTipo("orden")}><Icon name="print" />Orden de inspección</button>
              <button type="button" className="cl-secondary" onClick={() => setPrintTipo("reporte")}><Icon name="print" />Reporte de inspección</button>
            </div>
          </Seccion>

          <Seccion icon="history" title="Bitácora" tone="quiet" meta={`${historial.length} ${historial.length === 1 ? "registro" : "registros"}`}>
            <details>
              <summary>Ver actividad</summary>
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
          </Seccion>
        </div>
        <footer>
          <div className="cl-drawer-main-actions">
            {isAdmin ? (
              <HoldButton
                icon={<Icon name="trash" />}
                size="md"
                doneLabel="Eliminando…"
                disabled={saving || finalizing || deleting}
                onHold={eliminar}
                onTap={() => notify(`Mantén presionado para eliminar la inspección ${inspeccion.numero_inspeccion}.`)}
              >
                {deleting ? "Eliminando…" : "Mantener para eliminar"}
              </HoldButton>
            ) : null}
            <button type="button" className="cl-secondary" onClick={cerrar} disabled={saving || finalizing || deleting}>Cerrar</button>
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
