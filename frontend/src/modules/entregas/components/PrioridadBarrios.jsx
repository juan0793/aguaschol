import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../../components/Icon";
import PrioridadPrint from "../print/PrioridadPrint";
import { useImprimirHoja } from "../hooks/useImprimirHoja";
import "../styles/resumenPrioridad.css";
import { formatDate, formatLempiras, formatNumber } from "../utils/entregasFormatters";
import {
  NIVELES,
  agruparPorTecnico,
  criteriosPara,
  descripcionCriterio,
  filtrarPrioridad,
  resumenPrioridad,
  textoCarga,
  textoMotivos,
  textoUltimaEntrega
} from "../utils/prioridadBarrios.js";

// Fila de un barrio: en escritorio es una línea de la tabla; en el teléfono, una
// tarjeta de tres líneas (la misma marca, reacomodada por CSS).
function FilaPrioridad({ barrio, conMora, conTecnico, maxima, propioId }) {
  const documentos = Number(barrio.carga?.documentos) || 0;
  const mio = propioId != null && Number(barrio.responsable_id) === Number(propioId);
  return (
    <li className={`ent-prio-fila${mio ? " is-mio" : ""}`}>
      <span className="ent-prio-pos" aria-label={`Puesto ${barrio.posicion}`}>{barrio.posicion}</span>
      <span className="ent-prio-celda-barrio">
        <strong>{barrio.nombre}</strong>
        <small>{barrio.codigo} · {textoUltimaEntrega(barrio)}</small>
      </span>
      {conTecnico ? <span className="ent-prio-celda-tecnico">{mio ? "Tú" : barrio.responsable_nombre}</span> : null}
      <span className="ent-prio-celda-motivo">{textoMotivos(barrio)}</span>
      <span className="ent-prio-celda-carga" title={barrio.carga?.fuente === "historial" ? "Documentos por ciclo, promedio de los últimos ciclos" : "Sin historial: claves del padrón"}>
        <i aria-hidden="true"><b style={{ width: `${maxima ? Math.max((documentos / maxima) * 100, 3) : 0}%` }} /></i>
        {textoCarga(barrio, formatNumber)} <span className="ent-prio-unidad">doc.</span>
      </span>
      {conMora ? <span className="ent-prio-celda-mora">{formatLempiras(barrio.mora?.mora)}</span> : null}
      <span className="ent-prio-celda-nivel"><span className={`ent-prio-chip is-${barrio.nivel}`}>{NIVELES[barrio.nivel]}</span></span>
    </li>
  );
}

