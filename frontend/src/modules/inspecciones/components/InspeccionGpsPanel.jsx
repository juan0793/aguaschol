import { useState } from "react";
import { Icon } from "../../../components/Icon";
import { formatDateTime } from "../utils/inspeccionesFormatters";

const TIPOS_PUNTO = [
  ["inicio", "Inicio / punto de inspección"],
  ["observado", "Punto observado"],
  ["derivacion", "Derivación o conexión adicional"],
  ["cierre", "Punto de cierre"]
];

export default function InspeccionGpsPanel({ api, inspeccionId, puntos = [], readOnly, onRegistered, notify }) {
  const [tipoPunto, setTipoPunto] = useState(TIPOS_PUNTO[0][0]);
  const [descripcion, setDescripcion] = useState("");
  const [capturing, setCapturing] = useState(false);

  const marcarPunto = () => {
    if (!navigator.geolocation) {
      notify("Este dispositivo no permite obtener la ubicación GPS.");
      return;
    }
    setCapturing(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await api.addGps(inspeccionId, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy_meters: position.coords.accuracy,
            tipo_punto: tipoPunto,
            descripcion
          });
          setDescripcion("");
          notify("Punto GPS registrado.");
          onRegistered();
        } catch (error) {
          notify(error.message);
        } finally {
          setCapturing(false);
        }
      },
      (geoError) => {
        notify(geoError.message || "No fue posible obtener tu ubicación.");
        setCapturing(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  return (
    <div className="ins-gps-panel">
      {!readOnly ? (
        <div className="ins-gps-form">
          <select value={tipoPunto} onChange={(event) => setTipoPunto(event.target.value)}>
            {TIPOS_PUNTO.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <input placeholder="Descripción opcional" value={descripcion} onChange={(event) => setDescripcion(event.target.value)} />
          <button type="button" className="cl-primary" onClick={marcarPunto} disabled={capturing}>
            <Icon name="map" />
            {capturing ? "Obteniendo ubicación…" : "Marcar punto GPS"}
          </button>
        </div>
      ) : null}
      <ul className="cl-history">
        {!puntos.length ? (
          <li className="is-empty">Sin puntos GPS registrados.</li>
        ) : (
          puntos.map((punto) => (
            <li key={punto.id}>
              <i />
              <div>
                <strong>{TIPOS_PUNTO.find(([key]) => key === punto.tipo_punto)?.[1] || punto.tipo_punto}</strong>
                <span>{punto.usuario_nombre || "—"} · {formatDateTime(punto.created_at)} · ±{punto.accuracy_meters ? Math.round(punto.accuracy_meters) : "?"} m</span>
                {punto.descripcion ? <small>{punto.descripcion}</small> : null}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
