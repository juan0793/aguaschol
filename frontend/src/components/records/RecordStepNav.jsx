import { Icon } from "../Icon";

const RecordStepNav = ({ sections, activeSection, onChange, onMove }) => {
  const currentIndex = Math.max(0, sections.findIndex((section) => section.key === activeSection));
  const previous = currentIndex > 0 ? sections[currentIndex - 1] : null;
  const next = currentIndex < sections.length - 1 ? sections[currentIndex + 1] : null;

  return (
    <div className="record-step-nav">
      <div className="record-step-nav-tabs" role="tablist" aria-label="Secciones de la ficha">
        {sections.map((section, index) => (
          <button
            key={section.key}
            type="button"
            role="tab"
            aria-selected={activeSection === section.key}
            className={activeSection === section.key ? "is-active" : ""}
            onClick={() => onChange(section.key)}
          >
            <span>{index + 1}</span>
            <strong>{section.label}</strong>
          </button>
        ))}
      </div>
      <div className="record-step-nav-flow">
        <button type="button" className="button-secondary" onClick={() => onMove(-1)} disabled={!previous}>
          <Icon name="arrowLeft" />
          {previous?.mobileLabel || "Inicio"}
        </button>
        <small>{next ? `Sigue: ${next.label}` : "Ultimo paso"}</small>
        <button type="button" className="button-secondary" onClick={() => onMove(1)} disabled={!next}>
          {next?.mobileLabel || "Listo"}
          <Icon name="arrowRight" />
        </button>
      </div>
    </div>
  );
};

export default RecordStepNav;
