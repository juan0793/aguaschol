import { useEffect, useMemo, useState } from "react";
import FieldMap from "./FieldMap";
import { Icon } from "./Icon";
import { MAP_POINT_TYPES } from "../constants/formsAndUi";
import { formatDateTime } from "../utils/datesAndBusiness";
import { buildExternalMapUrl, formatCoordinate, getMapPointTypeLabel } from "../utils/mapField";

const validationStatusMeta = {
  pending: { label: "Pendiente", className: "is-pending" },
  approved: { label: "Aprobado", className: "is-approved" },
  needs_correction: { label: "Requiere correccion", className: "is-warning" },
  corrected: { label: "Corregido", className: "is-corrected" }
};

const buildDraftFromPoint = (value = {}) => {
  const point = value || {};
  return {
  point_type: point.point_type || "caja_registro",
  latitude: point.latitude ?? "",
  longitude: point.longitude ?? "",
  accuracy_meters: point.accuracy_meters ?? "",
  reference: point.reference_note || "",
  description: point.description || "",
  marker_color: point.marker_color || "#1576d1",
  is_terminal_point: Boolean(point.is_terminal_point),
  validation_status: point.validation_status || "pending",
  validation_notes: point.validation_notes || "",
  correction_notes: point.correction_notes || ""
  };
};

