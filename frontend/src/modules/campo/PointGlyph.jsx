import { pointShapeSvg } from "./pointTypes";

// Forma del tipo de punto, la misma del mapa. El SVG sale de constantes propias.
export function PointGlyph({ type, size = 18, pending = false }) {
  return (
    <span
      className="pg-glyph"
      aria-hidden="true"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: pointShapeSvg(type, { size, pending }) }}
    />
  );
}
