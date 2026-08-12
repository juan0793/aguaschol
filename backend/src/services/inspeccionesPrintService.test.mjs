import test from "node:test";
import assert from "node:assert/strict";
import { __seedMemoryUsersForTests, createInspeccion } from "./inspeccionesService.js";
import { attachPrintStatus, getPrintData, registerPrintEvent } from "./inspeccionesPrintService.js";

const admin = { id: 1, role: "admin", full_name: "Administradora" };
const responsable = { id: 2, role: "operator", full_name: "Carlos Hernández" };
const otroTecnico = { id: 5, role: "operator", full_name: "Ana López" };

__seedMemoryUsersForTests([admin, responsable, otroTecnico]);

const crearInspeccion = () =>
  createInspeccion(
    {
      clave_catastral: "00-00-00-00",
      inspeccion_general: true,
      motivo: "Verificación de conexión",
      trabajo_solicitado: "Verificar acometida y medidor.",
      tecnico_responsable_id: responsable.id
    },
    admin
  );

test("el estado de impresión inicia en NO_IMPRESO para ambos documentos", async () => {
  const inspeccion = await crearInspeccion();
  const data = await getPrintData(inspeccion.id, "orden", admin);
  assert.equal(data.print_status.ORDEN.impreso, false);
  assert.equal(data.print_status.REPORTE.impreso, false);
});

test("un tercero sin participacion no puede consultar los datos de impresión", async () => {
  const inspeccion = await crearInspeccion();
  await assert.rejects(() => getPrintData(inspeccion.id, "orden", otroTecnico), (error) => error.status === 403);
});

test("imprimir una segunda vez queda registrado como REIMPRESO, no bloquea la accion", async () => {
  const inspeccion = await crearInspeccion();
  const first = await registerPrintEvent(inspeccion.id, { tipo_documento: "orden", accion: "impreso" }, admin);
  assert.equal(first.accion, "IMPRESO");
  const second = await registerPrintEvent(inspeccion.id, { tipo_documento: "orden", accion: "impreso" }, admin);
  assert.equal(second.accion, "REIMPRESO");
  const status = await getPrintData(inspeccion.id, "orden", admin);
  assert.equal(status.print_status.ORDEN.impreso, true);
  assert.equal(status.print_status.ORDEN.total_impresiones, 2);
});

test("attachPrintStatus enriquece un listado sin romper campos existentes", async () => {
  const inspeccion = await crearInspeccion();
  await registerPrintEvent(inspeccion.id, { tipo_documento: "reporte", accion: "impreso" }, admin);
  const [enriched] = await attachPrintStatus([{ id: inspeccion.id, numero_inspeccion: inspeccion.numero_inspeccion }]);
  assert.equal(enriched.print_status.REPORTE.impreso, true);
  assert.equal(enriched.print_status.ORDEN.impreso, false);
  assert.equal(enriched.numero_inspeccion, inspeccion.numero_inspeccion);
});
