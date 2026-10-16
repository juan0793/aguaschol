// Mapa de la zona trabajada para el informe en PDF. Encuadra los puntos, pinta el
// mapa base de OpenStreetMap (los mismos mosaicos y la misma caché que Puntos GPS) y
// dibuja cada punto con la figura y el color de su tipo. Si no hay red ni mosaicos
// guardados, igual dibuja los puntos sobre un fondo claro: se ve dónde se trabajó.
import { buildTileTemplate, loadTileBlob, tileUrl } from "../../campo/offlineTiles";
import { pointShapeSvg } from "../../campo/pointTypes";

const TILE = 256;
const ZOOM_MIN = 12;
const ZOOM_MAX = 18;

const mundoX = (lng, z) => ((lng + 180) / 360) * TILE * 2 ** z;
const mundoY = (lat, z) => {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * TILE * 2 ** z;
};

const cargarImagen = (src) => new Promise((resolve, reject) => {
  const imagen = new Image();
  imagen.onload = () => resolve(imagen);
  imagen.onerror = reject;
  imagen.src = src;
});

const svgComoImagen = (svg) => cargarImagen(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);

// Zoom más cercano en el que todos los puntos caben con margen.
const elegirZoom = (puntos, ancho, alto, margen) => {
  for (let z = ZOOM_MAX; z >= ZOOM_MIN; z -= 1) {
    const xs = puntos.map((punto) => mundoX(punto.lng, z));
    const ys = puntos.map((punto) => mundoY(punto.lat, z));
    if (Math.max(...xs) - Math.min(...xs) <= ancho - margen * 2 && Math.max(...ys) - Math.min(...ys) <= alto - margen * 2) return z;
  }
  return ZOOM_MIN;
};

/**
 * @param {object} opciones
 * @param {object[]} opciones.points  puntos con latitude/longitude/point_type
 * @param {(punto) => string} [opciones.colorDe]  color fijo por punto (p. ej. por día); sin él, figura y color del tipo
 * @returns {Promise<string>} data URL JPEG, o "" si no hay puntos con coordenadas
 */
export async function dibujarMapaPuntos({ points = [], apiUrl = "", ancho = 1400, alto = 820, colorDe = null } = {}) {
  const puntos = points
    .map((punto) => ({ punto, lat: Number(punto.latitude), lng: Number(punto.longitude) }))
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng) && Math.abs(item.lat) <= 85);
  if (!puntos.length || typeof document === "undefined") return "";

  const margen = 70;
  const z = elegirZoom(puntos, ancho, alto, margen);
  const xs = puntos.map((item) => mundoX(item.lng, z));
  const ys = puntos.map((item) => mundoY(item.lat, z));
  const izquierda = (Math.min(...xs) + Math.max(...xs)) / 2 - ancho / 2;
  const arriba = (Math.min(...ys) + Math.max(...ys)) / 2 - alto / 2;

  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#eef3f8";
  ctx.fillRect(0, 0, ancho, alto);

  // Mapa base: los mosaicos que cubren el recuadro.
  const plantilla = buildTileTemplate(apiUrl);
  const maximo = 2 ** z;
  const pedidos = [];
  for (let tx = Math.floor(izquierda / TILE); tx <= Math.floor((izquierda + ancho) / TILE); tx += 1) {
    for (let ty = Math.floor(arriba / TILE); ty <= Math.floor((arriba + alto) / TILE); ty += 1) {
      if (ty < 0 || ty >= maximo) continue;
      const x = ((tx % maximo) + maximo) % maximo;
      pedidos.push(loadTileBlob(tileUrl(plantilla, { z, x, y: ty }))
        .then((blob) => createImageBitmap(blob))
        .then((bitmap) => { ctx.drawImage(bitmap, tx * TILE - izquierda, ty * TILE - arriba, TILE, TILE); bitmap.close?.(); return true; })
        .catch(() => false));
    }
  }
  const resultados = await Promise.all(pedidos);
  const sinFondo = !resultados.some(Boolean);
  if (!sinFondo) {
    // Velo suave: el mapa base queda de fondo y los puntos resaltan.
    ctx.fillStyle = "rgba(255, 255, 255, 0.38)";
    ctx.fillRect(0, 0, ancho, alto);
  }

  // Puntos: figura del tipo (como en Puntos GPS) o círculo del color indicado.
  const figuras = new Map();
  const tamano = 44;
  for (const item of puntos) {
    const x = mundoX(item.lng, z) - izquierda;
    const y = mundoY(item.lat, z) - arriba;
    const color = colorDe?.(item.punto);
    if (color) {
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      continue;
    }
    const tipo = item.punto.point_type || "punto";
    if (!figuras.has(tipo)) figuras.set(tipo, await svgComoImagen(pointShapeSvg(tipo, { size: tamano })).catch(() => null));
    const figura = figuras.get(tipo);
    if (figura) ctx.drawImage(figura, x - tamano / 2, y - tamano / 2, tamano, tamano);
  }

  // Atribución obligatoria de OpenStreetMap.
  const texto = sinFondo ? "Sin mapa base: sin conexión al guardar el informe" : "© OpenStreetMap";
  ctx.font = "600 18px Arial, sans-serif";
  const anchoTexto = ctx.measureText(texto).width;
  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
  ctx.fillRect(ancho - anchoTexto - 22, alto - 34, anchoTexto + 16, 26);
  ctx.fillStyle = "#3d4f61";
  ctx.fillText(texto, ancho - anchoTexto - 14, alto - 15);

  return canvas.toDataURL("image/jpeg", 0.86);
}

export const COLORES_DIA = ["#1465d9", "#d59124", "#18a689", "#8a4fb8", "#c0392b", "#0f8a7e", "#64748b"];
