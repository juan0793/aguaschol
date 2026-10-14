import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../../components/Icon";
import SlideCommit from "../../../components/micro/SlideCommit";
import {
  estadoClass,
  estadoDocumentoLabel,
  formatCount,
  formatDate,
  formatNumber
} from "../utils/entregasFormatters";
import { filaVacia, parsearPegado, posicionesDuplicadas } from "../utils/cierreLoteUtils";
import { cierreTieneCambiosPendientes, clearEntregaDraft, falloEntregaAmbiguo, readEntregaDraft, saveEntregaDraft } from "../utils/entregaDraftStorage";
import EntregasDrawer from "./EntregasDrawer";

const ESTADOS_ACTIVOS = ["PENDIENTE", "REENTREGADA", "NO_LOCALIZADA"];
const MAX_FILAS = 100;
const filaTieneDatos = (fila) => Boolean(fila.numero_abonado.trim() || fila.clave_catastral.trim() || fila.observacion.trim());
const filaIncompleta = (fila) => !fila.numero_abonado.trim() && !fila.clave_catastral.trim();

/**
 * Cierre de un lote, pensado primero para el técnico en el teléfono. Lo primero es una
 * pregunta con dos respuestas grandes: "¿Te sobraron facturas?". Si sobraron, al indicar
 * cuántas aparece una ficha por cada sobrante, sin botones intermedios. Las palabras son las
 * del técnico ("sobrantes"), no las del sistema ("no entregadas").
 */
