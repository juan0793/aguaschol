import { useCallback, useEffect, useMemo, useState } from "react";
import FieldMap from "./FieldMap";
import { Icon } from "./Icon";
import { MAP_POINT_TYPES } from "../constants/formsAndUi";
import { formatDateTime } from "../utils/datesAndBusiness";
import { buildExternalMapUrl, formatCoordinate, getMapPointTypeLabel } from "../utils/mapField";
import { escapeHtml } from "../utils/html";
import { printDocument } from "../utils/printDocument";

const SUSPICIOUS_FAST_SECONDS = 90;
const CRITICAL_FAST_SECONDS = 45;

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

const validationProcessSteps = [
  { key: "received", label: "Recibidas", helper: "Capturadas", className: "is-received" },
  { key: "validating", label: "Validando", helper: "En revision", className: "is-validating" },
  { key: "validated", label: "Validadas", helper: "Aprobadas", className: "is-validated" }
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
    housing_units: point.housing_units ?? "1",
    marker_color: point.marker_color || "#1576d1",
    is_terminal_point: Boolean(point.is_terminal_point),
    validation_status: point.validation_status || "pending",
    validation_notes: point.validation_notes || "",
    correction_notes: point.correction_notes || ""
  };
};

const formatDuration = (seconds = 0) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "--";
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  if (minutes <= 0) return `${remainingSeconds}s`;
  return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
};

const getPointTechnicianName = (point = {}) =>
  point.created_by_name || point.created_by_username || point.created_by || "Tecnico sin nombre";

const getCaptureTimeComment = (seconds = null) => {
  if (!Number.isFinite(seconds)) return "Primer punto del tecnico; no hay punto anterior para comparar.";
  if (seconds < CRITICAL_FAST_SECONDS) return "Sospechoso: tiempo extremadamente corto para un censo; conviene revisar evidencia y secuencia.";
  if (seconds < SUSPICIOUS_FAST_SECONDS) return "Atencion: tiempo muy rapido para censo; validar que no sea captura repetida o incompleta.";
  return "Tiempo dentro de un rango razonable para captura de censo.";
};

