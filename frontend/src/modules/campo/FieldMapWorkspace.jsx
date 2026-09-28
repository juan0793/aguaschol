import { ALERT_MAP_POINT_TYPE, COMMERCIAL_MAP_POINT_TYPE, MAP_POINT_TYPES } from "../../constants/formsAndUi";
import { API_URL } from "../../config/api";
import { FieldMap, MapPrintDialog } from "../../app/lazyModules";
import { Icon } from "../../components/Icon";
import { MAP_POINT_LIST_STEP } from "../../constants/workspace";
import { MapLoadBoundary } from "../../components/MapLoadBoundary";
import { Suspense } from "react";
import { formatCoordinate, getMapPointTypeLabel } from "../../utils/mapField";
import { formatDateTime, formatMapDiaryLabel } from "../../utils/datesAndBusiness";
import { getMapPointHousingUnits, getMapPointReferenceNote, getMapPointTechnicalDescription } from "../../utils/mapReport";
import "./field-map.css";

const OFFLINE_MAP_STATUSES = ["Sin conexion", "Sin GPS", "Sin permiso", "HTTPS requerido"];

const getPointSummary = (point) =>
  [getMapPointReferenceNote(point), getMapPointTechnicalDescription(point)].filter(Boolean).join(" - ")
  || "Sin referencia adicional.";

function PointDot({ point }) {
  return (
    <span
      className={`map-report-point-dot ${point.is_terminal_point ? "is-pin" : ""}`}
      style={{ "--point-color": point.marker_color || "#1576d1" }}
      aria-hidden="true"
    />
  );
}

