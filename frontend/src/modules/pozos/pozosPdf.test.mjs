import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { crearInformePozos, nombreArchivoPozos, planPorColonia } from "./pozosPdf.js";

const require = createRequire(import.meta.url);
const { jsPDF } = require("jspdf");
const { autoTable } = await import("jspdf-autotable");

const pozos = [
  { id: 1, codigo: "Pchol.-001", nombre: "Casa", colonia: "Bo. Guadalupe", en_uso: true, ph: 6.3, tds_g_l: 0.2, profundidad_m: null, nivel_freatico_m: null, diametro_pulg: 4, temperatura_c: 33, coordenada_valida: true, latitud: 13.3, longitud: -87.19, utm_x: 480000, utm_y: 1470000 },
  { id: 2, codigo: "Pchol.-010", nombre: "Tienda", colonia: "Bo. Guadalupe", en_uso: null, ph: null, tds_g_l: null, profundidad_m: 20, nivel_freatico_m: 10, diametro_pulg: 6, temperatura_c: null, coordenada_valida: false, utm_x: 480100, utm_y: 14700000 },
  { id: 3, codigo: "Pchol.-002", nombre: "Bodega", colonia: "La Libertad", en_uso: true, ph: 7, tds_g_l: 0.5, profundidad_m: 30, nivel_freatico_m: 12, diametro_pulg: 6, temperatura_c: 31, coordenada_valida: true, latitud: 13.31, longitud: -87.18, utm_x: 480200, utm_y: 1470100 }
];

test("el plan agrupa por colonia los pozos con datos por levantar, por código", () => {
  const plan = planPorColonia(pozos);
  assert.deepEqual(plan.map((grupo) => [grupo.colonia, grupo.items.map((item) => item.pozo.codigo)]), [["Bo. Guadalupe", ["Pchol.-001", "Pchol.-010"]]]);
  assert.equal(plan[0].datos, 2 + 5);
});

test("los cuatro informes se arman, también sin pozos", () => {
  for (const tipo of ["inventario", "fichas", "calidad", "levantamiento"]) {
    const doc = crearInformePozos({ jsPDF, autoTable, tipo, pozos, alcance: "Prueba", generadoEn: "21/10/2026" });
    assert.ok(doc.getNumberOfPages() >= 1, tipo);
    assert.ok(crearInformePozos({ jsPDF, autoTable, tipo, pozos: [] }).getNumberOfPages() >= 1, `${tipo} vacío`);
  }
  assert.equal(crearInformePozos({ jsPDF, autoTable, tipo: "fichas", pozos }).getNumberOfPages(), 3);
  assert.throws(() => crearInformePozos({ jsPDF, autoTable, tipo: "otro", pozos }), /no reconocido/);
  assert.equal(nombreArchivoPozos("calidad", new Date("2026-10-21T12:00:00Z")), "calidad-agua-pozos-2026-10-21.pdf");
});