export default function CierreLoteDialog({ api, config, lote, notify, onClose, onSaved, sessionUserId }) {
  const motivos = config.motivos;
  const motivoPorDefecto = motivos[0]?.codigo || "CASA_CERRADA";
  const observacionInicial = lote.observacion_responsable || "";
  const draftId = `cierre-${lote.id}`;
  const total = Number(lote.total_asignadas) || 0;
  const esNota = lote.tipo_documento === "NOTA_COBRO";
  const docs = esNota ? "notas de cobro" : "facturas";
  const doc = esNota ? "nota de cobro" : "factura";
  const [draftInicial] = useState(() => readEntregaDraft(sessionUserId, draftId));
  const [detalle, setDetalle] = useState(lote.no_entregadas || []);
  // Sin borrador, un lote con sobrantes ya guardados (reabierto o "Guardar sin cerrar")
  // arranca con esa cantidad para no pedirla de nuevo.
  const [sobrantes, setSobrantes] = useState(() => {
    if (typeof draftInicial?.sobrantes === "string") return draftInicial.sobrantes;
    const guardados = (lote.no_entregadas || []).filter((item) => ESTADOS_ACTIVOS.includes(item.estado)).length;
    return guardados ? String(guardados) : "";
  });
  const [observacion, setObservacion] = useState(typeof draftInicial?.observacion === "string" ? draftInicial.observacion : observacionInicial);
  const [nuevas, setNuevas] = useState(Array.isArray(draftInicial?.nuevas) ? draftInicial.nuevas : []);
  const [pegado, setPegado] = useState(typeof draftInicial?.pegado === "string" ? draftInicial.pegado : "");
  const [modo, setModo] = useState(draftInicial?.modo === "pegar" ? "pegar" : "manual");
  const [guardando, setGuardando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [buscando, setBuscando] = useState(-1);
  const [duplicadosConfirmados, setDuplicadosConfirmados] = useState(draftInicial?.duplicadosConfirmados === true);
  const [draftRecuperado, setDraftRecuperado] = useState(Boolean(draftInicial));
  const [draftPersistido, setDraftPersistido] = useState(null);
  const [requiereRecarga, setRequiereRecarga] = useState(false);
  // "Sí, me sobraron" sigue elegido aunque la cantidad baje a 0 mientras se corrige.
  const [eligioSobrantes, setEligioSobrantes] = useState(
    () => Number(draftInicial?.sobrantes || 0) > 0 || (lote.no_entregadas || []).some((item) => ESTADOS_ACTIVOS.includes(item.estado))
  );
  const cantidadRef = useRef(null);

  useEffect(() => {
    setDetalle(lote.no_entregadas || []);
  }, [lote]);

  const guardadasActivas = useMemo(() => detalle.filter((item) => ESTADOS_ACTIVOS.includes(item.estado)).length, [detalle]);
  const identificadas = guardadasActivas + nuevas.length;
  const incompletas = useMemo(() => nuevas.filter(filaIncompleta).length, [nuevas]);
  const sinNota = useMemo(
    () => nuevas.filter((fila) => motivos.find((item) => item.codigo === fila.motivo)?.requiere_observacion && !fila.observacion.trim()).length,
    [nuevas, motivos]
  );
  // El backend rechaza el alta si un abonado/clave se repite dentro del lote, y
  // ese rechazo ocurre justo al cerrar: lo detectamos antes para que la ficha
  // conflictiva se vea y el cierre no falle sin explicacion.
  const duplicados = useMemo(() => posicionesDuplicadas(nuevas, detalle), [nuevas, detalle]);
  const hayDuplicados = duplicados.length > 0;

  const sobrantesNum = Number(sobrantes || 0);
  const entregadas = Math.max(total - (Number.isFinite(sobrantesNum) ? sobrantesNum : 0), 0);
  const diferencia = sobrantesNum - identificadas;
  const sobrantesInvalidos = sobrantes === "" || !Number.isSafeInteger(sobrantesNum) || sobrantesNum < 0 || sobrantesNum > total;
  const respuesta = sobrantes === "" && !eligioSobrantes ? null : eligioSobrantes ? "sobraron" : "todas";

  // Un unico lugar decide si el lote puede cerrarse y, sobre todo, por que no. El motivo
  // largo va en escritorio; en el teléfono el pie lleva la versión corta.
  const bloqueo = useMemo(() => {
    if (lote.estado !== "ABIERTO") return { largo: "Este lote ya está cerrado o revisado. Un administrador debe reabrirlo para corregir el cierre.", corto: "El lote ya está cerrado." };
    if (!config.permissions.can_close_own_lote) return { largo: "Tu usuario no tiene permiso para cerrar lotes. Pídeselo a un administrador.", corto: "Sin permiso para cerrar lotes." };
    if (requiereRecarga) return { largo: "No se confirmó qué alcanzó a guardar el servidor. Cierra y vuelve a abrir el lote para revisarlo antes de continuar.", corto: "Cierra y vuelve a abrir el lote." };
    if (buscando !== -1) return { largo: "Espera a que termine la búsqueda en el padrón.", corto: "Buscando en el padrón…" };
    if (sobrantes === "" && !eligioSobrantes) return { largo: `Responde arriba si te sobraron ${docs}.`, corto: `¿Te sobraron ${docs}? Responde arriba.` };
    if (sobrantes === "" || (eligioSobrantes && sobrantesNum === 0)) return { largo: `Indica cuántas ${docs} te sobraron, o elige "No" si entregaste todas.`, corto: "Indica cuántas te sobraron." };
    if (sobrantesInvalidos) return { largo: `Los sobrantes van de 0 a ${formatNumber(total)}.`, corto: `Sobrantes entre 0 y ${formatNumber(total)}.` };
    if (diferencia > 0) return { largo: `Indicaste ${formatCount(sobrantesNum, "sobrante")} y hay ${formatCount(identificadas, "ficha")}: ${diferencia === 1 ? "falta" : "faltan"} ${formatNumber(diferencia)}.`, corto: `${diferencia === 1 ? "Falta" : "Faltan"} ${formatCount(diferencia, "sobrante")} por anotar.` };
    if (diferencia < 0) return { largo: `Hay ${formatCount(identificadas, "sobrante anotado", "sobrantes anotados")} pero indicaste ${formatNumber(sobrantesNum)}: quita ${formatNumber(Math.abs(diferencia))} o sube la cantidad.`, corto: `Sobran ${formatNumber(Math.abs(diferencia))} fichas: revisa la cantidad.` };
    if (incompletas) return { largo: `Anota el abonado o la clave de cada sobrante: ${incompletas === 1 ? "falta 1 ficha" : `faltan ${formatNumber(incompletas)} fichas`}.`, corto: `Falta el abonado o la clave en ${formatCount(incompletas, "ficha")}.` };
    if (sinNota) return { largo: `Escribe la nota de ${sinNota === 1 ? "la ficha" : `las ${formatNumber(sinNota)} fichas`} con motivo "Otro".`, corto: `Falta la nota en ${formatCount(sinNota, "ficha")} con "Otro".` };
    if (hayDuplicados && !duplicadosConfirmados) return { largo: `Hay ${formatCount(duplicados.length, "sobrante repetido", "sobrantes repetidos")} (mismo abonado y clave). Corrígelo o confirma que es real.`, corto: "Revisa los sobrantes repetidos." };
    return null;
  }, [lote.estado, config.permissions.can_close_own_lote, requiereRecarga, buscando, sobrantes, eligioSobrantes, sobrantesInvalidos, total, docs, diferencia, sobrantesNum, identificadas, incompletas, sinNota, hayDuplicados, duplicadosConfirmados, duplicados.length]);

  const hayCambiosPendientes = cierreTieneCambiosPendientes({ sobrantes, observacion, observacionInicial, nuevas, pegado });

  useEffect(() => {
    if (!hayCambiosPendientes) {
      clearEntregaDraft(sessionUserId, draftId);
      setDraftPersistido(false);
      return;
    }
    setDraftPersistido(saveEntregaDraft(sessionUserId, draftId, { sobrantes, observacion, nuevas, pegado, modo, duplicadosConfirmados }));
  }, [draftId, duplicadosConfirmados, hayCambiosPendientes, modo, nuevas, observacion, pegado, sessionUserId, sobrantes]);

  const persistirCaptura = () => {
    const guardado = saveEntregaDraft(sessionUserId, draftId, { sobrantes, observacion, nuevas, pegado, modo, duplicadosConfirmados });
    setDraftPersistido(guardado);
    return guardado;
  };

  const solicitarCierre = () => {
    const guardado = hayCambiosPendientes ? persistirCaptura() : false;
    if (hayCambiosPendientes && !window.confirm(guardado
      ? "Hay cambios sin enviar. Se conservarán en esta pestaña para retomarlos después. ¿Quieres salir?"
      : "Hay cambios sin enviar y no se pudo guardar un borrador local. ¿Quieres descartarlos y salir?")) return;
    onClose();
  };

  // La cantidad manda: al subirla aparecen fichas vacías hasta igualarla; al bajarla se
  // quitan solo fichas vacías del final, nunca una con datos.
  const cambiarSobrantes = (valor) => {
    setSobrantes(valor);
    const n = Number(valor);
    if (valor === "" || !Number.isSafeInteger(n) || n < 0 || n > total) return;
    const objetivo = Math.min(Math.max(n - guardadasActivas, 0), MAX_FILAS);
    setNuevas((filas) => {
      if (filas.length < objetivo) return [...filas, ...Array.from({ length: objetivo - filas.length }, () => filaVacia(motivoPorDefecto))];
      const resultado = [...filas];
      while (resultado.length > objetivo && !filaTieneDatos(resultado[resultado.length - 1])) resultado.pop();
      return resultado;
    });
  };

  const elegirTodas = () => {
    if (guardadasActivas > 0 || nuevas.some(filaTieneDatos)) {
      notify("Ya hay sobrantes anotados. Quítalos primero si de verdad entregaste todas.");
      return;
    }
    setEligioSobrantes(false);
    setNuevas([]);
    setSobrantes("0");
  };

  const elegirSobrantes = () => {
    setEligioSobrantes(true);
    if (sobrantesNum < 1) cambiarSobrantes("1");
    setTimeout(() => cantidadRef.current?.select(), 0);
  };

  const patchNueva = (index, cambios) =>
    setNuevas((filas) => filas.map((fila, posicion) => (posicion === index ? { ...fila, ...cambios } : fila)));

  const quitarFila = (index) => {
    setNuevas((filas) => filas.filter((_unused, posicion) => posicion !== index));
    setSobrantes((actual) => String(Math.max(Number(actual || 0) - 1, 0)));
  };

  const agregarOtro = () => {
    if (identificadas >= total || nuevas.length >= MAX_FILAS) return;
    setNuevas((filas) => [...filas, filaVacia(motivoPorDefecto)]);
    setSobrantes(String(Math.max(sobrantesNum, identificadas) + 1));
  };

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
    // Las fichas vacías que había se reemplazan por las pegadas.
    const conDatos = nuevas.filter(filaTieneDatos);
    if (guardadasActivas + conDatos.length + filas.length > total) {
      notify(`Los sobrantes no pueden pasar de ${formatNumber(total)}.`);
      return;
    }
    setNuevas([...conDatos, ...filas]);
    setSobrantes(String(guardadasActivas + conDatos.length + filas.length));
    setEligioSobrantes(true);
    setPegado("");
    setModo("manual");
  };

  const guardarNuevas = async () => {
    if (requiereRecarga) {
      notify("Cierra y vuelve a abrir el lote para comprobar qué registros llegaron antes de continuar.");
      return false;
    }
    if (!nuevas.length) return true;
    if (nuevas.some(filaIncompleta)) {
      notify("Cada sobrante necesita número de abonado o clave catastral.");
      return false;
    }
    const sinObservacion = nuevas.filter(
      (fila) => motivos.find((item) => item.codigo === fila.motivo)?.requiere_observacion && !fila.observacion.trim()
    );
    if (sinObservacion.length) {
      notify('Los sobrantes con motivo "Otro" necesitan una nota.');
      return false;
    }
    if (hayDuplicados && !duplicadosConfirmados) {
      notify("Hay sobrantes repetidos (mismo abonado y clave). Corrígelos o confirma que van duplicados.");
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
      setSobrantes((actual) => String(Math.max(Number(actual || 0) - 1, 0)));
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
    if (bloqueo) {
      notify(bloqueo.largo);
      throw yaAvisado(bloqueo.largo);
    }
    persistirCaptura();
    setGuardando(true);
    setCerrando(true);
    try {
      // guardarNuevas ya explica el motivo cuando devuelve false.
      if (!(await guardarNuevas())) throw yaAvisado("Revisa los sobrantes antes de cerrar.");
      const actualizado = await api.cerrarLote(lote.id, {
        total_sobrantes: Number(sobrantes),
        observacion_responsable: observacion
      });
      clearEntregaDraft(sessionUserId, draftId);
      onSaved(actualizado);
    } catch (error) {
      if (falloEntregaAmbiguo(error)) {
        setRequiereRecarga(true);
        setDuplicadosConfirmados(false);
      }
      if (!error.avisado) notify(falloEntregaAmbiguo(error)
        ? `${error.message} Cierra y vuelve a abrir el lote para revisar qué se guardó antes de reintentar.`
        : error.message);
      throw error;
    } finally {
      setGuardando(false);
      setCerrando(false);
    }
  };

  const guardarDetalle = async () => {
    persistirCaptura();
    setGuardando(true);
    try {
      if (await guardarNuevas()) notify("Sobrantes guardados en el lote.");
    } catch (error) {
      if (falloEntregaAmbiguo(error)) {
        setRequiereRecarga(true);
        setDuplicadosConfirmados(false);
      }
      notify(falloEntregaAmbiguo(error)
        ? `${error.message} Cierra y vuelve a abrir el lote para revisar qué se guardó antes de reintentar.`
        : error.message);
    } finally {
      setGuardando(false);
    }
  };

  const etiquetaMotivo = (codigo) => motivos.find((item) => item.codigo === codigo)?.etiqueta || codigo;
  const anotadas = identificadas - incompletas;
  const mostrarSobrantes = respuesta === "sobraron" || detalle.length > 0 || nuevas.length > 0;

  return (
    <EntregasDrawer title={`Cerrar lote ${lote.id}`} busy={guardando} onClose={solicitarCierre}>
      <header className="ent-cierre-head">
        <div>
          <h2>Cerrar lote · {lote.barrio_nombre}</h2>
          <p>Lote #{lote.id} · {lote.responsable_nombre} · {formatDate(lote.fecha)}</p>
        </div>
        <button type="button" className="cl-icon-button" disabled={guardando} onClick={solicitarCierre} aria-label="Cerrar">
          ✕
        </button>
      </header>

      <div className="cl-drawer-scroll ent-cierre">
        {draftRecuperado ? (
          <p className="ent-draft-status" role="status">
            Se recuperó lo que habías anotado sin enviar. Revísalo y desliza para cerrar.
            <button type="button" className="cl-link" onClick={() => setDraftRecuperado(false)}>Entendido</button>
          </p>
        ) : null}

        <section className={`ent-cierre-pregunta ${respuesta ? `is-${respuesta}` : ""}`} aria-labelledby="ent-cierre-pregunta">
          <h3 id="ent-cierre-pregunta">¿Te sobraron {docs}?</h3>
          <p>Llevaste {formatCount(total, doc, docs)} a {lote.barrio_nombre}.</p>
          <div className="ent-cierre-respuestas" role="group" aria-labelledby="ent-cierre-pregunta">
            <button type="button" aria-pressed={respuesta === "todas"} onClick={elegirTodas}>
              <Icon name="checkCircle" />
              <span><strong>No</strong><small>Entregué todas</small></span>
            </button>
            <button type="button" aria-pressed={respuesta === "sobraron"} onClick={elegirSobrantes}>
              <Icon name="warning" />
              <span><strong>Sí</strong><small>Me sobraron</small></span>
            </button>
          </div>

          {respuesta === "sobraron" ? (
            <div className="ent-cierre-cantidad">
              <label htmlFor="ent-cierre-cantidad">¿Cuántas te sobraron?</label>
              <div className="ent-stepper">
                <button type="button" aria-label="Una menos" onClick={() => cambiarSobrantes(String(Math.max(sobrantesNum - 1, 0)))} disabled={sobrantesNum <= 0}>−</button>
                <input
                  id="ent-cierre-cantidad"
                  ref={cantidadRef}
                  type="number"
                  aria-label="Sobrantes"
                  min="0"
                  max={total}
                  step="1"
                  inputMode="numeric"
                  value={sobrantes}
                  onChange={(event) => cambiarSobrantes(event.target.value)}
                />
                <button type="button" aria-label="Una más" onClick={() => cambiarSobrantes(String(Math.min(sobrantesNum + 1, total)))} disabled={sobrantesNum >= total}>+</button>
              </div>
            </div>
          ) : null}

          {respuesta ? (
            <p className="ent-cierre-cuenta">
              Entregadas <strong>{formatNumber(entregadas)}</strong> de {formatNumber(total)}
              {sobrantesNum > 0 ? <> · Sobrantes <strong>{formatNumber(sobrantesNum)}</strong></> : null}
            </p>
          ) : null}
          {sobrantes !== "" && sobrantesInvalidos ? <p className="cl-alert">Los sobrantes van de 0 a {formatNumber(total)}.</p> : null}
        </section>

        {mostrarSobrantes ? (
          <section className="ent-cierre-sobrantes" aria-labelledby="ent-cierre-sobrantes">
            <header>
              <h3 id="ent-cierre-sobrantes">Anota cada sobrante</h3>
              <span className={anotadas === sobrantesNum && sobrantesNum > 0 ? "is-ok" : ""}>
                {formatNumber(anotadas)} de {formatNumber(sobrantesNum)}
              </span>
            </header>
            <p className="ent-cierre-ayuda">Con el número de abonado o la clave basta; el nombre se completa solo si está en el padrón.</p>

            {hayDuplicados ? (
              <label className="ent-duplicados-aviso">
                <input type="checkbox" checked={duplicadosConfirmados} onChange={(event) => setDuplicadosConfirmados(event.target.checked)} />
                <span>Hay {formatCount(duplicados.length, "sobrante repetido", "sobrantes repetidos")} con el mismo abonado y clave. Marca aquí si de verdad van repetidos.</span>
              </label>
            ) : null}

            <ol className="ent-sobrantes-lista">
              {detalle.map((documento, index) => (
                <li key={documento.id} className="ent-sobrante is-guardado">
                  <header>
                    <strong>Sobrante {index + 1}</strong>
                    <span className={`cl-status ${estadoClass(documento.estado)}`}><i />{estadoDocumentoLabel(documento.estado)}</span>
                    {lote.estado === "ABIERTO" ? (
                      <button type="button" className="ent-sobrante-quitar" onClick={() => eliminarExistente(documento)} aria-label={`Quitar sobrante ${index + 1}`}>
                        <Icon name="trash" />
                      </button>
                    ) : null}
                  </header>
                  <p>
                    {documento.numero_abonado ? <>Abonado <b>{documento.numero_abonado}</b></> : null}
                    {documento.clave_catastral ? <> · Clave <b>{documento.clave_catastral}</b></> : null}
                    {" · "}{etiquetaMotivo(documento.motivo)}
                  </p>
                </li>
              ))}
              {nuevas.map((fila, index) => {
                const numero = guardadasActivas + index + 1;
                const requiereNota = motivos.find((item) => item.codigo === fila.motivo)?.requiere_observacion;
                const duplicada = duplicados.includes(index);
                return (
                  <li key={`nueva-${index}`} className={`ent-sobrante ${duplicada ? "is-duplicada" : ""}`}>
                    <header>
                      <strong>Sobrante {numero}{sobrantesNum ? <small> de {formatNumber(sobrantesNum)}</small> : null}</strong>
                      {duplicada ? <span className="ent-dup-hint">Repetido</span> : null}
                      <button type="button" className="ent-sobrante-quitar" onClick={() => quitarFila(index)} aria-label={`Quitar sobrante ${numero}`}>
                        <Icon name="trash" />
                      </button>
                    </header>
                    <div className="ent-sobrante-campos">
                      <label>
                        <span>Abonado</span>
                        <input
                          value={fila.numero_abonado}
                          inputMode="numeric"
                          autoComplete="off"
                          onChange={(event) => patchNueva(index, { numero_abonado: event.target.value })}
                          onBlur={(event) => buscarAbonado(index, event.target.value, "abonado")}
                          placeholder="10245"
                        />
                      </label>
                      <label>
                        <span>Clave catastral</span>
                        <input
                          value={fila.clave_catastral}
                          autoComplete="off"
                          onChange={(event) => patchNueva(index, { clave_catastral: event.target.value })}
                          onBlur={(event) => buscarAbonado(index, event.target.value, "clave")}
                          placeholder="10-20-03-04"
                        />
                      </label>
                      <label className="is-wide">
                        <span>¿Por qué no se entregó?</span>
                        <select value={fila.motivo} onChange={(event) => patchNueva(index, { motivo: event.target.value })}>
                          {motivos.map((motivo) => <option key={motivo.codigo} value={motivo.codigo}>{motivo.etiqueta}</option>)}
                        </select>
                      </label>
                      <label className="is-wide">
                        <span>Nota {requiereNota ? "(obligatoria)" : "(opcional)"}</span>
                        <textarea
                          rows={requiereNota || fila.observacion ? 2 : 1}
                          value={fila.observacion}
                          onChange={(event) => patchNueva(index, { observacion: event.target.value })}
                          placeholder="Ej. portón con candado"
                        />
                      </label>
                    </div>
                    {buscando === index ? <small className="ent-sobrante-info">Buscando en el padrón…</small> : null}
                    {fila.abonado_nombre && buscando !== index ? <small className="ent-sobrante-info">{fila.abonado_nombre}</small> : null}
                  </li>
                );
              })}
            </ol>

            <div className="ent-sobrantes-acciones">
              <button type="button" className="cl-secondary" onClick={agregarOtro} disabled={identificadas >= total}>
                <Icon name="plus" />Otro sobrante
              </button>
              <button type="button" className="cl-link" onClick={() => setModo(modo === "pegar" ? "manual" : "pegar")}>
                {modo === "pegar" ? "Cancelar pegado" : "Pegar un listado"}
              </button>
            </div>

            {modo === "pegar" ? (
              <div className="ent-pegado">
                <label className="cl-field">
                  Una línea por sobrante: abonado, clave y motivo
                  <textarea
                    rows={5}
                    value={pegado}
                    onChange={(event) => setPegado(event.target.value)}
                    placeholder={"10245\t10-20-03-04\tCasa cerrada\n10287\t10-20-03-18\tDirección no encontrada"}
                  />
                </label>
                <button type="button" className="cl-secondary" onClick={agregarPegado}><Icon name="plus" />Agregar al lote</button>
              </div>
            ) : null}
          </section>
        ) : null}

        <label className="cl-field ent-cierre-nota">
          Observación del recorrido (opcional)
          <textarea
            rows={2}
            value={observacion}
            onChange={(event) => setObservacion(event.target.value)}
            placeholder="Ej. Varias viviendas cerradas por la mañana."
          />
        </label>

        {/* Aviso secundario: va al final para no empujar la pregunta en el teléfono. */}
        {hayCambiosPendientes ? <p className="ent-draft-status" role="status">{draftPersistido === null ? "Guardando una copia en esta pestaña…" : draftPersistido ? "Lo anotado se conserva en esta pestaña hasta que cierres el lote." : "No se pudo guardar una copia local de lo anotado."}</p> : null}
      </div>

      <footer className="ent-drawer-footer">
        {nuevas.some(filaTieneDatos) && lote.estado === "ABIERTO" ? (
          <button type="button" className="cl-secondary ent-guardar-detalle" onClick={guardarDetalle} disabled={guardando}>
            Guardar sin cerrar
          </button>
        ) : null}
        <div className="ent-cerrar-wrap">
          {!guardando && bloqueo ? (
            <p className="cl-alert ent-cerrar-motivo" id="ent-cerrar-motivo" role="status">
              <span className="ent-motivo-largo">No se puede cerrar todavía: {bloqueo.largo}</span>
              <span className="ent-motivo-corto">{bloqueo.corto}</span>
            </p>
          ) : null}
          <SlideCommit
            label="Desliza para cerrar el lote"
            doneLabel="Lote cerrado"
            errorLabel="No se pudo cerrar el lote"
            width="fill"
            onConfirm={cerrar}
            disabled={Boolean(bloqueo) || (guardando && !cerrando)}
            title={bloqueo?.largo || undefined}
            describedBy={bloqueo ? "ent-cerrar-motivo" : undefined}
          />
        </div>
      </footer>
    </EntregasDrawer>
  );
}
