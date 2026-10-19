// Mapa de la zona trabajada para el informe en PDF. Encuadra los puntos, pinta el
// mapa base de OpenStreetMap (los mismos mosaicos y la misma caché que Puntos GPS) y
// dibuja cada punto con la figura y el color de su tipo. Si no hay red ni mosaicos
// guardados, igual dibuja los puntos sobre un fondo claro: se ve dónde se trabajó.
import { buildTileTemplate, loadTileBlob, tileUrl } from "../../campo/offlineTiles";
import { getPointTypeStyle, pointShapeSvg } from "../../campo/pointTypes";
import { ubicarEtiquetas } from "./etiquetasMapa";

const TILE = 256;
const ZOOM_MIN = 12;
const ZOOM_MAX = 18;
const ZOOM_ETIQUETAS = 20;

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
const elegirZoom = (puntos, ancho, alto, margen, zoomMax = ZOOM_MAX) => {
  for (let z = zoomMax; z >= ZOOM_MIN; z -= 1) {
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
 * @param {(punto) => string} [opciones.etiquetaDe]  número de cada punto (mapa de barrio): etiqueta del color de su tipo
 * @returns {Promise<string>} data URL JPEG, o "" si no hay puntos con coordenadas
 */
export async function dibujarMapaPuntos({ points = [], apiUrl = "", ancho = 1400, alto = 820, colorDe = null, etiquetaDe = null, calidad = 0.86 } = {}) {
  const puntos = points
    .map((punto) => ({ punto, lat: Number(punto.latitude), lng: Number(punto.longitude) }))
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng) && Math.abs(item.lat) <= 85);
  if (!puntos.length || typeof document === "undefined") return "";

  const margen = 70;
  // El mapa de barrio se acerca hasta zoom 20 para separar casa por casa: el servidor
  // de mosaicos llega a 18 y lo que pase de ahí se dibuja ampliado.
  const z = elegirZoom(puntos, ancho, alto, margen, etiquetaDe ? ZOOM_ETIQUETAS : ZOOM_MAX);
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
  const zMosaico = Math.min(z, ZOOM_MAX);
  const lado = TILE * 2 ** (z - zMosaico);
  const maximo = 2 ** zMosaico;
  const pedidos = [];
  for (let tx = Math.floor(izquierda / lado); tx <= Math.floor((izquierda + ancho) / lado); tx += 1) {
    for (let ty = Math.floor(arriba / lado); ty <= Math.floor((arriba + alto) / lado); ty += 1) {
      if (ty < 0 || ty >= maximo) continue;
      const x = ((tx % maximo) + maximo) % maximo;
      pedidos.push(loadTileBlob(tileUrl(plantilla, { z: zMosaico, x, y: ty }))
        .then((blob) => createImageBitmap(blob))
        .then((bitmap) => { ctx.drawImage(bitmap, tx * lado - izquierda, ty * lado - arriba, lado, lado); bitmap.close?.(); return true; })
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

  if (etiquetaDe) dibujarEtiquetas(ctx, puntos.map((item) => ({ ...item, x: mundoX(item.lng, z) - izquierda, y: mundoY(item.lat, z) - arriba })), etiquetaDe, ancho, alto);

  // Puntos: figura del tipo (como en Puntos GPS) o círculo del color indicado.
  const figuras = new Map();
  const tamano = 44;
  for (const item of etiquetaDe ? [] : puntos) {
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

  return canvas.toDataURL("image/jpeg", calidad);
}

// Mapa de barrio: cada punto es una etiqueta con su número del informe, del color de su
// tipo. Si dos puntos quedan muy juntos, la etiqueta se corre y una línea la une al sitio
// exacto, marcado con un punto.
const ALTO_ETIQUETA = 34;
function dibujarEtiquetas(ctx, puntos, etiquetaDe, ancho, alto) {
  ctx.font = "700 21px Arial, sans-serif";
  const datos = puntos.map((item) => {
    const texto = String(etiquetaDe(item.punto) ?? "");
    return { ...item, texto, ancho: Math.max(ALTO_ETIQUETA, ctx.measureText(texto).width + 16) };
  });
  const lugares = ubicarEtiquetas(datos, { alto: ALTO_ETIQUETA, lienzoAncho: ancho, lienzoAlto: alto });

  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(22, 36, 47, 0.75)";
  datos.forEach((item, indice) => {
    const lugar = lugares[indice];
    if (!lugar.movida) return;
    ctx.beginPath();
    ctx.moveTo(item.x, item.y);
    ctx.lineTo(lugar.x, lugar.y);
    ctx.stroke();
  });
  datos.forEach((item, indice) => {
    if (!lugares[indice].movida) return;
    ctx.beginPath();
    ctx.arc(item.x, item.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = getPointTypeStyle(item.punto.point_type).color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  });

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  datos.forEach((item, indice) => {
    const { x, y } = lugares[indice];
    const izquierda = x - item.ancho / 2;
    const arriba = y - ALTO_ETIQUETA / 2;
    const radio = ALTO_ETIQUETA / 2;
    ctx.beginPath();
    ctx.moveTo(izquierda + radio, arriba);
    ctx.arcTo(izquierda + item.ancho, arriba, izquierda + item.ancho, arriba + ALTO_ETIQUETA, radio);
    ctx.arcTo(izquierda + item.ancho, arriba + ALTO_ETIQUETA, izquierda, arriba + ALTO_ETIQUETA, radio);
    ctx.arcTo(izquierda, arriba + ALTO_ETIQUETA, izquierda, arriba, radio);
    ctx.arcTo(izquierda, arriba, izquierda + item.ancho, arriba, radio);
    ctx.closePath();
    ctx.fillStyle = getPointTypeStyle(item.punto.point_type).color;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(item.texto, x, y + 1);
  });
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

export const COLORES_DIA = ["#1465d9", "#d59124", "#18a689", "#8a4fb8", "#c0392b", "#0f8a7e", "#64748b"];
