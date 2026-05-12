import { useMemo, useState } from "react";
import { MAP_POINT_TYPES } from "../../constants/formsAndUi";
import { API_URL } from "../../config/api";
import { Icon } from "../Icon";
import BottomSheet from "./BottomSheet";
import MapFilters from "./MapFilters";
import MapSearchBar from "./MapSearchBar";
import MapView from "./MapView";
import MarkerPopup from "./MarkerPopup";

function MapPage({
  activeDateLabel,
  editingPointId,
  isAdmin,
  loading,
  locating,
  mapDraft,
  mapFocusRequest,
  mapStatus,
  points,
  recordMetaByPointId,
  saving,
  search,
  selectedPoint,
  selectedPointId,
  typeFilter,
  onBoundsChange,
  onCenterDefault,
  onCreateNotice,
  onDeletePoint,
  onDraftChange,
  onEditPoint,
  onLocate,
  onOpenRecord,
  onResetDraft,
  onSavePoint,
  onSearchChange,
  onSelectPoint,
  onTypeFilterChange
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const selectedMeta = selectedPoint ? recordMetaByPointId?.[selectedPoint.id] : null;
  const captureTitle = editingPointId ? "Editar ubicacion" : "Agregar punto";

  const pointTypeLabel = useMemo(
    () => MAP_POINT_TYPES.find((item) => item.value === mapDraft.point_type)?.label || "Punto",
    [mapDraft.point_type]
  );

  const handleMapClick = (coords) => {
    if (!captureOpen && !editingPointId) return;
    onDraftChange((current) => ({
      ...current,
      latitude: coords.latitude,
      longitude: coords.longitude
    }));
  };

  const openCapture = () => {
    setCaptureOpen(true);
    onResetDraft();
  };

  const handleEdit = (event) => {
    if (!selectedPoint) return;
    onEditPoint(selectedPoint.id, event);
    setCaptureOpen(true);
  };

  return (
    <main className="field-map-page no-print">
      <MapView
        apiUrl={API_URL}
        focusRequest={mapFocusRequest}
        mapDraft={mapDraft}
        points={points}
        selectedPointId={selectedPointId}
        onBoundsChange={onBoundsChange}
        onMapClick={handleMapClick}
        onSelectPoint={onSelectPoint}
      />

      <header className="field-map-topbar">
        <MapSearchBar value={search} onChange={onSearchChange} />
        <div className="field-map-status-row">
          <span className={`field-map-status ${mapStatus === "Sin conexion" ? "is-offline" : ""}`}>
            {loading ? "Cargando..." : mapStatus}
          </span>
          <span>{activeDateLabel}</span>
          <span>{points.length} visibles</span>
        </div>
      </header>

      <div className="field-map-actions" aria-label="Acciones del mapa">
        <button type="button" onClick={onLocate} disabled={locating} aria-label="Ubicacion actual">
          <Icon name={locating ? "refresh" : "map"} />
        </button>
        <button type="button" onClick={() => setFiltersOpen((current) => !current)} aria-label="Filtros">
          <Icon name="search" />
        </button>
        <button type="button" onClick={onCenterDefault} aria-label="Centrar mapa">
          <Icon name="refresh" />
        </button>
        <button type="button" className="is-primary" onClick={openCapture} aria-label="Agregar punto">
          <Icon name="plus" />
        </button>
      </div>

      <MapFilters
        isOpen={filtersOpen}
        value={typeFilter}
        onChange={onTypeFilterChange}
        onClose={() => setFiltersOpen(false)}
      />

      {(captureOpen || editingPointId) ? (
        <form className="field-map-capture-panel" onSubmit={onSavePoint}>
          <div>
            <strong>{captureTitle}</strong>
            <button type="button" onClick={() => { setCaptureOpen(false); onResetDraft(); }}>
              Cerrar
            </button>
          </div>
          <div className="field-map-capture-grid">
            <label>
              <span>Latitud</span>
              <input name="latitude" value={mapDraft.latitude} onChange={(event) => onDraftChange((current) => ({ ...current, latitude: event.target.value }))} />
            </label>
            <label>
              <span>Longitud</span>
              <input name="longitude" value={mapDraft.longitude} onChange={(event) => onDraftChange((current) => ({ ...current, longitude: event.target.value }))} />
            </label>
          </div>
          <label>
            <span>Tipo</span>
            <select name="point_type" value={mapDraft.point_type} onChange={(event) => onDraftChange((current) => ({ ...current, point_type: event.target.value }))}>
              {MAP_POINT_TYPES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Referencia</span>
            <input value={mapDraft.reference} onChange={(event) => onDraftChange((current) => ({ ...current, reference: event.target.value }))} placeholder="Clave, colonia o referencia" />
          </label>
          <label>
            <span>Descripcion</span>
            <textarea value={mapDraft.description} onChange={(event) => onDraftChange((current) => ({ ...current, description: event.target.value }))} rows="2" placeholder={`Detalle para ${pointTypeLabel}`} />
          </label>
          <div className="field-map-capture-actions">
            <button type="button" className="button-secondary" onClick={onLocate} disabled={locating}>
              <Icon name="map" />
              GPS
            </button>
            <button type="submit" disabled={saving}>
              <Icon name={editingPointId ? "records" : "plus"} />
              {saving ? "Guardando..." : editingPointId ? "Actualizar" : "Guardar"}
            </button>
          </div>
        </form>
      ) : null}

      <BottomSheet isOpen={Boolean(selectedPoint)} onClose={() => onSelectPoint(null)}>
        <MarkerPopup
          point={selectedPoint}
          recordMeta={selectedMeta}
          onOpenRecord={() => onOpenRecord(selectedPoint)}
          onCreateNotice={() => onCreateNotice(selectedPoint)}
          onEditLocation={handleEdit}
        />
        {isAdmin ? (
          <button type="button" className="field-map-delete-button" onClick={() => onDeletePoint(selectedPoint.id)}>
            Eliminar punto
          </button>
        ) : null}
      </BottomSheet>
    </main>
  );
}

export default MapPage;
