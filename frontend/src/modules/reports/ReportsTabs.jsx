const tabs = [["overview", "Resumen"], ["records", "Registros"], ["debt", "Mora"], ["regulator", "Ente regulador"]];
export default function ReportsTabs({ active, onChange }) {
  return <nav className="reports-tabs" role="tablist" aria-label="Secciones de reportes">{tabs.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={active === key} className={active === key ? "is-active" : ""} onClick={() => onChange(key)}>{label}</button>)}</nav>;
}
