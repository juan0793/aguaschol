import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  Layers,
  LocateFixed,
  Map as MapIcon,
  Minus,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
  X
} from "lucide-react";
import { API_URL } from "../../config/api";
import { FieldMap, MapPrintDialog } from "../../app/lazyModules";
import { MapLoadBoundary } from "../../components/MapLoadBoundary";
import { MAP_POINT_LIST_STEP } from "../../constants/workspace";
import { formatCoordinate } from "../../utils/mapField";
import { formatDateTime, formatMapDiaryLabel } from "../../utils/datesAndBusiness";
import { getMapPointHousingUnits, getMapPointReferenceNote, getMapPointTechnicalDescription } from "../../utils/mapReport";
import { POINT_TYPE_ORDER, getPointTypeStyle } from "./pointTypes";
import { PointGlyph } from "./PointGlyph";
import { getOutboxSyncState, UNDO_WINDOW_MS, isOutboxId } from "./mapPointOutbox";
import { useGpsWatch } from "./useGpsWatch";
import OfflineZonesPanel from "./OfflineZonesPanel";
import "./puntos-gps.css";

const LAST_TYPE_KEY = "aguaschol.campo.ultimoTipo";
const ignoreDraftChange = () => {};
const readLastType = () => {
  try {
    const value = window.localStorage.getItem(LAST_TYPE_KEY);
    return POINT_TYPE_ORDER.includes(value) ? value : "caja_registro";
  } catch {
    return "caja_registro";
  }
};

