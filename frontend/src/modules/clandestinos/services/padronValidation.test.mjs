import assert from "node:assert/strict";
import { buildPadronValidation } from "./padronValidation.js";

const result = buildPadronValidation(
  { clave_catastral: "01-02-03", nombre_catastral: "", barrio_colonia: "", identidad: "" },
  { clave_catastral: "01-02-03", nombre: "Ana", caserio: "Centro", exists_in_aguas: false },
  null
);

assert.equal(result.estado_padron, "clandestino");
assert.equal(result.clave_alcaldia, "01-02-03");
assert.match(result.comentarios, /no en Aguas.*Posible clandestino/);

const byAbonado = buildPadronValidation(
  { clave_catastral: "", abonado: "123", nombre_catastral: "", inquilino: "", barrio_colonia: "", identidad: "" },
  null,
  { clave_catastral: "10-10-10-01", abonado: "123", nombre: "Carlos", barrio_colonia: "Centro", agua: "S", alcantarillado: "N", recoleccion: "S" }
);
assert.equal(byAbonado.clave_catastral, "10-10-10-01");
assert.equal(byAbonado.nombre_catastral, "Carlos");
assert.equal(byAbonado.conexion_agua, "Si");
assert.equal(byAbonado.estado_padron, "varios_padrones");
