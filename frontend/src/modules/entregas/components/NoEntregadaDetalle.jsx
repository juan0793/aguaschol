import { useEffect, useRef, useState } from "react";
import { Icon } from "../../../components/Icon";
import AvisoTecnico from "./AvisoTecnico";
import IntentosTimeline from "./IntentosTimeline";
import EntregasDrawer from "./EntregasDrawer";
import { toLocalIsoDate } from "../utils/entregasDate";
import {
  estadoClass,
  estadoDocumentoLabel,
  formatDate,
  formatDateTime,
  formatLempiras,
  tipoDocumentoLabel
} from "../utils/entregasFormatters";

const hoy = toLocalIsoDate;

export default function NoEntregadaDetalle({ api, config, id, personal, permissions, notify, onClose, onChanged }) {
  const [documento, setDocumento] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState({ fecha: hoy(), resultado: "CASA_CERRADA", responsable_id: "", observacion: "" });
  const [observacion, setObservacion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const puedeGestionar = permissions.can_manage_seguimiento && (documento?.lote_estado !== "REVISADO" || permissions.can_force_close) && documento?.estado !== "CANCELADA";

  const puedeAvisar = permissions.can_send_aviso && config.plantillas_aviso?.length > 0 && documento?.estado !== "CANCELADA";

  // El padre crea onClose y notify en cada render: si la carga dependiera de ellos,
  // cada redibujo de la pagina (foco de la ventana, refresco de contadores) volvia a
  // pedir el documento y el cajon parpadeaba en "Cargando seguimiento…".
  const onCloseRef = useRef(onClose);
  const notifyRef = useRef(notify);
  useEffect(() => {
    onCloseRef.current = onClose;
    notifyRef.current = notify;
  });

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    api.noEntregada(id)
      .then((data) => {
        if (!vigente) return;
        setDocumento(data);
        setObservacion(data.observacion || "");
        setIntento((actual) => ({ ...actual, responsable_id: String(data.responsable_id || "") }));
      })
      .catch((error) => {
        if (!vigente) return;
        notifyRef.current(error.message);
        onCloseRef.current();
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [api, id]);

  const registrarIntento = async (event) => {
    event.preventDefault();
    if (guardando) return;
    setGuardando(true);
    try {
      setDocumento(await api.registrarIntento(id, intento));
      setIntento((actual) => ({ ...actual, observacion: "" }));
      onChanged?.();
    } catch (error) {
      notify(error.message);
    } finally {
      setGuardando(false);
    }
  };

  const actualizar = async (payload) => {
    setGuardando(true);
    try {
      setDocumento(await api.actualizarNoEntregada(id, payload));
      onChanged?.();
    } catch (error) {
      notify(error.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <EntregasDrawer title="Seguimiento del documento" onClose={onClose} busy={guardando}>
        <header>
          <div>
            <span className="cl-kicker">Documento no entregado</span>
            <h2>{documento?.numero_abonado || "—"}</h2>
            <p>
              {documento?.clave_catastral || "Sin clave"} · {documento?.barrio_nombre || "—"} ·{" "}
              {tipoDocumentoLabel(documento?.tipo_documento)}
            </p>
          </div>
          <button type="button" className="cl-icon-button" onClick={onClose} disabled={guardando} aria-label="Cerrar">
            ✕
          </button>
        </header>

        <div className="cl-drawer-scroll">
          {cargando || !documento ? (
            <p className="cl-module-loading">
              <Icon name="refresh" />
              Cargando seguimiento…
            </p>
          ) : (
            <>
              <section className="ent-card ent-resumen-documento">
                <div>
                  <span>Estado</span>
                  <strong>
                    <span className={`cl-status ${estadoClass(documento.estado)}`}>
                      <i />
                      {estadoDocumentoLabel(documento.estado)}
                    </span>
                  </strong>
                </div>
                <div>
                  <span>Responsable</span>
                  <strong>{documento.responsable_nombre || "—"}</strong>
                </div>
                <div>
                  <span>Desde</span>
                  <strong>{formatDate(documento.fecha_lote)}</strong>
                </div>
                <div>
                  <span>Intentos</span>
                  <strong>{documento.intentos_detalle?.length || 0}</strong>
                </div>
              </section>

              {documento.saldo ? (
                <section className="ent-card ent-saldo-documento" aria-label="Saldo en el padrón">
                  {documento.saldo.encontrado ? (
                    <dl className="ent-saldo-cifras">
                      <div><dt>Saldo total</dt><dd>{formatLempiras(documento.saldo.total)}</dd></div>
                      <div><dt>Capital</dt><dd>{formatLempiras(documento.saldo.capital)}</dd></div>
                      <div className="is-mora"><dt>Mora</dt><dd>{formatLempiras(documento.saldo.mora)}</dd></div>
                    </dl>
                  ) : (
                    <p>Este documento no tiene registro en el padrón vigente: no se conoce su saldo.</p>
                  )}
                </section>
              ) : null}

              <section className="ent-card">
                <h3>Historial</h3>
                <IntentosTimeline
                  documento={{
                    ...documento,
                    motivo_etiqueta:
                      config.motivos.find((item) => item.codigo === documento.motivo)?.etiqueta || documento.motivo
                  }}
                />
              </section>

              {puedeAvisar || documento.avisos?.length ? (
                <section className="ent-card">
                  <h3>Avisos al técnico</h3>
                  {documento.avisos?.length ? (
                    <ul className="ent-avisos">
                      {documento.avisos.map((aviso) => (
                        <li key={aviso.id}>
                          <p>{aviso.body}</p>
                          <small>
                            {formatDateTime(aviso.created_at)} · {aviso.remitente_nombre || "Oficina"} → {aviso.destinatario_nombre || "Técnico"} ·{" "}
                            <span className={aviso.leido ? "is-leido" : "is-sin-leer"}>{aviso.leido ? "Leído" : "Sin leer"}</span>
                          </small>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {puedeAvisar ? (
                    <AvisoTecnico
                      api={api}
                      documento={documento}
                      plantillas={config.plantillas_aviso}
                      notify={notify}
                      onEnviado={setDocumento}
                    />
                  ) : null}
                </section>
              ) : null}

              {puedeGestionar ? (
                <>
                  <form id="ent-intento-form" className="ent-card ent-intento-form" onSubmit={registrarIntento}>
                    <h3>Registrar intento</h3>
                    <div className="ent-grid-2">
                      <label className="cl-field">
                        Fecha
                        <input
                          type="date"
                          value={intento.fecha}
                          onChange={(event) => setIntento({ ...intento, fecha: event.target.value })}
                          required
                        />
                      </label>
                      <label className="cl-field">
                        Resultado
                        <select
                          value={intento.resultado}
                          onChange={(event) => setIntento({ ...intento, resultado: event.target.value })}
                        >
                          {config.resultados_intento.map((resultado) => (
                            <option key={resultado} value={resultado}>
                              {resultado.replace(/_/g, " ").toLowerCase()}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="cl-field">
                        Responsable del intento
                        <select
                          value={intento.responsable_id}
                          onChange={(event) => setIntento({ ...intento, responsable_id: event.target.value })}
                        >
                          <option value="">Mismo del lote</option>
                          {personal.map((persona) => (
                            <option key={persona.id} value={persona.id}>
                              {persona.nombre_completo}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="cl-field is-wide">
                        Observación del intento
                        <textarea
                          rows={2}
                          value={intento.observacion}
                          onChange={(event) => setIntento({ ...intento, observacion: event.target.value })}
                        />
                      </label>
                    </div>
                  </form>

                  <section className="ent-card">
                    <h3>Observación del documento</h3>
                    <label className="cl-field">
                      Detalle específico de este abonado
                      <textarea rows={3} value={observacion} onChange={(event) => setObservacion(event.target.value)} />
                    </label>
                    <div className="ent-acciones">
                      <button
                        type="button"
                        className="cl-secondary"
                        disabled={guardando}
                        onClick={() => actualizar({ observacion })}
                      >
                        Actualizar observación
                      </button>
                      <button
                        type="button"
                        className="cl-quiet"
                        disabled={guardando || documento.estado === "CANCELADA"}
                        onClick={() => actualizar({ estado: "CANCELADA" })}
                      >
                        Cancelar seguimiento
                      </button>
                    </div>
                  </section>
                </>
              ) : null}
            </>
          )}
        </div>

        {!cargando && documento && puedeGestionar ? (
          <footer className="ent-drawer-footer ent-seguimiento-footer">
            <button type="submit" form="ent-intento-form" className="cl-secondary" disabled={guardando}>
              <Icon name="plus" />
              Registrar intento
            </button>
            <button
              type="button"
              className="cl-primary"
              disabled={guardando || documento.estado === "REENTREGADA"}
              onClick={() => actualizar({ estado: "REENTREGADA" })}
            >
              <Icon name="success" />
              Marcar reentregada
            </button>
          </footer>
        ) : null}
    </EntregasDrawer>
  );
}