const distanceMeters = (a, b) => {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

const pointSummary = (point) =>
  [getMapPointReferenceNote(point), getMapPointTechnicalDescription(point)].filter(Boolean).join(" · ") || "Sin detalles todavía";

const GPS_LABELS = {
  apagado: "GPS apagado",
  buscando: "Buscando GPS…",
  esperando: "Esperando GPS…",
  "sin-permiso": "Sin permiso de GPS",
  "no-disponible": "Sin GPS",
  https: "GPS requiere HTTPS"
};

function PointStatus({ point }) {
  if (!point?.pending) return <span className="pg-status is-sent">Enviado</span>;
  if (point.outboxStatus === "rechazado") return <span className="pg-status is-rejected">Rechazado</span>;
  return <span className="pg-status is-pending">Por enviar</span>;
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
    handleMapDraftChange,
    handleMarkPoint,
    handleOpenPointInMaps,
    handleSaveMapPoint,
    handleSelectMapPoint,
    hiddenMapPointCount,
    isAdmin,
    listedMapPoints,
    loadMapPoints,
    loadingMapPoints,
    mapDescriptionLookupStatus,
    mapDiaryGroups,
    mapDraft,
    mapFocusRequest,
    mapPointsForCanvas,
    openMapDiaryArchiveModal,
    outboxCount = 0,
    outboxOnline = true,
    outboxPoints = [],
    outboxProblem,
    outboxRejectedCount = 0,
    outboxSyncing,
    primaryMapDiaryGroups,
    resetMapDraft,
    savingMapPoint,
    selectedMapPoint,
    selectedMapPointId,
    setMapDiaryDateKey,
    setMapPointListLimit,
    setMapStatus,
    setShowMapPrintDialog,
    setWorkspaceView,
    showMapPrintDialog,
    syncOutboxNow,
    visibleMapPoints,
    workspaceView
  } = model;

  const rootRef = useRef(null);
  const mapApiRef = useRef(null);
  const typeButtonRefs = useRef(new Map());
  const toastTimerRef = useRef(0);
  const [mapApi, setMapApi] = useState(null);
  const [aim, setAim] = useState(null);
  const [pointType, setPointType] = useState(readLastType);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showZones, setShowZones] = useState(false);
  const [toast, setToast] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const [marking, setMarking] = useState(false);

  const gps = useGpsWatch({
    onFirstFix: (fix) => mapApiRef.current?.flyTo(fix.latitude, fix.longitude, Math.max(19, mapApiRef.current.getZoom()))
  });

  // El visor ocupa el alto que queda debajo de la barra de la app.
  useEffect(() => {
    const element = rootRef.current;
    if (!element) return undefined;
    const fit = () => {
      const top = document.querySelector(".app-chrome")?.getBoundingClientRect().bottom ?? 0;
      element.style.setProperty("--pg-top", `${Math.max(0, Math.round(top))}px`);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);

  const handleReady = useCallback((api) => {
    mapApiRef.current = api;
    setMapApi(api);
  }, []);

  const handleAim = useCallback((next) => setAim(next), []);

  const chooseType = (type) => {
    setPointType(type);
    try {
      window.localStorage.setItem(LAST_TYPE_KEY, type);
    } catch {
      // Sin almacenamiento: solo no se recuerda.
    }
  };

  const handleTypeKeyDown = (event, type) => {
    const currentIndex = POINT_TYPE_ORDER.indexOf(type);
    const nextIndex = {
      ArrowRight: (currentIndex + 1) % POINT_TYPE_ORDER.length,
      ArrowDown: (currentIndex + 1) % POINT_TYPE_ORDER.length,
      ArrowLeft: (currentIndex - 1 + POINT_TYPE_ORDER.length) % POINT_TYPE_ORDER.length,
      ArrowUp: (currentIndex - 1 + POINT_TYPE_ORDER.length) % POINT_TYPE_ORDER.length,
      Home: 0,
      End: POINT_TYPE_ORDER.length - 1
    }[event.key];
    if (nextIndex === undefined) return;
    event.preventDefault();
    const nextType = POINT_TYPE_ORDER[nextIndex];
    chooseType(nextType);
    typeButtonRefs.current.get(nextType)?.focus({ preventScroll: true });
  };

  const locate = () => {
    if (gps.fix && gps.status === "activo") {
      mapApi?.flyTo(gps.fix.latitude, gps.fix.longitude, Math.max(19, mapApi.getZoom()));
      return;
    }
    gps.locate();
  };

  const mark = async () => {
    if (!aim || marking) return;
    setMarking(true);
    try {
      const fix = gps.fix;
      // La precisión del GPS solo vale si la mira está donde el GPS dice que está el técnico.
      const nearFix = fix && distanceMeters(aim, fix) <= Math.max(15, fix.accuracy * 1.5);
      const localId = await handleMarkPoint({
        latitude: aim.latitude,
        longitude: aim.longitude,
        accuracy: nearFix ? fix.accuracy : null,
        pointType
      });
      if (!localId) return;
      navigator.vibrate?.(18);
      setFlashId(localId);
      setToast({ localId });
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
        setFlashId(null);
      }, UNDO_WINDOW_MS);
    } finally {
      setMarking(false);
    }
  };

  const undoMark = async () => {
    if (!toast) return;
    window.clearTimeout(toastTimerRef.current);
    const discarded = await handleDeleteMapPoint(toast.localId);
    if (!discarded) {
      toastTimerRef.current = window.setTimeout(() => setToast(null), UNDO_WINDOW_MS);
      return;
    }
    setToast(null);
    setFlashId(null);
  };

  const openDetails = (pointId) => {
    window.clearTimeout(toastTimerRef.current);
    setToast(null);
    handleEditMapPoint(pointId);
    setSheetOpen(true);
  };

  const pendingForDay = useMemo(
    () => outboxPoints.filter((point) => point.diary_date === activeMapDiaryDateKey),
    [activeMapDiaryDateKey, outboxPoints]
  );
  const canvasPoints = useMemo(() => [...pendingForDay, ...mapPointsForCanvas], [mapPointsForCanvas, pendingForDay]);
  const listPoints = useMemo(() => [...pendingForDay, ...listedMapPoints], [listedMapPoints, pendingForDay]);
  const selected = outboxPoints.find((point) => point.id === selectedMapPointId) ?? selectedMapPoint ?? null;
  const dayTotal = visibleMapPoints.length + pendingForDay.length;
  const typeStyle = getPointTypeStyle(pointType);
  const isEditing = Boolean(editingMapPointId);
  const gpsLabel = gps.status === "activo" && gps.fix ? `GPS ±${gps.fix.accuracy} m` : GPS_LABELS[gps.status] || "GPS";

  const syncState = getOutboxSyncState({ outboxCount, outboxRejectedCount, outboxOnline });

  const selectFromList = (pointId) => {
    handleSelectMapPoint(pointId);
    setSheetOpen(false);
  };

  return (
    <main ref={rootRef} className={`pg no-print ${sheetOpen ? "is-sheet-open" : ""}`}>
      <h2 className="pg-visually-hidden">Puntos GPS</h2>

      <section className="pg-stage" aria-label="Visor del mapa">
        <div className="pg-readout">
          <span className={`pg-reading pg-gps is-${gps.status === "activo" ? gps.quality : gps.status}`}>
            <span className="pg-dot" aria-hidden="true" />{gpsLabel}
          </span>
          <span className="pg-reading pg-coords" aria-label="Coordenadas de la mira">
            {aim ? <>{aim.latitude.toFixed(6)}<span aria-hidden="true">,</span> {aim.longitude.toFixed(6)}</> : "—"}
          </span>
          <button type="button" className={`pg-reading pg-sync ${syncState.tone}`} onClick={() => syncOutboxNow?.()} aria-label={`${syncState.text}. Toca para intentar enviar ahora.`} title="Intentar enviar ahora los puntos guardados">
            <span className={`pg-dot ${outboxSyncing ? "is-busy" : ""}`} aria-hidden="true" />
            <span role="status" aria-live="polite">{syncState.text}</span>
          </button>
        </div>
        {gps.message || outboxProblem ? <p className="pg-banner" role="status">{gps.message || outboxProblem}</p> : null}

        <div className="pg-map">
          <MapLoadBoundary>
            <Suspense fallback={<div className="pg-map-loading">Cargando mapa…</div>}>
              <FieldMap
                apiUrl={API_URL}
                isActive={workspaceView === "map"}
                mapDraft={mapDraft}
                mapFocusRequest={mapFocusRequest}
                mapPoints={canvasPoints}
                onDraftChange={ignoreDraftChange}
                onSelectPoint={handleSelectMapPoint}
                onStatusChange={setMapStatus}
                selectedMapPointId={selectedMapPointId}
                visor
                onAimChange={handleAim}
                onReady={handleReady}
                userLocation={gps.fix}
                flashPointId={flashId}
              />
            </Suspense>
          </MapLoadBoundary>
          <div className="pg-reticle" aria-hidden="true" style={{ "--pg-type": typeStyle.color }}>
            <span className="pg-reticle-ring" />
            <span className="pg-reticle-cross" />
          </div>
          <div className="pg-controls">
            <button type="button" className={`pg-fab is-locate ${gps.status === "activo" ? "is-on" : ""}`} onClick={locate} aria-label="Ir a mi ubicación" title="Ir a mi ubicación">
              <LocateFixed size={22} />
            </button>
            <div className="pg-fab-group" role="group" aria-label="Zoom">
              <button type="button" className="pg-fab" onClick={() => mapApi?.zoomIn()} aria-label="Acercar"><Plus size={20} /></button>
              <button type="button" className="pg-fab" onClick={() => mapApi?.zoomOut()} aria-label="Alejar"><Minus size={20} /></button>
            </div>
            <button type="button" className={`pg-fab ${showZones ? "is-on" : ""}`} onClick={() => setShowZones((value) => !value)} aria-label="Zonas sin señal y leyenda" aria-expanded={showZones} title="Zonas sin señal y leyenda">
              <Layers size={20} />
            </button>
          </div>
          {showZones ? <OfflineZonesPanel apiUrl={API_URL} mapApi={mapApi} onClose={() => setShowZones(false)} /> : null}
          {toast ? (
            <div className="pg-toast" role="status">
              <span>Punto marcado. Se enviará cuando haya conexión.</span>
              <button type="button" onClick={() => openDetails(toast.localId)}>Detalles</button>
              <button type="button" onClick={undoMark}>Deshacer</button>
            </div>
          ) : null}
        </div>
      </section>

      <aside className="pg-dock" aria-label="Registrar y revisar puntos">
        <button type="button" className="pg-handle" onClick={() => setSheetOpen((value) => !value)} aria-expanded={sheetOpen}>
          <span className="pg-handle-bar" aria-hidden="true" />
          <span>{sheetOpen ? "Cerrar jornada" : `Jornada · ${dayTotal} ${dayTotal === 1 ? "punto" : "puntos"}`}</span>
          <ChevronUp size={18} aria-hidden="true" />
        </button>

        {!isEditing ? (
          <div className="pg-capture">
            <div className="pg-types" role="radiogroup" aria-label="Tipo de punto">
              {POINT_TYPE_ORDER.map((type) => {
                const style = getPointTypeStyle(type);
                return (
                  <button
                    key={type}
                    ref={(element) => {
                      if (element) typeButtonRefs.current.set(type, element);
                      else typeButtonRefs.current.delete(type);
                    }}
                    type="button"
                    role="radio"
                    tabIndex={pointType === type ? 0 : -1}
                    aria-checked={pointType === type}
                    className={`pg-type ${pointType === type ? "is-active" : ""}`}
                    style={{ "--pg-type": style.color }}
                    onClick={() => chooseType(type)}
                    onKeyDown={(event) => handleTypeKeyDown(event, type)}
                  >
                    <PointGlyph type={type} size={18} />
                    <span>{style.short}</span>
                  </button>
                );
              })}
            </div>
            <button type="button" className="pg-mark" style={{ "--pg-type": typeStyle.color }} onClick={mark} disabled={!aim || marking}>
              <PointGlyph type={pointType} size={22} />
              Marcar {typeStyle.short.toLowerCase()} aquí
            </button>
          </div>
        ) : null}

        <div className="pg-sheet">
          {isEditing ? (
            <form className="pg-edit" onSubmit={async (event) => { await handleSaveMapPoint(event); }}>
              <header className="pg-section-head">
                <h3>{isOutboxId(editingMapPointId) ? "Detalles del punto" : `Editar punto #${editingMapPointId}`}</h3>
                <button type="button" className="pg-icon-button" onClick={resetMapDraft} aria-label="Cancelar edición"><X size={18} /></button>
              </header>
              <label className="pg-field">
                <span>Tipo</span>
                <select name="point_type" value={mapDraft.point_type} onChange={handleMapDraftChange}>
                  {POINT_TYPE_ORDER.map((type) => <option key={type} value={type}>{getPointTypeStyle(type).label}</option>)}
                </select>
              </label>
              <div className="pg-field">
                <span id="pg-housing-label">Viviendas</span>
                <div className="pg-stepper" role="group" aria-labelledby="pg-housing-label">
                  <button type="button" onClick={() => adjustMapDraftHousingUnits(-1)} aria-label="Restar vivienda"><Minus size={18} /></button>
                  <input name="housing_units" type="number" min="1" max="999" inputMode="numeric" value={mapDraft.housing_units} onChange={handleMapDraftChange} aria-labelledby="pg-housing-label" />
                  <button type="button" onClick={() => adjustMapDraftHousingUnits(1)} aria-label="Agregar vivienda"><Plus size={18} /></button>
                </div>
              </div>
              <label className="pg-field">
                <span>Referencia</span>
                <input name="reference" value={mapDraft.reference} onChange={handleMapDraftChange} placeholder="Frente a poste, casa verde…" />
              </label>
              <label className="pg-field">
                <span>Descripción técnica</span>
                <textarea name="description" rows="3" value={mapDraft.description} onChange={handleMapDraftChange} placeholder="Detalle de la caja o descarga. Ej. clave 10-07-01-01" />
                {mapDescriptionLookupStatus ? <small>{mapDescriptionLookupStatus}</small> : null}
              </label>
              <details className="pg-coords-edit">
                <summary>Coordenadas</summary>
                <div className="pg-coords-grid">
                  <label className="pg-field"><span>Latitud</span><input name="latitude" inputMode="decimal" value={mapDraft.latitude} onChange={handleMapDraftChange} /></label>
                  <label className="pg-field"><span>Longitud</span><input name="longitude" inputMode="decimal" value={mapDraft.longitude} onChange={handleMapDraftChange} /></label>
                </div>
              </details>
              <div className="pg-edit-actions">
                <button type="button" className="pg-button" onClick={resetMapDraft}>Cancelar</button>
                <button type="submit" className="pg-button is-primary" disabled={savingMapPoint}>{savingMapPoint ? "Guardando…" : "Guardar detalles"}</button>
              </div>
            </form>
          ) : selected ? (
            <article className="pg-detail" aria-labelledby="pg-detail-title">
              <header className="pg-section-head">
                <h3 id="pg-detail-title"><PointGlyph type={selected.point_type} size={20} pending={selected.pending} />{getPointTypeStyle(selected.point_type).label}</h3>
                <PointStatus point={selected} />
              </header>
              <p className="pg-detail-copy">{pointSummary(selected)}</p>
              {selected.outboxError ? <p className="pg-note is-error">{selected.outboxError}</p> : null}
              <dl className="pg-facts">
                <div><dt>Ubicación</dt><dd>{formatCoordinate(selected.latitude)}, {formatCoordinate(selected.longitude)}</dd></div>
                <div><dt>Precisión</dt><dd>{selected.accuracy_meters ? `±${selected.accuracy_meters} m` : "Colocado en el mapa"}</dd></div>
                <div><dt>Viviendas</dt><dd>{getMapPointHousingUnits(selected)}</dd></div>
                <div><dt>Hora</dt><dd>{formatDateTime(selected.created_at)}</dd></div>
              </dl>
              <div className="pg-detail-actions">
                <button type="button" className="pg-button is-primary" onClick={() => openDetails(selected.id)}><Pencil size={16} />Detalles</button>
                <button type="button" className="pg-button" onClick={(event) => handleOpenPointInMaps(selected, event)}><ExternalLink size={16} />Maps</button>
                <button type="button" className="pg-button" onClick={(event) => handleCopyCoordinates(selected, event)}><Copy size={16} />Copiar</button>
                {selected.pending || isAdmin ? (
                  <button type="button" className="pg-button is-danger" onClick={() => handleDeleteMapPoint(selected.id)}>
                    <Trash2 size={16} />{selected.pending ? "Descartar" : "Eliminar"}
                  </button>
                ) : null}
              </div>
            </article>
          ) : null}

          <section className="pg-day" aria-labelledby="pg-day-title">
            <header className="pg-section-head">
              <h3 id="pg-day-title">Jornada del {formatMapDiaryLabel(activeMapDiaryDateKey)}</h3>
              <span className="pg-count">{dayTotal}</span>
            </header>
            <nav className="pg-days" aria-label="Elegir jornada">
              {primaryMapDiaryGroups.map((group) => (
                <button key={group.key} type="button" className={activeMapDiaryDateKey === group.key ? "is-active" : ""} aria-pressed={activeMapDiaryDateKey === group.key} onClick={() => setMapDiaryDateKey(group.key)}>
                  <strong>{formatMapDiaryLabel(group.key)}</strong><small>{group.total}</small>
                </button>
              ))}
              {archivedMapDiaryGroups.length ? (
                <button type="button" onClick={openMapDiaryArchiveModal}><strong>Anteriores</strong><small>{archivedMapDiaryGroups.length} días</small></button>
              ) : null}
              {!mapDiaryGroups.length ? <span className="pg-note">Todavía no hay jornadas.</span> : null}
            </nav>
            <div className="pg-day-actions">
              <button type="button" className="pg-link-button" onClick={() => loadMapPoints?.()} disabled={loadingMapPoints}><RefreshCw size={15} />{loadingMapPoints ? "Actualizando…" : "Actualizar"}</button>
              <button type="button" className="pg-link-button" onClick={handleDownloadMapReport}><Download size={15} />Reporte</button>
              <button type="button" className="pg-link-button" onClick={() => setShowMapPrintDialog(true)}><Printer size={15} />Imprimir</button>
              <button type="button" className="pg-link-button" onClick={() => setWorkspaceView?.("executiveReport")}><MapIcon size={15} />Operaciones</button>
            </div>
            {loadingMapPoints ? <p className="pg-note">Cargando puntos…</p> : null}
            {listPoints.length ? (
              <ol className="pg-list">
                {listPoints.map((point) => (
                  <li key={point.id}>
                    <button type="button" className={`pg-row ${selectedMapPointId === point.id ? "is-active" : ""}`} aria-pressed={selectedMapPointId === point.id} onClick={() => selectFromList(point.id)}>
                      <PointGlyph type={point.point_type} size={18} pending={point.pending} />
                      <span className="pg-row-main">
                        <strong>{getPointTypeStyle(point.point_type).label}</strong>
                        <small>{pointSummary(point)}</small>
                      </span>
                      <span className="pg-row-meta">
                        <time>{new Intl.DateTimeFormat("es-HN", { hour: "2-digit", minute: "2-digit" }).format(new Date(point.created_at))}</time>
                        {point.pending ? <PointStatus point={point} /> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="pg-empty">
                <strong>Sin puntos en esta jornada</strong>
                <p>Mueve el mapa hasta poner la mira sobre la caja y pulsa «Marcar».</p>
              </div>
            )}
            {hiddenMapPointCount ? (
              <button type="button" className="pg-button pg-more" onClick={() => setMapPointListLimit((current) => current + MAP_POINT_LIST_STEP)}>
                Ver {Math.min(MAP_POINT_LIST_STEP, hiddenMapPointCount)} puntos más
              </button>
            ) : null}
          </section>
        </div>
      </aside>

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
    </main>
  );
}
