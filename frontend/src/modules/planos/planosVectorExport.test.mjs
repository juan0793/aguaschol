import test from "node:test";
import assert from "node:assert/strict";
import { buildCroquisSvg } from "./planosVectorExport.js";

test("croquis export keeps editable geometry as SVG vectors", () => {
  const svg = buildCroquisSvg({
    width: 800,
    height: 600,
    backgroundDataUrl: "data:image/png;base64,abc",
    layers: [{ key: "correcciones", visible: true, opacity: 1 }, { key: "oculta", visible: false, opacity: 1 }],
    elements: [
      { tipo_elemento: "linea", data_json: { capa: "correcciones", puntos: [{ x: 10, y: 20 }, { x: 30, y: 40 }], color: "#123456", grosor: 4 } },
      { tipo_elemento: "texto", data_json: { capa: "correcciones", x: 50, y: 60, contenido: "A&B <1>" } },
      { tipo_elemento: "linea", data_json: { capa: "oculta", puntos: [{ x: 1, y: 2 }, { x: 3, y: 4 }] } }
    ]
  });

  assert.match(svg, /<polyline points="10,20 30,40"/);
  assert.match(svg, /<image href="data:image\/png;base64,abc"/);
  assert.match(svg, /A&amp;B &lt;1&gt;/);
  assert.doesNotMatch(svg, /points="1,2 3,4"/);
});
