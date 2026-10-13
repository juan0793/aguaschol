import assert from "node:assert/strict";
import test from "node:test";
import { accionDeRuta, debeRegistrar, normalizarRuta, tipoDeCodigo, validarFallasDispositivo } from "./fallasRules.js";

const tecnico = { id: 7, role: "operator" };

test("cada ruta se nombra como la acción que hacía la persona", () => {
  assert.equal(accionDeRuta("POST", "/entregas/lotes/41/cerrar"), "Cerrar lote #41");
  assert.equal(accionDeRuta("POST", "/api/inspecciones/28/finalizar"), "Finalizar inspección #28");
  assert.equal(accionDeRuta("POST", "/map-points?x=1"), "Guardar punto GPS");
  assert.equal(accionDeRuta("PATCH", "/api/inmuebles/12"), "Editar ficha #12");
  assert.equal(accionDeRuta("DELETE", "/api/planos/3"), "Eliminar en Planos");
  assert.equal(normalizarRuta("entregas/lotes/"), "/api/entregas/lotes");
  assert.equal(tipoDeCodigo(503), "error_servidor");
  assert.equal(tipoDeCodigo(404), "rechazada");
});

test("solo se anotan las fallas de quien no es administración", () => {
  assert.equal(debeRegistrar({ metodo: "POST", ruta: "/api/entregas/lotes/41/cerrar", codigo: 404, user: tecnico }), true);
  assert.equal(debeRegistrar({ metodo: "GET", ruta: "/api/entregas/lotes/41", codigo: 404, user: tecnico }), false, "una consulta sin resultado no es falla");
  assert.equal(debeRegistrar({ metodo: "GET", ruta: "/api/entregas/lotes", codigo: 500, user: tecnico }), true);
  assert.equal(debeRegistrar({ metodo: "POST", ruta: "/api/entregas/lotes", codigo: 401, user: tecnico }), false);
  assert.equal(debeRegistrar({ metodo: "POST", ruta: "/api/entregas/lotes", codigo: 409, user: { id: 1, role: "admin" } }), false);
  assert.equal(debeRegistrar({ metodo: "POST", ruta: "/api/entregas/lotes", codigo: 403, user: { id: 1, role: "gerente", preview: { original_role: "admin" } } }), false);
  assert.equal(debeRegistrar({ metodo: "POST", ruta: "/api/fallas", codigo: 400, user: tecnico }), false);
  assert.equal(debeRegistrar({ metodo: "POST", ruta: "/api/auth/change-password", codigo: 400, user: tecnico }), false);
  assert.equal(debeRegistrar({ metodo: "POST", ruta: "/api/entregas/lotes", codigo: 403, user: { id: 3, role: "gerente" } }), false, "Gerencia es de solo lectura");
  assert.equal(debeRegistrar({ metodo: "POST", ruta: "/api/entregas/lotes", codigo: 409, user: null }), false);
});

test("las fallas del teléfono se validan antes de guardarse", () => {
  const ahora = Date.parse("2026-10-13T15:00:00Z");
  const [falla] = validarFallasDispositivo({ fallas: [{ metodo: "post", ruta: "/entregas/lotes/41/cerrar", ocurrido_en: "2026-10-13T14:00:00Z", veces: 3, mensaje: "Failed to fetch" }] }, ahora);
  assert.deepEqual([falla.metodo, falla.ruta, falla.accion, falla.tipo, falla.veces], ["POST", "/api/entregas/lotes/41/cerrar", "Cerrar lote #41", "sin_conexion", 3]);
  for (const cuerpo of [{}, { fallas: [] }, { fallas: Array(51).fill({}) }, { fallas: [{ metodo: "GET", ruta: "/x", ocurrido_en: "2026-10-13T14:00:00Z" }] }, { fallas: [{ metodo: "POST", ruta: "/x", ocurrido_en: "2026-09-01T00:00:00Z" }] }, { fallas: [{ metodo: "POST", ruta: "/fallas", ocurrido_en: "2026-10-13T14:00:00Z" }] }]) {
    assert.throws(() => validarFallasDispositivo(cuerpo, ahora), (error) => error.status === 400);
  }
});
