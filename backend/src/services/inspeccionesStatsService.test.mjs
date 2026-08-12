import test from "node:test";
import assert from "node:assert/strict";
import { __seedMemoryUsersForTests, createInspeccion, changeEstado, finalizarInspeccion } from "./inspeccionesService.js";
import { getInspeccionesStats } from "./inspeccionesStatsService.js";

const admin = { id: 1, role: "admin", full_name: "Administradora" };
const responsable = { id: 2, role: "operator", full_name: "Carlos Hernández" };
const otraResponsable = { id: 6, role: "validadora_campo", full_name: "María López" };

__seedMemoryUsersForTests([admin, responsable, otraResponsable]);

const crearInspeccion = (tecnicoId, motivo) =>
  createInspeccion(
    {
      clave_catastral: "00-00-00-00",
      inspeccion_general: true,
      motivo,
      trabajo_solicitado: "Verificar acometida y medidor.",
      tecnico_responsable_id: tecnicoId
    },
    admin
  );

test("solo administración puede consultar estadísticas", async () => {
  await assert.rejects(() => getInspeccionesStats({ agrupar: "tecnico" }, responsable), (error) => error.status === 403);
});

test("las estadísticas agrupan correctamente por técnico", async () => {
  const a = await crearInspeccion(responsable.id, "Verificación de conexión");
  await crearInspeccion(otraResponsable.id, "Posible irregularidad");
  await changeEstado(a.id, { estado: "EN_PROCESO" }, responsable);
  await finalizarInspeccion(a.id, {}, responsable);

  const stats = await getInspeccionesStats({ agrupar: "tecnico" }, admin);
  const fila = stats.rows.find((row) => row.key === responsable.full_name);
  assert.ok(fila);
  assert.equal(fila.FINALIZADA >= 1, true);
  assert.equal(stats.resumen.total_inspecciones >= 2, true);
});
