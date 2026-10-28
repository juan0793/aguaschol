import test from "node:test";
import assert from "node:assert/strict";
import {
  DESCARTES_FILTROS_INICIALES,
  antecedenteTexto,
  coincideBusqueda,
  columnasImpresas,
  describirFiltros,
  diasDescartes,
  indicePaginas,
  paginar,
  filtrarDescartes,
  filtrarSinDia,
  hayFiltros,
  opcionesDescartes,
  abonadosRepetidos,
  diaCorto,
  totalesDescartes
} from "./descartes.js";

const doc = (id, extra = {}) => ({
  id,
  lote_id: 100 + id,
  fecha_lote: "2026-10-15",
  numero_abonado: String(9000 + id),
  clave_catastral: `99-11-08-${String(id).padStart(2, "0")}`,
  abonado_nombre: `Abonado de prueba ${id}`,
  barrio_codigo: "25",
  barrio_nombre: "Bo. Prueba",
  responsable_id: 7,
  responsable_nombre: "Técnico Zaldaña",
  repetido: false,
  ...extra
});

const items = [
  doc(1, { repetido: true }),
  doc(2),
  doc(3, { fecha_lote: "2026-10-14", barrio_codigo: "31", barrio_nombre: "Col. Ejemplo", repetido: true }),
  doc(4, { fecha_lote: "2026-10-14", responsable_id: 8, responsable_nombre: "Ana Prueba" }),
  doc(5, { fecha_lote: "2026-10-13", responsable_id: null, responsable_nombre: "", barrio_codigo: "", barrio_nombre: "" })
];
const filtros = (extra) => ({ ...DESCARTES_FILTROS_INICIALES, ...extra });

test("descartes: la búsqueda encuentra abonado, nombre sin acentos y clave sin guiones", () => {
  assert.equal(coincideBusqueda(doc(1), "9001"), true);
  assert.equal(coincideBusqueda(doc(1, { abonado_nombre: "VARIEDADES JEDELYN" }), "jedelyn"), true);
  assert.equal(coincideBusqueda(doc(1, { abonado_nombre: "José Peña" }), "jose pena"), true);
  assert.equal(coincideBusqueda(doc(1), "99-11-08"), true);
  assert.equal(coincideBusqueda(doc(1), "99110801"), true);
  // Un número corto no cae en las cifras de la clave.
  assert.equal(coincideBusqueda(doc(1, { numero_abonado: "1" }), "1108"), false);
  assert.equal(coincideBusqueda(doc(1), ""), true);
});

test("descartes: filtra por día, barrio, técnico y repetidos a la vez", () => {
  assert.deepEqual(filtrarDescartes(items, filtros({ dia: "2026-10-14" })).map((item) => item.id), [3, 4]);
  assert.deepEqual(filtrarDescartes(items, filtros({ barrio: "31" })).map((item) => item.id), [3]);
  assert.deepEqual(filtrarDescartes(items, filtros({ tecnico: "7", soloRepetidos: true })).map((item) => item.id), [1, 3]);
  // Sin técnico ni barrio se agrupa por nombre vacío.
  assert.deepEqual(filtrarDescartes(items, filtros({ tecnico: "N:Sin responsable" })).map((item) => item.id), [5]);
  assert.deepEqual(filtrarDescartes(items, filtros({ barrio: "N:Sin barrio" })).map((item) => item.id), [5]);
  // La franja de días no mira el día elegido.
  assert.equal(filtrarSinDia(items, filtros({ dia: "2026-10-14", tecnico: "7" })).length, 3);
});

test("descartes: totales por técnico y por barrio, del que más tiene al que menos", () => {
  const totales = totalesDescartes(items);
  assert.equal(totales.documentos, 5);
  assert.equal(totales.repetidos, 2);
  assert.equal(totales.abonados, 5);
  assert.equal(totales.abonados_repetidos, 2);
  // "Sin responsable" está en el reparto pero no cuenta como técnico.
  assert.equal(totales.sin_responsable, 1);
  assert.equal(totales.tecnicos, 2);
  assert.deepEqual(totales.por_tecnico.map((fila) => [fila.nombre, fila.documentos, fila.repetidos]), [
    ["Técnico Zaldaña", 3, 2], ["Ana Prueba", 1, 0], ["Sin responsable", 1, 0]
  ]);
  assert.deepEqual(totales.por_barrio.map((fila) => [fila.llave, fila.documentos]), [["25", 3], ["31", 1], ["N:Sin barrio", 1]]);
  // Un mismo abonado en dos días cuenta una vez.
  assert.equal(totalesDescartes([doc(1), doc(1, { id: 9 })]).abonados, 1);
  assert.equal(totalesDescartes([]).documentos, 0);
});

test("descartes: días con su conteo, del más reciente al más viejo", () => {
  assert.deepEqual(diasDescartes(items).map((dia) => [dia.fecha, dia.documentos, dia.repetidos, dia.lotes]), [
    ["2026-10-15", 2, 1, 2], ["2026-10-14", 2, 1, 2], ["2026-10-13", 1, 0, 1]
  ]);
});

test("descartes: opciones por nombre", () => {
  const { barrios, tecnicos } = opcionesDescartes(items);
  assert.deepEqual(tecnicos.map((item) => item.nombre), ["Ana Prueba", "Sin responsable", "Técnico Zaldaña"]);
  assert.deepEqual(barrios.map((item) => item.nombre), ["Bo. Prueba", "Col. Ejemplo", "Sin barrio"]);
});

