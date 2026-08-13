import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "./Icon";
import { MAP_POINT_TYPES } from "../constants/formsAndUi";
import { formatCurrency } from "../utils/formatting";
import { formatDateTime, formatMapDiaryLabel } from "../utils/datesAndBusiness";
import { buildExternalMapUrl, formatCoordinate, getMapPointTypeLabel } from "../utils/mapField";
import { escapeHtml } from "../utils/html";
import { printDocument } from "../utils/printDocument";
import { buildFieldZoneGroups, getFieldPointClave, getFieldPointDate, getFieldPointZone, mergeFieldBarrioCatalog, summarizeFieldPoints } from "./fieldControlUtils";

const FieldMap = lazy(() => import("./FieldMap"));
const normalizeSearchText = (value = "") => String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const buildDraftFromPoint = (point = {}) => ({
  point_type: point.point_type || "caja_registro", latitude: point.latitude ?? "", longitude: point.longitude ?? "",
  accuracy_meters: point.accuracy_meters ?? "", reference: point.reference_note || "", description: point.description || "",
  housing_units: point.housing_units ?? "1", marker_color: point.marker_color || "#1465d9",
  is_terminal_point: Boolean(point.is_terminal_point), validation_status: point.validation_status || "pending",
  validation_notes: point.validation_notes || "", correction_notes: point.correction_notes || ""
});

