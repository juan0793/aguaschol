import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import logo from "../../assets/logo-aguas-choluteca.png";
import { formatCurrency } from "../../utils/formatting";
import { formatDateTime, formatMapDiaryLabel } from "../../utils/datesAndBusiness";
import ReportsHeader from "./ReportsHeader";
import ReportSummaryBar from "./ReportSummaryBar";
import ReportsTabs from "./ReportsTabs";
import ReportDialog from "./ReportDialog";
import ReportOverviewTab from "./tabs/ReportOverviewTab";
import ReportRecordsTab from "./tabs/ReportRecordsTab";
import ReportDebtTab from "./tabs/ReportDebtTab";
import RegulatorReportTab from "./tabs/RegulatorReportTab";
import ReportFindingsTab from "./tabs/ReportFindingsTab";
import { filterReportDays, flattenReportPoints } from "./utils/reportSelectors";
import { textoJornadas, unirBarriosDeJornadas } from "./utils/informeJornadas";
import "../../components/ds/design-system.css";
import "./reports.css";

const DOCUMENT_TYPES = [
  ["technical", "Técnico con coordenadas", "Coordenadas, referencias y datos de campo.", "map"],
  ["census", "Censo sin coordenadas", "Clave, nombre en el padrón y referencias, sin GPS.", "users"],
  ["brief", "Resumen ligero", "Listado compacto para revisión rápida.", "records"],
  ["regulator", "Ente regulador", "Consolida jornadas y personal técnico.", "auth"]
];

