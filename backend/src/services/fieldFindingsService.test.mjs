import test from "node:test";
import assert from "node:assert/strict";
import { candidatoDesdeHallazgo, clasificarHallazgos } from "./fieldFindingsService.js";

const cuenta = (clave, extra = {}) => ({ clave_catastral: clave, clave_base: clave.split("-").slice(0, 3).join("-"), abonado: extra.abonado || clave, inquilino: "TITULAR", agua: "S", alcantarillado: "N", total: 0, barrio_colonia: "BO. PRUEBA", ...extra });
const porBase = new Map([
  ["10-01-01", [cuenta("10-01-01-01", { alcantarillado: "S", total: 350 })]],
  ["10-01-02", [cuenta("10-01-02-01", { alcantarillado: "N" }), cuenta("10-01-02-02", { alcantarillado: "N", total: 90 })]],
  ["10-01-03", [cuenta("10-01-03-01", { alcantarillado: "S" })]],
  ["10-01-04", [cuenta("10-01-04-01", { alcantarillado: "N", total: 0 })]]
]);
const punto = (id, texto, tipo = "caja_registro") => ({ id, point_type: tipo, reference_note: texto, description: "", latitude: 13.3, longitude: -87.19 });

test("cada predio cae en una sola categoría, de la más accionable a la menos", () => {
  const resultado = clasificarHallazgos([
    punto(1, "10-01-09 casa sin cuenta"),
    punto(2, "10-01-02-02"),
    punto(3, "10-01-02 segunda caja"),
    punto(4, "10-01-01"),
    punto(5, "10-01-03"),
    punto(6, "10-01-04", "negocio_local_comercial"),
    punto(7, "sin clave anotada")
  ], porBase, new Map(), [{ codigo: "10", barrio: "Barrio San Juan Bosco" }]);
  const por = Object.fromEntries(resultado.items.map((item) => [item.base, item]));
  assert.equal(por["10-01-09"].categoria, "sin_cuenta");
  // Caja de registro en un predio cuyas cuentas no pagan alcantarillado.
  assert.equal(por["10-01-02"].categoria, "sin_facturar");
  assert.deepEqual(por["10-01-02"].puntos, [2, 3]);
  assert.equal(por["10-01-02"].clave, "10-01-02-02");
  assert.equal(por["10-01-01"].categoria, "con_mora");
  assert.equal(por["10-01-03"].categoria, "al_dia");
  // Un negocio no prueba alcantarillado: sin deuda queda al día.
  assert.equal(por["10-01-04"].categoria, "al_dia");
  assert.equal(por["10-01-09"].barrio, "10 - Barrio San Juan Bosco");
  assert.deepEqual(resultado.conteo, { sin_cuenta: 1, sin_facturar: 1, con_mora: 1, al_dia: 2, sin_clave: 1 });
  assert.equal(resultado.totales.mora, 350);
  assert.equal(resultado.totales.cuentas_sin_alcantarillado, 2);
  assert.equal(resultado.items[0].categoria, "sin_cuenta");
});

test("lo que ya está en el banco o tiene ficha no se propone como nuevo", () => {
  const resultado = clasificarHallazgos([punto(1, "10-01-09"), punto(2, "10-01-08")], porBase, new Map([["10-01-08", { banco: "pendiente" }]]));
  assert.equal(resultado.totales.nuevos_para_banco, 1);
  assert.deepEqual(resultado.items.find((item) => item.base === "10-01-08").seguimiento, { banco: "pendiente" });
});

test("el candidato del banco lleva la clave, los puntos y el alcantarillado observado", () => {
  const [item] = clasificarHallazgos([punto(41, "10-01-09-03 local nuevo")], porBase, new Map(), [{ codigo: "10", barrio: "Barrio San Juan Bosco" }]).items;
  const candidato = candidatoDesdeHallazgo(item);
  assert.equal(candidato.origen_ref, "10-01-09");
  assert.equal(candidato.clave_catastral, "10-01-09-03");
  assert.equal(candidato.alcantarillado, 1);
  assert.match(candidato.comentario_campo, /#41/);
  assert.equal(candidato.barrio_colonia, "Barrio San Juan Bosco");
});
