import { Icon } from "../../../components/Icon";
import { printStatusLabel } from "../utils/inspeccionesFormatters";

// La columna de impresión repetía "NO IMPRESA" en mayúsculas dos veces por fila
// y pesaba más que el dato de la inspección. El ícono distingue impreso de
// pendiente y el estado en palabras queda en el nombre accesible.
export default function PrintBadge({ etiqueta, estado }) {
  const impreso = Boolean(estado?.impreso);
  return (
    <span
      className={`cl-print-state ${impreso ? "is-printed" : ""}`}
      title={`${etiqueta}: ${printStatusLabel(estado).toLowerCase()}`}
    >
      <Icon name={impreso ? "success" : "print"} />
      <span className="ins-print-label">{etiqueta}</span>
      <span className="ins-sr">{printStatusLabel(estado).toLowerCase()}</span>
    </span>
  );
}
