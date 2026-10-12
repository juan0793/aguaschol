import assert from "node:assert/strict";
import test from "node:test";
import { normalizeUserRole } from "./userRoles.js";
import { createUser, updateUserRole } from "../services/userService.js";

test("acepta gerente y conserva los cuatro perfiles anteriores", () => {
  for (const role of ["admin", "operator", "transport", "validadora_campo", "gerente"]) {
    assert.equal(normalizeUserRole(role), role);
    assert.equal(normalizeUserRole(` ${role} `), role);
  }
});

test("rechaza perfiles desconocidos, vacíos y valores de otro tipo", () => {
  for (const role of ["gerencia", "ADMIN", "", " ", null, undefined, 1, ["admin"], { role: "admin" }]) {
    assert.throws(() => normalizeUserRole(role), (error) => error.status === 400);
  }
});

test("crear y cambiar perfiles inválidos falla antes de acceder a la base", async () => {
  await assert.rejects(
    createUser({ full_name: "Prueba", email: "prueba@example.test", role: "desconocido" }, { id: 1 }),
    (error) => error.status === 400
  );
  await assert.rejects(updateUserRole(2, undefined, { id: 1 }), (error) => error.status === 400);
});
