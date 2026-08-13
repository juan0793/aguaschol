import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "./Icon";
import { MAP_POINT_TYPES } from "../constants/formsAndUi";
import { formatCurrency } from "../utils/formatting";
import { formatDateTime, formatMapDiaryLabel } from "../utils/datesAndBusiness";
import { buildExternalMapUrl, formatCoordinate, getMapPointTypeLabel } from "../utils/mapField";
import { escapeHtml } from "../utils/html";
import { printDocument } from "../utils/printDocument";
import { buildFieldZoneGroups, getFieldPointClave, getFieldPointDate, getFieldPointZone, summarizeFieldPoints } from "./fieldControlUtils";

const FieldMap = lazy(() => import("./FieldMap"));

const normalizeSearchText = (value = "") => String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const buildDraftFromPoint = (point = {}) => ({
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
});

const FieldValidationWorkspace = ({
  apiFetch,
  apiUrl,
  barrioCodes = [],
  isActive
}) => {
  const [historyPoints, setHistoryPoints] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [query, setQuery] = useState("");
  const [excludedZones, setExcludedZones] = useState([]);
  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [draft, setDraft] = useState({});
  const [mapStatus, setMapStatus] = useState("Revision");
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedPointId, setSelectedPointId] = useState(null);
  const [savingPointId, setSavingPointId] = useState(null);

  const loadHistory = useCallback(async () => {
    if (!apiFetch) return;
    setLoadingHistory(true);
    setHistoryError("");
    try {
      const response = await apiFetch("/field-validation");
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No fue posible cargar el historico GPS.");
      setHistoryPoints(Array.isArray(data.points) ? data.points : Array.isArray(data) ? data : []);
    } catch (error) {
      setHistoryError(error.message || "No fue posible cargar el historico GPS.");
    } finally {
      setLoadingHistory(false);
    }
  }, [apiFetch]);

  useEffect(() => { if (isActive) loadHistory(); }, [isActive, loadHistory]);

  const dates = useMemo(
    () => Array.from(new Set(historyPoints.map(getFieldPointDate).filter(Boolean))).sort((left, right) => right.localeCompare(left)),
    [historyPoints]
  );
  const pointsByDate = useMemo(
    () => historyPoints.filter((point) => !dateFilter || getFieldPointDate(point) === dateFilter),
    [dateFilter, historyPoints]
  );
  const zoneGroups = useMemo(() => buildFieldZoneGroups(pointsByDate, barrioCodes), [barrioCodes, pointsByDate]);
  const analysisNamesByKey = useMemo(() => {
    const names = new Map();
    (analysis?.results || []).forEach((result) => {
      names.set(result.key, (result.matches || []).map((match) => [match.abonado, match.inquilino || match.nombre].filter(Boolean).join(" ")).join(" "));
    });
    return names;
  }, [analysis]);
  const selectedPoints = useMemo(() => {
    const search = normalizeSearchText(query);
    return pointsByDate.filter((point) => {
      const zone = getFieldPointZone(point, barrioCodes);
      if (excludedZones.includes(zone)) return false;
      if (!search) return true;
      const clave = getFieldPointClave(point);
      return normalizeSearchText([
        zone, clave, getMapPointTypeLabel(point.point_type), point.reference_note, point.description,
        point.created_by_name, point.created_by_username, analysisNamesByKey.get(clave.split("-").slice(0, 3).join("-"))
      ].filter(Boolean).join(" ")).includes(search);
    });
  }, [analysisNamesByKey, barrioCodes, excludedZones, pointsByDate, query]);
  const summary = useMemo(() => summarizeFieldPoints(selectedPoints, barrioCodes), [barrioCodes, selectedPoints]);
  const selectedPoint = useMemo(
    () => selectedPoints.find((point) => point.id === selectedPointId) || selectedPoints[0] || null,
    [selectedPointId, selectedPoints]
  );
  const mapDraft = useMemo(() => ({
    point_type: draft.point_type,
    latitude: draft.latitude,
    longitude: draft.longitude,
    accuracy_meters: draft.accuracy_meters,
    marker_color: draft.marker_color
  }), [draft]);

  useEffect(() => { setExcludedZones([]); }, [dateFilter]);
  useEffect(() => { setAnalysis(null); }, [dateFilter, excludedZones]);
  useEffect(() => { if (selectedPoint) setDraft(buildDraftFromPoint(selectedPoint)); }, [selectedPoint]);

  const openPoint = (pointId) => {
    setSelectedPointId(pointId);
    setDetailOpen(true);
  };
  const handleDraftChange = (event) => {
    const { name, value, type, checked } = event.target;
    setDraft((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };
  const savePoint = async (event) => {
    event.preventDefault();
    if (!selectedPoint) return;
    setSavingPointId(selectedPoint.id);
    try {
      const response = await apiFetch(`/field-validation/${selectedPoint.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.message || "No fue posible guardar el punto.");
      setHistoryPoints((current) => current.map((point) => point.id === saved.id ? saved : point));
      setDetailOpen(false);
    } catch (error) {
      setHistoryError(error.message || "No fue posible guardar el punto.");
    } finally {
      setSavingPointId(null);
    }
  };

  const analyzeSelection = async () => {
    const keys = Array.from(new Set(selectedPoints.map(getFieldPointClave).filter(Boolean).map((key) => key.split("-").slice(0, 3).join("-"))));
    if (!keys.length) { setAnalysis({ results: [], accounts: [], totalDebt: 0 }); return; }
    setAnalyzing(true);
    try {
      const results = await Promise.all(keys.map(async (key) => {
        const response = await apiFetch(`/claves/search?clave=${encodeURIComponent(key)}&field=clave`);
        const data = await response.json();
        return { key, matches: response.ok && Array.isArray(data.matches) ? data.matches : [] };
      }));
      const accounts = Array.from(results.reduce((rows, result) => {
        result.matches.forEach((match) => {
          const account = String(match.abonado || `${result.key}:${match.inquilino || match.nombre || ""}`);
          if (!rows.has(account)) rows.set(account, {
            clave: String(match.clave_base || match.clave_catastral || match.clave_aguas_formato || result.key),
            abonado: String(match.abonado || "--"),
            nombre: String(match.inquilino || match.nombre || "--"),
            total: Number(match.total || 0)
          });
        });
        return rows;
      }, new Map()).values()).sort((left, right) => right.total - left.total);
      setAnalysis({ results, accounts, totalDebt: accounts.reduce((total, row) => total + row.total, 0) });
    } catch (error) {
      setHistoryError(error.message || "No fue posible consultar las claves seleccionadas.");
    } finally {
      setAnalyzing(false);
    }
  };

  const printSelection = async () => {
    const groups = buildFieldZoneGroups(selectedPoints, barrioCodes);
    const zoneMarkup = groups.map((group) => `
      <section class="field-report-zone-section">
        <div class="field-report-zone-head"><div><span class="field-report-zone-kicker">Barrio / zona</span><h3>${escapeHtml(group.zone)}</h3></div><strong>${group.total} puntos</strong></div>
        <table class="field-report-table"><thead><tr><th>#</th><th>Fecha</th><th>Tipo</th><th>Clave</th><th>Referencia</th><th>Tecnico</th></tr></thead><tbody>
          ${group.items.map((point, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(getFieldPointDate(point))}</td><td>${escapeHtml(getMapPointTypeLabel(point.point_type))}</td><td>${escapeHtml(getFieldPointClave(point) || "--")}</td><td>${escapeHtml(point.reference_note || point.description || "--")}</td><td>${escapeHtml(point.created_by_name || point.created_by_username || "--")}</td></tr>`).join("")}
        </tbody></table>
      </section>`).join("");
    const accountMarkup = analysis?.accounts?.length ? `<section class="field-report-zone-section"><div class="field-report-zone-head"><div><span class="field-report-zone-kicker">Cartera consultada</span><h3>Abonados de la seleccion</h3></div><strong>${escapeHtml(formatCurrency(analysis.totalDebt))}</strong></div><table class="field-report-table"><thead><tr><th>Clave</th><th>Abonado</th><th>Nombre</th><th>Deuda</th></tr></thead><tbody>${analysis.accounts.map((row) => `<tr><td>${escapeHtml(row.clave)}</td><td>${escapeHtml(row.abonado)}</td><td>${escapeHtml(row.nombre)}</td><td>${escapeHtml(formatCurrency(row.total))}</td></tr>`).join("")}</tbody></table></section>` : "";
    await printDocument("Control territorial GPS", `<div class="field-report-shell"><header class="field-report-header"><div><p class="field-report-kicker">Aguas de Choluteca</p><h1>Control territorial GPS</h1><p>Historico seleccionado para analisis, seguimiento y trabajo de campo.</p></div><div class="field-report-meta"><span>${dateFilter ? formatMapDiaryLabel(dateFilter) : "Todas las jornadas"}</span><span>${summary.points} puntos</span><span>${summary.zones} barrios</span><span>${summary.keys} claves</span></div></header>${zoneMarkup || '<p class="field-report-empty">No hay puntos seleccionados.</p>'}${accountMarkup}</div>`, { pageSize: "Letter landscape", pageMargin: "8mm", showPageFooter: true });
  };

  return <main className="field-control-layout no-print">
    <section className="field-control-hero">
      <div><p className="sheet-kicker">Control territorial</p><h2><Icon name="map" /> Histórico de puntos GPS</h2><p>Selecciona jornadas y barrios, cruza claves y genera información lista para trabajo de campo.</p></div>
      <div className="field-control-actions">
        <button type="button" className="button-secondary" onClick={loadHistory} disabled={loadingHistory}><Icon name="refresh" />{loadingHistory ? "Cargando..." : "Actualizar"}</button>
        <button type="button" className="button-secondary" onClick={() => setZoneDialogOpen(true)}><Icon name="map" />Seleccionar barrios</button>
        <button type="button" onClick={printSelection} disabled={!selectedPoints.length}><Icon name="records" />Generar reporte</button>
      </div>
    </section>

    <section className="field-control-toolbar">
      <label><span>Jornada</span><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}><option value="">Todo el histórico</option>{dates.map((date) => <option key={date} value={date}>{formatMapDiaryLabel(date)}</option>)}</select></label>
      <label className="field-control-search"><span>Buscar</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Clave, abonado, nombre, técnico o referencia" /></label>
      <button type="button" className="button-secondary" onClick={analyzeSelection} disabled={analyzing || !selectedPoints.length}><Icon name="search" />{analyzing ? "Consultando..." : "Analizar claves y cartera"}</button>
    </section>

    {historyError ? <div className="field-control-error">{historyError}</div> : null}
    <section className="field-control-metrics" aria-label="Resumen de la seleccion">
      {[['Puntos visibles', summary.points], ['Barrios incluidos', summary.zones], ['Claves encontradas', summary.keys], ['Técnicos', summary.technicians], ['Abonados', analysis?.accounts?.length ?? '--'], ['Deuda asociada', analysis ? formatCurrency(analysis.totalDebt) : '--']].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
    </section>

    <section className="field-control-grid">
      <article className="field-control-map-card">
        <header><div><p className="sheet-kicker">Mapa consolidado</p><h3>{dateFilter ? `Jornada ${formatMapDiaryLabel(dateFilter)}` : "Todas las jornadas"}</h3></div><span className="panel-pill">{selectedPoints.length} visibles</span></header>
        <Suspense fallback={<div className="map-canvas field-map-loading">Cargando mapa...</div>}><FieldMap apiUrl={apiUrl} isActive={isActive} mapDraft={mapDraft} mapPoints={selectedPoints} onDraftChange={setDraft} onSelectPoint={openPoint} onStatusChange={setMapStatus} selectedMapPointId={selectedPoint?.id} /></Suspense>
        <small className="field-control-map-status">{mapStatus}. Selecciona un punto para revisar o editar su información.</small>
      </article>

      <aside className="field-control-sidebar">
        <header><div><p className="sheet-kicker">Zonas seleccionadas</p><h3>{summary.zones} barrios</h3></div><button type="button" className="report-link" onClick={() => setZoneDialogOpen(true)}>Configurar</button></header>
        <div className="field-control-zone-summary">{zoneGroups.filter((group) => !excludedZones.includes(group.zone)).map((group) => <button type="button" key={group.zone} onClick={() => { setQuery(group.zone); }}><span>{group.zone}</span><strong>{group.total}</strong></button>)}</div>
        {analysis ? <><header><div><p className="sheet-kicker">Cartera consultada</p><h3>{analysis.accounts.length} abonados</h3></div><strong>{formatCurrency(analysis.totalDebt)}</strong></header><div className="field-control-account-list">{analysis.accounts.slice(0, 20).map((row) => <button type="button" key={`${row.abonado}-${row.clave}`} onClick={() => setQuery(row.abonado !== "--" ? row.abonado : row.nombre)}><span><strong>{row.nombre}</strong><small>{row.clave} · Abonado {row.abonado}</small></span><b>{formatCurrency(row.total)}</b></button>)}</div></> : null}
        <header><div><p className="sheet-kicker">Puntos</p><h3>{selectedPoints.length} resultados</h3></div></header>
        <div className="field-control-point-list">{selectedPoints.slice(0, 80).map((point) => <button type="button" key={point.id} onClick={() => openPoint(point.id)}><span><strong>{getFieldPointClave(point) || getMapPointTypeLabel(point.point_type)}</strong><small>{getFieldPointZone(point, barrioCodes)} · {formatDateTime(point.created_at)}</small></span><Icon name="arrowRight" /></button>)}</div>
      </aside>
    </section>

    {zoneDialogOpen ? <div className="field-control-dialog-backdrop" onMouseDown={() => setZoneDialogOpen(false)}><section className="field-control-dialog" role="dialog" aria-modal="true" aria-label="Seleccionar barrios" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="sheet-kicker">Cobertura del mapa</p><h2>Seleccionar barrios</h2><p>Desmarca las zonas que no quieres incluir en el análisis ni en el reporte.</p></div><button type="button" className="reports-icon-button" onClick={() => setZoneDialogOpen(false)} aria-label="Cerrar">×</button></header><div className="field-control-dialog-tools"><span>{zoneGroups.filter((group) => !excludedZones.includes(group.zone)).length} de {zoneGroups.length} incluidos</span><button type="button" className="report-link" onClick={() => setExcludedZones([])}>Todos</button><button type="button" className="report-link" onClick={() => setExcludedZones(zoneGroups.map((group) => group.zone))}>Ninguno</button></div><div className="field-control-zone-grid">{zoneGroups.map((group) => <label key={group.zone} className={excludedZones.includes(group.zone) ? "is-excluded" : ""}><input type="checkbox" checked={!excludedZones.includes(group.zone)} onChange={() => setExcludedZones((current) => current.includes(group.zone) ? current.filter((zone) => zone !== group.zone) : [...current, group.zone])} /><span><strong>{group.zone}</strong><small>{group.total} puntos</small></span></label>)}</div><footer><button type="button" onClick={() => setZoneDialogOpen(false)}>Aplicar selección</button></footer></section></div> : null}

    {detailOpen && selectedPoint ? <div className="field-control-dialog-backdrop" onMouseDown={() => setDetailOpen(false)}><form className="field-control-dialog field-control-point-dialog" onSubmit={savePoint} onMouseDown={(event) => event.stopPropagation()}><header><div><p className="sheet-kicker">Punto #{selectedPoint.id}</p><h2>{getMapPointTypeLabel(selectedPoint.point_type)}</h2><p>{getFieldPointZone(selectedPoint, barrioCodes)} · {formatCoordinate(selectedPoint.latitude)}, {formatCoordinate(selectedPoint.longitude)}</p></div><button type="button" className="reports-icon-button" onClick={() => setDetailOpen(false)} aria-label="Cerrar">×</button></header><div className="field-control-point-form"><label><span>Tipo</span><select name="point_type" value={draft.point_type} onChange={handleDraftChange}>{MAP_POINT_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label><span>Clave / referencia</span><input name="reference" value={draft.reference} onChange={handleDraftChange} /></label><label className="is-wide"><span>Descripción técnica</span><textarea name="description" rows="4" value={draft.description} onChange={handleDraftChange} /></label><label><span>Latitud</span><input name="latitude" value={draft.latitude} onChange={handleDraftChange} /></label><label><span>Longitud</span><input name="longitude" value={draft.longitude} onChange={handleDraftChange} /></label><label><span>Precisión (m)</span><input name="accuracy_meters" value={draft.accuracy_meters} onChange={handleDraftChange} /></label><label><span>Viviendas</span><input type="number" name="housing_units" min="1" value={draft.housing_units} onChange={handleDraftChange} /></label></div><footer><button type="button" className="button-secondary" onClick={() => window.open(buildExternalMapUrl(selectedPoint.latitude, selectedPoint.longitude), "_blank", "noopener,noreferrer")}>Abrir en Maps</button><button type="button" className="button-secondary" onClick={() => navigator.clipboard?.writeText(`${selectedPoint.latitude}, ${selectedPoint.longitude}`)}>Copiar coordenadas</button><button type="submit" disabled={savingPointId === selectedPoint.id}>{savingPointId === selectedPoint.id ? "Guardando..." : "Guardar cambios"}</button></footer></form></div> : null}
  </main>;
};

export default FieldValidationWorkspace;
