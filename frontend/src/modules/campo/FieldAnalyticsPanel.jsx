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

const Empty = ({ text }) => <div className="field-control-empty"><Icon name="search" /><strong>Sin datos</strong><span>{text}</span></div>;
const Stat = ({ label, value, onClick, active }) => <button type="button" className={active ? "is-active" : ""} onClick={onClick} disabled={!onClick}><span>{label}</span><strong>{value}</strong></button>;

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
  return <aside className="field-control-floating-panel">
    <div className="field-control-tabs" role="tablist">
      {tabs.map(([id, label]) => <button type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? "is-active" : ""} key={id} onClick={() => onActiveTab(id)}>{label}</button>)}
    </div>

    {activeTab === "territory" ? <div className="field-control-panel-body">
      <div className="field-control-panel-summary"><div><strong>{selectedPoints.length} puntos</strong><span>{analytics?.territory?.zones ?? 0} barrios · {analytics?.territory?.keys ?? 0} claves</span></div></div>
      <div className="field-control-point-list">{selectedPoints.slice(0, pointLimit).map((point) => <article key={point.id} className={selectedPointId === point.id ? "is-selected" : ""}><button type="button" className="field-control-point-main" onClick={() => onSelectPoint(point.id)}><span><strong>{getFieldPointClave(point) || getMapPointTypeLabel(point.point_type)}</strong><small>{getFieldPointZone(point, barrios)}</small><small>{formatDateTime(point.created_at)} · {point.created_by_name || point.created_by_username || "Sin técnico"}</small></span></button><button type="button" className="field-control-point-edit" onClick={() => onEditPoint(point.id)} aria-label="Editar punto"><Icon name="records" /></button></article>)}</div>
      {pointLimit < selectedPoints.length ? <button type="button" className="field-control-more" onClick={() => setPointLimit((current) => current + 30)}>Ver 30 puntos más</button> : null}
    </div> : null}

    {activeTab === "portfolio" ? <div className="field-control-panel-body field-analytics-scroll">
      <div className="field-control-portfolio-summary"><article><span>Abonados</span><strong>{analytics?.portfolio?.accountsFound ?? 0}</strong></article><article><span>Cartera total</span><strong>{formatCurrency(analytics?.portfolio?.total ?? 0)}</strong></article><article><span>Promedio</span><strong>{formatCurrency(analytics?.portfolio?.average ?? 0)}</strong></article><article><span>Mediana</span><strong>{formatCurrency(analytics?.portfolio?.median ?? 0)}</strong></article></div>
      <div className="field-analytics-list">{(analytics?.portfolio?.ranges || []).map((range) => <button type="button" key={range.id} className={selectedMetric === `range:${range.id}` ? "is-active" : ""} onClick={() => onMetricFilter("range", range.id)}><span><strong>{range.label}</strong><small>{range.accounts} abonados · {range.keys} claves</small></span><b>{formatCurrency(range.total)}</b></button>)}</div>
    </div> : null}

    {activeTab === "commercial" ? <div className="field-control-panel-body field-analytics-scroll">
      <div className="field-analytics-stat-grid">
        <Stat label="Negocios" value={analytics?.commercial?.businesses ?? 0} active={selectedMetric === "flag:negocio"} onClick={() => onMetricFilter("flag", "negocio")} />
        <Stat label="Cartera comercial" value={formatCurrency(analytics?.commercial?.total ?? 0)} />
        <Stat label="Sin clave" value={analytics?.commercial?.withoutKey ?? 0} />
        <Stat label="Clandestinos" value={analytics?.commercial?.clandestine ?? 0} active={selectedMetric === "flag:clandestino"} onClick={() => onMetricFilter("flag", "clandestino")} />
      </div>
      <div className="field-analytics-list">{(analytics?.commercial?.zones || []).map((zone) => <div key={zone.label}><span><strong>{zone.label}</strong><small>{zone.businesses} negocios · {zone.accounts} abonados</small></span><b>{formatCurrency(zone.total)}</b></div>)}</div>
    </div> : null}

    {activeTab === "quality" ? <div className="field-control-panel-body field-analytics-scroll">
      <div className="field-analytics-stat-grid">
        <Stat label="Sin clave" value={analytics?.quality?.withoutKey ?? 0} active={selectedMetric === "flag:sin_clave"} onClick={() => onMetricFilter("flag", "sin_clave")} />
        <Stat label="Claves repetidas" value={analytics?.quality?.duplicatedKeys ?? 0} active={selectedMetric === "flag:clave_repetida"} onClick={() => onMetricFilter("flag", "clave_repetida")} />
        <Stat label="GPS deficiente" value={(analytics?.selection?.flags?.gps_deficiente || []).length} active={selectedMetric === "flag:gps_deficiente"} onClick={() => onMetricFilter("flag", "gps_deficiente")} />
        <Stat label="Precisión media" value={analytics?.quality?.accuracy?.mean == null ? "--" : `${analytics.quality.accuracy.mean} m`} />
      </div>
      <div className="field-analytics-list">{(analytics?.anomalies || []).map((row) => <div key={row.type}><span><strong>{row.detail}</strong><small>Severidad {row.severity}</small></span><b>{row.total}</b></div>)}{!analytics?.anomalies?.length ? <Empty text="No se detectaron anomalías en la selección." /> : null}</div>
    </div> : null}

    {activeTab === "technicians" ? <div className="field-control-panel-body field-analytics-scroll">
      <div className="field-analytics-list">{(analytics?.technicians || []).map((row) => <button type="button" key={row.id ?? row.name} onClick={() => onTechnicianFilter(row.id)}><span><strong>{row.name}</strong><small>{row.zones} barrios · {row.diaries} jornadas · {row.keyRate}% con clave</small></span><b>{row.points} pts</b></button>)}{!analytics?.technicians?.length ? <Empty text="No hay técnicos en esta selección." /> : null}</div>
    </div> : null}
  </aside>;
}