export default function ReportsWorkspace({ model }) {
  // Hallazgos va primero: es lo que convierte el levantamiento en acciones.
  const [tab, setTab] = useState("findings");
  const [daysOpen, setDaysOpen] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [dayFilters, setDayFilters] = useState({ query: "", year: "", month: "", withPoints: true });
  const [dayLimit, setDayLimit] = useState(15);
  const [documentType, setDocumentType] = useState("technical");
  const [documentFormat, setDocumentFormat] = useState("pdf");
  const [reportOptions, setReportOptions] = useState({ sharedKeys: false, debtSummary: false, mapaPorBarrio: true });
  const [excludedZones, setExcludedZones] = useState([]);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewZoom, setPreviewZoom] = useState(100);
  // Jornadas del informe de campo (técnico o censo): por defecto, la que está en pantalla.
  const [jornadasInforme, setJornadasInforme] = useState(() => [model.activeDateKey].filter(Boolean));
  const [datosJornadas, setDatosJornadas] = useState({ clave: "", jornadas: [], error: "" });
  const [cargandoJornadas, setCargandoJornadas] = useState(false);
  const [progreso, setProgreso] = useState("");
  const [limiteJornadas, setLimiteJornadas] = useState(14);
  const cargarJornadasRef = useRef(model.onLoadJornadas);
  cargarJornadasRef.current = model.onLoadJornadas;

  const days = useMemo(() => model.days.map((day) => ({ ...day, label: formatMapDiaryLabel(day.key) })), [model.days]);
  const filteredDays = useMemo(() => filterReportDays(days, dayFilters), [days, dayFilters]);
  const points = useMemo(() => flattenReportPoints(model.data.zones), [model.data.zones]);
  const debtKeys = useMemo(() => new Set((model.debtReport?.results || []).filter((item) => item.exists && item.matches?.some((match) => Number(match.total || 0) > 0)).map((item) => String(item.key))), [model.debtReport]);
  const debtSummary = { ...model.debtSummary, totalDebtLabel: formatCurrency(model.debtSummary.totalDebt || 0) };
  const debtChart = {
    ...model.debtChart,
    totalDebtLabel: formatCurrency(model.debtChart.totalDebt || 0),
    topRows: (model.debtChart.topRows || []).map((row) => ({ ...row, totalLabel: formatCurrency(row.total || 0) }))
  };
  useEffect(() => {
    setExcludedZones([]);
    setPreviewPage(1);
    setJornadasInforme([model.activeDateKey].filter(Boolean));
  }, [model.activeDateKey]);

  const admiteJornadas = documentType === "technical" || documentType === "census";
  const variasJornadas = admiteJornadas && (jornadasInforme.length > 1 || (jornadasInforme.length === 1 && jornadasInforme[0] !== model.activeDateKey));
  const claveJornadas = [...jornadasInforme].sort().join(",");
  // Entre que se marca una jornada y llegan sus puntos, todo cuenta como "cargando".
  const esperandoJornadas = variasJornadas && (cargandoJornadas || (datosJornadas.clave !== claveJornadas && !datosJornadas.error));

  // Con otras jornadas, sus puntos se piden para mostrar los barrios de todas.
  useEffect(() => {
    if (!generatorOpen || !variasJornadas || !cargarJornadasRef.current) return undefined;
    if (datosJornadas.clave === claveJornadas) return undefined;
    let vivo = true;
    const espera = window.setTimeout(async () => {
      setCargandoJornadas(true);
      try {
        const jornadas = await cargarJornadasRef.current(claveJornadas.split(","));
        if (vivo) setDatosJornadas({ clave: claveJornadas, jornadas, error: "" });
      } catch (error) {
        if (vivo) setDatosJornadas({ clave: claveJornadas, jornadas: [], error: error.message || "No se pudieron cargar las jornadas." });
      } finally {
        if (vivo) setCargandoJornadas(false);
      }
    }, 250);
    return () => { vivo = false; window.clearTimeout(espera); };
  }, [generatorOpen, variasJornadas, claveJornadas, datosJornadas.clave]);

  const barriosDisponibles = useMemo(
    () => (variasJornadas
      ? (datosJornadas.clave === claveJornadas ? unirBarriosDeJornadas(datosJornadas.jornadas) : [])
      : model.data.zones.map((zone) => ({ overrideKey: zone.overrideKey, displayName: zone.displayName || zone.zone, total: zone.items.length, dias: 1 }))),
    [variasJornadas, datosJornadas, claveJornadas, model.data.zones]
  );
  const includedZones = useMemo(
    () => model.data.zones.filter((zone) => !excludedZones.includes(zone.overrideKey)),
    [excludedZones, model.data.zones]
  );
  const barriosIncluidos = barriosDisponibles.filter((zone) => !excludedZones.includes(zone.overrideKey));
  const includedZoneKeys = barriosIncluidos.map((zone) => zone.overrideKey);
  const includedPoints = barriosIncluidos.reduce((total, zone) => total + zone.total, 0);
  const jornadasConPuntos = days.filter((day) => Number(day.total || 0) > 0 || day.key === model.activeDateKey);
  const alternarJornada = (clave) => setJornadasInforme((actual) => {
    if (actual.includes(clave)) return actual.length > 1 ? actual.filter((item) => item !== clave) : actual;
    return [...actual, clave].sort();
  });
  const textoDeJornadas = variasJornadas ? textoJornadas(jornadasInforme) : formatMapDiaryLabel(model.activeDateKey);
  const previewZones = includedZones.slice((previewPage - 1) * 5, previewPage * 5);
  const previewTotalPages = Math.max(1, Math.ceil(includedZones.length / 5));

  useEffect(() => {
    setPreviewPage((current) => Math.min(current, previewTotalPages));
  }, [previewTotalPages]);

  const generate = ({ preview = false, format = documentFormat } = {}) => {
    if (preview) { setGeneratorOpen(false); setPreviewOpen(true); return; }
    const actions = {
      technical: format === "pdf" ? model.onDownloadTechnical : model.onPrintTechnical,
      brief: format === "pdf" ? model.onDownloadBrief : model.onPrintBrief,
      census: format === "pdf" ? model.onDownloadCensus : model.onPrintCensus,
      regulator: model.onDownloadRegulator
    };
    const accion = actions[documentType];
    if (!accion) return;
    const conJornadas = variasJornadas
      ? { jornadas: jornadasInforme, jornadasCargadas: datosJornadas.clave === claveJornadas ? datosJornadas.jornadas : null, onProgreso: setProgreso }
      : admiteJornadas ? { onProgreso: setProgreso } : {};
    setProgreso(admiteJornadas ? "Preparando el informe…" : "");
    Promise.resolve(accion({ ...reportOptions, includedZoneKeys, ...conJornadas })).finally(() => setProgreso(""));
  };

  const toggleZone = (zoneKey) => {
    setExcludedZones((current) => current.includes(zoneKey) ? current.filter((key) => key !== zoneKey) : [...current, zoneKey]);
  };

  return <section className="reports-workspace">
    <ReportsHeader activeLabel={formatMapDiaryLabel(model.activeDateKey)} activeTotal={model.data.totalPoints} days={days} onSelectDay={model.onSelectDay} onOpenAllDays={() => setDaysOpen(true)} loading={model.loadingPoints || model.loadingContexts} onRefresh={model.onRefresh} onPreview={() => setPreviewOpen(true)} onGenerate={() => setGeneratorOpen(true)} onSettings={() => setSettingsOpen(true)} />
    <ReportSummaryBar total={model.data.totalPoints} zones={model.data.totalZones} points={points} />
    <div className="reports-content"><ReportsTabs active={tab} onChange={setTab} />
      {tab === "findings" ? <ReportFindingsTab apiFetch={model.apiFetch} activeDateKey={model.activeDateKey} notify={model.notify} onOpenBanco={model.onOpenBanco} /> : null}
      {tab === "overview" ? <ReportOverviewTab data={model.data} settings={model.settings} activeLabel={formatMapDiaryLabel(model.activeDateKey)} debt={model.debtReport ? debtSummary : null} onPreview={() => setPreviewOpen(true)} /> : null}
      {tab === "records" ? <ReportRecordsTab points={points} debtKeys={debtKeys} onEditPoint={(pointId) => { model.onEditPoint(pointId); setDetailOpen(true); }} onOpenMap={model.onOpenMap} /> : null}
      {tab === "debt" ? <ReportDebtTab loading={model.loadingDebt} report={model.debtReport} summary={debtSummary} chart={debtChart} onVerify={model.onVerifyDebt} onDetail={model.onDebtDetail} onPrint={model.onPrintDebt} onDownload={model.onDownloadDebt} /> : null}
      {tab === "regulator" ? <RegulatorReportTab days={model.regulatorDays.map((day) => ({ ...day, label: formatMapDiaryLabel(day.key) }))} selected={model.selectedRegulatorDays} settings={model.settings} technicians={model.technicians} generating={model.generatingRegulator} onToggle={model.onToggleRegulatorDay} onImage={model.onImage} onClearImage={model.onClearImage} onGenerate={model.onDownloadRegulator} /> : null}
    </div>
    <div className="reports-primary-actions"><button type="button" className="button-secondary" onClick={() => { setTab("debt"); model.onVerifyDebt(); }} disabled={model.loadingDebt}><Icon name="search" />Verificar deuda</button><button type="button" className="button-secondary" onClick={() => setPreviewOpen(true)}><Icon name="records" />Vista previa</button><button type="button" onClick={() => setGeneratorOpen(true)}><Icon name="records" />Generar documento</button></div>

    <ReportDialog open={daysOpen} onClose={() => setDaysOpen(false)} title="Seleccionar jornada">
      <div className="report-day-modal-filters"><input type="search" value={dayFilters.query} onChange={(event) => setDayFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Buscar por fecha..." aria-label="Buscar jornada" /><select value={dayFilters.year} onChange={(event) => setDayFilters((current) => ({ ...current, year: event.target.value }))}><option value="">Todos los años</option>{[...new Set(days.map((day) => day.key.slice(0, 4)))].map((year) => <option key={year}>{year}</option>)}</select><select value={dayFilters.month} onChange={(event) => setDayFilters((current) => ({ ...current, month: event.target.value }))}><option value="">Todos los meses</option>{Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((month) => <option key={month} value={month}>{month}</option>)}</select><label><input type="checkbox" checked={dayFilters.withPoints} onChange={(event) => setDayFilters((current) => ({ ...current, withPoints: event.target.checked }))} />Solo jornadas con puntos</label></div>
      <div className="report-day-modal-list">{filteredDays.slice(0, dayLimit).map((day) => <button type="button" className={model.activeDateKey === day.key ? "is-active" : ""} key={day.key} onClick={() => { model.onSelectDay(day.key); setDaysOpen(false); }}><span><strong>{day.label}</strong><small>{day.key.slice(0, 7)}</small></span><b>{day.total} puntos</b></button>)}{!filteredDays.length ? <p>Sin jornadas para estos filtros.</p> : null}</div>
      {dayLimit < filteredDays.length ? <footer><button type="button" className="button-secondary" onClick={() => setDayLimit((value) => value + 15)}>Cargar más</button></footer> : null}
    </ReportDialog>

    <ReportDialog open={generatorOpen} onClose={() => setGeneratorOpen(false)} title="Generar documento" variant="drawer">
      <div className="report-generator">
        <section className="rg-section" aria-labelledby="rg-tipo">
          <h3 id="rg-tipo" className="rg-title">Tipo de documento</h3>
          <div className="rg-types" role="radiogroup" aria-labelledby="rg-tipo">
            {DOCUMENT_TYPES.map(([value, label, detail, icon]) => (
              <label key={value} className={`rg-type ${documentType === value ? "is-selected" : ""}`}>
                <input type="radio" name="documentType" value={value} checked={documentType === value} onChange={(event) => setDocumentType(event.target.value)} />
                <span className="rg-type-icon"><Icon name={icon} /></span>
                <span className="rg-type-text"><strong>{label}</strong><small>{detail}</small></span>
              </label>
            ))}
          </div>
        </section>

        {admiteJornadas ? (
          <section className="rg-section" aria-labelledby="rg-jornadas">
            <div className="rg-head">
              <h3 id="rg-jornadas" className="rg-title"><Icon name="calendar" />Jornadas</h3>
              <span className="rg-count"><strong>{jornadasInforme.length}</strong> {jornadasInforme.length === 1 ? "elegida" : "elegidas"}</span>
              {variasJornadas ? <button type="button" className="report-link" onClick={() => setJornadasInforme([model.activeDateKey].filter(Boolean))}>Solo la de pantalla</button> : null}
            </div>
            {variasJornadas ? <p className="rg-hint">Cada barrio sale una sola vez; el día queda en cada punto.</p> : null}
            <div className="rg-checklist rg-days">
              {jornadasConPuntos.slice(0, limiteJornadas).map((day) => (
                <label key={day.key} className={jornadasInforme.includes(day.key) ? "is-checked" : ""}>
                  <input type="checkbox" checked={jornadasInforme.includes(day.key)} onChange={() => alternarJornada(day.key)} />
                  <span><strong>{day.label}</strong><small>{Number(day.total).toLocaleString("es-HN")} {Number(day.total) === 1 ? "punto" : "puntos"}{day.key === model.activeDateKey ? " · en pantalla" : ""}</small></span>
                </label>
              ))}
            </div>
            {limiteJornadas < jornadasConPuntos.length ? <button type="button" className="report-link rg-more" onClick={() => setLimiteJornadas((valor) => valor + 14)}>Ver más jornadas</button> : null}
          </section>
        ) : null}

        {documentType !== "regulator" ? (
          <section className="rg-section" aria-labelledby="rg-barrios">
            <div className="rg-head">
              <h3 id="rg-barrios" className="rg-title"><Icon name="map" />Barrios</h3>
              <span className="rg-count"><strong>{barriosIncluidos.length}</strong> de {barriosDisponibles.length}</span>
              <span className="rg-links">
                <button type="button" className="report-link" onClick={() => setExcludedZones([])}>Todos</button>
                <button type="button" className="report-link" onClick={() => setExcludedZones(barriosDisponibles.map((zone) => zone.overrideKey))}>Ninguno</button>
              </span>
            </div>
            {esperandoJornadas ? <p className="rg-hint is-loading">Cargando los puntos de las jornadas…</p> : null}
            {datosJornadas.error && variasJornadas ? <p className="rg-hint is-error">{datosJornadas.error}</p> : null}
            {!esperandoJornadas && barriosDisponibles.length ? (
              <div className="rg-checklist">
                {barriosDisponibles.map((zone) => (
                  <label key={zone.overrideKey} className={excludedZones.includes(zone.overrideKey) ? "" : "is-checked"}>
                    <input type="checkbox" checked={!excludedZones.includes(zone.overrideKey)} onChange={() => toggleZone(zone.overrideKey)} />
                    <span><strong title={zone.displayName}>{zone.displayName}</strong><small>{zone.total.toLocaleString("es-HN")} {zone.total === 1 ? "punto" : "puntos"}{variasJornadas && zone.dias > 1 ? ` · ${zone.dias} días` : ""}</small></span>
                  </label>
                ))}
              </div>
            ) : null}
            {!barriosDisponibles.length && !esperandoJornadas ? <p className="rg-hint">{variasJornadas ? "Estas jornadas no tienen puntos guardados." : "No hay puntos guardados para esta jornada."}</p> : null}
            <button type="button" className="report-link rg-more" onClick={() => { setGeneratorOpen(false); setTab("records"); }}><Icon name="edit" />Revisar datos de los puntos</button>
          </section>
        ) : null}

        {admiteJornadas || documentType === "brief" ? (
          <section className="rg-section" aria-labelledby="rg-opciones">
            <h3 id="rg-opciones" className="rg-title"><Icon name="settings" />Opciones</h3>
            <div className="rg-options">
              {admiteJornadas ? (
                <label className="rg-option">
                  <span><strong>Láminas con mapa</strong><small>Cada barrio en láminas: un mapa a escala con los puntos numerados y debajo su tabla. Sin ellas, solo las tablas.</small></span>
                  <input type="checkbox" role="switch" checked={reportOptions.mapaPorBarrio} onChange={(event) => setReportOptions((current) => ({ ...current, mapaPorBarrio: event.target.checked }))} />
                </label>
              ) : null}
              {documentType === "brief" ? (
                <>
                  <label className="rg-option">
                    <span><strong>Claves compartidas</strong><small>Al final, los abonados agrupados por la misma clave catastral base.</small></span>
                    <input type="checkbox" role="switch" checked={reportOptions.sharedKeys} onChange={(event) => setReportOptions((current) => ({ ...current, sharedKeys: event.target.checked }))} />
                  </label>
                  <label className="rg-option">
                    <span><strong>Deuda de abonados</strong><small>Al final, un listado compacto y el total adeudado.</small></span>
                    <input type="checkbox" role="switch" checked={reportOptions.debtSummary} onChange={(event) => setReportOptions((current) => ({ ...current, debtSummary: event.target.checked }))} />
                  </label>
                </>
              ) : null}
            </div>
          </section>
        ) : null}

        {documentType !== "regulator" ? (
          <section className="rg-section" aria-labelledby="rg-salida">
            <h3 id="rg-salida" className="rg-title">Salida</h3>
            <div className="rg-segmented" role="radiogroup" aria-labelledby="rg-salida">
              {[["pdf", "Descargar PDF", "download"], ["print", "Imprimir", "print"]].map(([value, label, icon]) => (
                <label key={value} className={documentFormat === value ? "is-selected" : ""}>
                  <input type="radio" name="documentFormat" value={value} checked={documentFormat === value} onChange={(event) => setDocumentFormat(event.target.value)} />
                  <Icon name={icon} />{label}
                </label>
              ))}
            </div>
          </section>
        ) : null}

        <details className="rg-section rg-heading">
          <summary>
            <span className="rg-title"><Icon name="edit" />Encabezado del documento</span>
            <span className="rg-heading-value">{model.settings.title || "Sin título"}</span>
            <Icon name="chevronDown" className="rg-chevron" />
          </summary>
          <div className="rg-fields">
            <label><span>Título</span><input name="title" value={model.settings.title} onChange={model.onSettingsChange} /></label>
            <label><span>Institución o subtítulo</span><input name="subtitle" value={model.settings.subtitle} onChange={model.onSettingsChange} /></label>
            <label><span>Descripción</span><textarea name="description" rows="3" value={model.settings.description} onChange={model.onSettingsChange} /></label>
          </div>
        </details>
      </div>
      <footer className="reports-dialog-actions report-generator-actions">
        <div className="rg-footer-summary" aria-live="polite">
          <strong>{documentType === "regulator" ? "Informe para ente regulador" : esperandoJornadas ? "Cargando jornadas…" : `${includedPoints.toLocaleString("es-HN")} ${includedPoints === 1 ? "punto" : "puntos"} · ${barriosIncluidos.length} ${barriosIncluidos.length === 1 ? "barrio" : "barrios"}`}</strong>
          <small>{documentType === "regulator" ? formatMapDiaryLabel(model.activeDateKey) : textoDeJornadas}</small>
        </div>
        {documentType !== "regulator" && !variasJornadas ? <button type="button" className="button-secondary rg-preview" onClick={() => generate({ preview: true })} disabled={!includedZones.length} aria-label="Vista previa" title="Vista previa"><Icon name="eye" /><span className="rg-btn-text">Vista previa</span></button> : null}
        <button type="button" className="rg-primary" onClick={() => generate()} disabled={Boolean(progreso) || ((!barriosIncluidos.length || esperandoJornadas) && documentType !== "regulator")} aria-busy={Boolean(progreso) || esperandoJornadas}><Icon name={documentType === "regulator" || documentFormat === "pdf" ? "download" : "print"} />{progreso || (esperandoJornadas ? "Cargando…" : documentType === "regulator" ? "Descargar informe" : documentFormat === "pdf" ? "Descargar PDF" : "Imprimir")}</button>
      </footer>
    </ReportDialog>

    <ReportDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Configuración del reporte" variant="drawer">
      <form className="report-settings-form"><label>Título<input name="title" value={model.settings.title} onChange={model.onSettingsChange} /></label><label>Subtítulo<input name="subtitle" value={model.settings.subtitle} onChange={model.onSettingsChange} /></label><label>Descripción<textarea name="description" rows="3" value={model.settings.description} onChange={model.onSettingsChange} /></label><label>Barrio manual<input name="manual_barrio" value={model.settings.manual_barrio} onChange={model.onSettingsChange} /></label><label>Ubicación / sector<input name="manual_location" value={model.settings.manual_location} onChange={model.onSettingsChange} /></label><label>Observaciones<textarea name="report_notes" rows="4" value={model.settings.report_notes} onChange={model.onSettingsChange} /></label><div><span>Mapa oficial</span><label className="button-secondary report-file-button">Adjuntar mapa<input type="file" accept="image/*" onChange={model.onImage} /></label>{model.settings.map_image_data_url ? <button type="button" className="button-secondary" onClick={model.onClearImage}>Quitar mapa</button> : null}<small>{model.settings.map_image_name || "Sin mapa adjunto"}</small></div><fieldset><legend>Personal y técnicos</legend>{model.technicians.map((technician, index) => <label key={index}>Técnico {index + 1}<span><input value={technician} onChange={(event) => model.onTechnicianChange(index, event.target.value)} />{model.technicians.length > 1 ? <button type="button" className="reports-icon-button" onClick={() => model.onRemoveTechnician(index)} aria-label={`Quitar técnico ${index + 1}`}>×</button> : null}</span></label>)}<button type="button" className="button-secondary" onClick={model.onAddTechnician}>Agregar técnico</button><label>Responsable de datos<input name="data_engineer" value={model.staff.data_engineer} onChange={model.onStaffChange} /></label></fieldset></form>
      <footer className="reports-dialog-actions"><button type="button" onClick={() => setSettingsOpen(false)}>Guardar y cerrar</button></footer>
    </ReportDialog>

    <ReportDialog open={detailOpen} onClose={() => { setDetailOpen(false); model.onResetPoint(); }} title="Detalle del punto" variant="drawer">
      <form className="report-settings-form" onSubmit={(event) => { model.onSavePoint(event); setDetailOpen(false); }}><label>Latitud<input name="latitude" value={model.reportDraft.latitude} onChange={model.onDraftChange} /></label><label>Longitud<input name="longitude" value={model.reportDraft.longitude} onChange={model.onDraftChange} /></label><label>Precisión (m)<input name="accuracy_meters" type="number" value={model.reportDraft.accuracy_meters} onChange={model.onDraftChange} /></label><label>Referencia<input name="reference" value={model.reportDraft.reference} onChange={model.onDraftChange} /></label><label>Descripción<textarea name="description" rows="5" value={model.reportDraft.description} onChange={model.onDraftChange} /></label><label>Viviendas<input name="housing_units" type="number" min="1" value={model.reportDraft.housing_units} onChange={model.onDraftChange} /></label><label><input name="is_terminal_point" type="checkbox" checked={Boolean(model.reportDraft.is_terminal_point)} onChange={model.onDraftChange} />Marcar como punto final</label><footer className="reports-dialog-actions"><button type="button" className="button-secondary" onClick={() => { setDetailOpen(false); model.onResetPoint(); }}>Cancelar</button><button type="submit" disabled={model.savingPoint}>{model.savingPoint ? "Guardando..." : "Guardar cambios"}</button></footer></form>
    </ReportDialog>

    <ReportDialog open={previewOpen} onClose={() => setPreviewOpen(false)} title="Vista previa del reporte" variant="preview">
      <div className="report-preview-toolbar"><span>Página {previewPage} de {previewTotalPages}</span><div><button type="button" className="button-secondary" onClick={() => setPreviewZoom((value) => Math.max(70, value - 10))} aria-label="Reducir zoom">−</button><b>{previewZoom}%</b><button type="button" className="button-secondary" onClick={() => setPreviewZoom((value) => Math.min(130, value + 10))} aria-label="Aumentar zoom">+</button></div></div>
      <div className="report-preview-stage"><article className="report-preview-page" style={{ transform: `scale(${previewZoom / 100})` }}><header><img src={logo} alt="Aguas de Choluteca" /><div><small>{model.settings.subtitle}</small><h1>{model.settings.title}</h1><p>{model.settings.description}</p></div><b>Informe de campo</b></header><section className="report-preview-meta"><span><small>Jornada</small><strong>{formatMapDiaryLabel(model.activeDateKey)}</strong></span><span><small>Puntos incluidos</small><strong>{includedPoints}</strong></span><span><small>Barrios incluidos</small><strong>{includedZones.length}</strong></span><span><small>Generado</small><strong>{formatDateTime(new Date())}</strong></span></section>{previewZones.map((zone) => <div className="report-preview-zone" key={zone.overrideKey}><div><span>Barrio / zona</span><h2>{zone.displayName || zone.zone}</h2><small>{zone.items.length} puntos incluidos</small></div><table><thead><tr><th>#</th><th>Tipo</th><th>Referencia</th>{documentType !== "census" ? <th>Coordenadas</th> : null}</tr></thead><tbody>{zone.items.slice(0, 8).map((point, index) => <tr key={point.id}><td>{index + 1}</td><td>{point.point_type}</td><td>{point.reference || point.description || "--"}</td>{documentType !== "census" ? <td>{point.latitude}, {point.longitude}</td> : null}</tr>)}</tbody></table></div>)}</article></div>
      <footer className="reports-dialog-actions report-preview-actions"><button type="button" className="button-secondary" onClick={() => setPreviewPage((value) => Math.max(1, value - 1))} disabled={previewPage === 1}>Anterior</button><button type="button" className="button-secondary" onClick={() => setPreviewPage((value) => Math.min(previewTotalPages, value + 1))} disabled={previewPage === previewTotalPages}>Siguiente</button><span /><button type="button" className="button-secondary" onClick={() => { setDocumentFormat("pdf"); generate({ format: "pdf" }); }}>Descargar PDF</button><button type="button" onClick={() => { setDocumentFormat("print"); generate({ format: "print" }); }}>Imprimir</button></footer>
    </ReportDialog>
  </section>;
}
