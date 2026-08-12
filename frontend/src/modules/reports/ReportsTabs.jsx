import { Icon } from "../../components/Icon";

const tabs = [
  ["overview", "Resumen", "dashboard"],
  ["records", "Registros", "records"],
  ["debt", "Mora", "activity"],
  ["regulator", "Ente regulador", "auth"]
];

export default function ReportsTabs({ active, onChange }) {
  return (
    <nav className="reports-tabs" role="tablist" aria-label="Secciones de reportes">
      {tabs.map(([key, label, icon]) => (
        <button key={key} type="button" role="tab" aria-selected={active === key} className={active === key ? "is-active" : ""} onClick={() => onChange(key)}>
          <Icon name={icon} />{label}
        </button>
      ))}
    </nav>
  );
}