const FieldValidationWorkspace = ({ apiFetch, apiUrl, barrioCodes = [], isActive }) => {
  const [historyPoints, setHistoryPoints] = useState([]);
  const [planosBarrios, setPlanosBarrios] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [query, setQuery] = useState("");
  const [selectedZones, setSelectedZones] = useState(() => new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("zones");
  const [draft, setDraft] = useState({});
  const [mapStatus, setMapStatus] = useState("Revisión");
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedPointId, setSelectedPointId] = useState(null);
  const [mapFocusRequest, setMapFocusRequest] = useState(null);
  const [savingPointId, setSavingPointId] = useState(null);
  const [pointLimit, setPointLimit] = useState(30);

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
  const dates = useMemo(() => Array.from(new Set(historyPoints.map(getFieldPointDate).filter(Boolean))).sort((a, b) => b.localeCompare(a)), [historyPoints]);
  const barrios = useMemo(() => mergeFieldBarrioCatalog(barrioCodes, planosBarrios), [barrioCodes, planosBarrios]);
  const pointsByDate = useMemo(() => historyPoints.filter((point) => !dateFilter || getFieldPointDate(point) === dateFilter), [dateFilter, historyPoints]);
  const zoneGroups = useMemo(() => buildFieldZoneGroups(pointsByDate, barrios), [barrios, pointsByDate]);

  useEffect(() => {
    setSelectedZones(new Set(zoneGroups.map((group) => group.zone)));
    setSelectedPointId(null); setAnalysis(null); setPointLimit(30);
  }, [dateFilter, zoneGroups]);

  const analysisNamesByKey = useMemo(() => {
    const names = new Map();
    (analysis?.results || []).forEach((result) => names.set(result.key, (result.matches || []).map((match) => [match.abonado, match.inquilino || match.nombre].filter(Boolean).join(" ")).join(" ")));
    return names;
  }, [analysis]);
  const selectedPoints = useMemo(() => {
    const search = normalizeSearchText(query);
    return pointsByDate.filter((point) => {
      const zone = getFieldPointZone(point, barrios);
      if (!selectedZones.has(zone) || (typeFilter && point.point_type !== typeFilter)) return false;
      if (!search) return true;
      const clave = getFieldPointClave(point);
      return normalizeSearchText([zone, clave, getMapPointTypeLabel(point.point_type), point.reference_note, point.description, point.created_by_name, point.created_by_username, analysisNamesByKey.get(clave.split("-").slice(0, 3).join("-"))].filter(Boolean).join(" ")).includes(search);
    });
  }, [analysisNamesByKey, barrios, pointsByDate, query, selectedZones, typeFilter]);
  const summary = useMemo(() => summarizeFieldPoints(selectedPoints, barrios), [barrios, selectedPoints]);
  const selectedPoint = useMemo(() => selectedPoints.find((point) => point.id === selectedPointId) || null, [selectedPointId, selectedPoints]);
  const mapDraft = useMemo(() => ({ point_type: draft.point_type, latitude: draft.latitude, longitude: draft.longitude, accuracy_meters: draft.accuracy_meters, marker_color: draft.marker_color }), [draft]);

  useEffect(() => { setAnalysis(null); }, [selectedZones, typeFilter]);
  useEffect(() => { if (selectedPoint) setDraft(buildDraftFromPoint(selectedPoint)); }, [selectedPoint]);
  const toggleZone = (zone) => setSelectedZones((current) => { const next = new Set(current); next.has(zone) ? next.delete(zone) : next.add(zone); return next; });
  const selectPoint = useCallback((pointId) => {
    const point = selectedPoints.find((item) => item.id === pointId);
    setSelectedPointId(pointId);
    if (point) setMapFocusRequest({ latitude: point.latitude, longitude: point.longitude, zoom: 17, requestId: Date.now() });
  }, [selectedPoints]);
  const editPoint = useCallback((pointId) => { selectPoint(pointId); setDetailOpen(true); }, [selectPoint]);
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

  const analyzeSelection = async () => {
    const keys = Array.from(new Set(selectedPoints.map(getFieldPointClave).filter(Boolean).map((key) => key.split("-").slice(0, 3).join("-"))));
    if (!keys.length) { setAnalysis({ results: [], accounts: [], totalDebt: 0 }); setActiveTab("portfolio"); return; }
    setAnalyzing(true); setHistoryError("");
    try {
      const results = await Promise.all(keys.map(async (key) => { const response = await apiFetch(`/claves/search?clave=${encodeURIComponent(key)}&field=clave`); const data = await response.json(); return { key, matches: response.ok && Array.isArray(data.matches) ? data.matches : [] }; }));
      const accounts = Array.from(results.reduce((rows, result) => { result.matches.forEach((match) => { const account = String(match.abonado || `${result.key}:${match.inquilino || match.nombre || ""}`); if (!rows.has(account)) rows.set(account, { clave: String(match.clave_base || match.clave_catastral || match.clave_aguas_formato || result.key), abonado: String(match.abonado || "--"), nombre: String(match.inquilino || match.nombre || "--"), total: Number(match.total || 0) }); }); return rows; }, new Map()).values()).sort((a, b) => b.total - a.total);
      setAnalysis({ results, accounts, totalDebt: accounts.reduce((total, row) => total + row.total, 0) }); setActiveTab("portfolio");
    } catch (error) { setHistoryError(error.message || "No fue posible consultar las claves seleccionadas."); }
    finally { setAnalyzing(false); }
  };

  const printSelection = async () => {
    const groups = buildFieldZoneGroups(selectedPoints, barrios);
    const zoneMarkup = groups.map((group) => `<section class="field-report-zone-section"><div class="field-report-zone-head"><div><span class="field-report-zone-kicker">Barrio / zona</span><h3>${escapeHtml(group.zone)}</h3></div><strong>${group.total} puntos</strong></div><table class="field-report-table"><thead><tr><th>#</th><th>Fecha</th><th>Tipo</th><th>Clave</th><th>Referencia</th><th>Técnico</th></tr></thead><tbody>${group.items.map((point, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(getFieldPointDate(point))}</td><td>${escapeHtml(getMapPointTypeLabel(point.point_type))}</td><td>${escapeHtml(getFieldPointClave(point) || "--")}</td><td>${escapeHtml(point.reference_note || point.description || "--")}</td><td>${escapeHtml(point.created_by_name || point.created_by_username || "--")}</td></tr>`).join("")}</tbody></table></section>`).join("");
    const accountMarkup = analysis?.accounts?.length ? `<section class="field-report-zone-section"><div class="field-report-zone-head"><div><span class="field-report-zone-kicker">Cartera consultada</span><h3>Abonados de la selección</h3></div><strong>${escapeHtml(formatCurrency(analysis.totalDebt))}</strong></div><table class="field-report-table"><thead><tr><th>Clave</th><th>Abonado</th><th>Nombre</th><th>Deuda</th></tr></thead><tbody>${analysis.accounts.map((row) => `<tr><td>${escapeHtml(row.clave)}</td><td>${escapeHtml(row.abonado)}</td><td>${escapeHtml(row.nombre)}</td><td>${escapeHtml(formatCurrency(row.total))}</td></tr>`).join("")}</tbody></table></section>` : "";
    await printDocument("Control territorial GPS", `<div class="field-report-shell"><header class="field-report-header"><div><p class="field-report-kicker">Aguas de Choluteca</p><h1>Control territorial GPS</h1><p>Histórico seleccionado para análisis, seguimiento y trabajo de campo.</p></div><div class="field-report-meta"><span>${dateFilter ? formatMapDiaryLabel(dateFilter) : "Todas las jornadas"}</span><span>${summary.points} puntos</span><span>${summary.zones} barrios</span><span>${summary.keys} claves</span></div></header>${zoneMarkup || '<p class="field-report-empty">No hay puntos seleccionados.</p>'}${accountMarkup}</div>`, { pageSize: "Letter landscape", pageMargin: "8mm", showPageFooter: true });
  };

  return <main className="field-control-layout no-print">
    <section className="field-control-commandbar">
      <div className="field-control-title"><span className="field-control-title-icon"><Icon name="map" /></span><div><p>Control territorial GPS</p><span>Histórico, zonas y cartera en un solo mapa</span></div></div>
      <label className="field-control-date"><span>Jornada</span><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}><option value="">Todo el histórico</option>{dates.map((date) => <option key={date} value={date}>{formatMapDiaryLabel(date)}</option>)}</select></label>
      <label className="field-control-search"><span className="sr-only">Buscar</span><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Clave, nombre o técnico" /><button type="button" onClick={() => setQuery("")} aria-label="Limpiar búsqueda">×</button></label>
      <button type="button" className="button-secondary field-control-compact-button" onClick={() => setFiltersOpen(true)}><Icon name="more" />Filtros{typeFilter ? <b>1</b> : null}</button>
      <button type="button" className="button-secondary field-control-compact-button" onClick={analyzeSelection} disabled={analyzing || !selectedPoints.length}><Icon name="search" />{analyzing ? "Consultando..." : "Analizar cartera"}</button>
      <button type="button" className="field-control-report-button" onClick={printSelection} disabled={!selectedPoints.length}><Icon name="records" />Generar reporte</button>
      <button type="button" className="field-control-refresh" onClick={loadHistory} disabled={loadingHistory} aria-label="Actualizar histórico"><Icon name="refresh" /></button>
    </section>

    {historyError ? <div className="field-control-error">{historyError}<button type="button" onClick={loadHistory}>Reintentar</button></div> : null}
    <section className="field-control-metrics" aria-label="Resumen de la selección">
      {[["Puntos", summary.points], ["Barrios", summary.zones], ["Claves", summary.keys], ["Técnicos", summary.technicians]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
      {analysis ? <><article className="is-analysis"><span>Abonados</span><strong>{analysis.accounts.length}</strong></article><article className="is-analysis"><span>Deuda asociada</span><strong>{formatCurrency(analysis.totalDebt)}</strong></article></> : null}
    </section>

    <section className="field-control-map-shell">
      <header className="field-control-map-heading"><div><p className="sheet-kicker">Mapa consolidado</p><h2>{dateFilter ? formatMapDiaryLabel(dateFilter) : "Todas las jornadas"}</h2></div><div><span className="panel-pill">{selectedPoints.length} visibles</span><small>{mapStatus}</small></div></header>
      <Suspense fallback={<div className="map-canvas field-map-loading"><span />Cargando mapa...</div>}><FieldMap apiUrl={apiUrl} isActive={isActive} mapDraft={mapDraft} mapFocusRequest={mapFocusRequest} mapPoints={selectedPoints} onDraftChange={setDraft} onEditPoint={editPoint} onSelectPoint={selectPoint} onStatusChange={setMapStatus} selectedMapPointId={selectedPointId} /></Suspense>

      <aside className="field-control-floating-panel">
        <div className="field-control-tabs" role="tablist">
          {[['zones', 'Zonas', selectedZones.size], ['points', 'Puntos', selectedPoints.length], ['portfolio', 'Cartera', analysis?.accounts?.length]].map(([tab, label, count]) => <button type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? "is-active" : ""} key={tab} onClick={() => setActiveTab(tab)} disabled={tab === "portfolio" && !analysis}>{label}{count !== undefined ? <span>{count}</span> : null}</button>)}
        </div>

        {activeTab === "zones" ? <div className="field-control-panel-body">
          <div className="field-control-panel-summary"><div><strong>{selectedZones.size} de {zoneGroups.length}</strong><span>zonas visibles</span></div><button type="button" onClick={() => setFiltersOpen(true)}>Selección avanzada</button></div>
          <div className="field-control-quick-actions"><button type="button" onClick={() => setSelectedZones(new Set(zoneGroups.map((group) => group.zone)))}>Todos</button><button type="button" onClick={() => setSelectedZones(new Set())}>Limpiar</button></div>
          <div className="field-control-zone-list">{zoneGroups.length ? zoneGroups.map((group) => <label key={group.zone} className={selectedZones.has(group.zone) ? "is-selected" : ""}><input type="checkbox" checked={selectedZones.has(group.zone)} onChange={() => toggleZone(group.zone)} /><span><strong>{group.zone}</strong><small>{group.total} {group.total === 1 ? "punto" : "puntos"}</small></span><b>{selectedZones.has(group.zone) ? "✓" : "+"}</b></label>) : <div className="field-control-empty"><Icon name="map" /><strong>Sin zonas</strong><span>No hay puntos en esta jornada.</span></div>}</div>
        </div> : null}

        {activeTab === "points" ? <div className="field-control-panel-body">
          <div className="field-control-panel-summary"><div><strong>{selectedPoints.length}</strong><span>puntos encontrados</span></div>{query ? <button type="button" onClick={() => setQuery("")}>Limpiar búsqueda</button> : null}</div>
          <div className="field-control-point-list">{selectedPoints.slice(0, pointLimit).map((point) => <article key={point.id} className={selectedPointId === point.id ? "is-selected" : ""}><button type="button" className="field-control-point-main" onClick={() => selectPoint(point.id)}><span><strong>{getFieldPointClave(point) || getMapPointTypeLabel(point.point_type)}</strong><small>{getFieldPointZone(point, barrios)}</small><small>{formatDateTime(point.created_at)} · {point.created_by_name || point.created_by_username || "Sin técnico"}</small></span></button><button type="button" className="field-control-point-edit" onClick={() => editPoint(point.id)} aria-label="Editar punto"><Icon name="records" /></button></article>)}</div>
          {pointLimit < selectedPoints.length ? <button type="button" className="field-control-more" onClick={() => setPointLimit((current) => current + 30)}>Ver 30 puntos más</button> : null}
        </div> : null}

        {activeTab === "portfolio" && analysis ? <div className="field-control-panel-body">
          <div className="field-control-portfolio-summary"><article><span>Abonados</span><strong>{analysis.accounts.length}</strong></article><article><span>Deuda total</span><strong>{formatCurrency(analysis.totalDebt)}</strong></article></div>
          <div className="field-control-account-list">{analysis.accounts.length ? analysis.accounts.slice(0, 40).map((row) => <button type="button" key={`${row.abonado}-${row.clave}`} onClick={() => { setQuery(row.abonado !== "--" ? row.abonado : row.nombre); setActiveTab("points"); }}><span><strong>{row.nombre}</strong><small>{row.clave} · Abonado {row.abonado}</small></span><b>{formatCurrency(row.total)}</b></button>) : <div className="field-control-empty"><Icon name="search" /><strong>Sin abonados asociados</strong><span>Las claves seleccionadas no devolvieron cartera.</span></div>}</div>
        </div> : null}
      </aside>
    </section>

    {filtersOpen ? <div className="field-control-dialog-backdrop" onMouseDown={() => setFiltersOpen(false)}><section className="field-control-dialog" role="dialog" aria-modal="true" aria-label="Filtros y selección" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="sheet-kicker">Control del mapa</p><h2>Filtros y selección</h2><p>Define qué tipos y barrios participan en el mapa, el análisis y el reporte.</p></div><button type="button" className="reports-icon-button" onClick={() => setFiltersOpen(false)} aria-label="Cerrar">×</button></header><div className="field-control-filter-type"><label><span>Tipo de punto</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">Todos los tipos</option>{MAP_POINT_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div><div className="field-control-dialog-tools"><span>{selectedZones.size} de {zoneGroups.length} barrios incluidos</span><button type="button" className="report-link" onClick={() => setSelectedZones(new Set(zoneGroups.map((group) => group.zone)))}>Todos</button><button type="button" className="report-link" onClick={() => setSelectedZones(new Set())}>Ninguno</button></div><div className="field-control-zone-grid">{zoneGroups.map((group) => <label key={group.zone} className={!selectedZones.has(group.zone) ? "is-excluded" : ""}><input type="checkbox" checked={selectedZones.has(group.zone)} onChange={() => toggleZone(group.zone)} /><span><strong>{group.zone}</strong><small>{group.total} puntos</small></span></label>)}</div><footer><button type="button" onClick={() => setFiltersOpen(false)}>Aplicar filtros</button></footer></section></div> : null}

    {detailOpen && selectedPoint ? <div className="field-control-dialog-backdrop" onMouseDown={() => setDetailOpen(false)}><form className="field-control-dialog field-control-point-dialog" onSubmit={savePoint} onMouseDown={(event) => event.stopPropagation()}><header><div><p className="sheet-kicker">Punto #{selectedPoint.id}</p><h2>{getMapPointTypeLabel(selectedPoint.point_type)}</h2><p>{getFieldPointZone(selectedPoint, barrios)} · {formatCoordinate(selectedPoint.latitude)}, {formatCoordinate(selectedPoint.longitude)}</p></div><button type="button" className="reports-icon-button" onClick={() => setDetailOpen(false)} aria-label="Cerrar">×</button></header><div className="field-control-point-form"><label><span>Tipo</span><select name="point_type" value={draft.point_type} onChange={handleDraftChange}>{MAP_POINT_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label><span>Clave / referencia</span><input name="reference" value={draft.reference} onChange={handleDraftChange} /></label><label className="is-wide"><span>Descripción técnica</span><textarea name="description" rows="4" value={draft.description} onChange={handleDraftChange} /></label><label><span>Latitud</span><input name="latitude" value={draft.latitude} onChange={handleDraftChange} /></label><label><span>Longitud</span><input name="longitude" value={draft.longitude} onChange={handleDraftChange} /></label><label><span>Precisión (m)</span><input name="accuracy_meters" value={draft.accuracy_meters} onChange={handleDraftChange} /></label><label><span>Viviendas</span><input type="number" name="housing_units" min="1" value={draft.housing_units} onChange={handleDraftChange} /></label></div><footer><button type="button" className="button-secondary" onClick={() => window.open(buildExternalMapUrl(selectedPoint.latitude, selectedPoint.longitude), "_blank", "noopener,noreferrer")}>Abrir en Maps</button><button type="button" className="button-secondary" onClick={() => navigator.clipboard?.writeText(`${selectedPoint.latitude}, ${selectedPoint.longitude}`)}>Copiar coordenadas</button><button type="submit" disabled={savingPointId === selectedPoint.id}>{savingPointId === selectedPoint.id ? "Guardando..." : "Guardar cambios"}</button></footer></form></div> : null}
  </main>;
};

export default FieldValidationWorkspace;
