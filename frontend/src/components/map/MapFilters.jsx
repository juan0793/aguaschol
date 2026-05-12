import { MAP_POINT_TYPES } from "../../constants/formsAndUi";

function MapFilters({ isOpen, value, onChange, onClose }) {
  if (!isOpen) return null;

  return (
    <section className="field-map-filter-panel">
      <div>
        <strong>Filtros</strong>
        <button type="button" onClick={onClose}>Cerrar</button>
      </div>
      <label>
        <span>Tipo de punto</span>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Todos</option>
          {MAP_POINT_TYPES.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
    </section>
  );
}

export default MapFilters;
