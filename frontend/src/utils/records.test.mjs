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

test("con aviso, el plazo de la ficha es el del aviso (aunque ya esté impresa)", () => {
  const viernes = new Date(2026, 9, 2, 10);
  const meta = getRecordDeadlineMeta({ created_at: "2026-09-01T10:00:00", estado_padron: "reportada", aviso_plazo_tipo: "horas", aviso_plazo_valor: 24, fecha_limite_aviso: "2026-10-05" }, viernes);
  assert.equal(meta.source, "aviso");
  assert.equal(meta.statusKey, "warning");
  assert.equal(meta.helper, "Aviso: 1 dia habil restante");
  assert.equal(getRecordDeadlineMeta({ aviso_plazo_tipo: "dias", fecha_limite_aviso: "2026-10-02", created_at: "2026-09-01" }, viernes).statusKey, "due");
  assert.equal(getRecordDeadlineMeta({ aviso_plazo_tipo: "dias", fecha_limite_aviso: "2026-10-01", created_at: "2026-09-01" }, viernes).statusKey, "overdue");
});

test("sin aviso, o con la ficha cerrada, sigue el plazo de levantamiento", () => {
  const viernes = new Date(2026, 9, 2, 10);
  assert.equal(getRecordDeadlineMeta({ created_at: "2026-10-01T10:00:00" }, viernes).source, "levantamiento");
  assert.equal(getRecordDeadlineMeta({ created_at: "2026-10-01T10:00:00", estado_operativo: "regularized", aviso_plazo_tipo: "dias", fecha_limite_aviso: "2026-10-05" }, viernes).source, "levantamiento");
  assert.equal(getRecordDeadlineMeta({ created_at: "2026-10-01T10:00:00", estado_padron: "reportada" }, viernes), null);
});
