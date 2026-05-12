import { formatCoordinate, getMapPointTypeLabel } from "../../utils/mapField";
import { Icon } from "../Icon";

function MarkerPopup({
  point,
  recordMeta,
  onCreateNotice,
  onEditLocation,
  onOpenRecord
}) {
  if (!point) return null;

  const title = recordMeta?.name || point.reference_note || point.description || getMapPointTypeLabel(point.point_type);
  const status = recordMeta?.status || getMapPointTypeLabel(point.point_type);

  return (
    <div className="field-map-marker-detail">
      <div className="field-map-marker-head">
        <div>
          <span>{recordMeta?.clave || "Sin clave vinculada"}</span>
          <h3>{title}</h3>
        </div>
        <strong>{status}</strong>
      </div>
      <div className="field-map-marker-grid">
        <span>Lat {formatCoordinate(point.latitude)}</span>
        <span>Lng {formatCoordinate(point.longitude)}</span>
        <span>{point.accuracy_meters ? `Precision ${point.accuracy_meters} m` : "Sin precision"}</span>
      </div>
      <div className="field-map-marker-actions">
        <button type="button" className="button-secondary" onClick={onOpenRecord}>
          <Icon name="records" />
          Ver ficha
        </button>
        <button type="button" className="button-secondary" onClick={onCreateNotice}>
          <Icon name="activity" />
          Crear aviso
        </button>
        <button type="button" onClick={onEditLocation}>
          <Icon name="map" />
          Editar ubicacion
        </button>
      </div>
    </div>
  );
}

export default MarkerPopup;
