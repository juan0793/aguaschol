import test from "node:test";
import assert from "node:assert/strict";
import {
  __seedMemoryUsersForTests,
  addGps,
  addParticipante,
  changeEstado,
  createInspeccion,
  finalizarInspeccion,
  getInspeccionDetail,
  listInspecciones,
  listTecnicosElegibles,
  reasignarInspeccion,
  removeParticipante,
  updateInspeccion
} from "./inspeccionesService.js";

const admin = { id: 1, role: "admin", full_name: "Administradora" };
const responsable = { id: 2, role: "operator", full_name: "Carlos Hernández" };
const apoyo = { id: 3, role: "validadora_campo", full_name: "José Martínez" };
const transporte = { id: 4, role: "transport", full_name: "Repartidor" };
const otroTecnico = { id: 5, role: "operator", full_name: "Ana López" };

__seedMemoryUsersForTests([admin, responsable, apoyo, transporte, otroTecnico]);

const CLAVE_VALIDA = "00-00-00-00";

const crearInspeccionBase = (overrides = {}) =>
  createInspeccion(
    {
      clave_catastral: CLAVE_VALIDA,
      inspeccion_general: true,
      motivo: "Verificación de conexión",
      trabajo_solicitado: "Verificar acometida y medidor.",
      tecnico_responsable_id: responsable.id,
      ...overrides
    },
    admin
  );

test("solo administración puede crear inspecciones", async () => {
  await assert.rejects(
    () => crearInspeccionBase().then(() => createInspeccion({ clave_catastral: CLAVE_VALIDA, inspeccion_general: true, motivo: "x", trabajo_solicitado: "y", tecnico_responsable_id: responsable.id }, responsable)),
    (error) => error.status === 403
  );
});

test("el técnico de transporte no es elegible como responsable", async () => {
  await assert.rejects(
    () => createInspeccion({ clave_catastral: CLAVE_VALIDA, inspeccion_general: true, motivo: "x", trabajo_solicitado: "y", tecnico_responsable_id: transporte.id }, admin),
    (error) => error.status === 404
  );
});

test("crear una inspección genera numero unico, participante responsable e historial", async () => {
  const inspeccion = await crearInspeccionBase({ apoyos: [apoyo.id] });
  assert.match(inspeccion.numero_inspeccion, /^INS-\d{4}-\d{5}$/);
  assert.equal(inspeccion.estado, "ASIGNADA");
  assert.notEqual(inspeccion.barrio_snapshot, "");
  assert.equal(inspeccion.participantes.length, 2);
  assert.equal(inspeccion.participantes.some((item) => item.tecnico_id === responsable.id && item.rol === "RESPONSABLE"), true);
  assert.equal(inspeccion.participantes.some((item) => item.tecnico_id === apoyo.id && item.rol === "APOYO"), true);
});

test("un técnico que no participa no puede ver el detalle", async () => {
  const inspeccion = await crearInspeccionBase();
  await assert.rejects(() => getInspeccionDetail(inspeccion.id, otroTecnico), (error) => error.status === 403);
  const visible = await getInspeccionDetail(inspeccion.id, responsable);
  assert.equal(visible.id, inspeccion.id);
});

test("el backend rechaza saltos de estado fuera del flujo", async () => {
  const inspeccion = await crearInspeccionBase();
  await assert.rejects(() => changeEstado(inspeccion.id, { estado: "SEGUIMIENTO" }, responsable), (error) => error.status === 409);
});

test("un técnico de apoyo no puede cambiar el estado de la inspección", async () => {
  const inspeccion = await crearInspeccionBase({ apoyos: [apoyo.id] });
  await assert.rejects(() => changeEstado(inspeccion.id, { estado: "EN_PROCESO" }, apoyo), (error) => error.status === 403);
});

test("registrar informacion encontrada activa automaticamente EN_PROCESO", async () => {
  const inspeccion = await crearInspeccionBase();
  assert.equal(inspeccion.estado, "ASIGNADA");
  const updated = await updateInspeccion(inspeccion.id, { informacion_encontrada: "Se verificó la acometida y el medidor." }, responsable);
  assert.equal(updated.estado, "EN_PROCESO");
  assert.ok(updated.fecha_inicio);
});

test("un punto GPS queda ligado automaticamente al usuario autenticado, no al enviado por el frontend", async () => {
  const inspeccion = await crearInspeccionBase({ apoyos: [apoyo.id] });
  const punto = await addGps(inspeccion.id, { latitude: 13.301, longitude: -87.19, accuracy_meters: 5, usuario_id: 999 }, apoyo);
  assert.equal(punto.usuario_id, apoyo.id);
});

