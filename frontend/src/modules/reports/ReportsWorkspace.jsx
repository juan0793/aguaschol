import { useMemo, useState } from "react";
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
import { filterReportDays, flattenReportPoints } from "./utils/reportSelectors";
import "./reports.css";

export default function ReportsWorkspace({ model }) {
  const [tab, setTab] = useState("overview");
  const [daysOpen, setDaysOpen] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [dayFilters, setDayFilters] = useState({ query: "", year: "", month: "", withPoints: true });
  const [dayLimit, setDayLimit] = useState(15);
  const [documentType, setDocumentType] = useState("technical");
  const [documentFormat, setDocumentFormat] = useState("pdf");
  const [previewPage, setPreviewPage] = useState(1);
  const [previewZoom, setPreviewZoom] = useState(100);

  const days = useMemo(() => model.days.map((day) => ({ ...day, label: formatMapDiaryLabel(day.key) })), [model.days]);
  const filteredDays = useMemo(() => filterReportDays(days, dayFilters), [days, dayFilters]);
  const points = useMemo(() => flattenReportPoints(model.data.zones), [model.data.zones]);
  const ready = points.filter((point) => Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude))).length;
  const pending = Math.max(0, points.length - ready);
  const debtKeys = useMemo(() => new Set((model.debtReport?.results || []).filter((item) => item.exists && item.matches?.some((match) => Number(match.total || 0) > 0)).map((item) => String(item.key))), [model.debtReport]);
  const debtSummary = { ...model.debtSummary, totalDebtLabel: formatCurrency(model.debtSummary.totalDebt || 0) };
  const debtChart = {
    ...model.debtChart,
    totalDebtLabel: formatCurrency(model.debtChart.totalDebt || 0),
    topRows: (model.debtChart.topRows || []).map((row) => ({ ...row, totalLabel: formatCurrency(row.total || 0) }))
  };
  const previewZones = model.data.zones.slice((previewPage - 1) * 5, previewPage * 5);
  const previewTotalPages = Math.max(1, Math.ceil(model.data.zones.length / 5));

  const generate = ({ preview = false } = {}) => {
    if (preview) { setGeneratorOpen(false); setPreviewOpen(true); return; }
    const actions = {
      technical: documentFormat === "pdf" ? model.onDownloadTechnical : model.onPrintTechnical,
      brief: documentFormat === "pdf" ? model.onDownloadBrief : model.onPrintBrief,
      census: documentFormat === "pdf" ? model.onDownloadCensus : model.onPrintCensus,
      regulator: model.onDownloadRegulator
    };
    actions[documentType]?.();
  };

  return <section className="reports-workspace">
    <ReportsHeader activeLabel={formatMapDiaryLabel(model.activeDateKey)} activeTotal={model.data.totalPoints} days={days} onSelectDay={model.onSelectDay} onOpenAllDays={() => setDaysOpen(true)} loading={model.loadingPoints || model.loadingContexts} onRefresh={model.onRefresh} onPreview={() => setPreviewOpen(true)} onGenerate={() => setGeneratorOpen(true)} onSettings={() => setSettingsOpen(true)} />
    <ReportSummaryBar total={model.data.totalPoints} zones={model.data.totalZones} ready={ready} pending={pending} />
    <div className="reports-content"><ReportsTabs active={tab} onChange={setTab} />
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
      <div className="report-generator"><fieldset><legend>Tipo de reporte</legend>{[["technical", "Técnico con coordenadas"], ["brief", "Resumen ligero"], ["census", "Censo sin coordenadas"], ["regulator", "Ente regulador"]].map(([value, label]) => <label key={value}><input type="radio" name="documentType" value={value} checked={documentType === value} onChange={(event) => setDocumentType(event.target.value)} />{label}</label>)}</fieldset><fieldset disabled={documentType === "regulator"}><legend>Formato</legend><label><input type="radio" name="documentFormat" value="pdf" checked={documentFormat === "pdf"} onChange={(event) => setDocumentFormat(event.target.value)} />PDF</label><label><input type="radio" name="documentFormat" value="print" checked={documentFormat === "print"} onChange={(event) => setDocumentFormat(event.target.value)} />Imprimir</label></fieldset><div className="report-generator-summary"><strong>{model.data.totalPoints} puntos · {model.data.totalZones} barrios</strong><span>Jornada {formatMapDiaryLabel(model.activeDateKey)}</span></div></div>
      <footer className="reports-dialog-actions"><button type="button" className="button-secondary" onClick={() => setGeneratorOpen(false)}>Cancelar</button><button type="button" className="button-secondary" onClick={() => generate({ preview: true })}>Vista previa</button><button type="button" onClick={() => generate()}>Generar</button></footer>
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
      <div className="report-preview-stage"><article className="report-preview-page" style={{ transform: `scale(${previewZoom / 100})` }}><header><img src={logo} alt="Aguas de Choluteca" /><div><small>{model.settings.subtitle}</small><h1>{model.settings.title}</h1><p>{model.settings.description}</p></div></header><section><strong>Jornada: {formatMapDiaryLabel(model.activeDateKey)}</strong><span>Generado: {formatDateTime(new Date())}</span><span>{model.data.totalPoints} puntos · {model.data.totalZones} barrios</span></section>{previewZones.map((zone) => <div className="report-preview-zone" key={zone.zone}><h2>{zone.displayName || zone.zone}</h2><table><thead><tr><th>#</th><th>Tipo</th><th>Referencia</th>{documentType !== "census" ? <th>Coordenadas</th> : null}</tr></thead><tbody>{zone.items.slice(0, 8).map((point, index) => <tr key={point.id}><td>{index + 1}</td><td>{point.point_type}</td><td>{point.reference || point.description || "--"}</td>{documentType !== "census" ? <td>{point.latitude}, {point.longitude}</td> : null}</tr>)}</tbody></table></div>)}</article></div>
      <footer className="reports-dialog-actions report-preview-actions"><button type="button" className="button-secondary" onClick={() => setPreviewPage((value) => Math.max(1, value - 1))} disabled={previewPage === 1}>Anterior</button><button type="button" className="button-secondary" onClick={() => setPreviewPage((value) => Math.min(previewTotalPages, value + 1))} disabled={previewPage === previewTotalPages}>Siguiente</button><span /><button type="button" className="button-secondary" onClick={() => { setDocumentFormat("pdf"); generate(); }}>Descargar PDF</button><button type="button" onClick={() => { setDocumentFormat("print"); generate(); }}>Imprimir</button></footer>
    </ReportDialog>
  </section>;
}
