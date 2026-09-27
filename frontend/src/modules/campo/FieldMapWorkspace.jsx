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

  return (
    <main className="map-layout no-print">
      <section className="map-shell">
        <article className="map-stage-card">
          <div className="lookup-card-head map-card-head">
            <div>
              <p className="sheet-kicker">Geolocalizacion de campo</p>
              <h2><Icon name="map" className="title-icon" />Mapa de campo</h2>
            </div>
          </div>
          <div className="map-toolbar">
            <span className={`map-status-chip ${["Sin conexion", "Sin GPS", "Sin permiso", "HTTPS requerido"].includes(mapStatus) ? "is-offline" : ""}`}>
              <Icon name={mapStatus === "GPS listo" ? "success" : mapStatus === "Sin conexion" ? "activity" : "map"} />
              {mapStatus}
            </span>
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
          <div className="map-diary-strip">
            <div className="map-diary-strip-head">
              <strong>Bitacora por dia</strong>
            </div>
            <div className="map-diary-tabs">
              {mapDiaryGroups.length ? (
                primaryMapDiaryGroups.map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    className={`map-diary-tab ${activeMapDiaryDateKey === group.key ? "is-active" : ""}`}
                    onClick={() => setMapDiaryDateKey(group.key)}
                  >
                    <strong>{formatMapDiaryLabel(group.key)}</strong>
                    <span>{group.total} puntos</span>
                  </button>
                ))
              ) : (
                <span className="map-diary-empty">Todavia no hay jornadas registradas.</span>
              )}
              {archivedMapDiaryGroups.length ? (
                <button type="button" className="map-diary-archive-card" onClick={openMapDiaryArchiveModal}>
                  <strong>Jornadas anteriores</strong>
                  <span>{archivedMapDiaryGroups.length} dias adjuntos</span>
                </button>
              ) : null}
            </div>
          </div>
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
              En movil se muestran los {mapPointsForCanvas.length} puntos mas recientes en el mapa para mantenerlo fluido. La bitacora conserva {visibleMapPoints.length} puntos.
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
            <div className="lookup-card-head map-card-head">
              <div>
                <p className="sheet-kicker">{editingMapPointId ? "Edicion activa" : "Nuevo punto"}</p>
                <h3>{editingMapPointId ? "Actualizar ubicacion" : "Registrar ubicacion"}</h3>
                <p className="helper-text">
                  {editingMapPointId
                    ? "Ajusta coordenadas o descripcion y guarda los cambios."
                    : "Usa GPS o toca el mapa; luego completa los datos tecnicos."}
                </p>
              </div>
              <button type="button" className="button-secondary" onClick={resetMapDraft}>
                <Icon name="refresh" />
                {editingMapPointId ? "Cancelar" : "Limpiar"}
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
              <label>
                <span>Precision (m)</span>
                <input
                  name="accuracy_meters"
                  value={mapDraft.accuracy_meters}
                  onChange={handleMapDraftChange}
                  inputMode="decimal"
                  placeholder="5"
                />
              </label>
              <label>
                <span>Tipo de punto</span>
                <select name="point_type" value={mapDraft.point_type} onChange={handleMapDraftChange}>
                  {MAP_POINT_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {mapDraft.point_type === COMMERCIAL_MAP_POINT_TYPE ? (
                  <small className="helper-text">Este punto se guardara y mostrara en rojo.</small>
                ) : mapDraft.point_type === ALERT_MAP_POINT_TYPE ? (
                  <small className="helper-text">Este punto se guardara como alerta y se destacara en amarillo en el reporte.</small>
                ) : null}
              </label>
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
            <div className="map-description-grid">
              <label>
                <span>Descripcion tecnica</span>
                <textarea
                  name="description"
                  value={mapDraft.description}
                  onChange={handleMapDraftChange}
                  rows="4"
                  placeholder="Detalle de la caja, descarga o punto observado. Ej. clave 10-07-01-01 o 22095."
                />
                {mapDescriptionLookupStatus ? (
                  <small className="helper-text">{mapDescriptionLookupStatus}</small>
                ) : null}
              </label>
              <label className="map-housing-units-field">
                <span>Viviendas</span>
                <div className="map-housing-stepper">
                  <button
                    type="button"
                    className="map-housing-stepper-button"
                    onClick={() => adjustMapDraftHousingUnits(-1)}
                    aria-label="Restar vivienda"
                  >
                    -
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
              </label>
            </div>
            <div className="map-form-actions">
              <button type="button" className="button-secondary" onClick={handleLocateUser} disabled={locatingUser}>
                <Icon name="map" />
                {locatingUser ? "Ubicando..." : "Usar mi ubicacion"}
              </button>
              <button type="submit" disabled={savingMapPoint}>
                <Icon name={editingMapPointId ? "records" : "plus"} />
                {savingMapPoint ? "Guardando..." : editingMapPointId ? "Actualizar punto" : "Guardar punto"}
              </button>
            </div>
          </form>

          {selectedMapPoint ? (
            <article className="map-detail-card">
              <div className="lookup-card-head map-card-head">
                <div>
                  <p className="sheet-kicker">Punto seleccionado</p>
                  <h3 className="map-point-title-with-dot">
                    <span
                      className={`map-report-point-dot ${selectedMapPoint.is_terminal_point ? "is-pin" : ""}`}
                      style={{ "--point-color": selectedMapPoint.marker_color || "#1576d1" }}
                    />
                    {getMapPointTypeLabel(selectedMapPoint.point_type)}
                  </h3>
                </div>
                <span className="panel-pill">#{selectedMapPoint.id}</span>
              </div>
              <p className="map-detail-copy">
                {[getMapPointReferenceNote(selectedMapPoint), getMapPointTechnicalDescription(selectedMapPoint)]
                  .filter(Boolean)
                  .join(" - ") || "Sin referencia adicional."}
              </p>
              <div className="map-point-coords">
                <span>{formatCoordinate(selectedMapPoint.latitude)}</span>
                <span>{formatCoordinate(selectedMapPoint.longitude)}</span>
                <span>{getMapPointHousingUnits(selectedMapPoint)} viviendas</span>
                <span>{selectedMapPoint.accuracy_meters ? `±${selectedMapPoint.accuracy_meters} m` : "Sin precision"}</span>
              </div>
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

          <article className="map-list-card">
            <div className="lookup-card-head map-card-head">
              <div>
                <p className="sheet-kicker">Registro tecnico</p>
                <h3>Puntos guardados</h3>
              </div>
              <div className="map-list-head-actions">
                <span className="panel-pill">{visibleMapPoints.length}</span>
                <button type="button" className="button-secondary" onClick={handleDownloadMapReport}>
                  <Icon name="download" />
                  Reporte detallado
                </button>
              </div>
            </div>
            <p className="helper-text">Mostrando la jornada del {formatMapDiaryLabel(activeMapDiaryDateKey)}.</p>
            {loadingMapPoints ? <p className="helper-text">Cargando puntos...</p> : null}
            <div className="map-point-list">
              {listedMapPoints.length ? (
                listedMapPoints.map((point) => (
                  <article
                    key={point.id}
                    className={`map-point-card ${selectedMapPointId === point.id ? "is-active" : ""}`}
                  >
                    <button type="button" className="map-point-main" onClick={() => handleSelectMapPoint(point.id)}>
                      <div className="map-point-top">
                        <strong className="map-point-title-with-dot">
                          <span
                            className={`map-report-point-dot ${point.is_terminal_point ? "is-pin" : ""}`}
                            style={{ "--point-color": point.marker_color || "#1576d1" }}
                          />
                          {getMapPointTypeLabel(point.point_type)}
                        </strong>
                        <span className="map-point-meta">{formatDateTime(point.created_at)}</span>
                      </div>
                      <p>
                        {[getMapPointReferenceNote(point), getMapPointTechnicalDescription(point)]
                          .filter(Boolean)
                          .join(" - ") || "Sin referencia adicional."}
                      </p>
                      <div className="map-point-coords">
                        <span>{formatCoordinate(point.latitude)}</span>
                        <span>{formatCoordinate(point.longitude)}</span>
                        <span>{point.accuracy_meters ? `±${point.accuracy_meters} m` : "Sin precision"}</span>
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
                      <button type="button" className="record-quick-chip" onClick={() => handleDeleteMapPoint(point.id)}>
                        Eliminar
                      </button>
                    ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <h3>Sin puntos aun</h3>
                  <p>Usa el GPS o toca el mapa para comenzar a registrar ubicaciones tecnicas.</p>
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
                Ver {Math.min(MAP_POINT_LIST_STEP, hiddenMapPointCount)} puntos mas
              </button>
            ) : null}
          </article>
        </aside>
      </section>
    </main>
  );
}
