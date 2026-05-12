import { Icon } from "../Icon";

function MapSearchBar({ value, onChange }) {
  return (
    <label className="field-map-search">
      <Icon name="search" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar clave, colonia o referencia"
        inputMode="search"
      />
    </label>
  );
}

export default MapSearchBar;
