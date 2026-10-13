import test from "node:test";
import assert from "node:assert/strict";
import { anotarFallaSinSenal, debeGuardarFalla, enviarFallasPendientes, fallasPendientes } from "./fallasPendientes.js";

const memoria = () => { const datos = new Map(); return { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, String(v)) }; };
const tecnico = { id: 5, role: "operator" };

test("solo se guardan acciones del equipo que intentaban guardar algo", () => {
  assert.equal(debeGuardarFalla({ metodo: "POST", ruta: "/entregas/lotes/4/cerrar", user: tecnico }), true);
  assert.equal(debeGuardarFalla({ metodo: "GET", ruta: "/entregas/lotes", user: tecnico }), false);
  assert.equal(debeGuardarFalla({ metodo: "POST", ruta: "/x", user: { id: 1, role: "admin" } }), false);
  assert.equal(debeGuardarFalla({ metodo: "POST", ruta: "/x", user: { id: 2, role: "gerente" } }), false);
  assert.equal(debeGuardarFalla({ metodo: "POST", ruta: "/fallas", user: tecnico }), false);
});

test("la misma acción sin señal se cuenta una vez con sus repeticiones", () => {
  const storage = memoria();
  const ahora = Date.parse("2026-10-13T15:00:00Z");
  anotarFallaSinSenal(tecnico, { metodo: "post", ruta: "/entregas/lotes/4/cerrar?x=1" }, { storage, ahora });
  anotarFallaSinSenal(tecnico, { metodo: "POST", ruta: "/entregas/lotes/4/cerrar" }, { storage, ahora: ahora + 60000 });
  anotarFallaSinSenal(tecnico, { metodo: "POST", ruta: "/map-points" }, { storage, ahora });
  const lista = fallasPendientes(5, storage);
  assert.equal(lista.length, 2);
  assert.equal(lista[0].veces, 2);
  assert.equal(lista[0].ruta, "/entregas/lotes/4/cerrar");
});

test("al volver la señal se envían y salen de la cola solo si el servidor las recibió", async () => {
  const storage = memoria();
  anotarFallaSinSenal(tecnico, { metodo: "POST", ruta: "/map-points" }, { storage });
  assert.equal(await enviarFallasPendientes(5, async () => false, storage), 0);
  assert.equal(fallasPendientes(5, storage).length, 1);
  let enviado = null;
  assert.equal(await enviarFallasPendientes(5, async (lote) => { enviado = lote; return true; }, storage), 1);
  assert.equal(enviado[0].ruta, "/map-points");
  assert.equal(fallasPendientes(5, storage).length, 0);
});
