import assert from "node:assert/strict";
import test from "node:test";
import { construirResumenEjecutivo } from "./weeklyReportSummary.js";

const snapshotBase = {
  periodo: { fecha_inicio: "2026-09-14", fecha_fin: "2026-09-18", etiqueta: "Semana del 14 al 18 de septiembre de 2026" },
  totales: { lotes: 13, lotes_abiertos: 0, asignadas: 1827, entregadas: 1330, no_entregadas: 63, pendientes: 63, reentregadas: 0, efectividad: 72.8 },
  por_responsable: [
    { responsable_nombre: "Elmer Gómez", efectividad: 96.8 },
    { responsable_nombre: "Alfredo Carranza", efectividad: 46.8 }
  ],
  indicadores_atencion: [{ codigo: "PENDIENTES_MAS_7_DIAS", total: 4 }],
  comparativo: {
    con_datos: true,
    periodo: { fecha_inicio: "2026-09-07", fecha_fin: "2026-09-11" },
    indicadores: [
      { clave: "entregadas", diferencia: 230 },
      { clave: "efectividad", diferencia: -5.2 }
    ]
  },
  destacados: {
    mejor_responsable: { responsable_nombre: "Elmer Gómez", efectividad: 96.8 },
    responsable_a_reforzar: { responsable_nombre: "Alfredo Carranza", efectividad: 46.8 },
    concentracion_pendientes: { barrio_nombre: "Barrio Nueva Esperanza", porcentaje: 19 }
  }
};

test("el resumen ejecutivo describe volumen, tendencia, pendientes y desempeño", () => {
  const frases = construirResumenEjecutivo(snapshotBase);
  assert.equal(frases.length, 4);
  assert.match(frases[0], /1,827 documentos en 13 lotes a cargo de 2 responsables, con una efectividad de 72\.8%/);
  assert.match(frases[1], /del 07\/09\/2026 al 11\/09\/2026, las entregas subieron en 230 documentos y la efectividad bajó 5\.2 puntos/);
  assert.match(frases[2], /Quedan 63 documentos pendientes de entrega, 4 con más de 7 días\./);
  assert.match(frases[2], /19\.0% se concentra en Barrio Nueva Esperanza/);
  assert.match(frases[3], /Elmer Gómez alcanzó la efectividad más alta \(96\.8%\); Alfredo Carranza cerró en 46\.8%/);
});

test("avisa cuando quedan lotes abiertos porque las cifras aún son parciales", () => {
  const frases = construirResumenEjecutivo({
    ...snapshotBase,
    totales: { ...snapshotBase.totales, lotes_abiertos: 1 }
  });
  assert.ok(frases.some((frase) => /1 lote quedó abierto dentro del período/.test(frase)));

  const varios = construirResumenEjecutivo({
    ...snapshotBase,
    totales: { ...snapshotBase.totales, lotes_abiertos: 3 }
  });
  assert.ok(varios.some((frase) => /3 lotes quedaron abiertos/.test(frase)));
});

test("un informe archivado sin comparativo (snapshot v1) no inventa la comparación", () => {
  const { comparativo, destacados, ...v1 } = snapshotBase;
  const frases = construirResumenEjecutivo(v1);
  assert.ok(!frases.some((frase) => /Frente al período/.test(frase)));
  assert.ok(!frases.some((frase) => /efectividad más alta/.test(frase)));
  assert.match(frases[0], /^Durante semana del 14 al 18 de septiembre de 2026/);
  assert.equal(comparativo.con_datos, true);
  assert.ok(destacados);
});

test("una semana sin reparto y una sin período previo se describen sin ruido", () => {
  const vacio = construirResumenEjecutivo({
    periodo: { etiqueta: "Semana del 5 al 9 de octubre de 2026" },
    totales: { lotes: 0, lotes_abiertos: 0, asignadas: 0, entregadas: 0, no_entregadas: 0, pendientes: 0, efectividad: 0 },
    comparativo: { con_datos: false, indicadores: [] },
    por_responsable: []
  });
  assert.equal(vacio[0], "Durante semana del 5 al 9 de octubre de 2026 no se registró reparto de documentos.");
  assert.equal(vacio[1], "No hay un período anterior con datos para comparar este resultado.");
  assert.equal(vacio.length, 2);
  assert.deepEqual(construirResumenEjecutivo(null), []);
});
