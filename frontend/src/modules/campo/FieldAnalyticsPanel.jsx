import { Icon } from "../../components/Icon.jsx";
import { formatCurrency } from "../../utils/formatting.js";
import { formatDateTime } from "../../utils/datesAndBusiness.js";
import { getMapPointTypeLabel } from "../../utils/mapField.js";
import { getFieldPointClave, getFieldPointZone } from "../../components/fieldControlUtils.js";

const tabs = [
  ["territory", "Territorio"],
  ["portfolio", "Cartera"],
  ["commercial", "Comercial"],
  ["quality", "Calidad"],
  ["technicians", "Técnicos"]
];

const QUALITY_BUCKET_LABELS = { excelente: "Excelente", buena: "Buena", aceptable: "Aceptable", baja: "Baja", deficiente: "Deficiente", sin_dato: "Sin dato" };
const QUALITY_BUCKET_TONES = { excelente: "success", buena: "success", aceptable: "warning", baja: "warning", deficiente: "danger", sin_dato: "muted" };

const Empty = ({ text }) => <div className="field-control-empty"><Icon name="search" /><strong>Sin datos</strong><span>{text}</span></div>;
const Stat = ({ label, value, onClick, active }) => <button type="button" className={active ? "is-active" : ""} onClick={onClick} disabled={!onClick}><span>{label}</span><strong>{value}</strong></button>;

const RankingBar = ({ rank, label, meta, value, valueLabel, max, onClick, active }) => {
  const width = value > 0 && max > 0 ? Math.min(100, Math.max(4, Math.round((value / max) * 100))) : 0;
  const content = <>
    {rank ? <b>{rank}</b> : null}
    <span>
      <em><strong>{label}</strong>{valueLabel ? <small>{valueLabel}</small> : null}</em>
      <i><mark style={{ width: `${width}%` }} /></i>
      {meta ? <small className="field-ranking-meta">{meta}</small> : null}
    </span>
  </>;
  return onClick
    ? <button type="button" className={`field-ranking-row ${rank ? "has-rank" : ""} ${active ? "is-active" : ""}`} onClick={onClick}>{content}</button>
    : <div className={`field-ranking-row is-static ${rank ? "has-rank" : ""}`}>{content}</div>;
};

const QualityStrip = ({ buckets = [] }) => {
  const total = buckets.reduce((sum, bucket) => sum + (bucket.count || 0), 0);
  if (!total) return null;
  return <div className="field-quality-strip-wrap">
    <div className="field-quality-strip" role="img" aria-label="Distribución de precisión GPS">
      {buckets.filter((bucket) => bucket.count > 0).map((bucket) => <span key={bucket.id} className={`is-${QUALITY_BUCKET_TONES[bucket.id] || "muted"}`} style={{ width: `${(bucket.count / total) * 100}%` }} title={`${QUALITY_BUCKET_LABELS[bucket.id] || bucket.id}: ${bucket.count}`} />)}
    </div>
    <div className="field-quality-strip-legend">{buckets.filter((bucket) => bucket.count > 0).map((bucket) => <span key={bucket.id} className={`is-${QUALITY_BUCKET_TONES[bucket.id] || "muted"}`}>{QUALITY_BUCKET_LABELS[bucket.id] || bucket.id} {Math.round((bucket.count / total) * 100)}%</span>)}</div>
  </div>;
};

const DualRate = ({ label, count, keyRate, validationRate }) => <div className="field-tech-row">
  <div className="field-tech-row-head"><strong>{label}</strong><span>{count} pts</span></div>
  <div className="field-tech-row-bars">
    <i><mark className="is-accent" style={{ width: `${Math.max(0, Math.min(100, keyRate || 0))}%` }} /></i>
    <i><mark className="is-success" style={{ width: `${Math.max(0, Math.min(100, validationRate || 0))}%` }} /></i>
  </div>
  <div className="field-tech-row-labels"><small>Con clave {keyRate ?? 0}%</small><small>Validado {validationRate ?? 0}%</small></div>
</div>;