export default function FieldMapWorkspace({ model }) {
  const {
    activeMapDiaryDateKey,
    adjustMapDraftHousingUnits,
    archivedMapDiaryGroups,
    editingMapPointId,
    handleCopyCoordinates,
    handleDeleteMapPoint,
    handleDownloadMapReport,
    handleEditMapPoint,
    handleLocateUser,
    handleMapDraftChange,
    handleMapDraftFromMap,
    handleOpenPointInMaps,
    handleSaveMapPoint,
    handleSelectMapPoint,
    hiddenCanvasPointCount,
    hiddenMapPointCount,
    isAdmin,
    listedMapPoints,
    loadingMapPoints,
    locatingUser,
    mapDescriptionLookupStatus,
    mapDiaryGroups,
    mapDraft,
    mapFocusRequest,
    mapLocationHelp,
    mapPointsForCanvas,
    mapStatus,
    openMapDiaryArchiveModal,
    primaryMapDiaryGroups,
    resetMapDraft,
    savingMapPoint,
    selectedMapPoint,
    selectedMapPointId,
    setMapDiaryDateKey,
    setMapPointListLimit,
    setMapStatus,
    setShowMapPrintDialog,
    showMapPrintDialog,
    visibleMapPoints,
    workspaceView
  } = model;

  const isOffline = OFFLINE_MAP_STATUSES.includes(mapStatus);
  const isGpsReady = mapStatus === "GPS listo";

  return (
    <main className="map-layout fm no-print">
      <section className="map-shell">
        <article className="map-stage-card" aria-labelledby="fm-map-title">
          <h2 id="fm-map-title" className="fm-visually-hidden">Mapa de campo</h2>
          <div className="map-toolbar">
            <span className={`map-status-chip ${isOffline ? "is-offline" : ""} ${isGpsReady ? "is-ready" : ""}`} role="status">
              <span className="fm-status-dot" aria-hidden="true" />
              {mapStatus}
            </span>
            <nav className="map-diary-strip" aria-label="Bitácora por día">
              <div className="map-diary-tabs">
                {mapDiaryGroups.length ? (
                  primaryMapDiaryGroups.map((group) => (
                    <button
                      key={group.key}
                      type="button"
                      className={`map-diary-tab ${activeMapDiaryDateKey === group.key ? "is-active" : ""}`}
                      aria-pressed={activeMapDiaryDateKey === group.key}
                      onClick={() => setMapDiaryDateKey(group.key)}
                    >
                      <strong>{formatMapDiaryLabel(group.key)}</strong>
                      <span>{group.total} {group.total === 1 ? "punto" : "puntos"}</span>
                    </button>
                  ))
                ) : (
                  <span className="map-diary-empty">Todavía no hay jornadas registradas.</span>
                )}
                {archivedMapDiaryGroups.length ? (
                  <button type="button" className="map-diary-archive-card" onClick={openMapDiaryArchiveModal}>
                    <strong>Jornadas anteriores</strong>
                    <span>{archivedMapDiaryGroups.length} días</span>
                  </button>
                ) : null}
              </div>
            </nav>
            <button
              type="button"
              className="button-secondary map-print-open-button"
              onClick={() => setShowMapPrintDialog(true)}
            >
              <Icon name="print" />
              Imprimir mapa
            </button>
          </div>
          {mapLocationHelp ? (
            <p className="map-location-help">
              <Icon name="warning" />
              {mapLocationHelp}
            </p>
          ) : null}
          <MapLoadBoundary>
            <Suspense fallback={<div className="map-canvas map-canvas-loading">Cargando mapa...</div>}>
              <FieldMap
                apiUrl={API_URL}
                isActive={workspaceView === "map"}
                mapDraft={mapDraft}
                mapFocusRequest={mapFocusRequest}
                mapPoints={mapPointsForCanvas}
                onDraftChange={handleMapDraftFromMap}
                onSelectPoint={handleSelectMapPoint}
                onStatusChange={setMapStatus}
                selectedMapPointId={selectedMapPointId}
              />
            </Suspense>
          </MapLoadBoundary>
          {hiddenCanvasPointCount ? (
            <p className="helper-text map-mobile-limit-note">
              En móvil se muestran los {mapPointsForCanvas.length} puntos más recientes en el mapa para mantenerlo fluido. La bitácora conserva {visibleMapPoints.length} puntos.
            </p>
          ) : null}
          {showMapPrintDialog ? (
            <Suspense fallback={null}>
              <MapPrintDialog
                apiUrl={API_URL}
                dateLabel={formatMapDiaryLabel(activeMapDiaryDateKey)}
                open={showMapPrintDialog}
                onOpenChange={setShowMapPrintDialog}
                points={visibleMapPoints}
              />
            </Suspense>
          ) : null}
        </article>

        <aside className="map-side-panel">
          <form className={`map-form-card ${editingMapPointId ? "is-editing" : ""}`} onSubmit={handleSaveMapPoint}>
            <header className="fm-section-head">
              <div>
                <h3>
                  {editingMapPointId ? `Editando punto #${editingMapPointId}` : "Registrar ubicación"}
                </h3>
                <p>
                  {editingMapPointId
                    ? "Ajusta coordenadas o descripción y guarda los cambios."
                    : "Usa GPS o toca el mapa; luego completa los datos técnicos."}
                </p>
              </div>
              <button type="button" className="button-secondary fm-quiet-button" onClick={resetMapDraft}>
                <Icon name={editingMapPointId ? "close" : "refresh"} />
                {editingMapPointId ? "Cancelar" : "Limpiar"}
              </button>
            </header>

            <fieldset className="fm-coords">
              <legend className="fm-visually-hidden">Coordenadas</legend>
              <div className="fm-coords-head">
                <span aria-hidden="true">Coordenadas</span>
                <button type="button" className="button-secondary fm-gps-button" onClick={handleLocateUser} disabled={locatingUser}>
                  <Icon name="map" />
                  {locatingUser ? "Ubicando..." : "Usar mi ubicación"}
                </button>
              </div>
              <div className="map-coordinates-grid">
                <label>
                  <span>Latitud</span>
                  <input
                    name="latitude"
                    value={mapDraft.latitude}
                    onChange={handleMapDraftChange}
                    inputMode="decimal"
                    placeholder="13.301700"
                  />
                </label>
                <label>
                  <span>Longitud</span>
                  <input
                    name="longitude"
                    value={mapDraft.longitude}
                    onChange={handleMapDraftChange}
                    inputMode="decimal"
                    placeholder="-87.188900"
                  />
                </label>
                <label className="fm-accuracy-field">
                  <span>Precisión (m)</span>
                  <input
                    name="accuracy_meters"
                    value={mapDraft.accuracy_meters}
                    onChange={handleMapDraftChange}
                    inputMode="decimal"
                    placeholder="5"
                  />
                </label>
              </div>
            </fieldset>

            <div className="fm-type-row">
              <label>
                <span>Tipo de punto</span>
                <select name="point_type" value={mapDraft.point_type} onChange={handleMapDraftChange}>
                  {MAP_POINT_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <div className="map-housing-units-field">
                <span id="fm-housing-label">Viviendas</span>
                <div className="map-housing-stepper" role="group" aria-labelledby="fm-housing-label">
                  <button
                    type="button"
                    className="map-housing-stepper-button"
                    onClick={() => adjustMapDraftHousingUnits(-1)}
                    aria-label="Restar vivienda"
                  >
                    <Icon name="minus" />
                  </button>
                  <input
                    name="housing_units"
                    type="number"
                    min="1"
                    max="999"
                    step="1"
                    value={mapDraft.housing_units}
                    onChange={handleMapDraftChange}
                    inputMode="numeric"
                    placeholder="1"
                    aria-labelledby="fm-housing-label"
                  />
                  <button
                    type="button"
                    className="map-housing-stepper-button"
                    onClick={() => adjustMapDraftHousingUnits(1)}
                    aria-label="Agregar vivienda"
                  >
                    <Icon name="plus" />
                  </button>
                </div>
              </div>
              {mapDraft.point_type === COMMERCIAL_MAP_POINT_TYPE ? (
                <small className="fm-type-note is-commercial">Este punto se guardará y mostrará en rojo.</small>
              ) : mapDraft.point_type === ALERT_MAP_POINT_TYPE ? (
                <small className="fm-type-note is-alert">Este punto se guardará como alerta y se destacará en amarillo en el reporte.</small>
              ) : null}
            </div>

            <label>
              <span>Referencia</span>
              <input
                name="reference"
                value={mapDraft.reference}
                onChange={handleMapDraftChange}
                placeholder="Frente a poste, esquina noroeste, casa verde..."
              />
            </label>
            <label>
              <span>Descripción técnica</span>
              <textarea
                name="description"
                value={mapDraft.description}
                onChange={handleMapDraftChange}
                rows="3"
                placeholder="Detalle de la caja, descarga o punto observado. Ej. clave 10-07-01-01 o 22095."
              />
              {mapDescriptionLookupStatus ? (
                <small className="helper-text">{mapDescriptionLookupStatus}</small>
              ) : null}
            </label>
            <div className="map-form-actions">
              <button type="submit" disabled={savingMapPoint}>
                <Icon name={editingMapPointId ? "records" : "plus"} />
                {savingMapPoint ? "Guardando..." : editingMapPointId ? "Actualizar punto" : "Guardar punto"}
              </button>
            </div>
          </form>

          {selectedMapPoint ? (
            <article className="map-detail-card" aria-labelledby="fm-detail-title">
              <header className="fm-section-head">
                <h3 id="fm-detail-title" className="map-point-title-with-dot">
                  <PointDot point={selectedMapPoint} />
                  {getMapPointTypeLabel(selectedMapPoint.point_type)}
                </h3>
                <span className="fm-id">#{selectedMapPoint.id}</span>
              </header>
              <p className="map-detail-copy">{getPointSummary(selectedMapPoint)}</p>
              <dl className="fm-detail-facts">
                <div><dt>Latitud</dt><dd>{formatCoordinate(selectedMapPoint.latitude)}</dd></div>
                <div><dt>Longitud</dt><dd>{formatCoordinate(selectedMapPoint.longitude)}</dd></div>
                <div><dt>Viviendas</dt><dd>{getMapPointHousingUnits(selectedMapPoint)}</dd></div>
                <div><dt>Precisión</dt><dd>{selectedMapPoint.accuracy_meters ? `±${selectedMapPoint.accuracy_meters} m` : "Sin dato"}</dd></div>
              </dl>
              <div className="map-point-actions">
                <button type="button" className="button-secondary" onClick={(event) => handleEditMapPoint(selectedMapPoint.id, event)}>
                  <Icon name="records" />
                  Editar
                </button>
                <button type="button" className="button-secondary" onClick={(event) => handleOpenPointInMaps(selectedMapPoint, event)}>
                  <Icon name="map" />
                  Ver en Maps
                </button>
                <button type="button" className="button-secondary" onClick={(event) => handleCopyCoordinates(selectedMapPoint, event)}>
                  <Icon name="copy" />
                  Copiar coords
                </button>
              </div>
            </article>
          ) : null}

          <article className="map-list-card" aria-labelledby="fm-list-title">
            <header className="fm-section-head">
              <div>
                <h3 id="fm-list-title">
                  Puntos guardados <span className="fm-count">{visibleMapPoints.length}</span>
                </h3>
                <p>Jornada del {formatMapDiaryLabel(activeMapDiaryDateKey)}</p>
              </div>
              <button type="button" className="button-secondary fm-quiet-button" onClick={handleDownloadMapReport}>
                <Icon name="download" />
                Reporte detallado
              </button>
            </header>
            {loadingMapPoints ? <p className="helper-text">Cargando puntos...</p> : null}
            <div className="map-point-list">
              {listedMapPoints.length ? (
                listedMapPoints.map((point) => (
                  <article
                    key={point.id}
                    className={`map-point-card ${selectedMapPointId === point.id ? "is-active" : ""}`}
                  >
                    <button
                      type="button"
                      className="map-point-main"
                      aria-pressed={selectedMapPointId === point.id}
                      onClick={() => handleSelectMapPoint(point.id)}
                    >
                      <div className="map-point-top">
                        <strong className="map-point-title-with-dot">
                          <PointDot point={point} />
                          {getMapPointTypeLabel(point.point_type)}
                        </strong>
                        <span className="map-point-meta">{formatDateTime(point.created_at)}</span>
                      </div>
                      <p>{getPointSummary(point)}</p>
                      <div className="map-point-coords">
                        <span>{formatCoordinate(point.latitude)}, {formatCoordinate(point.longitude)}</span>
                        <span>{point.accuracy_meters ? `±${point.accuracy_meters} m` : "Sin precisión"}</span>
                      </div>
                    </button>
                    <div className="map-point-actions">
                      <button type="button" className="record-quick-chip" onClick={(event) => handleOpenPointInMaps(point, event)}>
                        Ver en Maps
                      </button>
                      <button type="button" className="record-quick-chip" onClick={(event) => handleCopyCoordinates(point, event)}>
                        Copiar coords
                      </button>
                      <button type="button" className="record-quick-chip" onClick={(event) => handleEditMapPoint(point.id, event)}>
                        Editar
                      </button>
                      {isAdmin ? (
                        <button type="button" className="record-quick-chip is-danger" onClick={() => handleDeleteMapPoint(point.id)}>
                          Eliminar
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <div className="fm-empty">
                  <strong>Sin puntos en esta jornada</strong>
                  <p>Usa el GPS o toca el mapa para comenzar a registrar ubicaciones técnicas.</p>
                </div>
              )}
            </div>
            {hiddenMapPointCount ? (
              <button
                type="button"
                className="button-secondary map-load-more-button"
                onClick={() => setMapPointListLimit((current) => current + MAP_POINT_LIST_STEP)}
              >
                <Icon name="plus" />
                Ver {Math.min(MAP_POINT_LIST_STEP, hiddenMapPointCount)} puntos más
              </button>
            ) : null}
          </article>
        </aside>
      </section>
    </main>
  );
}
