import { useCallback, useEffect, useState } from "react";
import { Icon } from "../../../components/Icon";
import IntentosTimeline from "./IntentosTimeline";
import {
  estadoClass,
  estadoDocumentoLabel,
  formatDate,
  tipoDocumentoLabel
} from "../utils/entregasFormatters";

const hoy = () => new Date().toISOString().slice(0, 10);

export default function NoEntregadaDetalle({ api, config, id, personal, permissions, notify, onClose, onChanged }) {
  const [documento, setDocumento] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState({ fecha: hoy(), resultado: "CASA_CERRADA", responsable_id: "", observacion: "" });
  const [observacion, setObservacion] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await api.noEntregada(id);
      setDocumento(data);
      setObservacion(data.observacion || "");
      setIntento((actual) => ({ ...actual, responsable_id: String(data.responsable_id || "") }));
    } catch (error) {
      notify(error.message);
      onClose();
    } finally {
      setCargando(false);
    }
  }, [api, id, notify, onClose]);

  useEffect(() => {
    cargar();
  }, [cargar]);

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
    <div className="cl-drawer-backdrop" role="dialog" aria-modal="true">
      <aside className="cl-drawer ent-drawer">
        <header>
          <div>
            <span className="cl-kicker">Documento no entregado</span>
            <h2>{documento?.numero_abonado || "—"}</h2>
            <p>
              {documento?.clave_catastral || "Sin clave"} · {documento?.barrio_nombre || "—"} ·{" "}
              {tipoDocumentoLabel(documento?.tipo_documento)}
            </p>
          </div>
          <button type="button" className="cl-icon-button" onClick={onClose} aria-label="Cerrar">
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

              {permissions.can_manage_seguimiento ? (
                <>
                  <form className="ent-card" onSubmit={registrarIntento}>
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
                    <div className="ent-acciones">
                      <button type="submit" className="cl-secondary" disabled={guardando}>
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
      </aside>
    </div>
  );
}
