import assert from "node:assert/strict";
import test from "node:test";
import { buildAvisoHtml } from "./avisoTemplate.js";

test("el aviso usa las fechas y el texto editado sin inyectar HTML", () => {
  const html = buildAvisoHtml({
    clave_catastral: "10-22-23",
    barrio_colonia: "San Juan Bosco",
    fecha_aviso: "2026-08-03",
    fecha_limite_aviso: "2026-08-20",
    aviso_destinatario: "Ana <script>alert(1)</script>",
    aviso_instrucciones: "Presentar originales\nPreguntar por Catastro",
    firmante_aviso: "María Berríos",
    cargo_firmante: "Jefa de Facturación"
  });

  assert.match(html, /20 de agosto de 2026/);
  assert.match(html, /Presentar originales<br \/>Preguntar por Catastro/);
  assert.match(html, /Ana &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});