test("descartes: repetidos por abonado, primero los de más ciclos", () => {
  const anteriores = (ids) => ids.map((id) => ({ id, fecha_lote: "2026-09-20" }));
  const grupos = abonadosRepetidos([
    doc(1, { repetido: true, ciclos_anteriores: 1, anteriores: anteriores([50]) }),
    doc(9, { numero_abonado: "9001", fecha_lote: "2026-10-16", repetido: true, ciclos_anteriores: 1, anteriores: anteriores([50]) }),
    doc(3, { repetido: true, ciclos_anteriores: 3, anteriores: anteriores([60, 61, 62]) }),
    doc(4)
  ]);
  assert.deepEqual(grupos.map((grupo) => [grupo.llave, grupo.documentos.length, grupo.ciclos_anteriores, grupo.veces_antes]), [["9003", 1, 3, 3], ["9001", 2, 1, 1]]);
  // El más reciente manda: fecha, barrio y técnico del último documento.
  assert.equal(grupos[1].ultima_fecha, "2026-10-16");
  assert.deepEqual(grupos[1].documentos.map((item) => item.id), [9, 1]);
  assert.deepEqual(abonadosRepetidos([doc(4)]), []);
});

test("descartes: día corto con mes", () => {
  assert.equal(diaCorto("2026-10-27"), "mar 27/10");
  assert.equal(diaCorto("2026-11-01"), "dom 01/11");
  assert.equal(diaCorto(""), "—");
});

test("descartes: los filtros en palabras y las columnas del impreso", () => {
  const ciclo = { fecha_inicio: "2026-10-01", fecha_fin: "2026-10-27" };
  assert.deepEqual(describirFiltros(filtros(), { items, ciclo }), [{ rotulo: "Período", valor: "Todo el ciclo, del 01/10/2026 al 27/10/2026" }]);
  assert.deepEqual(describirFiltros(filtros({ dia: "2026-10-15", barrio: "31", tecnico: "8", q: " jedelyn ", soloRepetidos: true }), { items, ciclo }), [
    { rotulo: "Período", valor: "Día 15/10/2026" },
    { rotulo: "Barrio", valor: "Col. Ejemplo" },
    { rotulo: "Técnico", valor: "Ana Prueba" },
    { rotulo: "Búsqueda", valor: "“jedelyn”" },
    { rotulo: "Antecedentes", valor: "Solo repetidos" }
  ]);
  assert.equal(describirFiltros(filtros(), { items, ciclo: { fecha_fin: "2026-10-27" } })[0].valor, "Todo el ciclo, hasta el 27/10/2026");
  assert.deepEqual(columnasImpresas(filtros({ dia: "2026-10-15", tecnico: "7" })), { fecha: false, barrio: true, tecnico: false });
  assert.equal(hayFiltros(filtros()), false);
  assert.equal(hayFiltros(filtros({ q: "  " })), false);
  assert.equal(hayFiltros(filtros({ soloRepetidos: true })), true);
});

test("descartes: antecedentes en una línea", () => {
  assert.equal(antecedenteTexto({ repetido: false }), "Sin antecedentes");
  assert.equal(antecedenteTexto({ repetido: true, ciclos_anteriores: 1 }), "Repetido · 1 ciclo anterior");
  assert.equal(antecedenteTexto({ repetido: true, ciclos_anteriores: 3 }), "Repetido · 3 ciclos anteriores");
});

test("descartes: páginas de la lista", () => {
  const lista = Array.from({ length: 53 }, (_, i) => i + 1);
  assert.deepEqual(paginar(lista, 1, 25), { items: lista.slice(0, 25), pagina: 1, totalPaginas: 3, desde: 1, hasta: 25, total: 53 });
  assert.deepEqual(paginar(lista, 3, 25).items, [51, 52, 53]);
  // Una página que ya no existe (se achicó la lista) cae en la última.
  assert.equal(paginar(lista, 9, 25).pagina, 3);
  assert.deepEqual(paginar([], 1, 25), { items: [], pagina: 1, totalPaginas: 1, desde: 0, hasta: 0, total: 0 });
});

test("descartes: índice de páginas con saltos", () => {
  assert.deepEqual(indicePaginas(1, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(indicePaginas(1, 14), [1, 2, 3, 4, 5, 6, "…", 14]);
  assert.deepEqual(indicePaginas(7, 14), [1, "…", 5, 6, 7, 8, 9, "…", 14]);
  assert.deepEqual(indicePaginas(14, 14), [1, "…", 9, 10, 11, 12, 13, 14]);
  assert.deepEqual(indicePaginas(4, 8), [1, 2, 3, 4, 5, 6, 7, 8].slice(0, 6).concat(["…", 8]));
  // En el teléfono, una página a cada lado.
  assert.deepEqual(indicePaginas(5, 60, 1), [1, "…", 4, 5, 6, "…", 60]);
  assert.deepEqual(indicePaginas(1, 60, 1), [1, 2, 3, 4, "…", 60]);
  assert.deepEqual(indicePaginas(60, 60, 1), [1, "…", 57, 58, 59, 60]);
  assert.deepEqual(indicePaginas(2, 5, 1), [1, 2, 3, 4, 5]);
});
