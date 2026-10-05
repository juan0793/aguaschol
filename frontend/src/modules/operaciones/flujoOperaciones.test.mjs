import assert from "node:assert/strict";
import test from "node:test";
import { DIAS_INSPECCION, armarMapa } from "./flujoOperaciones.js";

test("arma los tres carriles y ordena lo que traba: lo vencido antes que lo que pide atención", () => {
  const { carriles, cuellos } = armarMapa({
    fichas: { counts: { draft: 2, pending: 10, visit: 3, confirmed: 5, regularization: 4, regularized: 9, discarded: 2 }, vencidasPorEtapa: { pending: 4, confirmed: 2 }, maxDiasVencida: 6 },
    banco: { counts: { clandestino: 300, sin_determinar: 72 }, sin_asignar: 120 },
    inspecciones: { asignadas: 3, en_proceso: 1, seguimiento: 0, finalizadas_mes: 7, finalizadas_mes_anterior: 5, bandeja: [{ estado: "ASIGNADA", antiguedad_dias: DIAS_INSPECCION + 11 }, { estado: "ASIGNADA", antiguedad_dias: 2 }] },
    entregas: { asignadas: 900, entregadas: 820, pendientes: 40, reentregadas: 12, no_localizadas: 3, pendientes_mas_7_dias: 31, lotes_abiertos: 2, efectividad: 91.1 }
  });
  assert.deepEqual(carriles.map((c) => c.key), ["clandestinos", "inspecciones", "entregas"]);
  const [banco, visita, aviso] = carriles[0].pasos;
  assert.equal(banco.value, 372);
  assert.equal(visita.value, 15);
  assert.equal(visita.nota, "4 vencidas");
  assert.equal(aviso.tono, "critico");
  assert.equal(carriles[1].pasos[0].nota, "1 atrasada · máx. 18 días");
  // Vencidas (grado 3) primero, por peso: entregas 31, fichas 6, inspecciones 1; el banco (grado 2) al final.
  assert.deepEqual(cuellos.map((c) => c.key), ["entregas", "fichas", "inspecciones", "banco"]);
  assert.match(cuellos[1].texto, /6 fichas tienen el plazo vencido; la más atrasada, por 6 días hábiles/);
});

test("un módulo que no respondió no aparece y no inventa cuellos", () => {
  const { carriles, cuellos } = armarMapa({ inspecciones: { asignadas: 0, en_proceso: 0, seguimiento: 0, bandeja: [] } });
  assert.deepEqual(carriles.map((c) => c.key), ["inspecciones"]);
  assert.equal(cuellos.length, 0);
});
