import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Icon } from "./Icon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { escapeHtml } from "../utils/html";
import { printDocument } from "../utils/printDocument";

const MAP_LAYERS = {
  imagery: { label: "Satelite", attribution: "Esri, Maxar, Earthstar Geographics" },
  streets: { label: "Calles", attribution: "OpenStreetMap contributors" },
  relief: { label: "Relieve", attribution: "Esri, USGS, NOAA" }
};

const validPoints = (points) =>
  points.filter((point) => Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude)));

function MapPrintDialog({ apiUrl, dateLabel, open, onOpenChange, points }) {
  const printAreaRef = useRef(null);
  const mapRef = useRef(null);
  const baseLayerRef = useRef(null);
  const labelLayerRef = useRef(null);
  const markerLayerRef = useRef(null);
  const [title, setTitle] = useState("Mapa de puntos GPS");
  const [layer, setLayer] = useState("imagery");
  const [markerSize, setMarkerSize] = useState(18);
  const [outlineWidth, setOutlineWidth] = useState(4);
  const [outlineColor, setOutlineColor] = useState("#ffffff");
  const [showNumbers, setShowNumbers] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [mapNode, setMapNode] = useState(null);
  const printablePoints = useMemo(() => validPoints(points), [points]);

  useEffect(() => {
    if (!open || !mapNode || mapRef.current) return undefined;

    const map = L.map(mapNode, {
      center: printablePoints.length
        ? [Number(printablePoints[0].latitude), Number(printablePoints[0].longitude)]
        : [13.3017, -87.1889],
      zoom: printablePoints.length ? 17 : 14,
      maxZoom: 21,
      zoomControl: true,
      preferCanvas: false,
      fadeAnimation: false,
      zoomAnimation: false
    });
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    if (printablePoints.length > 1) {
      map.fitBounds(
        L.latLngBounds(printablePoints.map((point) => [Number(point.latitude), Number(point.longitude)])),
        { padding: [52, 52], maxZoom: 19 }
      );
    }

    const resizeTimer = window.setTimeout(() => map.invalidateSize(false), 120);
    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
      baseLayerRef.current = null;
      labelLayerRef.current = null;
      markerLayerRef.current = null;
    };
  }, [mapNode, open, printablePoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    baseLayerRef.current?.remove();
    labelLayerRef.current?.remove();
    const tileUrl = `${apiUrl}/map-tiles/{z}/{x}/{y}.png?layer=${encodeURIComponent(layer)}`;
    baseLayerRef.current = L.tileLayer(tileUrl, {
      attribution: MAP_LAYERS[layer].attribution,
      crossOrigin: true,
      maxNativeZoom: 19,
      maxZoom: 21
    }).addTo(map);

    if (layer === "imagery" || layer === "relief") {
      labelLayerRef.current = L.tileLayer(`${apiUrl}/map-tiles/{z}/{x}/{y}.png?layer=labels`, {
        attribution: "Esri",
        crossOrigin: true,
        maxNativeZoom: 19,
        maxZoom: 21,
        pane: "overlayPane"
      }).addTo(map);
    }
  }, [apiUrl, layer, mapNode, open]);

  useEffect(() => {
    const markerLayer = markerLayerRef.current;
    if (!markerLayer) return;
    markerLayer.clearLayers();

    printablePoints.forEach((point, index) => {
      const size = markerSize;
      const color = point.marker_color || "#1576d1";
      const marker = L.marker([Number(point.latitude), Number(point.longitude)], {
        icon: L.divIcon({
          className: "map-print-marker-shell",
          html: `<span class="map-print-marker" style="--marker-size:${size}px;--marker-color:${color};--outline-color:${outlineColor};--outline-width:${outlineWidth}px">${showNumbers ? index + 1 : ""}</span>`,
          iconSize: [size + outlineWidth * 2, size + outlineWidth * 2],
          iconAnchor: [(size + outlineWidth * 2) / 2, (size + outlineWidth * 2) / 2]
        }),
        keyboard: false
      });
      marker.addTo(markerLayer);
    });
  }, [mapNode, markerSize, outlineColor, outlineWidth, printablePoints, showNumbers]);

  const handlePrint = async () => {
    if (!printAreaRef.current || printing) return;
    setPrinting(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      mapRef.current?.invalidateSize(false);
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      const canvas = await html2canvas(printAreaRef.current, {
        backgroundColor: "#ffffff",
        logging: false,
        scale: Math.min(2, window.devicePixelRatio || 1),
        useCORS: true
      });
      const image = canvas.toDataURL("image/jpeg", 0.94);
      await printDocument(title || "Mapa de puntos GPS", `
        <section style="display:grid;gap:10px;">
          <header style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;border-bottom:2px solid #0d4d86;padding-bottom:8px;">
            <div>
              <p style="margin:0 0 4px;color:#1576d1;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;">Levantamiento GPS</p>
              <h1 style="margin:0;color:#123b5d;font-size:20px;">${escapeHtml(title || "Mapa de puntos GPS")}</h1>
            </div>
            <div style="text-align:right;color:#45607a;font-size:10px;">
              <strong style="display:block;color:#123b5d;">${printablePoints.length} puntos</strong>
              <span>${escapeHtml(dateLabel)}</span>
            </div>
          </header>
          <img src="${image}" alt="Mapa de puntos GPS" style="display:block;width:100%;max-height:174mm;object-fit:contain;border:1px solid #bfd5e7;border-radius:10px;" />
          <p style="margin:0;color:#587087;font-size:9px;">Capa: ${escapeHtml(MAP_LAYERS[layer].label)}. La numeracion corresponde al orden de los puntos de la jornada.</p>
        </section>
      `, { bodyClassName: "map-print-document", showPageFooter: false });
    } catch {
      window.alert("No fue posible preparar el mapa para impresion. Espera a que cargue la capa y vuelve a intentar.");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !printing && onOpenChange(nextOpen)}>
      <DialogContent className="map-print-dialog shadcn-print-dialog sm:max-w-none" showCloseButton={!printing}>
        <DialogHeader className="map-print-dialog-header">
          <div>
            <DialogTitle>Mapa e impresion</DialogTitle>
            <DialogDescription>Edita la presentacion, encuadra los puntos y revisa el resultado antes de imprimir.</DialogDescription>
          </div>
          <span className="panel-pill">{printablePoints.length} puntos</span>
        </DialogHeader>

        <div className="map-print-layout">
          <aside className="map-print-settings" aria-label="Opciones de impresion del mapa">
            <label>
              <span>Titulo</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength="100" />
            </label>

            <fieldset>
              <legend>Capa del mapa</legend>
              <div className="map-print-layer-options">
                {Object.entries(MAP_LAYERS).map(([value, option]) => (
                  <button
                    key={value}
                    type="button"
                    className={layer === value ? "is-active" : ""}
                    onClick={() => setLayer(value)}
                  >
                    {option.label}
                    {value === "imagery" ? <small>Recomendada</small> : null}
                  </button>
                ))}
              </div>
            </fieldset>

            <label>
              <span>Tamano de puntos <strong>{markerSize}px</strong></span>
              <input type="range" min="12" max="30" value={markerSize} onChange={(event) => setMarkerSize(Number(event.target.value))} />
            </label>

            <label>
              <span>Grosor del remarcado <strong>{outlineWidth}px</strong></span>
              <input type="range" min="0" max="8" value={outlineWidth} onChange={(event) => setOutlineWidth(Number(event.target.value))} />
            </label>

            <label className="map-print-color-field">
              <span>Color del remarcado</span>
              <input type="color" value={outlineColor} onChange={(event) => setOutlineColor(event.target.value)} />
            </label>

            <label className="map-print-check-field">
              <input type="checkbox" checked={showNumbers} onChange={(event) => setShowNumbers(event.target.checked)} />
              <span>Numerar los puntos</span>
            </label>

            <p className="map-print-help">Puedes mover y acercar el mapa directamente para definir el encuadre que saldra impreso.</p>
          </aside>

          <section ref={printAreaRef} className="map-print-sheet">
            <header>
              <div>
                <span>Levantamiento GPS</span>
                <h2>{title || "Mapa de puntos GPS"}</h2>
              </div>
              <div className="map-print-sheet-meta">
                <strong>{printablePoints.length} puntos</strong>
                <span>{dateLabel}</span>
              </div>
            </header>
            <div ref={setMapNode} className="map-print-canvas" />
            <footer>
              <span>Capa: {MAP_LAYERS[layer].label}</span>
              <span>Mapa preparado para impresion</span>
            </footer>
          </section>
        </div>

        <div className="map-print-actions">
          <button type="button" className="button-secondary" onClick={() => onOpenChange(false)} disabled={printing}>Cancelar</button>
          <button type="button" onClick={handlePrint} disabled={printing || !printablePoints.length}>
            <Icon name="print" />
            {printing ? "Preparando..." : "Vista previa e imprimir"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MapPrintDialog;
