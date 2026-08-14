import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import { MAP_POINT_TYPES } from "../constants/formsAndUi";
import { formatCurrency } from "../utils/formatting";
import { formatMapDiaryLabel } from "../utils/datesAndBusiness";
import { buildExternalMapUrl, formatCoordinate, getMapPointTypeLabel } from "../utils/mapField";
import { escapeHtml } from "../utils/html";
import { printDocument } from "../utils/printDocument";
import { buildFieldZoneGroups, getFieldPointClave, getFieldPointDate, getFieldPointZone, mergeFieldBarrioCatalog, summarizeFieldPoints } from "./fieldControlUtils";
import FieldAnalyticsPanel from "../modules/campo/FieldAnalyticsPanel";
import { buildLegend, FIELD_MAP_MODES, resolveMarkerColor } from "../modules/campo/fieldMapModes";

const FieldMap = lazy(() => import("./FieldMap"));
const normalizeSearchText = (value = "") => String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const buildDraftFromPoint = (point = {}) => ({
  point_type: point.point_type || "caja_registro", latitude: point.latitude ?? "", longitude: point.longitude ?? "",
  accuracy_meters: point.accuracy_meters ?? "", reference: point.reference_note || "", description: point.description || "",
  housing_units: point.housing_units ?? "1", marker_color: point.marker_color || "#1465d9",
  is_terminal_point: Boolean(point.is_terminal_point), validation_status: point.validation_status || "pending",
  validation_notes: point.validation_notes || "", correction_notes: point.correction_notes || ""
});
const emptyAnalytics = () => ({
  territory: { points: 0, zones: 0, keys: 0, technicians: 0, withoutKey: 0, pendingValidation: 0 },
  portfolio: { accountsFound: 0, total: 0, average: 0, median: 0, ranges: [] },
  commercial: { businesses: 0, total: 0, withoutKey: 0, clandestine: 0, zones: [] },
  quality: { withoutKey: 0, duplicatedKeys: 0, accuracy: {}, buckets: [] },
  services: {}, technicians: [], zones: [], anomalies: [], duplicates: [],
  selection: { flags: {}, ranges: {} }, points: []
});

