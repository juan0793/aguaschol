import { Icon } from "./Icon";

const DEFAULT_ACCURACY_BUCKETS = [
  { label: "0 a 5 m", total: 0, tone: "is-good" },
  { label: "6 a 15 m", total: 0, tone: "is-mid" },
  { label: "Mas de 15 m", total: 0, tone: "is-warn" },
  { label: "Sin dato", total: 0, tone: "is-empty" }
];

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const toPositiveMax = (value) => Math.max(1, toNumber(value) || 1);

const getBarWidth = (value, max) => {
  const nextMax = toPositiveMax(max);
  const percentage = (toNumber(value) / nextMax) * 100;
  return `${Math.min(100, Math.max(0, percentage))}%`;
};

function FieldAnalyticsPanel({
  activeDateLabel,
  loadingMapContexts,
  loadingMapPoints,
  mapAnalyticsData,
  mapReportData,
  onBackToReport,
  onRefreshPoints,
  onRefreshZones
}) {
  const isLoading = loadingMapContexts || loadingMapPoints;
  const reportData = {
    totalPoints: toNumber(mapReportData?.totalPoints),
    totalZones: toNumber(mapReportData?.totalZones),
    totalsByType: mapReportData?.totalsByType && typeof mapReportData.totalsByType === "object" ? mapReportData.totalsByType : {},
    zones: Array.isArray(mapReportData?.zones) ? mapReportData.zones : []
  };
  const analyticsData = {
    journeySeries: Array.isArray(mapAnalyticsData?.journeySeries) ? mapAnalyticsData.journeySeries : [],
    typeSeries: Array.isArray(mapAnalyticsData?.typeSeries) ? mapAnalyticsData.typeSeries : [],
    zoneSeries: Array.isArray(mapAnalyticsData?.zoneSeries) ? mapAnalyticsData.zoneSeries : [],
    accuracyBuckets: Array.isArray(mapAnalyticsData?.accuracyBuckets)
      ? mapAnalyticsData.accuracyBuckets
      : DEFAULT_ACCURACY_BUCKETS,
    maxJourneyTotal: toPositiveMax(mapAnalyticsData?.maxJourneyTotal),
    maxTypeTotal: toPositiveMax(mapAnalyticsData?.maxTypeTotal),
    maxZoneTotal: toPositiveMax(mapAnalyticsData?.maxZoneTotal)
  };
  const hasFieldData = reportData.totalPoints > 0 || analyticsData.journeySeries.length > 0;

  return (
    <section className="preview-panel log-panel-full">
      <div className="log-shell">
        <div className="log-hero">
          <div className="admin-section-head">
            <div>
              <p className="sheet-kicker">Analitica de campo</p>
              <h2><Icon name="dashboard" className="title-icon" />Estadisticas del levantamiento</h2>
              <p className="workspace-title">
                Vista separada del reporte institucional para revisar tendencias, distribucion por zonas y calidad de captura.
              </p>
            </div>
            <span className="panel-pill">{activeDateLabel}</span>
          </div>
          <div className="log-summary-strip map-report-summary-strip">
            <div className="log-summary-card">
              <span>Total general</span>
              <strong>{reportData.totalPoints}</strong>
            </div>
            <div className="log-summary-card">
              <span>Zonas detectadas</span>
              <strong>{reportData.totalZones}</strong>
            </div>
            <div className="log-summary-card">
              <span>Tipos distintos</span>
              <strong>{analyticsData.typeSeries.length}</strong>
            </div>
            <div className="log-summary-card">
              <span>Contexto cercano</span>
              <strong>{loadingMapContexts ? "Buscando" : "Listo"}</strong>
            </div>
          </div>
        </div>

        <article className="document-sheet log-sheet map-analytics-sheet">
          <div className="map-report-office-head">
            <div className="map-report-brand">
              <div>
                <p className="sheet-kicker">Aguas de Choluteca, S.A. de C.V.</p>
                <h3>Centro estadistico de campo</h3>
                <p className="helper-text">Graficos operativos y metricas de la jornada seleccionada, aparte del formato imprimible.</p>
              </div>
            </div>
            <div className="search-actions">
              <button type="button" className="button-secondary" onClick={onRefreshPoints} disabled={loadingMapPoints}>
                <Icon name="refresh" />
                {loadingMapPoints ? "Actualizando..." : "Refrescar puntos"}
              </button>
              <button type="button" className="button-secondary" onClick={onRefreshZones} disabled={loadingMapContexts}>
                <Icon name="map" />
                {loadingMapContexts ? "Ubicando zonas..." : "Actualizar zonas"}
              </button>
              <button type="button" className="button-secondary" onClick={onBackToReport}>
                <Icon name="records" />
                Ir al reporte institucional
              </button>
            </div>
          </div>

          <div className="map-analytics-grid">
            {isLoading ? (
              <section className="document-block map-analytics-card map-analytics-loading">
                <div className="map-skeleton" aria-label="Cargando estadisticas de campo">
                  <span className="skeleton-line is-short" />
                  <span className="skeleton-line" />
                  <span className="skeleton-line" />
                  <span className="skeleton-line is-tiny" />
                </div>
              </section>
            ) : null}
            {!isLoading && !hasFieldData ? (
              <section className="document-block map-analytics-card map-analytics-empty">
                <div className="empty-state">
                  <Icon name="dashboard" className="empty-state-icon" />
                  <h3>Sin estadisticas para mostrar</h3>
                  <p>No hay puntos de campo cargados para la jornada seleccionada. Puedes refrescar los puntos o revisar otra bitacora desde Mapa de campo.</p>
                </div>
              </section>
            ) : null}
            <section className="document-block map-analytics-card">
              <div className="lookup-card-head map-card-head">
                <div>
                  <p className="sheet-kicker">Tendencia</p>
                  <h3>Jornadas recientes</h3>
                </div>
              </div>
              <div className="map-analytics-bar-list">
                {analyticsData.journeySeries.length ? (
                  analyticsData.journeySeries.map((item) => (
                    <div key={item.key} className="map-analytics-bar-row">
                      <div className="map-analytics-bar-copy">
                        <strong>{item.label}</strong>
                        <span>{item.total} puntos</span>
                      </div>
                      <div className="map-analytics-bar-track">
                        <div
                          className="map-analytics-bar-fill is-journey"
                          style={{ width: getBarWidth(item.total, analyticsData.maxJourneyTotal) }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <h3>Sin jornadas</h3>
                    <p>Cuando haya levantamientos, aqui veras la tendencia por dia.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="document-block map-analytics-card">
              <div className="lookup-card-head map-card-head">
                <div>
                  <p className="sheet-kicker">Distribucion</p>
                  <h3>Tipos de punto</h3>
                </div>
              </div>
              <div className="map-analytics-bar-list">
                {analyticsData.typeSeries.length ? (
                  analyticsData.typeSeries.map((item) => (
                    <div key={item.label} className="map-analytics-bar-row">
                      <div className="map-analytics-bar-copy">
                        <strong>{item.label}</strong>
                        <span>{item.total}</span>
                      </div>
                      <div className="map-analytics-bar-track">
                        <div
                          className="map-analytics-bar-fill is-type"
                          style={{ width: getBarWidth(item.total, analyticsData.maxTypeTotal) }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <h3>Sin tipos</h3>
                    <p>Aun no hay puntos en la jornada seleccionada.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="document-block map-analytics-card">
              <div className="lookup-card-head map-card-head">
                <div>
                  <p className="sheet-kicker">Zonas</p>
                  <h3>Mayor concentracion</h3>
                </div>
              </div>
              <div className="map-analytics-bar-list">
                {analyticsData.zoneSeries.length ? (
                  analyticsData.zoneSeries.map((item) => (
                    <div key={item.label} className="map-analytics-bar-row">
                      <div className="map-analytics-bar-copy">
                        <strong>{item.label}</strong>
                        <span>{item.total} puntos | prec. {item.accuracy ?? "--"} m</span>
                      </div>
                      <div className="map-analytics-bar-track">
                        <div
                          className="map-analytics-bar-fill is-zone"
                          style={{ width: getBarWidth(item.total, analyticsData.maxZoneTotal) }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <h3>Sin zonas</h3>
                    <p>No hay zonas consolidadas todavia para esta jornada.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="document-block map-analytics-card">
              <div className="lookup-card-head map-card-head">
                <div>
                  <p className="sheet-kicker">Calidad</p>
                  <h3>Precision del levantamiento</h3>
                </div>
              </div>
              <div className="map-analytics-bucket-grid">
                {analyticsData.accuracyBuckets.map((bucket) => (
                  <div key={bucket.label} className={`map-analytics-bucket ${bucket.tone}`}>
                    <span>{bucket.label}</span>
                    <strong>{toNumber(bucket.total)}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </article>
      </div>
    </section>
  );
}

export default FieldAnalyticsPanel;
