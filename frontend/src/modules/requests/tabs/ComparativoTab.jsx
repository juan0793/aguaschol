import { Icon } from "../../../components/Icon";

const count = (value) => Number(value || 0).toLocaleString("es-HN");

const MODES = [
  ["brecha", "Brecha por barrio", "Barrios con más claves de Alcaldía que no aparecen en Aguas", "Claves de Alcaldía sin coincidencia en Aguas: posibles conexiones sin registrar."],
  ["cobertura_baja", "Menos cobertura", "Barrios con menor cobertura en Aguas", "Porcentaje de claves de Alcaldía que sí están en Aguas; abajo están los barrios con más pendientes."],
  ["cobertura_alta", "Más cobertura", "Barrios con mayor cobertura registrada", "Barrios donde casi todas las claves de Alcaldía ya están en Aguas."],
  ["servicio_dominante", "Servicio mayoritario", "Servicio mayoritario por barrio", "El servicio que más usuarios tienen en cada barrio."],
  ["servicios", "Por servicio", "Usuarios divididos por servicio", "Toca un servicio para ver qué barrios lo tienen y en qué porcentaje."],
  ["comparativa", "Comparativa", "Comparativa por barrio", "Ordena los barrios por la métrica que necesites para un reporte."]
];

export default function ComparativoTab({ model }) {
  const { stats, comparison } = model;
  const summary = comparison?.summary;
  const mode = MODES.find(([key]) => key === model.chartMode) || MODES[0];
  const isPercent = model.chartMode.includes("cobertura") || (model.chartMode === "servicios" && model.statsServiceField);
  const value = (item) => (isPercent ? `${item.value}%` : count(item.value));
  const title = model.chartMode === "servicios" && stats.selectedServiceLabel ? `Barrios con ${stats.selectedServiceLabel}`
    : model.chartMode === "comparativa" ? `Comparativa por ${stats.metricLabels?.[model.sortMetric] || "métrica"}` : mode[2];
  const pick = (item) => {
    if (model.chartMode === "servicios" && !model.statsServiceField && item.field) { model.setStatsServiceField(item.field); return; }
    if (item.barrio_colonia && (model.chartMode !== "servicios" || model.statsServiceField)) model.onSelectStatBarrio(item.barrio_colonia);
  };
  const detail = stats.selectedBarrio;
  const maxService = detail ? Math.max(1, ...Object.keys(stats.serviceLabels).map((field) => Number(detail.servicios?.[field] || 0))) : 1;

  if (!summary) {
    return <div className="pq-panel"><div className="pq-empty"><Icon name="barChart" /><strong>{model.loadingComparison ? "Comparando padrones…" : "Todavía no hay comparación"}</strong><span>Cruza el padrón de Alcaldía con el de Aguas para ver brechas, cobertura y servicios por barrio.</span>{!model.loadingComparison ? <button type="button" className="pq-btn is-primary" onClick={model.onCompare}><Icon name="refresh" />Comparar padrones</button> : null}</div></div>;
  }

  return <div className="pq-panel">
    <div className="pq-compare-head">
      <dl className="pq-summary">
        <div><dt>Claves en Alcaldía</dt><dd>{count(summary.alcaldia_records ?? model.alcaldiaMeta?.total_records)}</dd></div>
        <div><dt>Usuarios en Aguas</dt><dd>{count(summary.aguas_records ?? model.padronMeta?.total_records)}</dd></div>
        <div className="is-alert"><dt>No aparecen en Aguas</dt><dd>{count(summary.candidate_clandestine)}</dd></div>
        <div><dt>Coincidencias</dt><dd>{count((summary.exact_matches ?? 0) + (summary.base_matches ?? 0))}</dd></div>
      </dl>
      <div className="pq-results-actions">
        <button type="button" className="pq-btn" onClick={model.onCompare} disabled={model.loadingComparison}><Icon name="refresh" className={model.loadingComparison ? "ds-icon-spin" : ""} />{model.loadingComparison ? "Comparando…" : "Comparar de nuevo"}</button>
        <button type="button" className="pq-btn" onClick={model.onDownloadStatsPdf} disabled={model.downloadingStatsPdf || !stats.dynamicRows.length}><Icon name="download" />{model.downloadingStatsPdf ? "Guardando…" : "Guardar PDF"}</button>
      </div>
    </div>

    <div className="pq-modes" role="tablist" aria-label="Qué gráfico ver">
      {MODES.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={model.chartMode === key} className={model.chartMode === key ? "is-active" : ""} onClick={() => { model.setChartMode(key); if (key !== "servicios") model.setStatsServiceField(""); }}>{label}</button>)}
    </div>

    <div className="pq-compare-grid">
      <section className="pq-chart">
        <header>
          <div><h3>{title}</h3><p>{model.chartMode === "servicios" && stats.selectedServiceLabel ? `Porcentaje de usuarios con ${stats.selectedServiceLabel} en cada barrio.` : mode[3]}</p></div>
          {model.chartMode === "servicios" && model.statsServiceField ? <button type="button" className="pq-link" onClick={() => model.setStatsServiceField("")}><Icon name="arrowLeft" />Todos los servicios</button> : null}
        </header>
        <div className="pq-chart-controls">
          <label className="pq-search"><Icon name="search" /><input type="search" value={model.barrioFilter} onChange={(event) => model.setBarrioFilter(event.target.value)} placeholder="Filtrar barrio" aria-label="Filtrar barrio" /></label>
          {model.chartMode === "comparativa" ? <>
            <label><span>Ordenar por</span><select value={model.sortMetric} onChange={(event) => model.setSortMetric(event.target.value)}>{Object.entries(stats.metricLabels || {}).map(([metric, label]) => <option key={metric} value={metric}>{label}</option>)}</select></label>
            <label><span>Orden</span><select value={model.sortDirection} onChange={(event) => model.setSortDirection(event.target.value)}><option value="desc">Mayor a menor</option><option value="asc">Menor a mayor</option></select></label>
          </> : null}
          <label><span>Mostrar</span><select value={model.limit} onChange={(event) => model.setLimit(Number(event.target.value))}>{[5, 10, 15, 20, 30].map((amount) => <option key={amount} value={amount}>Top {amount}</option>)}</select></label>
          <div className="pq-segmented" role="group" aria-label="Tipo de vista">
            {[["barras", "Barras"], ["tabla", "Tabla"]].map(([type, label]) => <button key={type} type="button" aria-pressed={model.chartType === type} className={model.chartType === type ? "is-active" : ""} onClick={() => model.setChartType(type)}>{label}</button>)}
          </div>
        </div>
        {stats.dynamicRows.length ? model.chartType === "tabla" ? <div className="pq-table-wrap is-flat">
          <table className="pq-table is-compare">
            <thead><tr><th>{model.chartMode === "servicios" && !model.statsServiceField ? "Servicio" : "Barrio"}</th><th>Detalle</th><th className="is-num">Valor</th></tr></thead>
            <tbody>{stats.dynamicRows.map((item) => <tr key={`${model.chartMode}-${item.barrio_colonia || item.field}`} className={detail?.barrio_colonia === item.barrio_colonia ? "is-selected" : ""} onClick={() => pick(item)}>
              <th scope="row"><button type="button" className="pq-link" onClick={(event) => { event.stopPropagation(); pick(item); }}>{item.barrio_colonia}</button></th>
              <td className="is-muted">{item.detail}</td>
              <td className="is-num"><b>{value(item)}</b></td>
            </tr>)}</tbody>
          </table>
        </div> : <ol className="pq-bars">
          {stats.dynamicRows.map((item) => <li key={`${model.chartMode}-${item.barrio_colonia || item.field}`}>
            <button type="button" className={detail?.barrio_colonia === item.barrio_colonia && model.chartMode !== "servicios" ? "is-selected" : ""} onClick={() => pick(item)}>
              <span className="pq-bars-label"><strong>{item.barrio_colonia}</strong><small>{item.detail}</small></span>
              <span className="pq-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (Number(item.value || 0) / stats.maxDynamicRows) * 100)}%` }} /></span>
              <b>{value(item)}</b>
            </button>
          </li>)}
        </ol> : <div className="pq-empty is-inline"><Icon name="search" /><strong>Sin barrios para este filtro</strong></div>}
      </section>

      <aside className="pq-detail" aria-label="Detalle del barrio">
        <span className="pq-kicker">Detalle del barrio</span>
        {detail ? <>
          <h3>{detail.barrio_colonia}</h3>
          <dl className="pq-detail-grid">
            <div><dt>Claves Alcaldía</dt><dd>{count(detail.alcaldia_total)}</dd></div>
            <div><dt>En Aguas</dt><dd>{count(detail.aguas_registradas)}</dd></div>
            <div><dt>Cobertura</dt><dd>{detail.cobertura_aguas_pct}%</dd></div>
            <div className={Number(detail.brecha_registros) > 0 ? "is-alert" : ""}><dt>Brecha</dt><dd>{count(detail.brecha_registros)}</dd></div>
          </dl>
          <span className="pq-bar is-coverage" aria-label={`Cobertura ${detail.cobertura_aguas_pct}%`}><i style={{ width: `${Math.min(100, Number(detail.cobertura_aguas_pct) || 0)}%` }} /></span>
          <p className="pq-detail-dominant">Servicio mayoritario <b>{detail.servicio_dominante || "Sin servicio dominante"}</b></p>
          <ul className="pq-detail-services">
            {Object.entries(stats.serviceLabels).map(([field, label]) => {
              const total = Number(detail.servicios?.[field] || 0);
              return <li key={field}><span>{label}</span><b>{count(total)}</b><span className="pq-bar" aria-hidden="true"><i style={{ width: `${(total / maxService) * 100}%` }} /></span></li>;
            })}
          </ul>
        </> : <p className="pq-note">Toca un barrio de la lista para ver su cobertura y servicios.</p>}
      </aside>
    </div>
  </div>;
}
