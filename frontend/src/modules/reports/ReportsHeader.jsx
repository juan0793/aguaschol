import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon";

// Encabezado de Reportes de levantamiento: qué es la pantalla, qué jornada se
// está viendo y las acciones de documento. Todo en dos líneas compactas.
export default function ReportsHeader({ activeLabel, activeTotal, days, onSelectDay, onOpenAllDays, loading, onRefresh, onPreview, onGenerate, onSettings }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const recent = days.filter((day) => String(day.label || day.key).toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);

  return (
    <header className="rp-header">
      <div className="rp-header-top">
        <div className="rp-title">
          <span className="rp-kicker">Control de campo</span>
          <h1>Reportes de levantamiento</h1>
          <p>Lo que los técnicos levantaron con GPS: sus hallazgos y los documentos oficiales de cada jornada.</p>
        </div>
        <div className="rp-actions">
          <button type="button" className="rp-btn is-icon" onClick={onRefresh} disabled={loading} title="Volver a cargar los puntos" aria-label="Actualizar"><Icon name="refresh" className={loading ? "ds-icon-spin" : ""} /></button>
          <button type="button" className="rp-btn" onClick={onSettings}><Icon name="settings" />Configurar</button>
          <button type="button" className="rp-btn" onClick={onPreview}><Icon name="eye" />Vista previa</button>
          <button type="button" className="rp-btn is-primary" onClick={onGenerate}><Icon name="print" />Generar documento</button>
        </div>
      </div>
      <div className="rp-toolbar">
        <div className="rp-day" ref={rootRef}>
          <button type="button" className="rp-day-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            <Icon name="calendar" />
            <span className="rp-day-label">Jornada</span>
            <strong>{activeLabel}</strong>
            <span className="rp-day-count">{Number(activeTotal || 0).toLocaleString("es-HN")} puntos</span>
            <Icon name="chevronDown" className="rp-day-caret" />
          </button>
          {open ? <div className="rp-day-pop" role="listbox" aria-label="Jornadas">
            <label className="rp-day-search"><Icon name="search" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar jornada" autoFocus aria-label="Buscar jornada" /></label>
            {recent.map((day) => <button type="button" role="option" aria-selected={day.label === activeLabel} key={day.key} className={day.label === activeLabel ? "is-active" : ""} onClick={() => { onSelectDay(day.key); setOpen(false); }}><span>{day.label}</span><small>{day.total} puntos</small></button>)}
            {!recent.length ? <p className="rp-day-empty">Ninguna jornada coincide.</p> : null}
            <button type="button" className="rp-day-all" onClick={() => { setOpen(false); onOpenAllDays(); }}>Ver todas las jornadas<Icon name="arrowRight" /></button>
          </div> : null}
        </div>
        <span className={`rp-status ${loading ? "is-loading" : ""}`.trim()} role="status"><i aria-hidden="true" />{loading ? "Actualizando puntos…" : "Datos al día"}</span>
      </div>
    </header>
  );
}