const FieldValidationWorkspace = ({ apiFetch, apiUrl, barrioCodes = [], isActive }) => {
  const [historyPoints, setHistoryPoints] = useState([]);
  const [planosBarrios, setPlanosBarrios] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [technicianFilter, setTechnicianFilter] = useState(() => new Set());
  const [validationFilter, setValidationFilter] = useState(() => new Set());
  const [query, setQuery] = useState("");
  const [selectedZones, setSelectedZones] = useState(() => new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("territory");
  const [mapMode, setMapMode] = useState("tipo");
  const [selectedMetric, setSelectedMetric] = useState("");
  const [draft, setDraft] = useState({});
  const [mapStatus, setMapStatus] = useState("Revisión");
  const [analytics, setAnalytics] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedPointId, setSelectedPointId] = useState(null);
  const [mapFocusRequest, setMapFocusRequest] = useState(null);
  const [savingPointId, setSavingPointId] = useState(null);
  const [pointLimit, setPointLimit] = useState(30);
  const analyticsAbortRef = useRef(null);

  const loadHistory = useCallback(async () => {
    if (!apiFetch) return;
    setLoadingHistory(true); setHistoryError("");
    try {
      const [response, planosResponse] = await Promise.all([apiFetch("/field-validation"), apiFetch("/planos/barrios")]);
      const [data, planosData] = await Promise.all([response.json(), planosResponse.json()]);
      if (!response.ok) throw new Error(data.message || "No fue posible cargar el histórico GPS.");
      setHistoryPoints(Array.isArray(data.points) ? data.points : Array.isArray(data) ? data : []);
      setPlanosBarrios(planosResponse.ok && Array.isArray(planosData.barrios) ? planosData.barrios : []);
    } catch (error) { setHistoryError(error.message || "No fue posible cargar el histórico GPS."); }
    finally { setLoadingHistory(false); }
  }, [apiFetch]);

  useEffect(() => { if (isActive) loadHistory(); }, [isActive, loadHistory]);
  useEffect(() => () => analyticsAbortRef.current?.abort(), []);
  const dates = useMemo(() => Array.from(new Set(historyPoints.map(getFieldPointDate).filter(Boolean))).sort((a, b) => b.localeCompare(a)), [historyPoints]);
  const barrios = useMemo(() => mergeFieldBarrioCatalog(barrioCodes, planosBarrios), [barrioCodes, planosBarrios]);
  const pointsByDate = useMemo(() => historyPoints.filter((point) => !dateFilter || getFieldPointDate(point) === dateFilter), [dateFilter, historyPoints]);
  const zoneGroups = useMemo(() => buildFieldZoneGroups(pointsByDate, barrios), [barrios, pointsByDate]);
  const technicians = useMemo(() => Array.from(pointsByDate.reduce((items, point) => {
    const id = Number(point.created_by);
    if (Number.isInteger(id) && id > 0) items.set(id, point.created_by_name || point.created_by_username || `Usuario ${id}`);
    return items;
  }, new Map()), ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "es")), [pointsByDate]);

  useEffect(() => {
    setSelectedZones(new Set(zoneGroups.map((group) => group.zone)));
    setTechnicianFilter(new Set()); setValidationFilter(new Set()); setSelectedPointId(null); setSelectedMetric(""); setPointLimit(30);
  }, [dateFilter, zoneGroups]);

  const baseSelectedPoints = useMemo(() => {
    const search = normalizeSearchText(query);
    return pointsByDate.filter((point) => {
      const zone = getFieldPointZone(point, barrios);
      if (!selectedZones.has(zone) || (typeFilter && point.point_type !== typeFilter)) return false;
      if (technicianFilter.size && !technicianFilter.has(Number(point.created_by))) return false;
      if (validationFilter.size && !validationFilter.has(point.validation_status || "pending")) return false;
      if (!search) return true;
      return normalizeSearchText([zone, getFieldPointClave(point), getMapPointTypeLabel(point.point_type), point.reference_note, point.description, point.created_by_name, point.created_by_username].filter(Boolean).join(" ")).includes(search);
    });
  }, [barrios, pointsByDate, query, selectedZones, technicianFilter, typeFilter, validationFilter]);

  const fetchAnalytics = useCallback(async () => {
    analyticsAbortRef.current?.abort();
    if (!selectedZones.size) { setAnalytics(emptyAnalytics()); setAnalyzing(false); return; }
    const controller = new AbortController();
    analyticsAbortRef.current = controller;
    setAnalyzing(true); setHistoryError("");
    try {
      const response = await apiFetch("/field-validation/analytics", {
        method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateFilter, zones: [...selectedZones], technicians: [...technicianFilter], pointTypes: typeFilter ? [typeFilter] : [], validationStatuses: [...validationFilter], search: query, includePoints: true })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No fue posible analizar la selección.");
      setAnalytics(data);
    } catch (error) {
      if (error.name !== "AbortError") setHistoryError(error.message || "No fue posible analizar la selección.");
    } finally {
      if (analyticsAbortRef.current === controller) { analyticsAbortRef.current = null; setAnalyzing(false); }
    }
  }, [apiFetch, dateFilter, query, selectedZones, technicianFilter, typeFilter, validationFilter]);

  useEffect(() => {
    if (!isActive || !historyPoints.length) return undefined;
    const timer = window.setTimeout(fetchAnalytics, 300);
    return () => window.clearTimeout(timer);
  }, [fetchAnalytics, historyPoints.length, isActive]);
  useEffect(() => { setSelectedMetric(""); setPointLimit(30); }, [dateFilter, query, selectedZones, technicianFilter, typeFilter, validationFilter]);

  const analyticsPointById = useMemo(() => new Map((analytics?.points || []).map((point) => [point.id, point])), [analytics]);
  const metricIds = useMemo(() => {
    if (!selectedMetric) return null;
    const [kind, id] = selectedMetric.split(":");
    return new Set((kind === "range" ? analytics?.selection?.ranges?.[id] : analytics?.selection?.flags?.[id]) || []);
  }, [analytics, selectedMetric]);
  const selectedPoints = useMemo(() => metricIds ? baseSelectedPoints.filter((point) => metricIds.has(point.id)) : baseSelectedPoints, [baseSelectedPoints, metricIds]);
  const summary = useMemo(() => summarizeFieldPoints(baseSelectedPoints, barrios), [barrios, baseSelectedPoints]);
  const selectedPoint = useMemo(() => historyPoints.find((point) => point.id === selectedPointId) || null, [historyPoints, selectedPointId]);
  const mapDraft = useMemo(() => ({ point_type: draft.point_type, latitude: draft.latitude, longitude: draft.longitude, accuracy_meters: draft.accuracy_meters, marker_color: draft.marker_color }), [draft]);
  const getMarkerColor = useCallback((point) => resolveMarkerColor(point, mapMode, analyticsPointById.get(point.id)), [analyticsPointById, mapMode]);
  const legend = useMemo(() => buildLegend(mapMode, mapMode === "jornada" ? { ...analytics, points: baseSelectedPoints.map((point) => ({ date: getFieldPointDate(point) })) } : analytics), [analytics, baseSelectedPoints, mapMode]);

  useEffect(() => { if (selectedPoint) setDraft(buildDraftFromPoint(selectedPoint)); }, [selectedPoint]);
  const toggleZone = (zone) => setSelectedZones((current) => { const next = new Set(current); next.has(zone) ? next.delete(zone) : next.add(zone); return next; });
  const toggleTechnician = (id) => setTechnicianFilter((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleValidation = (status) => setValidationFilter((current) => { const next = new Set(current); next.has(status) ? next.delete(status) : next.add(status); return next; });
  const selectPoint = useCallback((pointId) => {
    const point = historyPoints.find((item) => item.id === pointId);
    setSelectedPointId(pointId);
    if (point) setMapFocusRequest({ latitude: point.latitude, longitude: point.longitude, zoom: 17, requestId: Date.now() });
  }, [historyPoints]);
  const editPoint = useCallback((pointId) => { selectPoint(pointId); setDetailOpen(true); }, [selectPoint]);
  const applyMetricFilter = (kind, id) => setSelectedMetric((current) => current === `${kind}:${id}` ? "" : `${kind}:${id}`);
  const handleDraftChange = (event) => { const { name, value, type, checked } = event.target; setDraft((current) => ({ ...current, [name]: type === "checkbox" ? checked : value })); };
  const savePoint = async (event) => {
    event.preventDefault(); if (!selectedPoint) return; setSavingPointId(selectedPoint.id);
    try {
      const response = await apiFetch(`/field-validation/${selectedPoint.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.message || "No fue posible guardar el punto.");
      setHistoryPoints((current) => current.map((point) => point.id === saved.id ? saved : point)); setDetailOpen(false);
    } catch (error) { setHistoryError(error.message || "No fue posible guardar el punto."); }
    finally { setSavingPointId(null); }
  };

  const printSelection = async () => {
    const groups = buildFieldZoneGroups(selectedPoints, barrios);
    const zoneMarkup = groups.map((group) => `<section class="field-report-zone-section"><div class="field-report-zone-head"><div><span class="field-report-zone-kicker">Barrio / zona</span><h3>${escapeHtml(group.zone)}</h3></div><strong>${group.total} puntos</strong></div><table class="field-report-table"><thead><tr><th>#</th><th>Fecha</th><th>Tipo</th><th>Clave</th><th>Referencia</th><th>Técnico</th></tr></thead><tbody>${group.items.map((point, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(getFieldPointDate(point))}</td><td>${escapeHtml(getMapPointTypeLabel(point.point_type))}</td><td>${escapeHtml(getFieldPointClave(point) || "--")}</td><td>${escapeHtml(point.reference_note || point.description || "--")}</td><td>${escapeHtml(point.created_by_name || point.created_by_username || "--")}</td></tr>`).join("")}</tbody></table></section>`).join("");
    const portfolioMarkup = analytics ? `<section class="field-report-zone-section"><div class="field-report-zone-head"><div><span class="field-report-zone-kicker">Cartera consultada</span><h3>${analytics.portfolio.accountsFound} abonados asociados</h3></div><strong>${escapeHtml(formatCurrency(analytics.portfolio.total))}</strong></div></section>` : "";
    await printDocument("Control territorial GPS", `<div class="field-report-shell"><header class="field-report-header"><div><p class="field-report-kicker">Aguas de Choluteca</p><h1>Control territorial GPS</h1><p>Histórico seleccionado para análisis, seguimiento y trabajo de campo.</p></div><div class="field-report-meta"><span>${dateFilter ? formatMapDiaryLabel(dateFilter) : "Todas las jornadas"}</span><span>${selectedPoints.length} puntos</span><span>${summary.zones} barrios</span><span>${summary.keys} claves</span></div></header>${zoneMarkup || '<p class="field-report-empty">No hay puntos seleccionados.</p>'}${portfolioMarkup}</div>`, { pageSize: "Letter landscape", pageMargin: "8mm", showPageFooter: true });
  };

  const printPointCard = async () => {
    if (!selectedPoint) return;
    const field = (label, value, wide = false) => `<div class="print-field"${wide ? ' style="grid-column:1/-1"' : ""}><strong>${escapeHtml(label)}</strong><span style="white-space:pre-wrap">${escapeHtml(value || "--")}</span></div>`;
    await printDocument(
      `Ficha del punto #${selectedPoint.id}`,
      `<header class="print-header"><h1>Ficha de control territorial GPS</h1><p>Aguas de Choluteca, S.A. de C.V.</p><span class="print-key">Punto #${selectedPoint.id}</span></header><section class="print-section"><h3>Identificación</h3><div class="print-grid">${field("Tipo", getMapPointTypeLabel(draft.point_type))}${field("Barrio / zona", getFieldPointZone(selectedPoint, barrios))}${field("Clave / referencia", draft.reference, true)}${field("Descripción técnica", draft.description, true)}</div></section><section class="print-section"><h3>Ubicación y levantamiento</h3><div class="print-grid">${field("Latitud", draft.latitude)}${field("Longitud", draft.longitude)}${field("Precisión", draft.accuracy_meters ? `${draft.accuracy_meters} m` : "--")}${field("Viviendas", String(draft.housing_units || "--"))}${field("Técnico", selectedPoint.created_by_name || selectedPoint.created_by_username)}${field("Fecha", getFieldPointDate(selectedPoint))}${field("Estado de validación", draft.validation_status || "pending")}</div></section>`,
      { pageSize: "Letter portrait", pageMargin: "12mm", showPageFooter: true }
    );
  };

  const metricCards = analytics ? [
    ["Puntos", analytics.territory.points], ["Barrios", analytics.territory.zones], ["Claves", analytics.territory.keys], ["Técnicos", analytics.territory.technicians],
    ["Abonados", analytics.portfolio.accountsFound], ["Cartera total", formatCurrency(analytics.portfolio.total)], ["Deuda promedio", formatCurrency(analytics.portfolio.average)], ["Deuda mediana", formatCurrency(analytics.portfolio.median)],
    ["Negocios", analytics.commercial.businesses, "flag", "negocio"], ["Cartera comercial", formatCurrency(analytics.commercial.total)], ["Sin clave", analytics.quality.withoutKey, "flag", "sin_clave"],
    ["Claves repetidas", analytics.quality.duplicatedKeys, "flag", "clave_repetida"], ["GPS deficiente", analytics.selection.flags.gps_deficiente?.length || 0, "flag", "gps_deficiente"], ["Pendientes", analytics.territory.pendingValidation, "flag", "pendiente_validacion"]
  ] : [];

  return <main className="field-control-layout no-print">
    <section className="field-control-commandbar">
      <div className="field-control-title"><span className="field-control-title-icon"><Icon name="map" /></span><div><p>Control territorial GPS</p><span>Histórico, zonas y cartera en un solo mapa</span></div></div>
      <label className="field-control-date"><span>Jornada</span><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}><option value="">Todo el histórico</option>{dates.map((date) => <option key={date} value={date}>{formatMapDiaryLabel(date)}</option>)}</select></label>
      <label className="field-control-search"><span className="sr-only">Buscar</span><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Clave, barrio o técnico" /><button type="button" onClick={() => setQuery("")} aria-label="Limpiar búsqueda">×</button></label>
      <button type="button" className="button-secondary field-control-compact-button" onClick={() => setFiltersOpen(true)}><Icon name="more" />Filtros{typeFilter || technicianFilter.size || validationFilter.size ? <b>{Number(Boolean(typeFilter)) + technicianFilter.size + validationFilter.size}</b> : null}</button>
      <button type="button" className="button-secondary field-control-compact-button" onClick={fetchAnalytics} disabled={analyzing || !baseSelectedPoints.length}><Icon name="refresh" />{analyzing ? "Analizando..." : "Actualizar análisis"}</button>
      <button type="button" className="field-control-report-button" onClick={printSelection} disabled={!selectedPoints.length}><Icon name="records" />Generar reporte</button>
      <button type="button" className="field-control-refresh" onClick={loadHistory} disabled={loadingHistory} aria-label="Actualizar histórico"><Icon name="refresh" /></button>
    </section>

    {historyError ? <div className="field-control-error">{historyError}<button type="button" onClick={loadHistory}>Reintentar</button></div> : null}
    <section className={`field-control-metrics ${analyzing ? "is-loading" : ""}`} aria-label="Resumen de la selección">
      {analytics ? metricCards.map(([label, value, kind, id]) => <button type="button" key={label} className={`${kind ? "is-filterable" : ""} ${selectedMetric === `${kind}:${id}` ? "is-active" : ""}`} onClick={kind ? () => applyMetricFilter(kind, id) : undefined} disabled={!kind}><span>{label}</span><strong>{value}</strong></button>) : [["Puntos", summary.points], ["Barrios", summary.zones], ["Claves", summary.keys], ["Técnicos", summary.technicians]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
    </section>

    <section className="field-control-map-shell">
      <header className="field-control-map-heading"><div><p className="sheet-kicker">Mapa consolidado</p><h2>{dateFilter ? formatMapDiaryLabel(dateFilter) : "Todas las jornadas"}</h2></div><div><label className="field-map-mode"><span>Visualizar mapa por</span><select value={mapMode} onChange={(event) => setMapMode(event.target.value)}>{FIELD_MAP_MODES.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}</select></label><span className="panel-pill">{selectedPoints.length} visibles</span><small>{mapStatus}</small></div></header>
      <Suspense fallback={<div className="map-canvas field-map-loading"><span />Cargando mapa...</div>}><FieldMap apiUrl={apiUrl} getMarkerColor={getMarkerColor} isActive={isActive} mapDraft={mapDraft} mapFocusRequest={mapFocusRequest} mapPoints={selectedPoints} onDraftChange={setDraft} onEditPoint={editPoint} onSelectPoint={selectPoint} onStatusChange={setMapStatus} selectedMapPointId={selectedPointId} /></Suspense>
      <div className="field-map-legend"><strong>{FIELD_MAP_MODES.find((mode) => mode.id === mapMode)?.label}</strong>{legend.map((entry) => <span key={entry.label}><i style={{ background: entry.color }} />{entry.label}</span>)}</div>
      {selectedMetric ? <button type="button" className="field-map-clear-filter" onClick={() => setSelectedMetric("")}>Quitar filtro · {selectedPoints.length} puntos</button> : null}

      <FieldAnalyticsPanel activeTab={activeTab} analytics={analytics} barrios={barrios} onActiveTab={setActiveTab} onEditPoint={editPoint} onMetricFilter={applyMetricFilter} onSelectPoint={selectPoint} onTechnicianFilter={(id) => { if (id) setTechnicianFilter((current) => current.size === 1 && current.has(id) ? new Set() : new Set([id])); }} pointLimit={pointLimit} selectedMetric={selectedMetric} selectedPointId={selectedPointId} selectedPoints={selectedPoints} setPointLimit={setPointLimit} />
    </section>

    {filtersOpen ? <div className="field-control-dialog-backdrop" onMouseDown={() => setFiltersOpen(false)}><section className="field-control-dialog" role="dialog" aria-modal="true" aria-label="Filtros y selección" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="sheet-kicker">Control del mapa</p><h2>Filtros y selección</h2><p>Define qué tipos, técnicos, estados y barrios participan en el mapa, el análisis y el reporte.</p></div><button type="button" className="reports-icon-button" onClick={() => setFiltersOpen(false)} aria-label="Cerrar">×</button></header><div className="field-control-filter-type"><label><span>Tipo de punto</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">Todos los tipos</option>{MAP_POINT_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><fieldset><legend>Técnicos</legend><div className="field-filter-chip-list">{technicians.map((technician) => <label key={technician.id}><input type="checkbox" checked={technicianFilter.has(technician.id)} onChange={() => toggleTechnician(technician.id)} />{technician.name}</label>)}</div></fieldset><fieldset><legend>Estado de validación</legend><div className="field-filter-chip-list">{[["pending", "Pendiente"], ["approved", "Aprobado"], ["needs_correction", "Necesita corrección"], ["corrected", "Corregido"]].map(([status, label]) => <label key={status}><input type="checkbox" checked={validationFilter.has(status)} onChange={() => toggleValidation(status)} />{label}</label>)}</div></fieldset></div><div className="field-control-dialog-tools"><span>{selectedZones.size} de {zoneGroups.length} barrios incluidos</span><button type="button" className="report-link" onClick={() => setSelectedZones(new Set(zoneGroups.map((group) => group.zone)))}>Todos</button><button type="button" className="report-link" onClick={() => setSelectedZones(new Set())}>Ninguno</button></div><div className="field-control-zone-grid">{zoneGroups.map((group) => <label key={group.zone} className={!selectedZones.has(group.zone) ? "is-excluded" : ""}><input type="checkbox" checked={selectedZones.has(group.zone)} onChange={() => toggleZone(group.zone)} /><span><strong>{group.zone}</strong><small>{group.total} puntos</small></span></label>)}</div><footer><button type="button" onClick={() => setFiltersOpen(false)}>Aplicar filtros</button></footer></section></div> : null}

    {detailOpen && selectedPoint ? <div className="field-control-dialog-backdrop" onMouseDown={() => setDetailOpen(false)}><form className="field-control-dialog field-control-point-dialog" onSubmit={savePoint} onMouseDown={(event) => event.stopPropagation()}><header><div><p className="sheet-kicker">Punto #{selectedPoint.id}</p><h2>{getMapPointTypeLabel(selectedPoint.point_type)}</h2><p>{getFieldPointZone(selectedPoint, barrios)} · {formatCoordinate(selectedPoint.latitude)}, {formatCoordinate(selectedPoint.longitude)}</p></div><button type="button" className="reports-icon-button" onClick={() => setDetailOpen(false)} aria-label="Cerrar">×</button></header><div className="field-control-point-form"><label><span>Tipo</span><select name="point_type" value={draft.point_type} onChange={handleDraftChange}>{MAP_POINT_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label><span>Clave / referencia</span><input name="reference" value={draft.reference} onChange={handleDraftChange} /></label><label className="is-wide"><span>Descripción técnica</span><textarea name="description" rows="6" value={draft.description} onChange={handleDraftChange} /></label><label><span>Latitud</span><input name="latitude" value={draft.latitude} onChange={handleDraftChange} /></label><label><span>Longitud</span><input name="longitude" value={draft.longitude} onChange={handleDraftChange} /></label><label><span>Precisión (m)</span><input name="accuracy_meters" value={draft.accuracy_meters} onChange={handleDraftChange} /></label><label><span>Viviendas</span><input type="number" name="housing_units" min="1" value={draft.housing_units} onChange={handleDraftChange} /></label></div><footer><button type="button" className="button-secondary" onClick={printPointCard}><Icon name="records" />Imprimir ficha</button><button type="button" className="button-secondary" onClick={() => window.open(buildExternalMapUrl(selectedPoint.latitude, selectedPoint.longitude), "_blank", "noopener,noreferrer")}>Abrir en Maps</button><button type="button" className="button-secondary" onClick={() => navigator.clipboard?.writeText(`${selectedPoint.latitude}, ${selectedPoint.longitude}`)}>Copiar coordenadas</button><button type="submit" disabled={savingPointId === selectedPoint.id}>{savingPointId === selectedPoint.id ? "Guardando..." : "Guardar cambios"}</button></footer></form></div> : null}
  </main>;
};

export default FieldValidationWorkspace;