// Lista de barrios por prioridad (pestaña Prioridad). La ven administración,
// operadores y Gerencia, y el técnico al que administración le dio el acceso en
// Usuarios (sin montos). Imprime y guarda PDF de lo que está a la vista.
export default function PrioridadBarrios({ api, config, notify }) {
  const conMoraPermitida = Boolean(config.permissions.can_view_saldo);
  const alcance = config.permissions.prioridad_alcance || "todos";
  const [criterio, setCriterio] = useState("combinado");
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [tecnicoId, setTecnicoId] = useState("");
  const [agrupar, setAgrupar] = useState(false);
  const [sinAbiertos, setSinAbiertos] = useState(false);
  const [verMora, setVerMora] = useState(true);
  const [hoja, setHoja] = useImprimirHoja();
  const [generandoPdf, setGenerandoPdf] = useState(false);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError("");
    api.prioridad({ criterio })
      .then((respuesta) => { if (vivo) setDatos(respuesta); })
      .catch((problema) => { if (vivo) setError(problema.message || "No se pudo cargar la lista."); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [api, criterio]);

  const conMora = conMoraPermitida && Boolean(datos?.con_mora) && verMora;
  const tecnicoNombre = datos?.tecnicos.find((tecnico) => String(tecnico.id) === String(tecnicoId))?.nombre || "";
  const barrios = useMemo(
    () => filtrarPrioridad(datos?.barrios || [], { tecnicoId: tecnicoId === "" ? null : tecnicoId, sinAbiertos }),
    [datos, tecnicoId, sinAbiertos]
  );
  const resumen = resumenPrioridad(barrios);
  const maxima = Math.max(0, ...barrios.map((barrio) => Number(barrio.carga?.documentos) || 0));
  const grupos = agrupar ? agruparPorTecnico(barrios) : [{ id: "todos", nombre: "", barrios, documentos: resumen.documentos }];
  const conTecnico = !tecnicoId && alcance !== "propios" && !agrupar;
  const opciones = { criterio: datos?.criterio || criterio, tecnicoNombre: alcance === "propios" ? (datos?.tecnicos[0]?.nombre || "") : tecnicoNombre, agrupar, sinAbiertos, conMora };
  const armarHoja = () => ({ barrios, opciones, datos, generadoEn: new Date().toISOString() });

  const guardarPdf = async () => {
    setGenerandoPdf(true);
    try {
      const { descargarPrioridadPdf } = await import("../print/prioridadPdf");
      await descargarPrioridadPdf(armarHoja());
    } catch (problema) {
      notify?.(problema?.message || "No se pudo generar el PDF.");
    } finally {
      setGenerandoPdf(false);
    }
  };

  const vence = config.permissions.prioridad_vence;
  const sinPermisoTotal = !config.permissions.can_view_all;

  return (
    <section className="cl-inbox ent-prio" aria-labelledby="ent-prio-titulo">
      <div className="cl-inbox-head ent-head-compacta ent-prio-head">
        <div>
          <h3 id="ent-prio-titulo">Barrios por prioridad</h3>
          <p>
            {datos
              ? `Lo que falta del ${datos.ciclo_declarado ? "ciclo" : "mes"} (desde el ${formatDate(datos.desde)}): ${formatNumber(datos.totales.faltan)} de ${formatNumber(datos.totales.barrios_ciclo)} barrios${alcance === "propios" ? " de tu reparto" : ""}.`
              : "Lo que falta del ciclo, del más urgente al menos."}
          </p>
        </div>
        <div className="ent-prio-acciones">
          <button type="button" className="cl-secondary" onClick={() => setHoja(armarHoja())} disabled={!barrios.length || Boolean(hoja)}>
            <Icon name="print" />
            Imprimir
          </button>
          <button type="button" className="cl-secondary" onClick={guardarPdf} disabled={!barrios.length || generandoPdf}>
            <Icon name="download" />
            {generandoPdf ? "Generando…" : "Guardar PDF"}
          </button>
        </div>
      </div>

      {sinPermisoTotal ? (
        <p className="ent-prio-aviso">
          <Icon name="auth" />
          Administración te dio esta pantalla{vence ? ` hasta el ${formatDate(vence)}` : ""}{alcance === "propios" ? ", con tus barrios" : ""}.
        </p>
      ) : null}

      <div className="ent-prio-controles">
        <label>
          <span>Ordenar por</span>
          <select value={criterio} onChange={(event) => setCriterio(event.target.value)}>
            {criteriosPara(conMoraPermitida).map((item) => <option key={item.valor} value={item.valor}>{item.titulo}</option>)}
          </select>
        </label>
        {alcance !== "propios" ? (
          <label>
            <span>Técnico</span>
            <select value={tecnicoId} onChange={(event) => setTecnicoId(event.target.value)}>
              <option value="">Todos los técnicos</option>
              {(datos?.tecnicos || []).map((tecnico) => <option key={tecnico.id} value={tecnico.id}>{tecnico.nombre}</option>)}
            </select>
          </label>
        ) : null}
        <div className="ent-prio-casillas">
          {alcance !== "propios" ? <label><input type="checkbox" checked={agrupar} onChange={(event) => setAgrupar(event.target.checked)} /> Agrupar por técnico</label> : null}
          <label><input type="checkbox" checked={sinAbiertos} onChange={(event) => setSinAbiertos(event.target.checked)} /> Sin los de lote abierto</label>
          {conMoraPermitida ? <label><input type="checkbox" checked={verMora} onChange={(event) => setVerMora(event.target.checked)} /> Mostrar la mora</label> : null}
        </div>
      </div>
      <p className="ent-prio-criterio">{descripcionCriterio(criterio, conMoraPermitida)}</p>

      {error ? <p className="ent-prio-error" role="alert">{error}</p> : null}
      {!error && datos ? (
        <p className="ent-prio-resumen" aria-live="polite">
          <strong>{formatNumber(resumen.barrios)} {resumen.barrios === 1 ? "barrio" : "barrios"}</strong>
          <span><i className="is-alta" />{formatNumber(resumen.alta)} alta</span>
          <span><i className="is-media" />{formatNumber(resumen.media)} media</span>
          <span><i className="is-baja" />{formatNumber(resumen.baja)} baja</span>
          <span>≈{formatNumber(resumen.documentos)} documentos</span>
          {conMora ? <span>Mora {formatLempiras(resumen.mora)}</span> : null}
        </p>
      ) : null}

      {cargando && !datos ? <p className="ent-prio-vacio">Cargando…</p> : null}
      {datos && !barrios.length && !error ? (
        <p className="ent-prio-vacio">{datos.barrios.length ? "Ningún barrio con estos filtros." : "No falta ningún barrio del ciclo: todo está entregado."}</p>
      ) : null}

      {barrios.length ? (
        <div className={`ent-prio-tabla-pantalla${conTecnico ? " con-tecnico" : ""}${conMora ? " con-mora" : ""}${cargando ? " is-cargando" : ""}`}>
          <div className="ent-prio-cabeza" aria-hidden="true">
            <span>#</span><span>Barrio</span>{conTecnico ? <span>Técnico</span> : null}<span>Motivo</span><span className="is-num">Carga</span>{conMora ? <span className="is-num">Mora</span> : null}<span>Prioridad</span>
          </div>
          {grupos.map((grupo) => (
            <section key={grupo.id} className="ent-prio-bloque" aria-label={agrupar ? grupo.nombre : "Barrios"}>
              {agrupar ? (
                <h4 className="ent-prio-bloque-titulo">
                  {grupo.nombre}
                  <small>{formatNumber(grupo.barrios.length)} {grupo.barrios.length === 1 ? "barrio" : "barrios"} · ≈{formatNumber(grupo.documentos)} documentos</small>
                </h4>
              ) : null}
              <ol className="ent-prio-lista">
                {grupo.barrios.map((barrio) => (
                  <FilaPrioridad key={barrio.codigo} barrio={barrio} conMora={conMora} conTecnico={conTecnico} maxima={maxima} propioId={datos?.propio_id ?? config.personal_vinculado?.id} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : null}

      <p className="ent-prio-nota">
        Alta: lote abierto, anotado para la próxima jornada, sin entregas registradas o 31 días o más desde la última. Media: de 27 a 30 días. Baja: el resto.
      </p>

      {hoja ? createPortal(<div className="ent-acta-portal"><PrioridadPrint hoja={hoja} /></div>, document.body) : null}
    </section>
  );
}

// Los primeros barrios de la lista, para el Resumen de la oficina.
export function PrioridadResumen({ datos, error, onVerTodo }) {
  if (error) return null;
  const primeros = (datos?.barrios || []).slice(0, 6);
  const conMora = Boolean(datos?.con_mora);
  return (
    <section className="ent-card ent-prio-top" aria-labelledby="ent-prio-top-titulo">
      <div className="ent-card-head">
        <div>
          <h3 id="ent-prio-top-titulo">Prioridad de lo que falta</h3>
          <p>{descripcionCriterio("combinado", conMora)}</p>
        </div>
        <button type="button" className="cl-secondary" onClick={onVerTodo}>
          <Icon name="print" />
          Ver e imprimir
        </button>
      </div>
      {!datos ? <p className="ent-prio-vacio">Cargando…</p> : null}
      {datos && !primeros.length ? <p className="ent-prio-vacio">No falta ningún barrio del ciclo.</p> : null}
      {primeros.length ? (
        <div className={`ent-prio-tabla-pantalla con-tecnico${conMora ? " con-mora" : ""}`}>
          <ol className="ent-prio-lista">
            {primeros.map((barrio) => (
              <FilaPrioridad key={barrio.codigo} barrio={barrio} conMora={conMora} conTecnico maxima={Math.max(...primeros.map((fila) => Number(fila.carga?.documentos) || 0))} />
            ))}
          </ol>
        </div>
      ) : null}
      {datos && datos.barrios.length > primeros.length ? (
        <button type="button" className="ent-prio-mas" onClick={onVerTodo}>Ver los {formatNumber(datos.barrios.length)} barrios que faltan</button>
      ) : null}
    </section>
  );
}
