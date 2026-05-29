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

const validationStatusFilters = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "needs_correction", label: "Correccion" },
  { value: "corrected", label: "Corregidos" },
  { value: "approved", label: "Aprobados" }
];

const normalizeSearchText = (value = "") =>
  String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

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
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
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
  const completionPercent = counts.total ? Math.round(((counts.approved + counts.corrected) / counts.total) * 100) : 0;
  const filteredPoints = useMemo(() => {
    const search = normalizeSearchText(query);

    return mapPoints.filter((point) => {
      const status = point.validation_status || "pending";
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!search) return true;

      const haystack = normalizeSearchText(
        [
          getMapPointTypeLabel(point.point_type),
          point.reference_note,
          point.description,
          point.created_by_name,
          point.latitude,
          point.longitude
        ].join(" ")
      );
      return haystack.includes(search);
    });
  }, [mapPoints, query, statusFilter]);
  const nextPendingPoint = useMemo(
    () => filteredPoints.find((point) => ["pending", "needs_correction"].includes(point.validation_status || "pending")) ?? filteredPoints[0] ?? null,
    [filteredPoints]
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
          <p className="sheet-kicker">Validacion campo</p>
          <h2><Icon name="success" className="title-icon" />Revision de puntos GPS</h2>
          <p className="helper-text">
            Revisa coordenadas capturadas por tecnicos, corrige datos y deja trazabilidad antes de aprobarlos.
          </p>
        </div>
        <div className="field-validation-guide" aria-label="Flujo de validacion">
          <span><strong>1</strong>Ubica</span>
          <span><strong>2</strong>Corrige</span>
          <span><strong>3</strong>Aprueba</span>
        </div>
      </section>

      <section className="field-validation-command">
        <div className="field-validation-progress">
          <div>
            <span className="sheet-kicker">Avance de jornada</span>
            <strong>{completionPercent}% validado</strong>
          </div>
          <div className="field-validation-progress-bar" aria-hidden="true">
            <span style={{ width: `${completionPercent}%` }} />
          </div>
        </div>
        <div className="field-validation-metrics">
          <button type="button" className={statusFilter === "pending" ? "is-active" : ""} onClick={() => setStatusFilter("pending")}>
            <strong>{counts.pending}</strong>Pendientes
          </button>
          <button type="button" className={statusFilter === "needs_correction" ? "is-active" : ""} onClick={() => setStatusFilter("needs_correction")}>
            <strong>{counts.needs_correction}</strong>Correccion
          </button>
          <button type="button" className={statusFilter === "approved" ? "is-active" : ""} onClick={() => setStatusFilter("approved")}>
            <strong>{counts.approved}</strong>Aprobados
          </button>
        </div>
      </section>

      <section className="field-validation-grid">
        <aside className="field-validation-queue">
          <div className="field-validation-toolbar">
            <div>
              <p className="sheet-kicker">Cola de revision</p>
              <h3>{filteredPoints.length} puntos</h3>
            </div>
            <button type="button" className="button-secondary" onClick={onRefresh} disabled={loading}>
              <Icon name="refresh" />
              {loading ? "Cargando..." : "Actualizar"}
            </button>
          </div>

          <label className="field-validation-search">
            <span>Buscar punto</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tipo, tecnico, clave o coordenada" />
          </label>

          <div className="field-validation-filter-row">
            {validationStatusFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={statusFilter === filter.value ? "is-active" : ""}
                onClick={() => setStatusFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="field-validation-queue-list">
            {filteredPoints.length ? (
              filteredPoints.map((point, index) => {
                const meta = validationStatusMeta[point.validation_status || "pending"] ?? validationStatusMeta.pending;
                return (
                  <article
                    key={point.id}
                    className={`field-validation-queue-card ${selectedPoint?.id === point.id ? "is-active" : ""}`}
                  >
                    <button type="button" onClick={() => setSelectedPointId(point.id)}>
                      <span className="field-validation-card-index">{index + 1}</span>
                      <span>
                        <strong>{getMapPointTypeLabel(point.point_type)}</strong>
                        <small>{point.reference_note || point.description || "Sin referencia adicional."}</small>
                        <em>{point.created_by_name || "Tecnico sin nombre"} · {formatDateTime(point.created_at)}</em>
                      </span>
                      <span className={`validation-status-chip ${meta.className}`}>{meta.label}</span>
                    </button>
                  </article>
                );
              })
            ) : (
              <div className="empty-state field-validation-empty">
                <h3>Sin coincidencias</h3>
                <p>Ajusta el filtro o busca otra referencia.</p>
              </div>
            )}
          </div>
        </aside>

        <article className="map-stage-card field-validation-map-card">
          <div className="lookup-card-head map-card-head">
            <div>
              <p className="sheet-kicker">Mapa de revision</p>
              <h3>{activeDateLabel}</h3>
            </div>
            <div className="map-list-head-actions">
              <span className="panel-pill">{filteredPoints.length} visibles</span>
              <button type="button" className="button-secondary" onClick={() => nextPendingPoint && setSelectedPointId(nextPendingPoint.id)} disabled={!nextPendingPoint}>
                <Icon name="arrowRight" />
                Siguiente
              </button>
            </div>
          </div>
          <FieldMap
            apiUrl={apiUrl}
            isActive={isActive}
            mapDraft={draft}
            mapPoints={filteredPoints}
            onDraftChange={handleDraftFromMap}
            onSelectPoint={(pointId) => {
              setSelectedPointId(pointId);
              onSelectPoint?.(pointId);
            }}
            onStatusChange={setMapStatus}
            selectedMapPointId={selectedPoint?.id}
          />
          <div className="field-validation-map-hint">
            <Icon name="map" />
            <span>Estado del mapa: {mapStatus}. Toca el mapa para ajustar la ubicacion del punto seleccionado.</span>
          </div>
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

              <div className="field-validation-selected-summary">
                <p>{selectedPoint.reference_note || selectedPoint.description || "Sin referencia capturada."}</p>
                <div>
                  <span>{formatCoordinate(selectedPoint.latitude)}</span>
                  <span>{formatCoordinate(selectedPoint.longitude)}</span>
                  <span>{selectedPoint.accuracy_meters ? `${selectedPoint.accuracy_meters} m` : "Sin precision"}</span>
                </div>
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
                <button type="button" className="button-secondary field-validation-icon-action" onClick={() => window.open(buildExternalMapUrl(selectedPoint.latitude, selectedPoint.longitude), "_blank", "noopener,noreferrer")}>
                  <Icon name="map" />
                  Maps
                </button>
                <button type="button" className="button-secondary field-validation-icon-action" onClick={(event) => onCopyCoordinates(selectedPoint, event)}>
                  <Icon name="copy" />
                  Copiar
                </button>
                <button type="button" className="button-secondary field-validation-warning-action" onClick={() => handleQuickStatus("needs_correction")} disabled={savingPointId === selectedPoint.id}>
                  <Icon name="warning" />
                  Corregir
                </button>
                <button type="button" className="button-secondary field-validation-success-action" onClick={() => handleQuickStatus("approved")} disabled={savingPointId === selectedPoint.id}>
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
    </main>
  );
};

export default FieldValidationWorkspace;