const buildTechnicianTimingReport = (points = []) => {
  const technicianMap = new Map();
  points.forEach((point) => {
    const timestamp = Date.parse(point.created_at || "");
    if (!Number.isFinite(timestamp)) return;
    const technician = getPointTechnicianName(point);
    const current = technicianMap.get(technician) ?? [];
    current.push({ ...point, timestamp });
    technicianMap.set(technician, current);
  });

  const technicians = Array.from(technicianMap.entries())
    .map(([technician, technicianPoints]) => {
      const orderedPoints = technicianPoints.sort((left, right) => left.timestamp - right.timestamp);
      const rows = orderedPoints.map((point, index) => {
        const previous = orderedPoints[index - 1] ?? null;
        const secondsFromPrevious = previous ? (point.timestamp - previous.timestamp) / 1000 : null;
        const isCritical = Number.isFinite(secondsFromPrevious) && secondsFromPrevious < CRITICAL_FAST_SECONDS;
        const isSuspicious = Number.isFinite(secondsFromPrevious) && secondsFromPrevious < SUSPICIOUS_FAST_SECONDS;
        return {
          point,
          index: index + 1,
          secondsFromPrevious,
          isCritical,
          isSuspicious,
          comment: getCaptureTimeComment(secondsFromPrevious)
        };
      });
      const intervalRows = rows.filter((row) => Number.isFinite(row.secondsFromPrevious));
      const suspiciousRows = rows.filter((row) => row.isSuspicious);
      const totalSeconds = intervalRows.reduce((sum, row) => sum + row.secondsFromPrevious, 0);

      return {
        technician,
        rows,
        totalPoints: rows.length,
        intervals: intervalRows.length,
        suspiciousRows,
        averageSeconds: intervalRows.length ? totalSeconds / intervalRows.length : null,
        minimumSeconds: intervalRows.length ? Math.min(...intervalRows.map((row) => row.secondsFromPrevious)) : null
      };
    })
    .sort((left, right) => right.totalPoints - left.totalPoints || left.technician.localeCompare(right.technician));

  const totalSuspicious = technicians.reduce((sum, technician) => sum + technician.suspiciousRows.length, 0);
  return {
    technicians,
    totalPoints: points.length,
    totalSuspicious
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
  const processCounts = useMemo(
    () => ({
      received: counts.total,
      validating: counts.pending + counts.needs_correction + counts.corrected,
      validated: counts.approved
    }),
    [counts.approved, counts.corrected, counts.needs_correction, counts.pending, counts.total]
  );
  const mapDraft = useMemo(
    () => ({
      point_type: draft.point_type,
      latitude: draft.latitude,
      longitude: draft.longitude,
      accuracy_meters: draft.accuracy_meters,
      marker_color: draft.marker_color
    }),
    [draft.accuracy_meters, draft.latitude, draft.longitude, draft.marker_color, draft.point_type]
  );
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

  const handleDraftFromMap = useCallback((updater) => {
    setMapStatus("Ubicacion ajustada");
    setDraft(updater);
  }, []);

  const handleMapSelectPoint = useCallback(
    (pointId) => {
      setSelectedPointId(pointId);
      onSelectPoint?.(pointId);
    },
    [onSelectPoint, setSelectedPointId]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedPoint) return;
    await onSaveValidation(selectedPoint.id, draft);
  };

  const handleDecisionSave = async (status) => {
    if (!selectedPoint || savingPointId === selectedPoint.id) return;
    const nextDraft = {
      ...draft,
      validation_status: status
    };
    setDraft(nextDraft);
    await onSaveValidation(selectedPoint.id, nextDraft);
  };

  const handlePrintTimingReport = async () => {
    const report = buildTechnicianTimingReport(mapPoints);
    const generatedAt = formatDateTime(new Date().toISOString());
    const summaryMarkup = report.technicians
      .map(
        (technician) => `
          <div class="field-validation-time-summary-card ${technician.suspiciousRows.length ? "is-warning" : ""}">
            <strong>${escapeHtml(technician.technician)}</strong>
            <span>${technician.totalPoints} puntos</span>
            <span>Promedio: ${escapeHtml(formatDuration(technician.averageSeconds))}</span>
            <span>Minimo: ${escapeHtml(formatDuration(technician.minimumSeconds))}</span>
            <b>${technician.suspiciousRows.length} sospechosos</b>
          </div>
        `
      )
      .join("");
    const technicianSections = report.technicians
      .map((technician) => {
        const rowsMarkup = technician.rows
          .map(
            (row) => `
              <tr class="${row.isCritical ? "is-critical" : row.isSuspicious ? "is-suspicious" : ""}">
                <td>${row.index}</td>
                <td>${escapeHtml(formatDateTime(row.point.created_at))}</td>
                <td>${escapeHtml(getMapPointTypeLabel(row.point.point_type))}</td>
                <td>${escapeHtml(row.point.reference_note || row.point.description || "--")}</td>
                <td>${escapeHtml(formatDuration(row.secondsFromPrevious))}</td>
                <td>${escapeHtml(row.comment)}</td>
              </tr>
            `
          )
          .join("");

        return `
          <section class="field-validation-time-section">
            <div class="field-report-zone-head">
              <div>
                <span class="field-report-zone-kicker">Tecnico</span>
                <h3>${escapeHtml(technician.technician)}</h3>
              </div>
              <div class="field-report-zone-meta">
                <span>${technician.totalPoints} puntos</span>
                <span>${technician.suspiciousRows.length} sospechosos</span>
              </div>
            </div>
            <table class="field-report-table field-validation-time-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Hora</th>
                  <th>Tipo</th>
                  <th>Referencia</th>
                  <th>Tiempo</th>
                  <th>Comentario</th>
                </tr>
              </thead>
              <tbody>${rowsMarkup}</tbody>
            </table>
          </section>
        `;
      })
      .join("");

    await printDocument(
      "Reporte de tiempos de captura - Validacion de campo",
      `
        <div class="field-report-shell field-validation-time-report">
          <header class="field-report-header">
            <div>
              <p class="field-report-kicker">Validacion de campo</p>
              <h1>Reporte de tiempos de captura</h1>
              <p>Evalua cuanto tarda cada tecnico entre un punto y el siguiente. Para censo, tiempos menores a ${SUSPICIOUS_FAST_SECONDS} segundos se marcan como sospechosos.</p>
            </div>
            <div class="field-report-meta">
              <span>Generado: ${escapeHtml(generatedAt)}</span>
              <span>${escapeHtml(activeDateLabel)}</span>
              <span>Puntos evaluados: ${report.totalPoints}</span>
              <span>Sospechosos: ${report.totalSuspicious}</span>
            </div>
          </header>
          <section class="field-validation-time-summary">
            ${summaryMarkup || '<p class="field-report-empty">No hay puntos con fecha valida para evaluar tiempos.</p>'}
          </section>
          ${technicianSections || '<p class="field-report-empty">No hay puntos registrados para generar el reporte.</p>'}
        </div>
      `,
      {
        pageSize: "Letter portrait",
        pageMargin: "9mm",
        bodyClassName: "field-report-body field-validation-time-report-body",
        showPageFooter: true
      }
    );
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
        <div className="field-validation-hero-actions">
          <button type="button" className="button-secondary" onClick={handlePrintTimingReport} disabled={!mapPoints.length}>
            <Icon name="records" />
            Reporte tiempos
          </button>
        </div>
      </section>

      <section className="field-validation-command">
        <div className="field-validation-process" aria-label="Proceso de validacion">
          {validationProcessSteps.map((step, index) => (
            <button
              key={step.key}
              type="button"
              className={`${step.className} ${
                step.key === "received" && statusFilter === "all"
                  ? "is-active"
                  : step.key === "validating" && ["pending", "needs_correction", "corrected"].includes(statusFilter)
                    ? "is-active"
                    : step.key === "validated" && statusFilter === "approved"
                      ? "is-active"
                      : ""
              }`}
              onClick={() => {
                if (step.key === "received") setStatusFilter("all");
                if (step.key === "validating") setStatusFilter("pending");
                if (step.key === "validated") setStatusFilter("approved");
              }}
            >
              <span>{index + 1}</span>
              <strong>{step.label}</strong>
              <small>{step.helper}</small>
              <b>{processCounts[step.key]}</b>
            </button>
          ))}
        </div>
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
            mapDraft={mapDraft}
            mapPoints={filteredPoints}
            onDraftChange={handleDraftFromMap}
            onSelectPoint={handleMapSelectPoint}
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

              <div className="field-validation-review-strip">
                <div className="field-validation-review-steps">
                  <div>
                    <span>1</span>
                    <strong>Confirma el punto</strong>
                    <small>Usa el mapa si no coincide.</small>
                  </div>
                  <div>
                    <span>2</span>
                    <strong>Elige la decision</strong>
                    <small>Se guarda al tocar.</small>
                  </div>
                  <div>
                    <span>3</span>
                    <strong>Nota opcional</strong>
                    <small>Solo si ayuda al seguimiento.</small>
                  </div>
                </div>

                <div className="field-validation-decision" role="group" aria-label="Decision de validacion">
                  <button
                    type="button"
                    className={draft.validation_status === "pending" ? "is-active is-pending" : "is-pending"}
                    onClick={() => handleDecisionSave("pending")}
                    disabled={savingPointId === selectedPoint.id}
                  >
                    {savingPointId === selectedPoint.id && draft.validation_status === "pending" ? "Guardando..." : "Pendiente"}
                  </button>
                  <button
                    type="button"
                    className={draft.validation_status === "needs_correction" ? "is-active is-warning" : "is-warning"}
                    onClick={() => handleDecisionSave("needs_correction")}
                    disabled={savingPointId === selectedPoint.id}
                  >
                    {savingPointId === selectedPoint.id && draft.validation_status === "needs_correction" ? "Guardando..." : "Corregir"}
                  </button>
                  <button
                    type="button"
                    className={draft.validation_status === "approved" ? "is-active is-approved" : "is-approved"}
                    onClick={() => handleDecisionSave("approved")}
                    disabled={savingPointId === selectedPoint.id}
                  >
                    {savingPointId === selectedPoint.id && draft.validation_status === "approved" ? "Guardando..." : "Aprobar"}
                  </button>
                </div>

                <label className="field-validation-note-field">
                  <span>{draft.validation_status === "needs_correction" ? "Nota para correccion" : "Nota de validacion"}</span>
                  <textarea
                    name={draft.validation_status === "needs_correction" ? "correction_notes" : "validation_notes"}
                    value={draft.validation_status === "needs_correction" ? draft.correction_notes : draft.validation_notes}
                    onChange={handleDraftChange}
                    rows="3"
                    placeholder={
                      draft.validation_status === "needs_correction"
                        ? "Explica que debe corregir el tecnico."
                        : "Agrega una observacion breve para esta revision."
                    }
                  />
                </label>
              </div>

              <details className="field-validation-advanced">
                <summary>Ajustes avanzados del punto</summary>
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
                  <span>Viviendas</span>
                  <input name="housing_units" type="number" min="1" step="1" value={draft.housing_units} onChange={handleDraftChange} inputMode="numeric" />
                </label>
              </details>

              <div className="field-validation-actions">
                <button type="button" className="button-secondary field-validation-icon-action" onClick={() => window.open(buildExternalMapUrl(selectedPoint.latitude, selectedPoint.longitude), "_blank", "noopener,noreferrer")}>
                  <Icon name="map" />
                  Maps
                </button>
                <button type="button" className="button-secondary field-validation-icon-action" onClick={(event) => onCopyCoordinates(selectedPoint, event)}>
                  <Icon name="copy" />
                  Copiar
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
