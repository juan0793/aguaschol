import test from "node:test";
import assert from "node:assert/strict";
import { AJUSTES_DEFECTO, getAjustes, getAnalistaDatos, updateAjustes } from "./clandestinosAjustesService.js";
import { createInmueble } from "./inmuebleService.js";

const admin = { id: 1, role: "admin" };

test("el analista de datos tiene un valor por defecto y solo administración lo cambia", async () => {
  assert.equal(await getAnalistaDatos(), AJUSTES_DEFECTO.analista_datos);
  await assert.rejects(() => updateAjustes({ analista_datos: "Otra persona" }, { id: 2, role: "operator" }), (error) => error.status === 403);
  await assert.rejects(() => updateAjustes({ desconocido: "x" }, admin), (error) => error.status === 400);
  const ajustes = await updateAjustes({ analista_datos: "  Lic. Ana Martínez  " }, admin);
  assert.equal(ajustes.analista_datos, "Lic. Ana Martínez");
  assert.equal((await getAjustes()).analista_datos, "Lic. Ana Martínez");
});

test("una ficha nueva sin analista lleva el configurado; si trae uno, se respeta", async () => {
  await updateAjustes({ analista_datos: "Lic. Ana Martínez" }, admin);
  const sin = await createInmueble({ clave_catastral: "996-01-01", barrio_colonia: "Barrio prueba" });
  assert.equal(sin.analista_datos, "Lic. Ana Martínez");
  const con = await createInmueble({ clave_catastral: "996-01-02", barrio_colonia: "Barrio prueba", analista_datos: "Ing. Otro" });
  assert.equal(con.analista_datos, "Ing. Otro");
});
