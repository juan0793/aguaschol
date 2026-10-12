import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { once } from "node:events";
import { requireManagerAccess } from "../middleware/managerAccess.js";
import inspeccionesRoutes from "../routes/inspeccionesRoutes.js";
import entregasRoutes from "../routes/entregasRoutes.js";
import planosRoutes from "../routes/planosRoutes.js";
import clandestinosRoutes from "../routes/clandestinosRoutes.js";
import {
  __seedMemoryUsersForTests, createInspeccion, getInspeccionDetail, listInspecciones,
  getInspeccionesConfig, updateInspeccion, changeEstado, finalizarInspeccion, addGps
} from "./inspeccionesService.js";
import { getInspeccionesStats } from "./inspeccionesStatsService.js";
import { getClandestinosConfig } from "./clandestinosService.js";
import { updateLote, cerrarLote, createNoEntregadas, updateNoEntregada, registrarIntento } from "./entregasService.js";
import { generarReporteSemanal } from "./entregasReportService.js";
import {
  createPlanoBarrio, savePlanoDraft, reviewPlanoVersion, listPlanosBarrios,
  listPlanoVersions, listPlanoElements, savePlanoFinalPdf
} from "./planosService.js";
import { createMapPoint } from "./mapPointService.js";
import { validateFieldPoint } from "./fieldValidationService.js";
import { getGisPermissions } from "../modules/gis/gis.validation.js";

const admin = { id: 1, role: "admin", full_name: "Administración" };
const tecnico = { id: 2, role: "operator", full_name: "Técnico" };
const gerente = { id: 99, role: "gerente", full_name: "Gerencia" };
let inspeccion;

test("Gerencia ve una inspección ajena y estadísticas generales sin recibir permisos de escritura", async () => {
  __seedMemoryUsersForTests([admin, tecnico, gerente]);
  inspeccion = await createInspeccion({ clave_catastral: "00-00-00-00", inspeccion_general: true, motivo: "Verificación", trabajo_solicitado: "Verificar", tecnico_responsable_id: tecnico.id }, admin);
  assert.equal((await getInspeccionDetail(inspeccion.id, gerente)).id, inspeccion.id);
  assert.equal((await listInspecciones({}, gerente)).total, 1);
  const stats = await getInspeccionesStats({}, gerente);
  assert.equal(stats.resumen.total_inspecciones, 1);
  const permissions = getInspeccionesConfig(gerente).permissions;
  assert.equal(permissions.can_view_stats, true);
  assert.equal(permissions.can_create, false);
  assert.equal(permissions.can_manage, false);
  assert.ok(Object.values(getClandestinosConfig(gerente).permissions).every((value) => value === false));
  assert.deepEqual(getGisPermissions(gerente), ["read"]);
});

test("tener una asignación previa no permite a Gerencia modificar la inspección", async () => {
  const gerenteAsignado = { ...tecnico, role: "gerente" };
  for (const operation of [
    () => updateInspeccion(inspeccion.id, { informacion_encontrada: "Cambio" }, gerenteAsignado),
    () => changeEstado(inspeccion.id, { estado: "EN_PROCESO" }, gerenteAsignado),
    () => finalizarInspeccion(inspeccion.id, {}, gerenteAsignado),
    () => addGps(inspeccion.id, { latitude: 13.3, longitude: -87.2 }, gerenteAsignado)
  ]) await assert.rejects(operation, (error) => error.status === 403);
  assert.equal((await getInspeccionDetail(inspeccion.id, admin)).estado, "ASIGNADA");
});

test("los servicios rechazan escrituras gerenciales antes de tocar base, estados o archivos", async () => {
  for (const operation of [
    () => updateLote(1, {}, gerente), () => cerrarLote(1, {}, gerente),
    () => createNoEntregadas(1, {}, gerente), () => updateNoEntregada(1, {}, gerente),
    () => registrarIntento(1, {}, gerente), () => generarReporteSemanal({}, gerente),
    () => createMapPoint({}, gerente), () => validateFieldPoint(1, {}, gerente),
    () => savePlanoFinalPdf(1, { buffer: Buffer.from("archivo") }, gerente)
  ]) await assert.rejects(operation, (error) => error.status === 403);
});

test("Gerencia obtiene la versión autorizada aunque exista un borrador posterior", async () => {
  const barrio = await createPlanoBarrio({ codigo_barrio: "98", nombre_barrio: "Prueba permisos" }, "", admin);
  const original = [{ tipo_elemento: "texto", data_json: { x: 1, y: 2, texto: "Autorizado" } }];
  const aprobado = await savePlanoDraft(barrio.id, original, admin);
  await reviewPlanoVersion(aprobado.version.id, "aprobar", {}, admin);
  const borrador = await savePlanoDraft(barrio.id, [{ tipo_elemento: "texto", data_json: { x: 4, y: 5, texto: "Privado" } }], admin);
  assert.notEqual(aprobado.version.id, borrador.version.id);
  assert.deepEqual((await listPlanoVersions(barrio.id, gerente)).map((v) => v.id), [aprobado.version.id]);
  const visible = await listPlanoElements(barrio.id, gerente);
  assert.equal(visible.version.id, aprobado.version.id);
  assert.equal(visible.elements[0].data_json.texto, "Autorizado");
  assert.equal((await listPlanosBarrios(gerente)).find((b) => b.id === barrio.id).latest_version_id, aprobado.version.id);
  await assert.rejects(() => listPlanoElements(barrio.id, gerente, borrador.version.id), (e) => e.status === 403);
  await assert.rejects(() => savePlanoDraft(barrio.id, original, gerente), (e) => e.status === 403);
  assert.equal((await listPlanoElements(barrio.id, admin)).version.id, borrador.version.id);
});

test("HTTP con rol autenticado: lectura permitida y escritura bloqueada antes de handlers y uploads", async (t) => {
  const app = express();
  app.use(express.json());
  // La autenticación se sustituye aquí; se prueban la política y los routers reales.
  app.use((req, _res, next) => { req.authUser = gerente; next(); });
  for (const [base, router] of [["/api/inspecciones", inspeccionesRoutes], ["/api/entregas", entregasRoutes], ["/api/planos", planosRoutes], ["/api/clandestinos", clandestinosRoutes]]) {
    app.use(base, requireManagerAccess, router);
  }
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const read = await fetch(`${base}/api/inspecciones/${inspeccion.id}`);
  assert.equal(read.status, 200);
  assert.equal(read.headers.get("cache-control"), "private, no-store");
  assert.equal((await fetch(`${base}/api/inspecciones/stats`)).status, 200);
  for (const [method, path] of [
    ["PATCH", `/api/inspecciones/${inspeccion.id}`],
    ["POST", `/api/inspecciones/${inspeccion.id}/print-events`],
    ["POST", "/api/entregas/reportes/semanales"], ["POST", "/api/entregas/ciclos/cerrar"],
    ["POST", "/api/planos/barrios"], ["POST", "/api/clandestinos/banco/importar"],
    ["POST", "/api/clandestinos/fichas/avisos-impresos"]
  ]) {
    const response = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(response.status, 403, `${method} ${path}`);
  }
  assert.equal((await getInspeccionDetail(inspeccion.id, admin)).estado, "ASIGNADA");
});
