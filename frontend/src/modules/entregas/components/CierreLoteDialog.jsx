import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import {
  estadoClass,
  estadoDocumentoLabel,
  formatDate,
  formatNumber,
  tipoDocumentoLabel
} from "../utils/entregasFormatters";
import { filaVacia, parsearPegado } from "../utils/cierreLoteUtils";

const ESTADOS_ACTIVOS = ["PENDIENTE", "REENTREGADA", "NO_LOCALIZADA"];

export default function CierreLoteDialog({ api, config, lote, notify, onClose, onSaved }) {
  const motivos = config.motivos;
  const motivoPorDefecto = motivos[0]?.codigo || "CASA_CERRADA";
  const [detalle, setDetalle] = useState(lote.no_entregadas || []);
  const [sobrantes, setSobrantes] = useState(String(lote.total_sobrantes ?? ""));
  const [observacion, setObservacion] = useState(lote.observacion_responsable || "");
  const [nuevas, setNuevas] = useState([]);
  const [pegado, setPegado] = useState("");
  const [modo, setModo] = useState("manual");
  const [guardando, setGuardando] = useState(false);
  const [buscando, setBuscando] = useState(-1);

  useEffect(() => {
    setDetalle(lote.no_entregadas || []);
  }, [lote]);

  const identificadas = useMemo(
    () => detalle.filter((item) => ESTADOS_ACTIVOS.includes(item.estado)).length + nuevas.length,
    [detalle, nuevas]
  );
  const sobrantesNum = Number(sobrantes || 0);
  const entregadas = Math.max(Number(lote.total_asignadas) - (Number.isFinite(sobrantesNum) ? sobrantesNum : 0), 0);
  const diferencia = sobrantesNum - identificadas;
  const sobrantesInvalidos =
    sobrantes === "" || sobrantesNum < 0 || sobrantesNum > Number(lote.total_asignadas);
  const progreso = sobrantesNum > 0 ? Math.min((identificadas / sobrantesNum) * 100, 100) : 100;
  const puedeCerrar = !guardando && !sobrantesInvalidos && diferencia === 0;
  const faltantes = Math.max(diferencia, 0);

  const patchNueva = (index, cambios) =>
    setNuevas((filas) => filas.map((fila, posicion) => (posicion === index ? { ...fila, ...cambios } : fila)));

  // Autocompleta clave y nombre a partir del padrón ya existente en el sistema.
  const buscarAbonado = async (index, valor, campo) => {
    if (!String(valor).trim()) return;
    setBuscando(index);
    try {
      const resultado = await api.buscarClave(valor, campo);
      const coincidencia = resultado?.matches?.[0];
      if (!coincidencia) {
        notify("No se encontró el dato en el padrón; puedes continuar manualmente.");
        return;
      }
      patchNueva(index, {
        numero_abonado: String(coincidencia.abonado ?? valor),
        clave_catastral: coincidencia.clave_catastral || "",
        abonado_nombre: coincidencia.inquilino || coincidencia.nombre || ""
      });
    } catch (error) {
      notify(error.message);
    } finally {
      setBuscando(-1);
    }
  };

  const agregarPegado = () => {
    const filas = parsearPegado(pegado, motivos);
    if (!filas.length) {
      notify("No se reconoció ninguna fila en el texto pegado.");
      return;
    }
    setNuevas((actuales) => [...actuales, ...filas]);
    const totalPegado = identificadas + filas.length;
    if (sobrantes === "" || sobrantesNum < totalPegado) setSobrantes(String(totalPegado));
    setPegado("");
    setModo("manual");
  };

  const agregarFaltantes = () => {
    const total = faltantes || 1;
    setNuevas((filas) => [...filas, ...Array.from({ length: total }, () => filaVacia(motivoPorDefecto))]);
    if (sobrantes === "" || faltantes === 0) setSobrantes(String(identificadas + total));
  };

  const marcarTodoEntregado = () => {
    if (identificadas > 0) {
      notify("Ya hay no entregadas registradas. Quita esas filas si el lote realmente cerró en cero.");
      return;
    }
    setSobrantes("0");
    setNuevas([]);
  };

  const guardarNuevas = async () => {
    if (!nuevas.length) return true;
    const incompletas = nuevas.filter((fila) => !fila.numero_abonado.trim() && !fila.clave_catastral.trim());
    if (incompletas.length) {
      notify("Cada documento necesita número de abonado o clave catastral.");
      return false;
    }
    const sinObservacion = nuevas.filter(
      (fila) => motivos.find((item) => item.codigo === fila.motivo)?.requiere_observacion && !fila.observacion.trim()
    );
    if (sinObservacion.length) {
      notify('Los documentos con motivo "Otro" necesitan una observación.');
      return false;
    }

    const actualizado = await api.agregarNoEntregadas(lote.id, { items: nuevas });
    setDetalle(actualizado.no_entregadas || []);
    setNuevas([]);
    return true;
  };

  const eliminarExistente = async (documento) => {
    try {
      await api.eliminarNoEntregada(documento.id);
      setDetalle((filas) => filas.filter((fila) => fila.id !== documento.id));
    } catch (error) {
      notify(error.message);
    }
  };

  const cerrar = async () => {
    if (guardando) return;
    setGuardando(true);
    try {
      const ok = await guardarNuevas();
      if (!ok) return;
      const actualizado = await api.cerrarLote(lote.id, {
        total_sobrantes: Number(sobrantes),
        observacion_responsable: observacion
      });
      onSaved(actualizado);
    } catch (error) {
      notify(error.message);
    } finally {
      setGuardando(false);
    }
  };

  const guardarDetalle = async () => {
    setGuardando(true);
    try {
      if (await guardarNuevas()) notify("Documentos registrados en el lote.");
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
            <span className="cl-kicker">Cierre de lote</span>
            <h2>{lote.responsable_nombre}</h2>
            <p>
              {lote.barrio_nombre} · {tipoDocumentoLabel(lote.tipo_documento)} · {formatDate(lote.fecha)} ·{" "}
              {formatNumber(lote.total_asignadas)} asignadas
            </p>
          </div>
          <button type="button" className="cl-icon-button" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>

        <div className="cl-drawer-scroll">
          <div className="ent-cierre-pasos" aria-label="Progreso del cierre">
            <span className={sobrantes === "" ? "is-active" : "is-done"}>1<small>Sobrantes</small></span>
            <span className={diferencia === 0 && sobrantes !== "" ? "is-done" : "is-active"}>2<small>No entregadas</small></span>
            <span className={puedeCerrar ? "is-done" : ""}>3<small>Confirmar</small></span>
          </div>

          <section className="ent-card ent-cierre-resumen">
            <h3>Resultado del recorrido</h3>
            <div className="ent-cierre-kpis">
              <div>
                <span>Recibidas</span>
                <strong>{formatNumber(lote.total_asignadas)}</strong>
              </div>
              <div>
                <span>Entregadas</span>
                <strong>{formatNumber(entregadas)}</strong>
              </div>
              <div className={diferencia === 0 && sobrantes !== "" ? "is-ok" : "is-alert"}>
                <span>Por registrar</span>
                <strong>{formatNumber(Math.max(diferencia, 0))}</strong>
              </div>
            </div>

            <div className="ent-grid-2">
              <label className="cl-field">
                Sobrantes / no entregadas
                <div className="ent-stepper">
                  <button
                    type="button"
                    aria-label="Restar sobrante"
                    onClick={() => setSobrantes(String(Math.max(sobrantesNum - 1, 0)))}
                    disabled={sobrantesInvalidos && sobrantes !== ""}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0"
                    max={lote.total_asignadas}
                    step="1"
                    inputMode="numeric"
                    value={sobrantes}
                    onChange={(event) => setSobrantes(event.target.value)}
                  />
                  <button
                    type="button"
                    aria-label="Sumar sobrante"
                    onClick={() => setSobrantes(String(Math.min(sobrantesNum + 1, Number(lote.total_asignadas))))}
                    disabled={sobrantesNum >= Number(lote.total_asignadas)}
                  >
                    +
                  </button>
                </div>
                <button type="button" className="cl-secondary ent-quick-zero" onClick={marcarTodoEntregado}>
                  Todo entregado, cerrar en 0
                </button>
              </label>
              <label className="cl-field">
                Entregadas (calculado)
                <input type="text" value={formatNumber(entregadas)} readOnly />
              </label>
              <label className="cl-field is-wide">
                Observación del responsable
                <textarea
                  rows={3}
                  value={observacion}
                  onChange={(event) => setObservacion(event.target.value)}
                  placeholder="Ej. Varias viviendas se encontraron cerradas durante el recorrido de la mañana."
                />
              </label>
            </div>
            {sobrantesInvalidos ? (
              <p className="cl-alert">Los sobrantes deben estar entre 0 y {formatNumber(lote.total_asignadas)}.</p>
            ) : null}
          </section>

          <section className="ent-card">
            <header className="ent-card-head">
              <div>
                <h3>Identificar no entregadas</h3>
                <p>
                  Identificadas {formatNumber(identificadas)} de {formatNumber(sobrantesNum)} sobrantes.
                </p>
              </div>
              <div className="ent-modo-switch">
                <button
                  type="button"
                  className={modo === "manual" ? "is-active" : ""}
                  onClick={() => setModo("manual")}
                >
                  Agregar manualmente
                </button>
                <button type="button" className={modo === "pegar" ? "is-active" : ""} onClick={() => setModo("pegar")}>
                  Pegar varias filas
                </button>
              </div>
            </header>

            {diferencia !== 0 && sobrantes !== "" ? (
              <p className={`ent-diferencia ${diferencia > 0 ? "is-atencion" : "is-critico"}`}>
                {diferencia > 0
                  ? `Faltan ${formatNumber(diferencia)} documento(s) por identificar.`
                  : `Hay ${formatNumber(Math.abs(diferencia))} documento(s) de más respecto a los sobrantes declarados.`}
              </p>
            ) : null}
            <div className="ent-cierre-progress">
              <span>{formatNumber(identificadas)} / {formatNumber(sobrantesNum)} registradas</span>
              <i><em style={{ width: `${progreso}%` }} /></i>
            </div>

            <div className="ent-captura-actions">
              <button type="button" className="cl-secondary" onClick={agregarFaltantes}>
                <Icon name="plus" />
                {faltantes > 0 ? `Crear ${formatNumber(faltantes)} fila(s) faltante(s)` : "Agregar documento"}
              </button>
              <button type="button" className="cl-secondary" onClick={() => setModo("pegar")}>
                <Icon name="copy" />
                Pegar listado
              </button>
            </div>

            {modo === "pegar" ? (
              <div className="ent-pegado">
                <label className="cl-field">
                  Pega una fila por documento (abonado, clave, motivo)
                  <textarea
                    rows={6}
                    value={pegado}
                    onChange={(event) => setPegado(event.target.value)}
                    placeholder={"10245\t10-20-03-04\tCasa cerrada\n10287\t10-20-03-18\tDirección no encontrada"}
                  />
                </label>
                <button type="button" className="cl-secondary" onClick={agregarPegado}>
                  <Icon name="plus" />
                  Agregar filas
                </button>
              </div>
            ) : null}

            {nuevas.length ? (
              <div className="cl-table-wrap">
                <table className="cl-table ent-table ent-captura ent-captura-table">
                  <thead>
                    <tr>
                      <th>Abonado</th>
                      <th>Clave catastral</th>
                      <th>Motivo</th>
                      <th>Observación</th>
                      <th aria-label="Quitar" />
                    </tr>
                  </thead>
                  <tbody>
                    {nuevas.map((fila, index) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <tr key={`nueva-${index}`}>
                        <td>
                          <input
                            value={fila.numero_abonado}
                            onChange={(event) => patchNueva(index, { numero_abonado: event.target.value })}
                            onBlur={(event) => buscarAbonado(index, event.target.value, "abonado")}
                            placeholder="10245"
                          />
                          {fila.abonado_nombre ? <small>{fila.abonado_nombre}</small> : null}
                        </td>
                        <td>
                          <input
                            value={fila.clave_catastral}
                            onChange={(event) => patchNueva(index, { clave_catastral: event.target.value })}
                            onBlur={(event) => buscarAbonado(index, event.target.value, "clave")}
                            placeholder="10-20-03-04"
                          />
                          {buscando === index ? <small>Buscando en padrón…</small> : null}
                        </td>
                        <td>
                          <select value={fila.motivo} onChange={(event) => patchNueva(index, { motivo: event.target.value })}>
                            {motivos.map((motivo) => (
                              <option key={motivo.codigo} value={motivo.codigo}>
                                {motivo.etiqueta}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            value={fila.observacion}
                            onChange={(event) => patchNueva(index, { observacion: event.target.value })}
                            placeholder="Detalle específico del caso"
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="cl-icon-button"
                            onClick={() => setNuevas((filas) => filas.filter((_unused, posicion) => posicion !== index))}
                            aria-label="Quitar fila"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {detalle.length ? (
              <div className="cl-table-wrap ent-detalle-guardado">
                <table className="cl-table ent-table ent-detalle-table">
                  <thead>
                    <tr>
                      <th>Abonado</th>
                      <th>Clave</th>
                      <th>Motivo</th>
                      <th>Estado</th>
                      <th aria-label="Acciones" />
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.map((documento) => (
                      <tr key={documento.id}>
                        <td>{documento.numero_abonado || "—"}</td>
                        <td>{documento.clave_catastral || "—"}</td>
                        <td>{motivos.find((item) => item.codigo === documento.motivo)?.etiqueta || documento.motivo}</td>
                        <td>
                          <span className={`cl-status ${estadoClass(documento.estado)}`}>
                            <i />
                            {estadoDocumentoLabel(documento.estado)}
                          </span>
                        </td>
                        <td>
                          {lote.estado === "ABIERTO" ? (
                            <button
                              type="button"
                              className="cl-icon-button"
                              onClick={() => eliminarExistente(documento)}
                              aria-label="Eliminar documento"
                            >
                              ✕
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </div>

        <footer className="ent-drawer-footer">
          <button type="button" className="cl-secondary" onClick={guardarDetalle} disabled={guardando || !nuevas.length}>
            Guardar detalle
          </button>
          <div className="ent-cerrar-wrap">
            {!guardando && sobrantesInvalidos ? (
              <p className="cl-alert ent-cerrar-motivo">Escribe los sobrantes (usa 0 si entregaste todo) para poder cerrar.</p>
            ) : !guardando && diferencia !== 0 ? (
              <p className="cl-alert ent-cerrar-motivo">
                {diferencia > 0
                  ? `Identifica ${formatNumber(diferencia)} documento(s) más antes de cerrar.`
                  : `Quita ${formatNumber(Math.abs(diferencia))} documento(s) de más antes de cerrar.`}
              </p>
            ) : null}
            <button
              type="button"
              className="cl-primary"
              onClick={cerrar}
              disabled={!puedeCerrar}
            >
              <Icon name={guardando ? "refresh" : "success"} />
              {guardando ? "Cerrando…" : "Cerrar lote"}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
