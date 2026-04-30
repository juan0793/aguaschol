import { Icon } from "./Icon";

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
              <strong>{mapReportData.totalPoints}</strong>
            </div>
            <div className="log-summary-card">
              <span>Zonas detectadas</span>
              <strong>{mapReportData.totalZones}</strong>
            </div>
            <div className="log-summary-card">
              <span>Tipos distintos</span>
              <strong>{mapAnalyticsData.typeSeries.length}</strong>
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
            <section className="document-block map-analytics-card">
              <div className="lookup-card-head map-card-head">
                <div>
                  <p className="sheet-kicker">Tendencia</p>
                  <h3>Jornadas recientes</h3>
                </div>
              </div>
              <div className="map-analytics-bar-list">
                {mapAnalyticsData.journeySeries.length ? (
                  mapAnalyticsData.journeySeries.map((item) => (
                    <div key={item.key} className="map-analytics-bar-row">
                      <div className="map-analytics-bar-copy">
                        <strong>{item.label}</strong>
                        <span>{item.total} puntos</span>
                      </div>
                      <div className="map-analytics-bar-track">
                        <div
                          className="map-analytics-bar-fill is-journey"
                          style={{ width: `${(item.total / mapAnalyticsData.maxJourneyTotal) * 100}%` }}
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
                {mapAnalyticsData.typeSeries.length ? (
                  mapAnalyticsData.typeSeries.map((item) => (
                    <div key={item.label} className="map-analytics-bar-row">
                      <div className="map-analytics-bar-copy">
                        <strong>{item.label}</strong>
                        <span>{item.total}</span>
                      </div>
                      <div className="map-analytics-bar-track">
                        <div
                          className="map-analytics-bar-fill is-type"
                          style={{ width: `${(item.total / mapAnalyticsData.maxTypeTotal) * 100}%` }}
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
                {mapAnalyticsData.zoneSeries.length ? (
                  mapAnalyticsData.zoneSeries.map((item) => (
                    <div key={item.label} className="map-analytics-bar-row">
                      <div className="map-analytics-bar-copy">
                        <strong>{item.label}</strong>
                        <span>{item.total} puntos | prec. {item.accuracy ?? "--"} m</span>
                      </div>
                      <div className="map-analytics-bar-track">
                        <div
                          className="map-analytics-bar-fill is-zone"
                          style={{ width: `${(item.total / mapAnalyticsData.maxZoneTotal) * 100}%` }}
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
                {mapAnalyticsData.accuracyBuckets.map((bucket) => (
                  <div key={bucket.label} className={`map-analytics-bucket ${bucket.tone}`}>
                    <span>{bucket.label}</span>
                    <strong>{bucket.total}</strong>
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
