import { PDFDocument, StandardFonts, rgb, degrees, LineCapStyle } from "pdf-lib";

// Genera un PDF vectorial: toma el plano base (PDF original o imagen) y le "estampa"
// encima los trazos del croquis (linea de division, poligonos, textos, puntos, tapados)
// en las mismas coordenadas donde se dibujaron en el editor.
//
// Mapeo de coordenadas:
//   El editor guarda los trazos en pixeles del render (background.width/height).
//   factor = anchoPDF_pts / anchoRender  ->  Xpdf = x * factor
//   El PDF tiene el origen abajo-izquierda, por eso Y se voltea: Ypdf = altoPDF - y * factor

const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const clamp01 = (value) => Math.min(1, Math.max(0, value));

const parseColor = (value, fallback = { r: 15, g: 23, b: 42 }) => {
  const fallbackColor = { color: rgb(fallback.r / 255, fallback.g / 255, fallback.b / 255), alpha: 1 };
  const raw = String(value ?? "").trim();
  if (!raw) return fallbackColor;

  let match = /^#([0-9a-f]{3})$/i.exec(raw);
  if (match) {
    const [r, g, b] = match[1].split("").map((char) => parseInt(char + char, 16));
    return { color: rgb(r / 255, g / 255, b / 255), alpha: 1 };
  }
  match = /^#([0-9a-f]{6})$/i.exec(raw);
  if (match) {
    const int = parseInt(match[1], 16);
    return { color: rgb(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255), alpha: 1 };
  }
  match = /^rgba?\(([^)]+)\)$/i.exec(raw);
  if (match) {
    const parts = match[1].split(",").map((part) => Number(part.trim()));
    if (parts.length >= 3 && parts.slice(0, 3).every((component) => Number.isFinite(component))) {
      const alpha = parts.length >= 4 && Number.isFinite(parts[3]) ? clamp01(parts[3]) : 1;
      return { color: rgb(clamp01(parts[0] / 255), clamp01(parts[1] / 255), clamp01(parts[2] / 255)), alpha };
    }
  }
  return fallbackColor;
};

// Helvetica usa codificacion WinAnsi (Latin-1). Reemplaza lo que no pueda representar
// para que drawText no falle; conserva acentos y signos del espanol (rango 0xA0-0xFF).
const sanitizeText = (value) => String(value ?? "").replace(/[^\t\n\r\x20-\x7E\xA0-\xFF]/g, "?");

// Misma escala de render que usa el editor para dibujar el fondo del PDF.
// Sirve de respaldo cuando no se pasa renderWidth (ej. al regenerar un mapa aprobado).
const scaleForWidth = (pageWidth) => Math.min(4, Math.max(2, 2800 / pageWidth));

const dataUrlToBytes = (dataUrl) => {
  const base64 = String(dataUrl).split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

export const buildCroquisPdf = async ({ pdfBytes, imageDataUrl, elements = [], layers = [], renderWidth, renderHeight }) => {
  let doc;
  let page;

  if (pdfBytes) {
    doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    page = doc.getPages()[0];
    if (!page) throw new Error("El PDF base no tiene paginas.");
  } else if (imageDataUrl) {
    doc = await PDFDocument.create();
    const bytes = dataUrlToBytes(imageDataUrl);
    const embedded = /^data:image\/png/i.test(imageDataUrl) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    page = doc.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
  } else {
    throw new Error("No hay plano base para generar el PDF.");
  }

  const { width, height } = page.getSize();
  let baseWidth = number(renderWidth, 0);
  if (!(baseWidth > 0)) baseWidth = pdfBytes ? width * scaleForWidth(width) : width;
  const factor = width / baseWidth;
  const toX = (value) => number(value) * factor;
  const toY = (value) => height - number(value) * factor;

  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  const layerMap = Object.fromEntries((layers || []).map((layer) => [layer.key, layer]));
  const layerFor = (key) => layerMap[key || "correcciones"] || { visible: true, opacity: 1 };

  const drawText = (text, { x, y, size, color, opacity, rotacion = 0 }) => {
    const clean = sanitizeText(text);
    if (!clean) return;
    page.drawText(clean, { x, y, size: Math.max(1, size), font, color, opacity, rotate: degrees(-number(rotacion)) });
  };

  for (const element of elements || []) {
    try {
      const data = element?.data_json || {};
      const layer = layerFor(data.capa);
      if (layer.visible === false) continue;
      const opacity = clamp01(number(layer.opacity, 1));
      const stroke = parseColor(data.color || data.colorBorde, { r: 15, g: 23, b: 42 });
      const tipo = element.tipo_elemento || element.tipo;
      const puntos = Array.isArray(data.puntos) ? data.puntos : [];

      if (tipo === "linea" && puntos.length >= 2) {
        const thickness = Math.max(0.4, number(data.grosor, 3) * factor);
        for (let index = 0; index < puntos.length - 1; index += 1) {
          page.drawLine({
            start: { x: toX(puntos[index].x), y: toY(puntos[index].y) },
            end: { x: toX(puntos[index + 1].x), y: toY(puntos[index + 1].y) },
            thickness,
            color: stroke.color,
            opacity,
            lineCap: LineCapStyle.Round
          });
        }
        continue;
      }

      if (tipo === "poligono" && puntos.length >= 3) {
        const thickness = Math.max(0.4, number(data.grosor, 2) * factor);
        const loop = [...puntos, puntos[0]];
        for (let index = 0; index < loop.length - 1; index += 1) {
          page.drawLine({
            start: { x: toX(loop[index].x), y: toY(loop[index].y) },
            end: { x: toX(loop[index + 1].x), y: toY(loop[index + 1].y) },
            thickness,
            color: stroke.color,
            opacity,
            lineCap: LineCapStyle.Round
          });
        }
        continue;
      }

      if (tipo === "punto") {
        page.drawCircle({
          x: toX(data.x),
          y: toY(data.y),
          size: Math.max(0.5, number(data.size, 12) * factor),
          color: stroke.color,
          opacity
        });
        if (data.descripcion) {
          const size = Math.max(1, 18 * factor);
          drawText(data.descripcion, {
            x: toX(number(data.x) + number(data.size, 12) + 6),
            y: toY(data.y) - size * 0.35,
            size,
            color: stroke.color,
            opacity
          });
        }
        continue;
      }

      if (tipo === "tapado") {
        const fill = parseColor(data.color || "#ffffff", { r: 255, g: 255, b: 255 });
        const rectHeight = number(data.height, 40);
        page.drawRectangle({
          x: toX(data.x),
          y: toY(number(data.y) + rectHeight),
          width: number(data.width, 80) * factor,
          height: rectHeight * factor,
          color: fill.color,
          opacity
        });
        continue;
      }

      // texto, codigo, observacion y cualquier otro elemento con contenido
      const content = data.contenido ?? data.descripcion;
      if (content != null && String(content).trim()) {
        const fontSize = number(data.fontSize, 22);
        drawText(content, {
          x: toX(data.x),
          y: toY(number(data.y) + fontSize),
          size: fontSize * factor,
          color: stroke.color,
          opacity,
          rotacion: data.rotacion
        });
      }
    } catch {
      // Un elemento con datos raros no debe tumbar toda la exportacion.
    }
  }

  return doc.save();
};
