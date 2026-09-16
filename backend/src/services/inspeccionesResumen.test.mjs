import test from "node:test";
import assert from "node:assert/strict";
import {
  __seedMemoryInspeccionesForTests,
  __seedMemoryUsersForTests,
  changeEstado,
  createInspeccion,
  getResumenInspecciones
} from "./inspeccionesService.js";

const admin = { id: 1, role: "admin", full_name: "Administradora" };
const elmer = { id: 2, role: "operator", full_name: "Elmer Díaz" };
const ana = { id: 3, role: "validadora_campo", full_name: "Ana López" };

__seedMemoryUsersForTests([admin, elmer, ana]);

// 16 sep 2026, 12:00 en Honduras.
const NOW = new Date("2026-09-16T18:00:00.000Z");

const legacy = (id, overrides) => ({
  id,
  numero_inspeccion: `INS-2026-${String(id).padStart(5, "0")}`,
  clave_catastral: "00-00-00-00",
  inspeccion_general: 1,
  abonado_numero: "",
  abonado_nombre_snapshot: "ADOLFO FLORES GOMEZ",
  barrio_snapshot: "Centro",
  direccion_snapshot: "Centro",
  motivo: "Posible irregularidad",
  trabajo_solicitado: "Verificar.",
  informacion_encontrada: "",
  observaciones: "",
  estado: "ASIGNADA",
  requiere_seguimiento: 0,
  seguimiento_detalle: "",
  seguimiento_fecha_sugerida: null,
  tecnico_responsable_id: elmer.id,
  creada_por_usuario_id: admin.id,
  finalizada_por_usuario_id: null,
  fecha_inicio: null,
  fecha_finalizacion: null,
  ...overrides,
  updated_at: overrides.created_at
});

__seedMemoryInspeccionesForTests({
  inspecciones: [
    // Asignada el 11 sep: 5 dias de antiguedad.
    legacy(8001, { fecha_asignacion: "2026-09-11T15:00:00.000Z", created_at: "2026-09-11T15:00:00.000Z" }),
    // Asignada el 14 sep a las 23:30 de Honduras (15 sep UTC): cuenta como 14 sep, 2 dias.
    legacy(8002, { tecnico_responsable_id: ana.id, fecha_asignacion: "2026-09-15T05:30:00.000Z", created_at: "2026-09-15T05:30:00.000Z" }),
    // Creada y finalizada en septiembre.
    legacy(8003, { estado: "FINALIZADA", fecha_asignacion: "2026-09-02T15:00:00.000Z", created_at: "2026-09-02T15:00:00.000Z", fecha_finalizacion: "2026-09-03T15:00:00.000Z" }),
    // Creada en agosto, finalizada en agosto: solo suma al mes anterior.
    legacy(8004, { estado: "FINALIZADA", fecha_asignacion: "2026-08-20T15:00:00.000Z", created_at: "2026-08-20T15:00:00.000Z", fecha_finalizacion: "2026-08-21T15:00:00.000Z" }),
    // Creada en agosto y en seguimiento hoy.
    legacy(8005, { estado: "SEGUIMIENTO", fecha_asignacion: "2026-08-25T15:00:00.000Z", created_at: "2026-08-25T15:00:00.000Z" })
  ],
  participantes: [
    { id: 8101, inspeccion_id: 8001, tecnico_id: elmer.id, rol: "RESPONSABLE", created_at: "2026-09-11T15:00:00.000Z", removed_at: null },
    { id: 8102, inspeccion_id: 8002, tecnico_id: ana.id, rol: "RESPONSABLE", created_at: "2026-09-15T05:30:00.000Z", removed_at: null }
  ]
});

test("el resumen separa conteos actuales de los del mes seleccionado", async () => {
  const resumen = await getResumenInspecciones(admin, { now: NOW });
  assert.equal(resumen.mes, "2026-09");
  assert.equal(resumen.mes_anterior, "2026-08");
  assert.deepEqual(resumen.rango, { desde: "2026-09-01", hasta: "2026-09-16" });
  assert.equal(resumen.asignadas, 2);
  assert.equal(resumen.seguimiento, 1);
  assert.equal(resumen.finalizadas_mes, 1);
  assert.equal(resumen.finalizadas_mes_anterior, 1);
  assert.equal(resumen.creadas_mes, 3);
  assert.equal(resumen.creadas_finalizadas, 1);
  assert.deepEqual(resumen.distribucion_creadas, { ASIGNADA: 2, EN_PROCESO: 0, SEGUIMIENTO: 0, FINALIZADA: 1 });

  const agosto = await getResumenInspecciones(admin, { mes: "2026-08", now: NOW });
  assert.equal(agosto.asignadas, 2, "los conteos actuales no dependen del mes");
  assert.equal(agosto.finalizadas_mes, 1);
  assert.deepEqual(agosto.rango, { desde: "2026-08-01", hasta: "2026-08-31" });
});

test("la bandeja excluye finalizadas, ordena de la mas antigua y calcula dias en hora de Honduras", async () => {
  const { bandeja, mas_antigua_asignada_dias } = await getResumenInspecciones(admin, { now: NOW });
  assert.deepEqual(bandeja.map((item) => item.id), [8005, 8001, 8002]);
  assert.deepEqual(bandeja.map((item) => item.antiguedad_dias), [22, 5, 2]);
  assert.equal(mas_antigua_asignada_dias, 5);
});

test("un mes invalido o futuro vuelve al mes actual", async () => {
  assert.equal((await getResumenInspecciones(admin, { mes: "2026-13", now: NOW })).mes, "2026-09");
  assert.equal((await getResumenInspecciones(admin, { mes: "2026-10", now: NOW })).mes, "2026-09");
});

test("carga por tecnico solo para administracion y el tecnico ve solo lo suyo", async () => {
  const deAdmin = await getResumenInspecciones(admin, { now: NOW });
  assert.deepEqual(deAdmin.carga_tecnicos.map((item) => [item.nombre, item.activas]), [["Elmer Díaz", 2], ["Ana López", 1]]);

  const deAna = await getResumenInspecciones(ana, { now: NOW });
  assert.deepEqual(deAna.carga_tecnicos, []);
  assert.deepEqual(deAna.bandeja.map((item) => item.id), [8002]);
});

test("la antiguedad cuenta desde la entrada al estado actual y la actividad trae los ultimos cambios", async () => {
  const creada = await createInspeccion(
    { clave_catastral: "00-00-00-00", inspeccion_general: true, motivo: "Verificación de conexión", trabajo_solicitado: "Revisar.", tecnico_responsable_id: elmer.id },
    admin
  );
  await changeEstado(creada.id, { estado: "EN_PROCESO" }, elmer);

  const now = new Date();
  const resumen = await getResumenInspecciones(admin, { now });
  const fila = resumen.bandeja.find((item) => item.id === creada.id);
  assert.equal(fila.estado, "EN_PROCESO");
  assert.equal(fila.antiguedad_dias, 0);
  assert.deepEqual(resumen.actividad.slice(0, 2).map((item) => item.estado_nuevo), ["EN_PROCESO", "ASIGNADA"]);
  assert.equal(resumen.actividad[0].numero_inspeccion, creada.numero_inspeccion);
  assert.ok(resumen.actividad.length <= 5);
});
