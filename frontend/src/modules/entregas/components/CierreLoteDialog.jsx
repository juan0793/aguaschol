import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import SlideCommit from "../../../components/micro/SlideCommit";
import {
  estadoClass,
  estadoDocumentoLabel,
  formatDate,
  formatNumber,
  tipoDocumentoLabel
} from "../utils/entregasFormatters";
import { filaVacia, parsearPegado, posicionesDuplicadas } from "../utils/cierreLoteUtils";
import EntregasDrawer from "./EntregasDrawer";

const ESTADOS_ACTIVOS = ["PENDIENTE", "REENTREGADA", "NO_LOCALIZADA"];

export default function CierreLoteDialog({ api, config, lote, notify, onClose, onSaved }) {
  const motivos = config.motivos;
  const motivoPorDefecto = motivos[0]?.codigo || "CASA_CERRADA";
  const [detalle, setDetalle] = useState(lote.no_entregadas || []);
  const [sobrantes, setSobrantes] = useState("");
  const [observacion, setObservacion] = useState(lote.observacion_responsable || "");
  const [nuevas, setNuevas] = useState([]);
  const [pegado, setPegado] = useState("");
  const [modo, setModo] = useState("manual");
  const [guardando, setGuardando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [buscando, setBuscando] = useState(-1);
  const [duplicadosConfirmados, setDuplicadosConfirmados] = useState(false);

  useEffect(() => {
    setDetalle(lote.no_entregadas || []);
  }, [lote]);

  const identificadas = useMemo(
    () => detalle.filter((item) => ESTADOS_ACTIVOS.includes(item.estado)).length + nuevas.length,
    [detalle, nuevas]
  );
  // El backend rechaza el alta si un abonado/clave se repite dentro del lote, y
  // ese rechazo ocurre justo al pulsar "Cerrar lote": lo detectamos antes para
  // que la fila conflictiva se vea y el cierre no falle sin explicacion.
  const duplicados = useMemo(() => posicionesDuplicadas(nuevas, detalle), [nuevas, detalle]);
  const hayDuplicados = duplicados.length > 0;

  const sobrantesNum = Number(sobrantes || 0);
  const entregadas = Math.max(Number(lote.total_asignadas) - (Number.isFinite(sobrantesNum) ? sobrantesNum : 0), 0);
  const diferencia = sobrantesNum - identificadas;
  const sobrantesInvalidos =
    sobrantes === "" || !Number.isSafeInteger(sobrantesNum) || sobrantesNum < 0 || sobrantesNum > Number(lote.total_asignadas);
  const progreso = sobrantesNum > 0 ? Math.min((identificadas / sobrantesNum) * 100, 100) : 100;
  // Un unico lugar decide si el lote puede cerrarse y, sobre todo, por que no.
  // El motivo se muestra siempre junto al boton: un boton apagado sin
  // explicacion es lo que hacia parecer que el cierre "no hace nada".
  const motivoBloqueo = useMemo(() => {
    if (lote.estado !== "ABIERTO") {
      return "Este lote ya está cerrado o revisado. Un administrador debe reabrirlo para corregir el cierre.";
    }
    if (!config.permissions.can_close_own_lote) {
      return "Tu usuario no tiene permiso para cerrar lotes. Pídeselo a un administrador.";
    }
    if (buscando !== -1) return "Espera a que termine la búsqueda en el padrón.";
    if (sobrantesInvalidos) {
      return `Escribe cuántos sobrantes trajiste (usa 0 si entregaste todo), entre 0 y ${formatNumber(lote.total_asignadas)}.`;
    }
    if (diferencia > 0) {
      return `Declaraste ${formatNumber(sobrantesNum)} sobrante(s) y llevas ${formatNumber(identificadas)} identificado(s): falta(n) ${formatNumber(diferencia)} documento(s) por registrar.`;
    }
    if (diferencia < 0) {
      return `Declaraste ${formatNumber(sobrantesNum)} sobrante(s) pero hay ${formatNumber(identificadas)} documento(s) registrados: quita ${formatNumber(Math.abs(diferencia))} o sube los sobrantes.`;
    }
    if (hayDuplicados && !duplicadosConfirmados) {
      return `Hay ${formatNumber(duplicados.length)} documento(s) repetidos (mismo abonado y clave). Corrige la fila marcada o confirma que el duplicado es real.`;
    }
    return null;
  }, [
    lote.estado,
    lote.total_asignadas,
    config.permissions.can_close_own_lote,
    buscando,
    sobrantesInvalidos,
    diferencia,
    sobrantesNum,
    identificadas,
    hayDuplicados,
    duplicadosConfirmados,
    duplicados.length
  ]);

  const puedeCerrar = !guardando && !motivoBloqueo;
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
    if (identificadas + filas.length > lote.total_asignadas) { notify("El detalle no puede superar las asignadas."); return; }
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
    const total = Math.min(Number.isSafeInteger(faltantes) ? faltantes || 1 : 1, 100, Number(lote.total_asignadas) - identificadas);
    if (total <= 0) return;
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

    if (hayDuplicados && !duplicadosConfirmados) {
      notify("Hay documentos repetidos (mismo abonado y clave). Corrígelos o confirma que van duplicados.");
      return false;
    }

    const actualizado = await api.agregarNoEntregadas(lote.id, {
      items: nuevas,
      ...(hayDuplicados ? { permitir_duplicados: true } : {})
    });
    setDetalle(actualizado.no_entregadas || []);
    setNuevas([]);
    setDuplicadosConfirmados(false);
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

  // El cierre lo dispara un deslizador que refleja el resultado: si la promesa
  // falla, el control marca el error y regresa solo. Por eso `cerrar` propaga
  // la excepcion en lugar de tragarsela, y marca las que ya fueron avisadas
  // para no mostrar dos veces el mismo motivo.
  const yaAvisado = (mensaje) => Object.assign(new Error(mensaje), { avisado: true });

  const cerrar = async () => {
    if (guardando) throw yaAvisado("Espera a que termine la operación en curso.");
    if (motivoBloqueo) {
      notify(motivoBloqueo);
      throw yaAvisado(motivoBloqueo);
    }
    setGuardando(true);
    setCerrando(true);
    try {
      // guardarNuevas ya explica el motivo cuando devuelve false.
      if (!(await guardarNuevas())) throw yaAvisado("Revisa el detalle antes de cerrar.");
      const actualizado = await api.cerrarLote(lote.id, {
        total_sobrantes: Number(sobrantes),
        observacion_responsable: observacion
      });
      onSaved(actualizado);
    } catch (error) {
      if (!error.avisado) notify(error.message);
      throw error;
    } finally {
      setGuardando(false);
      setCerrando(false);
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
    <EntregasDrawer title={`Cerrar lote ${lote.id}`} busy={guardando} onClose={() => { if (!nuevas.length || window.confirm("Hay documentos sin guardar. ¿Descartar y salir?")) onClose(); }}>
        <header>
          <div>
            <span className="cl-kicker">Cierre de lote</span>
            <h2>{lote.responsable_nombre}</h2>
            <p>
              {lote.barrio_nombre} · {tipoDocumentoLabel(lote.tipo_documento)} · {formatDate(lote.fecha)} ·{" "}
              {formatNumber(lote.total_asignadas)} asignadas
            </p>
          </div>
          <button type="button" className="cl-icon-button" disabled={guardando} onClick={() => { if (!nuevas.length || window.confirm("Hay documentos sin guardar. ¿Descartar y salir?")) onClose(); }} aria-label="Cerrar">
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
                    aria-label="Sobrantes / no entregadas"
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
                {faltantes > 0 ? `Crear ${formatNumber(Math.min(faltantes, 100))} fila(s) faltante(s)` : "Agregar documento"}
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

            {hayDuplicados ? (
              <div className="ent-duplicados-aviso">
                <p>
                  {formatNumber(duplicados.length)} documento(s) repiten un abonado y clave ya capturados en este lote.
                  Corrige la fila marcada o confirma que el duplicado es real.
                </p>
                <label>
                  <input
                    type="checkbox"
                    checked={duplicadosConfirmados}
                    onChange={(event) => setDuplicadosConfirmados(event.target.checked)}
                  />
                  Sí, este lote lleva documentos repetidos
                </label>
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
                      <th>¿Por qué no se entregó?</th>
                      <th aria-label="Quitar" />
                    </tr>
                  </thead>
                  <tbody>
                    {nuevas.map((fila, index) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <tr key={`nueva-${index}`} className={duplicados.includes(index) ? "is-duplicada" : ""}>
                        <td>
                          <input
                            value={fila.numero_abonado}
                            aria-label={`Abonado, fila ${index + 1}`}
                            onChange={(event) => patchNueva(index, { numero_abonado: event.target.value })}
                            onBlur={(event) => buscarAbonado(index, event.target.value, "abonado")}
                            placeholder="10245"
                          />
                          {fila.abonado_nombre ? <small>{fila.abonado_nombre}</small> : null}
                          {duplicados.includes(index) ? <small className="ent-dup-hint">Repetido en este lote</small> : null}
                        </td>
                        <td>
                          <input
                            value={fila.clave_catastral}
                            aria-label={`Clave catastral, fila ${index + 1}`}
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
                          <textarea
                            rows={2}
                            aria-label={`Por qué no se entregó, fila ${index + 1}`}
                            value={fila.observacion}
                            onChange={(event) => patchNueva(index, { observacion: event.target.value })}
                            placeholder="Describe qué ocurrió en esta entrega"
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
            {!guardando && motivoBloqueo ? (
              <p className="cl-alert ent-cerrar-motivo" id="ent-cerrar-motivo" role="status">
                No se puede cerrar todavía: {motivoBloqueo}
              </p>
            ) : null}
            <SlideCommit
              label="Desliza para cerrar el lote"
              doneLabel="Lote cerrado"
              errorLabel="No se pudo cerrar el lote"
              width="fill"
              onConfirm={cerrar}
              disabled={Boolean(motivoBloqueo) || (guardando && !cerrando)}
              title={motivoBloqueo || undefined}
              describedBy={motivoBloqueo ? "ent-cerrar-motivo" : undefined}
            />
          </div>
        </footer>
    </EntregasDrawer>
  );
}
