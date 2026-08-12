import { useState } from "react";
import { Icon } from "../../components/Icon";
import PageHeader from "../../components/ds/PageHeader";

export default function ReportsHeader({ activeLabel, activeTotal, days, onSelectDay, onOpenAllDays, loading, onRefresh, onPreview, onGenerate, onSettings }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const recent = days.filter((day) => String(day.key).includes(query.trim())).slice(0, 5);
  return (
    <PageHeader
      kicker="Control de campo"
      title="Reportes de levantamiento"
      description="Consulta jornadas, verifica datos y genera documentos institucionales."
      meta={
        <>
          <div className="report-day-combobox">
            <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
              <Icon name="records" /><span><small>Jornada</small><strong>{activeLabel} · {activeTotal} puntos</strong></span><b>⌄</b>
            </button>
            {open ? <div className="report-day-popover">
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por fecha..." autoFocus />
              <span>Recientes</span>
              {recent.map((day) => <button type="button" key={day.key} onClick={() => { onSelectDay(day.key); setOpen(false); }}><strong>{day.label}</strong><small>{day.total} puntos</small></button>)}
              <button type="button" className="report-day-all" onClick={() => { setOpen(false); onOpenAllDays(); }}>Ver todas las jornadas</button>
            </div> : null}
          </div>
          <span className={`ds-badge ${loading ? "is-warning" : "is-success is-live"}`}><span className="ds-badge-dot" />{loading ? "Actualizando" : "Listo para generar"}</span>
        </>
      }
      secondaryActions={<>
        <button type="button" className="button-secondary" onClick={onRefresh} disabled={loading}><Icon name="refresh" className={loading ? "ds-icon-spin" : ""} />Actualizar</button>
        <button type="button" className="button-secondary" onClick={onSettings} aria-label="Configurar reporte"><Icon name="auth" />Configurar</button>
        <button type="button" className="button-secondary" onClick={onPreview}><Icon name="search" />Vista previa</button>
      </>}
      primaryAction={<button type="button" onClick={onGenerate}><Icon name="records" />Generar documento</button>}
    />
  );
}
