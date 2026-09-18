import { useEffect, useState } from "react";
import { Icon } from "../../../components/Icon";
import { estadoClass, estadoDocumentoLabel, formatDate, formatNumber, prioridadPendiente, tipoDocumentoLabel } from "../utils/entregasFormatters";
import { NO_ENTREGADAS_FILTROS_INICIALES } from "../hooks/useNoEntregadas";
import { addDaysIso } from "../utils/entregasDate";
import LatticeLoader from "../../../components/micro/LatticeLoader";

// La cola de trabajo es solo lo PENDIENTE: al cerrar el ciclo los documentos del
// mes anterior pasan a "sin efecto" y salen de aqui sin alterar las cifras de sus
// lotes, que siguen contandolos como no entregados de ese dia.
const QUICK = [
  ["Pendientes", { estado: "PENDIENTE" }],
  ["Más de 3 días", { estado: "PENDIENTE", dias_minimos: "3" }],
  ["Críticos · +7 días", { estado: "PENDIENTE", dias_minimos: "7" }],
  ["Sin intentos", { estado: "PENDIENTE", sin_intentos: "1" }],
  ["Sin efecto", { estado: "VENCIDA" }]
];

export default function NoEntregadasTable({ model, config, personal, api, notify, onOpen, onCicloCerrado }) {
  const { items, loading, error, filters, setFilters, clearFilters, page, setPage, total, total_pages: totalPages } = model;
  const [advanced, setAdvanced] = useState(false);
  const [corte, setCorte] = useState(null);
  const [cerrando, setCerrando] = useState(false);
  const [afectados, setAfectados] = useState(null);
  const ciclo = config.ciclo || {};
  // El corte cubre hasta su fecha inclusive, asi que por defecto va al dia
  // anterior: declararlo el mismo dia en que ya se reparten las facturas nuevas
  // se llevaria por delante los pendientes de esa jornada.
  const abrirCorte = () => setCorte({ fecha_corte: addDaysIso(config.jornada?.fecha || "", -1), motivo: "" });
  const confirmarCorte = async () => {
    if (corte.motivo.trim().length < 5) { notify("Indica de qué emisión se trata (mínimo 5 caracteres)."); return; }
    setCerrando(true);
    try {
      const resultado = await api.cerrarCiclo({ fecha_corte: corte.fecha_corte, motivo: corte.motivo.trim() });
      notify(`Ciclo cerrado: ${resultado.documentos_vencidos} documento(s) quedaron sin efecto.`);
      setCorte(null);
      onCicloCerrado();
    } catch (error) { notify(error.message); }
    finally { setCerrando(false); }
  };
  const count = Object.entries(filters).filter(([key, value]) => !["estado", "q"].includes(key) && value).length;
  // Cuenta en vivo lo que el corte dejaria sin efecto, para poder verlo antes de
  // confirmar en vez de despues.
  useEffect(() => {
    if (!corte?.fecha_corte) { setAfectados(null); return; }
    let vigente = true;
    setAfectados(null);
    api.noEntregadas({ estado: "PENDIENTE", fecha_hasta: corte.fecha_corte, limit: 1 })
      .then((data) => { if (vigente) setAfectados(data.total); })
      .catch(() => { if (vigente) setAfectados(null); });
    return () => { vigente = false; };
  }, [api, corte?.fecha_corte]);

  const quick = (patch) => setFilters({ ...NO_ENTREGADAS_FILTROS_INICIALES, ...patch });
  const quickActivo = (patch) => ["estado", "dias_minimos", "sin_intentos"].every((key) => (filters[key] || "") === (patch[key] || ""));
  const selects = [
    ["barrio_codigo", "Barrio", config.barrios.map((item) => [item.codigo, item.barrio])],
    ["responsable_id", "Responsable", personal.map((item) => [item.id, item.nombre_completo])],
    ["tipo_documento", "Documento", config.tipos_documento.map((item) => [item, tipoDocumentoLabel(item)])],
    ["motivo", "Motivo", config.motivos.map((item) => [item.codigo, item.etiqueta])]
  ];
  return <section className="cl-inbox ent-operational-inbox" aria-busy={loading}>
    <div className="cl-inbox-head"><div><span className="cl-kicker">Bandeja operativa</span><h3>No entregadas</h3><p>Atiende primero los documentos más antiguos. Abre una fila para registrar el siguiente intento.</p></div></div>
    <div className={`ent-ciclo-strip${ciclo.dias_abierto > 35 ? " is-largo" : ""}`}>
      <Icon name="calendar" />
      <span className="ent-ciclo-texto">
        {ciclo.fecha_inicio
          ? <>Ciclo de facturación abierto desde <strong>{formatDate(ciclo.fecha_inicio)}</strong> · {formatNumber(ciclo.dias_abierto)} días.</>
          : <>Todavía no se ha declarado ningún corte: la bandeja acumula todos los pendientes registrados.</>}
        {ciclo.ultimo_corte ? <> Último corte el {formatDate(ciclo.ultimo_corte.fecha_corte)}: {formatNumber(ciclo.ultimo_corte.documentos_vencidos)} sin efecto.</> : null}
      </span>
      {config.permissions.can_close_ciclo && !corte ? <button type="button" className="cl-secondary" onClick={abrirCorte}>Cerrar ciclo</button> : null}
    </div>
    {corte ? <section className="ent-card ent-danger-zone">
      <h3>Cerrar ciclo de facturación</h3>
      <p>Marca que facturación ya emitió los documentos del mes nuevo. Los pendientes hasta la fecha de corte quedan sin efecto y salen de la cola de seguimiento; las cifras de los lotes ya cerrados y los informes emitidos no cambian.</p>
      <label className="cl-field">Fecha de corte (inclusive)<input type="date" value={corte.fecha_corte} max={config.jornada?.fecha} min={ciclo.fecha_inicio || undefined} onChange={(event) => setCorte({ ...corte, fecha_corte: event.target.value })} /></label>
      <p className="ent-corte-preview" role="status">{afectados === null ? "Calculando cuántos documentos quedarían sin efecto…" : afectados === 0 ? "No hay pendientes hasta esa fecha: el corte solo abrirá el ciclo nuevo." : `${formatNumber(afectados)} documento(s) pendientes hasta el ${formatDate(corte.fecha_corte)} quedarán sin efecto.`}</p>
      {corte.fecha_corte === config.jornada?.fecha ? <p className="cl-alert">Estás cortando en la jornada de hoy: los pendientes registrados hoy también quedarán sin efecto.</p> : null}
      <label className="cl-field">Emisión que abre el ciclo nuevo<textarea rows={2} maxLength={255} value={corte.motivo} onChange={(event) => setCorte({ ...corte, motivo: event.target.value })} placeholder="Ej.: emisión de facturas de octubre" /></label>
      <div className="ent-danger-actions">
        <button type="button" className="cl-quiet" disabled={cerrando} onClick={() => setCorte(null)}>Cancelar</button>
        <button type="button" className="cl-primary" disabled={cerrando || corte.motivo.trim().length < 5} onClick={confirmarCorte}>{cerrando ? "Cerrando…" : "Confirmar cierre de ciclo"}</button>
      </div>
    </section> : null}
    <div className="ent-sticky-tools">
      <div className="ent-search-row">
        <label className="cl-field ent-search-field">Buscar documento<input type="search" value={filters.q || ""} onChange={(event) => setFilters({ q: event.target.value })} placeholder="Abonado, nombre o clave catastral" /></label>
        <label className="cl-field">Estado<select value={filters.estado} onChange={(event) => setFilters({ estado: event.target.value })}><option value="">Todos los estados</option>{config.estados_no_entregada.map((estado) => <option key={estado} value={estado}>{estadoDocumentoLabel(estado)}</option>)}</select></label>
        <button type="button" className="cl-secondary" aria-expanded={advanced} aria-controls="ent-documentos-filtros" onClick={() => setAdvanced(!advanced)}><Icon name="filter" />Filtros{count ? ` (${count})` : ""}</button>
        {count || filters.q || filters.estado !== "PENDIENTE" ? <button type="button" className="cl-quiet" onClick={clearFilters}>Limpiar</button> : null}
      </div>
      {advanced ? <div className="ent-advanced" id="ent-documentos-filtros">
        {selects.map(([key, label, options]) => <label key={key} className="cl-field">{label}<select value={filters[key]} onChange={(event) => setFilters({ [key]: event.target.value })}><option value="">Todos</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>)}
        <label className="cl-field">Abonado exacto/parcial<input value={filters.numero_abonado} onChange={(event) => setFilters({ numero_abonado: event.target.value })} /></label>
        <label className="cl-field">Clave catastral<input value={filters.clave_catastral} onChange={(event) => setFilters({ clave_catastral: event.target.value })} /></label>
        <label className="cl-field">Desde<input type="date" value={filters.fecha_desde} onChange={(event) => setFilters({ fecha_desde: event.target.value })} /></label>
        <label className="cl-field">Hasta<input type="date" value={filters.fecha_hasta} onChange={(event) => setFilters({ fecha_hasta: event.target.value })} /></label>
        <label className="cl-field">Más de (días)<input type="number" min="0" step="1" value={filters.dias_minimos} onChange={(event) => setFilters({ dias_minimos: event.target.value })} /></label>
      </div> : null}
      <div className="ent-quick-filters" aria-label="Prioridad de seguimiento">
        {QUICK.map(([label, patch]) => <button key={label} type="button" aria-pressed={quickActivo(patch)} onClick={() => quick(patch)}>{label}</button>)}
      </div>
      <p className="ent-list-caption" role="status">{loading ? "Actualizando…" : `${formatNumber(total)} documentos · más antiguos primero`}</p>
    </div>
    {error ? <p className="cl-alert" role="alert">{error} <button type="button" onClick={model.reload}>Reintentar</button></p> : null}
    <table className="cl-table ent-operational-table ent-documents-table"><thead><tr><th>Abonado / clave</th><th>Recorrido</th><th>Motivo</th><th>Seguimiento</th><th>Estado</th></tr></thead><tbody>
      {items.map((item) => <tr key={item.id} className={item.estado === "PENDIENTE" ? prioridadPendiente(item.dias_pendiente, item.intentos) : ""} onClick={() => onOpen(item)}>
        <td data-label="Abonado"><button type="button" className="ent-row-link" onClick={(event) => { event.stopPropagation(); onOpen(item); }}><strong>{item.numero_abonado || item.clave_catastral}</strong><span>{item.abonado_nombre || "Sin nombre registrado"}</span><small>{item.clave_catastral || "Sin clave"}</small></button></td>
        <td data-label="Recorrido"><strong>{item.barrio_nombre}</strong><small>{item.responsable_nombre}</small><small>{tipoDocumentoLabel(item.tipo_documento)} · Lote #{item.lote_id}</small></td>
        <td data-label="Motivo">{config.motivos.find((motivo) => motivo.codigo === item.motivo)?.etiqueta || item.motivo}</td>
        <td data-label="Seguimiento"><strong>{formatNumber(item.dias_pendiente)} días</strong><small>{item.intentos} intentos · {item.fecha_ultimo_intento ? `Último ${formatDate(item.fecha_ultimo_intento)}` : "Sin intento"}</small><small>Desde {formatDate(item.fecha_lote)}</small></td>
        <td data-label="Estado"><span className={`cl-status ${estadoClass(item.estado)}`}>{estadoDocumentoLabel(item.estado)}</span></td>
      </tr>)}
    </tbody></table>
    {!items.length && !error ? <p className="cl-empty">{loading ? <LatticeLoader label="Cargando documentos…" /> : "No hay documentos con estos filtros."}</p> : null}
    <div className="cl-pagination"><span>Página {page} de {totalPages}</span><div><button type="button" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><button type="button" disabled={loading || page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</button></div></div>
  </section>;
}
