import { useEffect, useState } from "react";
import { Icon } from "../../../components/Icon";
import LatticeLoader from "../../../components/micro/LatticeLoader";
import { estadoClass, estadoDocumentoLabel, formatDate, formatDayLabel, formatNumber, tipoDocumentoLabel } from "../utils/entregasFormatters";

// Vista del administrador: lo que quedo sin entregar cada dia del ciclo y los
// abonados "repetidos", que ya se habian quedado sin factura en un ciclo de
// facturacion anterior y vuelven a quedarse sin ella en este.
const REPETIDOS_VISIBLES = 10;

const abonadoDe = (item) => item.numero_abonado || item.clave_catastral || "Sin abonado";
const vecesEnCiclos = (n) => (n === 1 ? "1 ciclo anterior" : `${formatNumber(n)} ciclos anteriores`);

export default function ControlDescartes({ api, config, onOpen }) {
  const hoy = config.jornada?.fecha || "";
  const [fecha, setFecha] = useState(hoy);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [verTodos, setVerTodos] = useState(false);

  useEffect(() => {
    let vigente = true;
    setLoading(true);
    setError("");
    api.descartes({ fecha })
      .then((respuesta) => { if (vigente) setData(respuesta); })
      .catch((problema) => { if (vigente) setError(problema.message); })
      .finally(() => { if (vigente) setLoading(false); });
    return () => { vigente = false; };
  }, [api, fecha, recarga]);

  const motivo = (codigo) => config.motivos.find((item) => item.codigo === codigo)?.etiqueta || codigo;
  const ciclo = data?.ciclo || {};
  const resumen = data?.resumen || {};
  const repetidos = data?.repetidos || [];
  const visibles = verTodos ? repetidos : repetidos.slice(0, REPETIDOS_VISIBLES);
  const delDia = data?.dia?.items || [];
  const esHoy = fecha === hoy;

  return <section className="cl-inbox ent-operational-inbox ent-descartes" aria-busy={loading}>
    <div className="cl-inbox-head"><div>
      <span className="cl-kicker">Solo administración</span>
      <h3>Control de descartes</h3>
      <p>Lo que quedó sin entregar cada día y los abonados que ya se habían quedado sin factura en ciclos anteriores.</p>
    </div></div>

    {error ? <p className="cl-alert" role="alert">{error} <button type="button" onClick={() => setRecarga((n) => n + 1)}>Reintentar</button></p> : null}
    {!data && !error ? <p className="cl-empty"><LatticeLoader label="Cargando descartes…" /></p> : null}

    {data ? <>
      <div className="ent-ciclo-strip">
        <Icon name="calendar" />
        <span className="ent-ciclo-texto">
          {ciclo.fecha_inicio
            ? <>Ciclo {ciclo.cerrado ? "cerrado" : "abierto"} del <strong>{formatDate(ciclo.fecha_inicio)}</strong> al <strong>{formatDate(ciclo.fecha_fin)}</strong>.</>
            : <>Ciclo hasta el <strong>{formatDate(ciclo.fecha_fin)}</strong>.</>}
          {ciclo.corte_anterior ? null : <> Todavía no hay un ciclo anterior para comparar: los repetidos aparecen a partir del primer cierre de ciclo.</>}
        </span>
      </div>

      <div className="ent-kpis ent-descartes-kpis">
        <div className="ent-kpi"><span className="ent-kpi-label"><Icon name="calendar" />{esHoy ? "Hoy" : formatDate(fecha)}</span><strong>{formatNumber(resumen.documentos_dia)}</strong><small>sin entregar</small></div>
        <div className={`ent-kpi ${resumen.repetidos_dia ? "is-atencion" : ""}`}><span className="ent-kpi-label"><Icon name="warning" />Repetidos del día</span><strong>{formatNumber(resumen.repetidos_dia)}</strong><small>ya sin factura antes</small></div>
        <div className="ent-kpi"><span className="ent-kpi-label"><Icon name="inbox" />En el ciclo</span><strong>{formatNumber(resumen.documentos)}</strong><small>sin entregar</small></div>
        <div className={`ent-kpi ${resumen.abonados_repetidos ? "is-atencion" : ""}`}><span className="ent-kpi-label"><Icon name="users" />Abonados repetidos</span><strong>{formatNumber(resumen.abonados_repetidos)}</strong><small>de ciclos anteriores</small></div>
      </div>

      <section className="ent-descartes-bloque" aria-labelledby="ent-repetidos-titulo">
        <h4 id="ent-repetidos-titulo">Repetidos de ciclos anteriores</h4>
        {repetidos.length ? <>
          <p className="ent-list-caption">Abonados sin entregar en este ciclo que también quedaron sin entregar en un ciclo anterior. Los que se repiten en más ciclos van primero.</p>
          <table className="cl-table ent-operational-table ent-repetidos-table"><thead><tr><th>Abonado / clave</th><th>Este ciclo</th><th>Ciclos anteriores</th><th>Se repite en</th></tr></thead><tbody>
            {visibles.map((grupo) => <tr key={grupo.llave} onClick={() => onOpen(grupo.ciclo_actual[0])}>
              <td data-label="Abonado"><button type="button" className="ent-row-link" onClick={(event) => { event.stopPropagation(); onOpen(grupo.ciclo_actual[0]); }}><strong>{abonadoDe(grupo)}</strong><span>{grupo.abonado_nombre || "Sin nombre registrado"}</span><small>{grupo.numero_abonado ? grupo.clave_catastral || "Sin clave" : "Sin número de abonado"} · {grupo.barrio_nombre}</small></button></td>
              <td data-label="Este ciclo"><ul className="ent-antecedentes">{grupo.ciclo_actual.map((item) => <li key={item.id}><strong>{formatDate(item.fecha_lote)}</strong> · {motivo(item.motivo)}<small>{item.responsable_nombre || "Sin responsable"} · {estadoDocumentoLabel(item.estado)}</small></li>)}</ul></td>
              <td data-label="Antes"><ul className="ent-antecedentes">{grupo.anteriores.map((item) => <li key={item.id}><strong>{formatDate(item.fecha_lote)}</strong> · {motivo(item.motivo)}<small>{item.responsable_nombre || "Sin responsable"} · {estadoDocumentoLabel(item.estado)}</small></li>)}</ul></td>
              <td data-label="Se repite en"><span className="cl-status is-no_localizada">{vecesEnCiclos(grupo.ciclos_anteriores)}</span></td>
            </tr>)}
          </tbody></table>
          {repetidos.length > REPETIDOS_VISIBLES ? <button type="button" className="cl-quiet ent-descartes-mas" onClick={() => setVerTodos(!verTodos)}>{verTodos ? "Ver menos" : `Ver los ${formatNumber(repetidos.length)} abonados`}</button> : null}
        </> : <p className="cl-empty">{ciclo.corte_anterior ? "Ningún abonado de este ciclo había quedado sin entregar en ciclos anteriores." : "Sin ciclo anterior todavía no hay repetidos que mostrar."}</p>}
      </section>

      <section className="ent-descartes-bloque" aria-labelledby="ent-diario-titulo">
        <div className="ent-descartes-dia-head">
          <h4 id="ent-diario-titulo">Registro diario</h4>
          <label className="cl-field">Día<input type="date" value={fecha} max={hoy} onChange={(event) => { if (event.target.value) setFecha(event.target.value); }} /></label>
          {!esHoy ? <button type="button" className="cl-quiet" onClick={() => setFecha(hoy)}>Ir a hoy</button> : null}
        </div>
        {data.dias.length ? <div className="ent-descartes-dias" role="list" aria-label="Días del ciclo con documentos sin entregar">
          {data.dias.map((dia) => <button key={dia.fecha} type="button" role="listitem" aria-pressed={dia.fecha === fecha} onClick={() => setFecha(dia.fecha)}>
            <strong>{formatDayLabel(dia.fecha)}</strong>
            <span>{formatNumber(dia.documentos)} sin entregar</span>
            {dia.repetidos ? <em>{formatNumber(dia.repetidos)} {dia.repetidos === 1 ? "repetido" : "repetidos"}</em> : <small>{formatNumber(dia.lotes)} {dia.lotes === 1 ? "lote" : "lotes"}</small>}
          </button>)}
        </div> : null}

        <p className="ent-list-caption" role="status">{loading ? "Actualizando…" : `${formatNumber(delDia.length)} ${delDia.length === 1 ? "documento" : "documentos"} sin entregar el ${formatDate(fecha)} · repetidos primero`}</p>
        {delDia.length ? <table className="cl-table ent-operational-table ent-documents-table"><thead><tr><th>Abonado / clave</th><th>Recorrido</th><th>Motivo</th><th>Antecedentes</th><th>Estado</th></tr></thead><tbody>
          {delDia.map((item) => <tr key={item.id} className={item.repetido ? "is-repetido" : ""} onClick={() => onOpen(item)}>
            <td data-label="Abonado"><button type="button" className="ent-row-link" onClick={(event) => { event.stopPropagation(); onOpen(item); }}><strong>{abonadoDe(item)}</strong><span>{item.abonado_nombre || "Sin nombre registrado"}</span><small>{item.numero_abonado ? item.clave_catastral || "Sin clave" : "Sin número de abonado"}</small></button></td>
            <td data-label="Recorrido"><strong>{item.barrio_nombre}</strong><small>{item.responsable_nombre || "Sin responsable"}</small><small>{tipoDocumentoLabel(item.tipo_documento)} · Lote #{item.lote_id}</small></td>
            <td data-label="Motivo">{motivo(item.motivo)}{item.observacion ? <small>{item.observacion}</small> : null}</td>
            <td data-label="Antecedentes">{item.repetido
              ? <><span className="cl-status is-no_localizada">Repetido</span><small>En {vecesEnCiclos(item.ciclos_anteriores)}:</small>{item.anteriores.slice(0, 3).map((previo) => <small key={previo.id}>{formatDate(previo.fecha_lote)} · {motivo(previo.motivo)} · {estadoDocumentoLabel(previo.estado)}</small>)}{item.anteriores.length > 3 ? <small>y {formatNumber(item.anteriores.length - 3)} más</small> : null}</>
              : <small>Sin antecedentes</small>}</td>
            <td data-label="Estado"><span className={`cl-status ${estadoClass(item.estado)}`}>{estadoDocumentoLabel(item.estado)}</span></td>
          </tr>)}
        </tbody></table> : !loading ? <p className="cl-empty">No se registraron documentos sin entregar el {formatDate(fecha)}.</p> : null}
      </section>
    </> : null}
  </section>;
}
