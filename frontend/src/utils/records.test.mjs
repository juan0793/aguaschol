import assert from "node:assert/strict";
import test from "node:test";
import { getRecordDeadlineMeta, getRecordListRows } from "./records.js";

test("prepara solamente nombre, clave y barrio para la lista imprimible", () => {
  assert.deepEqual(
    getRecordListRows([
      { inquilino: "Ana Perez", clave_catastral: "11-14-17", barrio_colonia: "Suyapa" },
      { abonado: "Luis Lopez", clave_catastral: "18-09-18" }
    ]),
    [
      { number: 1, name: "Ana Perez", clave: "11-14-17", barrio: "Suyapa" },
      { number: 2, name: "Luis Lopez", clave: "18-09-18", barrio: "Sin barrio" }
    ]
  );
});

test("muestra la fecha limite calculada", () => {
  const meta = getRecordDeadlineMeta(
    { created_at: "2026-06-10T12:00:00", estado_padron: "clandestino" },
    new Date("2026-06-29T12:00:00")
  );

  assert.equal(meta.deadlineLabel, "19 de junio de 2026");
});