export default function FieldAnalyticsPanel({
  activeTab,
  analytics,
  barrios,
  onActiveTab,
  onEditPoint,
  onMetricFilter,
  onSelectPoint,
  onTechnicianFilter,
  pointLimit,
  selectedMetric,
  selectedPointId,
  selectedPoints,
  setPointLimit
}) {
  const anomalyCount = analytics?.anomalies?.length || 0;
  const territoryZones = [...(analytics?.zones || [])].sort((a, b) => b.points - a.points).slice(0, 6);
  const territoryMax = Math.max(1, ...territoryZones.map((zone) => zone.points || 0));
  const commercialZones = analytics?.commercial?.zones || [];
  const commercialMax = Math.max(1, ...commercialZones.map((zone) => zone.total || 0));
  return <aside className="field-control-floating-panel">
    <div className="field-control-tabs" role="tablist">
      {tabs.map(([id, label]) => <button type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? "is-active" : ""} key={id} onClick={() => onActiveTab(id)}>{label}{id === "quality" && anomalyCount ? <span className="is-warning">{anomalyCount}</span> : null}</button>)}
    </div>

    {activeTab === "territory" ? <div className="field-control-panel-body field-analytics-scroll">
      <div className="field-control-panel-summary"><div><strong>{selectedPoints.length} puntos</strong><span>{analytics?.territory?.zones ?? 0} barrios · {analytics?.territory?.keys ?? 0} claves</span></div></div>
      {territoryZones.length ? <div className="field-ranking">{territoryZones.map((zone, index) => <RankingBar key={zone.label} rank={index + 1} label={zone.label} valueLabel={`${zone.points} pts`} meta={`${zone.keys} claves · ${zone.technicians} técnicos`} value={zone.points} max={territoryMax} />)}</div> : null}
      <div className="field-control-point-list">{selectedPoints.slice(0, pointLimit).map((point) => <article key={point.id} className={selectedPointId === point.id ? "is-selected" : ""}><button type="button" className="field-control-point-main" onClick={() => onSelectPoint(point.id)}><span><strong>{getFieldPointClave(point) || getMapPointTypeLabel(point.point_type)}</strong><small>{getFieldPointZone(point, barrios)}</small><small>{formatDateTime(point.created_at)} · {point.created_by_name || point.created_by_username || "Sin técnico"}</small></span></button><button type="button" className="field-control-point-edit" onClick={() => onEditPoint(point.id)} aria-label="Editar punto"><Icon name="records" /></button></article>)}</div>
      {pointLimit < selectedPoints.length ? <button type="button" className="field-control-more" onClick={() => setPointLimit((current) => current + 30)}>Ver 30 puntos más</button> : null}
    </div> : null}

    {activeTab === "portfolio" ? <div className="field-control-panel-body field-analytics-scroll">
      <div className="field-control-portfolio-summary"><article><span>Abonados</span><strong>{analytics?.portfolio?.accountsFound ?? 0}</strong></article><article><span>Cartera total</span><strong>{formatCurrency(analytics?.portfolio?.total ?? 0)}</strong></article><article><span>Promedio</span><strong>{formatCurrency(analytics?.portfolio?.average ?? 0)}</strong></article><article><span>Mediana</span><strong>{formatCurrency(analytics?.portfolio?.median ?? 0)}</strong></article></div>
      <div className="field-ranking is-slim">{(analytics?.portfolio?.ranges || []).map((range) => <RankingBar key={range.id} label={range.label} meta={`${range.accounts} abonados · ${range.keys} claves`} value={range.percent ?? 0} max={100} valueLabel={`${Math.round(range.percent ?? 0)}%`} active={selectedMetric === `range:${range.id}`} onClick={() => onMetricFilter("range", range.id)} />)}</div>
    </div> : null}

    {activeTab === "commercial" ? <div className="field-control-panel-body field-analytics-scroll">
      <div className="field-analytics-stat-grid">
        <Stat label="Negocios" value={analytics?.commercial?.businesses ?? 0} active={selectedMetric === "flag:negocio"} onClick={() => onMetricFilter("flag", "negocio")} />
        <Stat label="Cartera comercial" value={formatCurrency(analytics?.commercial?.total ?? 0)} />
        <Stat label="Sin clave" value={analytics?.commercial?.withoutKey ?? 0} />
        <Stat label="Clandestinos" value={analytics?.commercial?.clandestine ?? 0} active={selectedMetric === "flag:clandestino"} onClick={() => onMetricFilter("flag", "clandestino")} />
      </div>
      <div className="field-ranking is-slim">{commercialZones.map((zone) => <RankingBar key={zone.label} label={zone.label} meta={`${zone.businesses} negocios · ${zone.accounts} abonados`} value={zone.total || 0} max={commercialMax} valueLabel={formatCurrency(zone.total)} />)}</div>
    </div> : null}

    {activeTab === "quality" ? <div className="field-control-panel-body field-analytics-scroll">
      <div className="field-analytics-stat-grid">
        <Stat label="Sin clave" value={analytics?.quality?.withoutKey ?? 0} active={selectedMetric === "flag:sin_clave"} onClick={() => onMetricFilter("flag", "sin_clave")} />
        <Stat label="Claves repetidas" value={analytics?.quality?.duplicatedKeys ?? 0} active={selectedMetric === "flag:clave_repetida"} onClick={() => onMetricFilter("flag", "clave_repetida")} />
        <Stat label="GPS deficiente" value={(analytics?.selection?.flags?.gps_deficiente || []).length} active={selectedMetric === "flag:gps_deficiente"} onClick={() => onMetricFilter("flag", "gps_deficiente")} />
        <Stat label="Precisión media" value={analytics?.quality?.accuracy?.mean == null ? "--" : `${analytics.quality.accuracy.mean} m`} />
      </div>
      <QualityStrip buckets={analytics?.quality?.buckets} />
      <div className="field-analytics-list">{(analytics?.anomalies || []).map((row) => <div key={row.type}><span><strong>{row.detail}</strong><small>Severidad {row.severity}</small></span><b>{row.total}</b></div>)}{!analytics?.anomalies?.length ? <Empty text="No se detectaron anomalías en la selección." /> : null}</div>
    </div> : null}

    {activeTab === "technicians" ? <div className="field-control-panel-body field-analytics-scroll">
      <div className="field-tech-list">{(analytics?.technicians || []).map((row) => <button type="button" key={row.id ?? row.name} onClick={() => onTechnicianFilter(row.id)}><DualRate label={row.name} count={row.points} keyRate={row.keyRate} validationRate={row.validationRate} /><small className="field-tech-extra">{row.zones} barrios · {row.diaries} jornadas</small></button>)}{!analytics?.technicians?.length ? <Empty text="No hay técnicos en esta selección." /> : null}</div>
    </div> : null}
  </aside>;
}
