const escapeXml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const buildCroquisSvg = ({ width, height, backgroundDataUrl = "", elements = [], layers = [] }) => {
  const layerMap = Object.fromEntries(layers.map((layer) => [layer.key, layer]));
  const baseLayer = layerMap.plano_base || { visible: true, opacity: 1 };
  const body = elements.flatMap((element) => {
    const data = element.data_json || {};
    const layer = layerMap[data.capa || "correcciones"] || { visible: true, opacity: 1 };
    if (!layer.visible) return [];
    const opacity = number(layer.opacity, 1);
    const color = escapeXml(data.color || data.colorBorde || "#0f172a");
    const points = (data.puntos || []).map((point) => `${number(point.x)},${number(point.y)}`).join(" ");

    if (element.tipo_elemento === "linea" && points) {
      return [`<polyline points="${points}" fill="none" stroke="${color}" stroke-width="${number(data.grosor, 3)}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`];
    }
    if (element.tipo_elemento === "poligono" && points) {
      return [`<polygon points="${points}" fill="${escapeXml(data.relleno || "rgba(21,118,209,0.12)")}" stroke="${color}" stroke-width="${number(data.grosor, 2)}" stroke-linejoin="round" opacity="${opacity}"/>`];
    }
    if (element.tipo_elemento === "punto") {
      const x = number(data.x);
      const y = number(data.y);
      const label = data.descripcion ? `<text x="${x + number(data.size, 12) + 6}" y="${y + 5}" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="${color}">${escapeXml(data.descripcion)}</text>` : "";
      return [`<g opacity="${opacity}"><circle cx="${x}" cy="${y}" r="${number(data.size, 12)}" fill="${color}"/>${label}</g>`];
    }
    if (element.tipo_elemento === "tapado") {
      return [`<rect x="${number(data.x)}" y="${number(data.y)}" width="${number(data.width, 80)}" height="${number(data.height, 40)}" fill="${escapeXml(data.color || "#ffffff")}" opacity="${opacity}"/>`];
    }
    const x = number(data.x);
    const y = number(data.y);
    const rotation = number(data.rotacion);
    return [`<text x="${x}" y="${y + number(data.fontSize, 22)}" transform="rotate(${rotation} ${x} ${y})" font-family="Arial, sans-serif" font-size="${number(data.fontSize, 22)}" font-weight="800" fill="${color}" opacity="${opacity}">${escapeXml(data.contenido || "")}</text>`];
  }).join("");

  const background = backgroundDataUrl && baseLayer.visible
    ? `<image href="${escapeXml(backgroundDataUrl)}" width="${number(width, 1000)}" height="${number(height, 700)}" opacity="${number(baseLayer.opacity, 1)}"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${number(width, 1000)}" height="${number(height, 700)}" viewBox="0 0 ${number(width, 1000)} ${number(height, 700)}">${background}${body}</svg>`;
};
