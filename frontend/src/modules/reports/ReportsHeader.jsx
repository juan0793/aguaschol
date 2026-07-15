import { useState } from "react";
import { Icon } from "../../components/Icon";

export default function ReportsHeader({ activeLabel, activeTotal, days, onSelectDay, onOpenAllDays, loading, onRefresh, onPreview, onGenerate, onSettings }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const recent = days.filter((day) => String(day.key).includes(query.trim())).slice(0, 5);
  return (
    <header className="reports-header reports-glass">
      <div className="reports-heading"><span>Control de campo</span><h1>Reportes de levantamiento</h1><p>Consulta jornadas, verifica datos y genera documentos institucionales.</p></div>
      <div className="report-day-combobox">
        <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <Icon name="records" /><span><small>Jornada</small><strong>{activeLabel} · {activeTotal} puntos</strong></span><b>⌄</b>
        </button>
        {open ? <div className="report-day-popover reports-glass"><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por fecha..." autoFocus />
          <span>Recientes</span>{recent.map((day) => <button type="button" key={day.key} onClick={() => { onSelectDay(day.key); setOpen(false); }}><strong>{day.label}</strong><small>{day.total} puntos</small></button>)}
          <button type="button" className="report-day-all" onClick={() => { setOpen(false); onOpenAllDays(); }}>Ver todas las jornadas</button></div> : null}
      </div>
      <div className="reports-status"><span className={loading ? "is-loading" : "is-ready"}>{loading ? "Actualizando" : "Listo para generar"}</span></div>
      <div className="reports-header-actions">
        <button type="button" className="button-secondary" onClick={onRefresh} disabled={loading}><Icon name="refresh" />Actualizar</button>
        <button type="button" className="button-secondary" onClick={onSettings} aria-label="Configurar reporte"><Icon name="auth" />Configurar</button>
        <button type="button" className="button-secondary" onClick={onPreview}><Icon name="search" />Vista previa</button>
        <button type="button" onClick={onGenerate}><Icon name="records" />Generar documento</button>
      </div>
    </header>
  );
}
