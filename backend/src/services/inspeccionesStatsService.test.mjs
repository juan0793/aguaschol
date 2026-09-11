import test from "node:test";
import assert from "node:assert/strict";
import { __seedMemoryUsersForTests, __seedMemoryInspeccionesForTests, createInspeccion, changeEstado, finalizarInspeccion } from "./inspeccionesService.js";
import { getInspeccionesStats, getInspeccionesTablero, repartirPorcentajes } from "./inspeccionesStatsService.js";

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

test("los porcentajes siempre suman 100 aunque cada uno redondee hacia abajo", () => {
  // 3/24, 5/24, 4/24, 12/24 redondeados por separado dan 13+21+17+50 = 101.
  const reparto = repartirPorcentajes([3, 5, 4, 12], 24);
  assert.equal(reparto.reduce((suma, valor) => suma + valor, 0), 100);
  assert.equal(reparto[3], 50);

  // Un mes sin inspecciones no debe producir NaN ni dividir por cero.
  assert.deepEqual(repartirPorcentajes([0, 0, 0, 0], 0), [0, 0, 0, 0]);

  // Tercios: 33+33+33 = 99, el residuo tiene que repartirse.
  assert.equal(repartirPorcentajes([1, 1, 1], 3).reduce((suma, valor) => suma + valor, 0), 100);
});

test("el tablero anual solo lo ve administración", async () => {
  await assert.rejects(() => getInspeccionesTablero({}, responsable), (error) => error.status === 403);
});

test("el tablero devuelve los 12 meses y cada mes cuadra con su desglose", async () => {
  await crearInspeccion(responsable.id, "Revisión solicitada");

  const tablero = await getInspeccionesTablero({}, admin);
  assert.equal(tablero.meses.length, 12);
  assert.ok(tablero.anios_disponibles.includes(tablero.anio));

  tablero.meses.forEach((mes) => {
    const suma = mes.estados.reduce((total, estado) => total + estado.total, 0);
    assert.equal(suma, mes.total, `el mes ${mes.mes} no cuadra: ${suma} != ${mes.total}`);
    if (mes.total) {
      assert.equal(mes.estados.reduce((total, estado) => total + estado.porcentaje, 0), 100);
    }
  });

  // El mes en curso nunca puede venir marcado como futuro.
  const enCurso = tablero.meses.find((mes) => mes.en_curso);
  assert.ok(enCurso);
  assert.equal(enCurso.futuro, false);
  assert.ok(enCurso.total >= 1);
});

test("el tablero agrupa fechas Date devueltas por MySQL", async () => {
  const anio = String(new Date().getFullYear() - 1);
  __seedMemoryInspeccionesForTests({
    inspecciones: [{
      id: 9001,
      numero_inspeccion: "INS-QA-DATE",
      estado: "ASIGNADA",
      fecha_asignacion: new Date(Number(anio), 10, 4, 12),
      clave_catastral: "00-00-00-01",
      abonado_nombre_snapshot: "QA",
      abonado_numero: "1",
      motivo: "QA",
      tecnico_responsable_id: responsable.id
    }]
  });
  const tablero = await getInspeccionesTablero({ anio }, admin);
  assert.equal(tablero.anio, anio);
  assert.equal(tablero.meses[10].total, 1);
});

test("un año pasado no tiene meses futuros", async () => {
  const tablero = await getInspeccionesTablero({ anio: "2000" }, admin);
  // 2000 no está en anios_disponibles, así que cae al año en curso.
  assert.equal(tablero.anio, String(new Date().getFullYear()));
  assert.equal(tablero.meses.filter((mes) => mes.futuro).length, 12 - tablero.mes_en_curso);
});
