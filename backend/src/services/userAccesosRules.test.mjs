import test from "node:test";
import assert from "node:assert/strict";
import { ACCESOS, accesoVigente, normalizarAcceso } from "./userAccesosRules.js";

const hoy = "2026-11-18";

test("normalizarAcceso valida clave, perfil, alcance y fecha", () => {
  assert.deepEqual(normalizarAcceso({ clave: "entregas.prioridad", role: "validadora_campo" }, { hoy }), { clave: "entregas.prioridad", alcance: "todos", vence: null });
  assert.deepEqual(
    normalizarAcceso({ clave: "entregas.prioridad", role: "validadora_campo", alcance: "propios", vence: "2026-11-30" }, { hoy }),
    { clave: "entregas.prioridad", alcance: "propios", vence: "2026-11-30" }
  );
  assert.throws(() => normalizarAcceso({ clave: "otra.cosa", role: "validadora_campo" }, { hoy }), /no existe/);
  assert.throws(() => normalizarAcceso({ clave: "entregas.prioridad", role: "admin" }, { hoy }), /ya tiene/);
  assert.throws(() => normalizarAcceso({ clave: "entregas.prioridad", role: "operator" }, { hoy }), /ya tiene/);
  assert.throws(() => normalizarAcceso({ clave: "entregas.prioridad", role: "validadora_campo", alcance: "medio" }, { hoy }), /alcance/);
  assert.throws(() => normalizarAcceso({ clave: "entregas.prioridad", role: "validadora_campo", vence: "2026-11-17" }, { hoy }), /ya pasó/);
  assert.throws(() => normalizarAcceso({ clave: "entregas.prioridad", role: "validadora_campo", vence: "2028-01-01" }, { hoy }), /un año/);
  assert.throws(() => normalizarAcceso({ clave: "entregas.prioridad", role: "validadora_campo", vence: "30/11/2026" }, { hoy }), /no es válida/);
});

test("accesoVigente respeta el vencimiento y el perfil", () => {
  const fila = { acceso: "entregas.prioridad", vence: "2026-11-18" };
  assert.equal(accesoVigente(fila, { hoy, role: "validadora_campo" }), true);
  assert.equal(accesoVigente(fila, { hoy: "2026-11-19", role: "validadora_campo" }), false);
  assert.equal(accesoVigente({ acceso: "entregas.prioridad", vence: null }, { hoy, role: "validadora_campo" }), true);
  // Si al usuario le cambian el perfil a uno que ya no lo recibe, el acceso queda sin efecto.
  assert.equal(accesoVigente(fila, { hoy, role: "admin" }), false);
  assert.equal(accesoVigente({ acceso: "borrado" }, { hoy }), false);
  assert.ok(ACCESOS.every((item) => item.alcances.length && item.perfiles.length));
});