test("un técnico que no participa no puede registrar GPS", async () => {
  const inspeccion = await crearInspeccionBase();
  await assert.rejects(
    () => addGps(inspeccion.id, { latitude: 13.3, longitude: -87.19 }, otroTecnico),
    (error) => error.status === 403
  );
});

test("el responsable puede agregar apoyo y el apoyo obtiene acceso inmediato", async () => {
  const inspeccion = await crearInspeccionBase();
  await addParticipante(inspeccion.id, { tecnico_id: otroTecnico.id }, responsable);
  const visible = await getInspeccionDetail(inspeccion.id, otroTecnico);
  assert.equal(visible.participantes.some((item) => item.tecnico_id === otroTecnico.id), true);
});

test("no se puede quitar al responsable como apoyo; hay que reasignar", async () => {
  const inspeccion = await crearInspeccionBase();
  await assert.rejects(() => removeParticipante(inspeccion.id, responsable.id, admin), (error) => error.status === 400);
});

test("reasignar mueve al responsable anterior a apoyo y notifica al nuevo responsable", async () => {
  const inspeccion = await crearInspeccionBase();
  const reasignada = await reasignarInspeccion(inspeccion.id, { tecnico_responsable_id: otroTecnico.id }, admin);
  assert.equal(reasignada.tecnico_responsable_id, otroTecnico.id);
  const roles = Object.fromEntries(reasignada.participantes.map((item) => [item.tecnico_id, item.rol]));
  assert.equal(roles[otroTecnico.id], "RESPONSABLE");
  assert.equal(roles[responsable.id], "APOYO");
});

test("administrador o responsable pueden finalizar; un tercero no", async () => {
  const inspeccion = await crearInspeccionBase();
  await changeEstado(inspeccion.id, { estado: "EN_PROCESO" }, responsable);
  await assert.rejects(() => finalizarInspeccion(inspeccion.id, {}, otroTecnico), (error) => error.status === 403);
  const finalizada = await finalizarInspeccion(inspeccion.id, { requiere_seguimiento: true, seguimiento_detalle: "Revisar en próxima visita." }, responsable);
  assert.equal(finalizada.estado, "FINALIZADA");
  assert.equal(finalizada.finalizada_por_usuario_id, responsable.id);
  assert.equal(finalizada.requiere_seguimiento, true);
});

test("el responsable puede finalizar directamente una inspección asignada", async () => {
  const inspeccion = await crearInspeccionBase();
  const finalizada = await finalizarInspeccion(inspeccion.id, {
    requiere_seguimiento: true,
    seguimiento_detalle: "Volver la próxima semana."
  }, responsable);

  assert.equal(finalizada.estado, "FINALIZADA");
  assert.equal(finalizada.seguimiento_detalle, "Volver la próxima semana.");
  assert.ok(finalizada.fecha_inicio);
  assert.ok(finalizada.fecha_finalizacion);
});

test("una inspección finalizada no admite mas cambios de campo de un tecnico", async () => {
  const inspeccion = await crearInspeccionBase();
  await changeEstado(inspeccion.id, { estado: "EN_PROCESO" }, responsable);
  await finalizarInspeccion(inspeccion.id, {}, responsable);
  await assert.rejects(
    () => updateInspeccion(inspeccion.id, { observaciones: "tarde" }, responsable),
    (error) => error.status === 409
  );
});

test("listInspecciones pagina de a 10 por defecto y respeta el alcance por tecnico", async () => {
  for (let index = 0; index < 12; index += 1) {
    await crearInspeccionBase({ motivo: `Verificación ${index}` });
  }
  const pagina1 = await listInspecciones({ page: 1 }, admin);
  assert.equal(pagina1.limit, 10);
  assert.equal(pagina1.items.length, 10);
  assert.ok(pagina1.total >= 13);

  const sinTecnico = { id: 9, role: "operator", full_name: "Técnico sin asignaciones" };
  __seedMemoryUsersForTests([admin, responsable, apoyo, transporte, otroTecnico, sinTecnico]);
  const propias = await listInspecciones({ page: 1, limit: 5 }, responsable);
  const ajenas = await listInspecciones({ page: 1, limit: 5 }, sinTecnico);
  assert.ok(propias.total > 0);
  assert.equal(ajenas.total, 0);
});

test("listTecnicosElegibles excluye transporte y administracion", async () => {
  const tecnicos = await listTecnicosElegibles();
  const roles = tecnicos.map((item) => item.role);
  assert.equal(roles.includes("transport"), false);
  assert.equal(roles.includes("admin"), false);
  assert.equal(roles.every((role) => ["operator", "validadora_campo"].includes(role)), true);
});
