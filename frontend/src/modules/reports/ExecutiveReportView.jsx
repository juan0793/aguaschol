import { EXECUTIVE_REPORT_CREDIT } from "../../constants/workspace";
import { Icon } from "../../components/Icon";
import { formatSpanishDate } from "../../utils/datesAndBusiness";

export default function ExecutiveReportView({ model }) {
  const {
    alcaldiaMeta,
    alertRecords,
    executiveReportData,
    handleDownloadExecutiveReportPdf,
    mapDiaryGroups,
    padronMeta,
    safeAuditLogs,
    safeMapPoints,
    safeRecords,
    safeUsers
  } = model;

  return (
    <main className="executive-report-layout">
      <section className="executive-hero-panel">
        <div>
          <p className="sheet-kicker">Memoria operativa integral</p>
          <h2><Icon name="dashboard" className="title-icon" />Resumen de Operaciones realizadas</h2>
          <p>
            Consolidado de todo lo trabajado en la aplicación: captura de fichas, validación de padrones,
            avisos, impresión, geolocalización, mapeo, reportes PDF, usuarios, funciones desarrolladas,
            ahorro de tiempo para técnicos y trazabilidad.
          </p>
          <p className="executive-supervisor">{EXECUTIVE_REPORT_CREDIT}</p>
        </div>
        <button type="button" onClick={handleDownloadExecutiveReportPdf}>
          <Icon name="records" />
          Descargar PDF
        </button>
      </section>

      <section className="executive-kpi-grid">
        {[
          { label: "Fichas registradas", value: safeRecords.length, helper: `${executiveReportData.statusTotals.reportada || 0} reportadas` },
          { label: "Puntos GPS", value: safeMapPoints.length, helper: `${mapDiaryGroups.length} jornadas de campo` },
          { label: "Padrón maestro", value: padronMeta?.total_records ?? 0, helper: `${alcaldiaMeta?.total_records ?? 0} registros Alcaldía` },
          { label: "Eventos auditados", value: safeAuditLogs.length, helper: `${safeUsers.length} usuarios registrados` }
        ].map((item) => (
          <article key={item.label} className="executive-kpi-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </article>
        ))}
      </section>

      <section className="executive-section-grid">
        <article className="executive-card is-wide">
          <div className="executive-card-head">
            <div>
              <p className="sheet-kicker">Alcance construido</p>
              <h3>Módulos y capacidades entregadas</h3>
            </div>
            <span className="panel-pill">
              Desde {executiveReportData.firstDate ? formatSpanishDate(executiveReportData.firstDate) : "sin registros"}
            </span>
          </div>
          <div className="executive-module-list">
            {executiveReportData.modules.map((item) => (
              <article key={item.title} className="executive-module-item">
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                <span>{item.evidence}</span>
              </article>
            ))}
          </div>
        </article>

        <article className="executive-card is-wide">
          <div className="executive-card-head">
            <div>
              <p className="sheet-kicker">Funciones de la aplicación</p>
              <h3>Herramientas desarrolladas para campo y oficina</h3>
            </div>
          </div>
          <div className="executive-module-list">
            {executiveReportData.applicationFunctions.slice(0, 6).map((item) => (
              <article key={item[0]} className="executive-module-item">
                <strong>{item[0]}</strong>
                <p>{item[1]}</p>
              </article>
            ))}
          </div>
        </article>

        <article className="executive-card is-wide">
          <div className="executive-card-head">
            <div>
              <p className="sheet-kicker">Ahorro operativo</p>
              <h3>Tiempo que se ahorran los técnicos</h3>
            </div>
          </div>
          <div className="executive-table-list">
            {executiveReportData.timeSavingsRows.slice(0, 6).map((item) => (
              <div key={item[0]}>
                <span>{item[0]}</span>
                <strong>{item[1]} → {item[2]}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="executive-card">
          <div className="executive-card-head">
            <div>
              <p className="sheet-kicker">Fichas</p>
              <h3>Estado operativo</h3>
            </div>
          </div>
          <div className="executive-stat-list">
            <div><span>Clandestinas</span><strong>{executiveReportData.statusTotals.clandestino || 0}</strong></div>
            <div><span>Reportadas</span><strong>{executiveReportData.statusTotals.reportada || 0}</strong></div>
            <div><span>Varios padrones</span><strong>{executiveReportData.statusTotals.varios_padrones || 0}</strong></div>
            <div><span>Con fotografía</span><strong>{executiveReportData.photoCount}</strong></div>
            <div><span>Listas para aviso</span><strong>{executiveReportData.printedReadyRecords}</strong></div>
            <div><span>Plazo crítico</span><strong>{alertRecords.length}</strong></div>
          </div>
        </article>

        <article className="executive-card">
          <div className="executive-card-head">
            <div>
              <p className="sheet-kicker">Campo</p>
              <h3>Jornadas realizadas</h3>
            </div>
          </div>
          <div className="executive-table-list">
            {(executiveReportData.fieldJourneyRows.length ? executiveReportData.fieldJourneyRows : [{ label: "Sin jornadas", points: 0, zones: 0, records: 0 }]).slice(0, 8).map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.points} pts · {item.zones} zonas · {item.records} fichas</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="executive-card">
          <div className="executive-card-head">
            <div>
              <p className="sheet-kicker">Responsables</p>
              <h3>Levantamiento por técnico</h3>
            </div>
          </div>
          <div className="executive-table-list">
            {(executiveReportData.fieldResponsibleRows.length ? executiveReportData.fieldResponsibleRows : [{ name: "Sin responsable", records: 0, withPhoto: 0 }]).map((item) => (
              <div key={item.name}>
                <span>{item.name}</span>
                <strong>{item.records} fichas · {item.withPhoto} fotos</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="executive-card">
          <div className="executive-card-head">
            <div>
              <p className="sheet-kicker">Geolocalización</p>
              <h3>Puntos por tipo</h3>
            </div>
          </div>
          <div className="executive-table-list">
            {(executiveReportData.mapTypeRows.length ? executiveReportData.mapTypeRows : [{ label: "Sin puntos", total: 0 }]).map((item) => (
              <div key={item.label}><span>{item.label}</span><strong>{item.total}</strong></div>
            ))}
          </div>
        </article>

        <article className="executive-card">
          <div className="executive-card-head">
            <div>
              <p className="sheet-kicker">Mapeo</p>
              <h3>Zonas principales</h3>
            </div>
          </div>
          <div className="executive-table-list">
            {(executiveReportData.mapZoneRows.length ? executiveReportData.mapZoneRows : [{ label: "Sin zonas", total: 0 }]).map((item) => (
              <div key={item.label}><span>{item.label}</span><strong>{item.total}</strong></div>
            ))}
          </div>
        </article>

        <article className="executive-card">
          <div className="executive-card-head">
            <div>
              <p className="sheet-kicker">Bitácora</p>
              <h3>Eventos principales</h3>
            </div>
          </div>
          <div className="executive-table-list">
            {(executiveReportData.auditRows.length ? executiveReportData.auditRows : [{ label: "Sin eventos", total: 0 }]).slice(0, 6).map((item) => (
              <div key={item.label}><span>{item.label}</span><strong>{item.total}</strong></div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