const FieldValidationWorkspace = ({
  apiUrl,
  activeDateLabel,
  isActive,
  loading,
  mapPoints,
  onCopyCoordinates,
  onRefresh,
  onSaveValidation,
  onSelectPoint,
  savingPointId,
  selectedPointId,
  setSelectedPointId
}) => {
  const selectedPoint = useMemo(
    () => mapPoints.find((point) => point.id === selectedPointId) ?? mapPoints[0] ?? null,
    [mapPoints, selectedPointId]
  );
  const [draft, setDraft] = useState(() => buildDraftFromPoint(selectedPoint));
  const [mapStatus, setMapStatus] = useState("Revision");

  useEffect(() => {
    if (!selectedPoint) {
      setDraft(buildDraftFromPoint({}));
      return;
    }

    setDraft(buildDraftFromPoint(selectedPoint));
  }, [selectedPoint]);

  const counts = useMemo(
    () =>
      mapPoints.reduce(
        (totals, point) => {
          const status = point.validation_status || "pending";
          totals[status] = (totals[status] || 0) + 1;
          totals.total += 1;
          return totals;
        },
        { total: 0, pending: 0, approved: 0, needs_correction: 0, corrected: 0 }
      ),
    [mapPoints]
  );

  const handleDraftChange = (event) => {
    const { name, value, type, checked } = event.target;
    setDraft((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleDraftFromMap = (updater) => {
    setMapStatus("Ubicacion ajustada");
    setDraft(updater);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedPoint) return;
    await onSaveValidation(selectedPoint.id, draft);
  };

  const handleQuickStatus = async (status) => {
    if (!selectedPoint) return;
    await onSaveValidation(selectedPoint.id, {
      ...draft,
      validation_status: status
    });
  };

  const selectedMeta = validationStatusMeta[selectedPoint?.validation_status || "pending"] ?? validationStatusMeta.pending;

  return (
    <main className="field-validation-layout no-print">
      <section className="field-validation-hero">
        <div>
          <p className="sheet-kicker">Validacion de campo</p>
          <h2><Icon name="success" className="title-icon" />Revision de puntos GPS</h2>
          <p className="helper-text">
            Revisa coordenadas capturadas por tecnicos, corrige datos y deja trazabilidad antes de aprobarlos.
          </p>
        </div>
        <div className="field-validation-metrics">
          <span><strong>{counts.pending}</strong>Pendientes</span>
          <span><strong>{counts.needs_correction}</strong>Correccion</span>
          <span><strong>{counts.approved}</strong>Aprobados</span>
        </div>
      </section>

      <section className="field-validation-grid">
        <article className="map-stage-card field-validation-map-card">
          <div className="lookup-card-head map-card-head">
            <div>
              <p className="sheet-kicker">Mapa de revision</p>
              <h3>{activeDateLabel}</h3>
            </div>
            <div className="map-list-head-actions">
              <span className="panel-pill">{counts.total} puntos</span>
              <button type="button" className="button-secondary" onClick={onRefresh} disabled={loading}>
                <Icon name="refresh" />
                {loading ? "Cargando..." : "Actualizar"}
              </button>
            </div>
          </div>
          <FieldMap
            apiUrl={apiUrl}
            isActive={isActive}
            mapDraft={draft}
            mapPoints={mapPoints}
            onDraftChange={handleDraftFromMap}
            onSelectPoint={(pointId) => {
              setSelectedPointId(pointId);
              onSelectPoint?.(pointId);
            }}
            onStatusChange={setMapStatus}
            selectedMapPointId={selectedPoint?.id}
          />
          <p className="helper-text">Estado del mapa: {mapStatus}. Toca el mapa para ajustar la ubicacion del punto seleccionado.</p>
        </article>

        <aside className="field-validation-panel">
          {selectedPoint ? (
            <form className="map-form-card field-validation-form" onSubmit={handleSubmit}>
              <div className="lookup-card-head map-card-head">
                <div>
                  <p className="sheet-kicker">Punto #{selectedPoint.id}</p>
                  <h3 className="map-point-title-with-dot">
                    <span
                      className={`map-report-point-dot ${selectedPoint.is_terminal_point ? "is-pin" : ""}`}
                      style={{ "--point-color": selectedPoint.marker_color || "#1576d1" }}
                    />
                    {getMapPointTypeLabel(selectedPoint.point_type)}
                  </h3>
                </div>
                <span className={`validation-status-chip ${selectedMeta.className}`}>{selectedMeta.label}</span>
              </div>

              <div className="map-coordinates-grid">
                <label>
                  <span>Latitud</span>
                  <input name="latitude" value={draft.latitude} onChange={handleDraftChange} inputMode="decimal" />
                </label>
                <label>
                  <span>Longitud</span>
                  <input name="longitude" value={draft.longitude} onChange={handleDraftChange} inputMode="decimal" />
                </label>
                <label>
                  <span>Precision (m)</span>
                  <input name="accuracy_meters" value={draft.accuracy_meters} onChange={handleDraftChange} inputMode="decimal" />
                </label>
                <label>
                  <span>Tipo</span>
                  <select name="point_type" value={draft.point_type} onChange={handleDraftChange}>
                    {MAP_POINT_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                <span>Referencia corregida</span>
                <input name="reference" value={draft.reference} onChange={handleDraftChange} />
              </label>
              <label>
                <span>Descripcion tecnica</span>
                <textarea name="description" value={draft.description} onChange={handleDraftChange} rows="3" />
              </label>
              <label>
                <span>Estado de validacion</span>
                <select name="validation_status" value={draft.validation_status} onChange={handleDraftChange}>
                  <option value="pending">Pendiente</option>
                  <option value="approved">Aprobado</option>
                  <option value="needs_correction">Requiere correccion</option>
                  <option value="corrected">Corregido</option>
                </select>
              </label>
              <label>
                <span>Nota de validacion</span>
                <textarea name="validation_notes" value={draft.validation_notes} onChange={handleDraftChange} rows="3" />
              </label>
              <label>
                <span>Nota para correccion</span>
                <textarea name="correction_notes" value={draft.correction_notes} onChange={handleDraftChange} rows="3" />
              </label>

              <div className="field-validation-actions">
                <button type="button" className="button-secondary" onClick={() => window.open(buildExternalMapUrl(selectedPoint.latitude, selectedPoint.longitude), "_blank", "noopener,noreferrer")}>
                  <Icon name="map" />
                  Maps
                </button>
                <button type="button" className="button-secondary" onClick={(event) => onCopyCoordinates(selectedPoint, event)}>
                  <Icon name="copy" />
                  Copiar
                </button>
                <button type="button" className="button-secondary" onClick={() => handleQuickStatus("needs_correction")} disabled={savingPointId === selectedPoint.id}>
                  <Icon name="warning" />
                  Corregir
                </button>
                <button type="button" className="button-secondary" onClick={() => handleQuickStatus("approved")} disabled={savingPointId === selectedPoint.id}>
                  <Icon name="success" />
                  Aprobar
                </button>
                <button type="submit" disabled={savingPointId === selectedPoint.id}>
                  <Icon name="records" />
                  {savingPointId === selectedPoint.id ? "Guardando..." : "Guardar revision"}
                </button>
              </div>
            </form>
          ) : (
            <article className="empty-state">
              <h3>Sin puntos para revisar</h3>
              <p>No hay capturas GPS en la jornada seleccionada.</p>
            </article>
          )}
        </aside>
      </section>

      <section className="field-validation-list">
        {mapPoints.map((point) => {
          const meta = validationStatusMeta[point.validation_status || "pending"] ?? validationStatusMeta.pending;
          return (
            <article
              key={point.id}
              className={`map-point-card field-validation-card ${selectedPoint?.id === point.id ? "is-active" : ""}`}
            >
              <button type="button" className="map-point-main" onClick={() => setSelectedPointId(point.id)}>
                <div className="map-point-top">
                  <strong>{getMapPointTypeLabel(point.point_type)}</strong>
                  <span className={`validation-status-chip ${meta.className}`}>{meta.label}</span>
                </div>
                <p>{point.reference_note || point.description || "Sin referencia adicional."}</p>
                <div className="map-point-coords">
                  <span>{formatCoordinate(point.latitude)}</span>
                  <span>{formatCoordinate(point.longitude)}</span>
                  <span>{point.accuracy_meters ? `${point.accuracy_meters} m` : "Sin precision"}</span>
                </div>
                <small>{point.created_by_name || "Tecnico sin nombre"} · {formatDateTime(point.created_at)}</small>
              </button>
            </article>
          );
        })}
      </section>
    </main>
  );
};

export default FieldValidationWorkspace;
