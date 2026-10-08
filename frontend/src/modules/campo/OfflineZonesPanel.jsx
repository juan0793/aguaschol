import { useEffect, useRef, useState } from "react";
import { CloudDownload, Trash2, X } from "lucide-react";
import { POINT_TYPE_ORDER, getPointTypeStyle } from "./pointTypes";
import { PointGlyph } from "./PointGlyph";
import {
  buildTileTemplate,
  clearSavedMap,
  downloadZone,
  estimateMapStorage,
  listSavedZones,
  planZoneDownload,
  rememberZone
} from "./offlineTiles";

const formatMb = (bytes) => `${Math.max(0.1, bytes / (1024 * 1024)).toLocaleString("es-HN", { maximumFractionDigits: 1 })} MB`;
const formatDay = (iso) => new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const formatTileCount = (count) => `${count} ${count === 1 ? "cuadro del mapa" : "cuadros del mapa"}`;

// Panel de Zonas: leyenda de tipos y mapa sin señal. Solo baja la vista general de
// calles (zoom 14 a 16) por la política de uso de OpenStreetMap; el detalle que el
// técnico ya miró queda guardado solo.
export default function OfflineZonesPanel({ apiUrl, mapApi, onClose }) {
  const [zones, setZones] = useState(() => listSavedZones());
  const [plan, setPlan] = useState(null);
  const [progress, setProgress] = useState(null);
  const [storage, setStorage] = useState(null);
  const [message, setMessage] = useState("");
  const abortRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const bounds = mapApi?.getBounds?.();
    if (bounds) setPlan({ ...planZoneDownload(bounds), bounds });
    estimateMapStorage().then(setStorage);
    const handleKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      abortRef.current?.abort();
    };
  }, [mapApi, onClose]);

  const save = async () => {
    if (!plan || plan.tooLarge) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setMessage("");
    setProgress({ done: 0, failed: 0, total: plan.tiles.length });
    try {
      const result = await downloadZone({ template: buildTileTemplate(apiUrl), tiles: plan.tiles, signal: controller.signal, onProgress: setProgress });
      if (result.cancelled) {
        setMessage(result.done > result.failed
          ? "Descarga cancelada. Los cuadros del mapa que alcanzaron a bajar quedan guardados."
          : "Descarga cancelada. No se guardó ningún cuadro del mapa.");
      } else if (!result.total || result.failed >= result.total) {
        setMessage("No se pudo guardar la zona; no se descargó ningún cuadro del mapa.");
      } else {
        setZones(rememberZone({ savedAt: new Date().toISOString(), tiles: result.total - result.failed, bounds: plan.bounds }));
        setMessage(result.failed
          ? `Se guardaron ${formatTileCount(result.total - result.failed)}; no se pudieron descargar ${formatTileCount(result.failed)}. Vuelve a intentarlo con mejor señal.`
          : "Zona guardada. Ya puedes verla sin señal.");
      }
      estimateMapStorage().then(setStorage);
    } catch (error) {
      setMessage(error.message || "No se pudo guardar la zona.");
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  };

  const clearAll = async () => {
    await clearSavedMap();
    setZones([]);
    setMessage("Se borraron los mapas guardados en este celular.");
    estimateMapStorage().then(setStorage);
  };

  const percent = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;

  return (
    <section className="pg-zones" role="dialog" aria-modal="false" aria-labelledby="pg-zones-title">
      <header className="pg-zones-head">
        <h3 id="pg-zones-title">Zonas y leyenda</h3>
        <button ref={closeRef} type="button" className="pg-icon-button" onClick={onClose} aria-label="Cerrar zonas y leyenda"><X size={18} /></button>
      </header>

      <div className="pg-zones-block">
        <h4>Mapa sin señal</h4>
        <p>Guarda las calles de lo que ves en pantalla para abrirlas sin datos. El detalle que ya miraste también queda guardado.</p>
        {plan ? (
          plan.tooLarge ? (
            <p className="pg-note is-warn">La zona en pantalla es muy grande. Acércate a un barrio para guardarla.</p>
          ) : (
            <p className="pg-note">{formatTileCount(plan.tiles.length)}, unos {formatMb(plan.estimatedBytes)}. Mejor con Wi‑Fi.</p>
          )
        ) : null}
        {progress ? (
          <div className="pg-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Guardando zona">
            <span style={{ transform: `scaleX(${percent / 100})` }} />
            <small>{progress.done} de {progress.total}</small>
          </div>
        ) : null}
        <div className="pg-zones-actions">
          {progress ? (
            <button type="button" className="pg-button" onClick={() => abortRef.current?.abort()}>Cancelar</button>
          ) : (
            <button type="button" className="pg-button is-primary" onClick={save} disabled={!plan || plan.tooLarge}>
              <CloudDownload size={18} />Guardar esta zona
            </button>
          )}
        </div>
        {message ? <p className="pg-note" role="status">{message}</p> : null}
        {zones.length ? (
          <ul className="pg-zone-list">
            {zones.map((zone) => (
              <li key={zone.savedAt}><span>Zona del {formatDay(zone.savedAt)}</span><small>{formatTileCount(zone.tiles)}</small></li>
            ))}
          </ul>
        ) : null}
        <div className="pg-zones-foot">
          {storage ? <small>Usado en este celular: {formatMb(storage.usage)}</small> : <span />}
          <button type="button" className="pg-link-button" onClick={clearAll}><Trash2 size={15} />Borrar mapas guardados</button>
        </div>
      </div>

      <div className="pg-zones-block">
        <h4>Tipos de punto</h4>
        <ul className="pg-legend">
          {POINT_TYPE_ORDER.map((type) => (
            <li key={type}><PointGlyph type={type} size={20} />{getPointTypeStyle(type).label}</li>
          ))}
          <li><PointGlyph type="caja_registro" size={20} pending />Por enviar (guardado en el celular)</li>
        </ul>
      </div>
    </section>
  );
}
