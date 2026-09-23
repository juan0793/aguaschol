import test from "node:test";
import assert from "node:assert/strict";
import { buildPadronIndex, descartarCandidato, resumirBarrios, dictaminarCandidato, enviarCandidatoAFicha, importBancoClandestinos, listBancoClandestinos, normalizarBarrio, normalizarClaveBanco, parseCsv, restaurarCandidato, verificarBancoClandestinos } from "./bancoClandestinosService.js";
import { getByClave } from "./inmuebleService.js";

const admin = { id: 1, role: "admin", full_name: "Administración" };
const tecnico = { id: 2, role: "operator", full_name: "Técnico" };
const campo = { id: 3, role: "validadora_campo", full_name: "Campo" };

const index = buildPadronIndex(
  [
    { clave_catastral: "14-08-02-01", abonado: "5001", inquilino: "LOCAL 1" },
    { clave_catastral: "22-35-01-01", abonado: "7317", inquilino: "LUCILA" }
  ],
  [
    { clave_catastral: "89-13-15", clave_aguas_formato: "89-13-15", nombre: "HILDA TORRES", caserio: "Residencial Villas Del Cortijo" },
    { clave_catastral: "22-35-01", clave_aguas_formato: "22-35-01", nombre: "LUCILA RUBI", caserio: "Barrio Cabañas" }
  ]
);

test("normaliza claves de campo a bloques de dos dígitos", () => {
  assert.equal(normalizarClaveBanco("89-13-15"), "89-13-15");
  assert.equal(normalizarClaveBanco(" 124 5 7 "), "124-05-07");
  assert.equal(normalizarClaveBanco("14-08-02-7"), "14-08-02-07");
  assert.equal(normalizarClaveBanco("casa verde"), "");
  assert.equal(normalizarClaveBanco("1-2"), "");
});

test("solo en Alcaldía es clandestino; en Aguas no lo es", () => {
  assert.equal(dictaminarCandidato({ clave_catastral: "89-13-15" }, index).dictamen, "clandestino");
  assert.equal(dictaminarCandidato({ clave_catastral: "89-13-15" }, index).alcaldia_propietario, "HILDA TORRES");
  assert.equal(dictaminarCandidato({ clave_catastral: "22-35-01" }, index).dictamen, "registrado");
  assert.equal(dictaminarCandidato({ clave_catastral: "22-35-01-01" }, index).dictamen, "registrado");
});

test("una unidad sin cuenta en un lote registrado es probable", () => {
  const result = dictaminarCandidato({ clave_catastral: "14-08-02-07" }, index);
  assert.equal(result.dictamen, "probable");
  assert.equal(result.aguas_clave, "14-08-02-01");
});

test("el abonado registrado manda aunque la clave no exista", () => {
  assert.equal(dictaminarCandidato({ clave_catastral: "999-01-01", abonado_campo: "7317" }, index).dictamen, "registrado");
});

test("sin clave o con clave desconocida queda sin determinar", () => {
  assert.equal(dictaminarCandidato({ clave_catastral: "" }, index).dictamen, "sin_determinar");
  assert.equal(dictaminarCandidato({ clave_catastral: "998-01-01" }, index).motivo_dictamen, "La clave no existe en ningún padrón");
});

test("lee CSV con BOM, comillas y comas dentro del texto", () => {
  const rows = parseCsv(String.fromCharCode(0xfeff) + 'origen_ref,comentario_campo,agua\r\n1,"Casa verde, portón ""blanco""",1\r\n2,,0\r\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].comentario_campo, 'Casa verde, portón "blanco"');
  assert.equal(rows[1].agua, "0");
});

const csv = [
  "origen_ref,clave_catastral,comentario_campo,agua,latitude,longitude,barrio_colonia",
  "t-1,997-01-01,Casa sin cuenta,1,13.30,-87.19,Barrio prueba",
  "t-2,,Solar baldío,0,13.31,-87.18,Barrio prueba",
  "t-3,997-01-03,Otra casa,0,,,Barrio prueba"
].join("\n");

test("solo administración importa y la reimportación no duplica", async () => {
  await assert.rejects(() => importBancoClandestinos({ csv, lote: "prueba" }, tecnico), (error) => error.status === 403);
  const first = await importBancoClandestinos({ csv, lote: "prueba" }, admin);
  assert.equal(first.nuevos, 3);
  const second = await importBancoClandestinos({ csv, lote: "prueba" }, admin);
  assert.equal(second.nuevos, 0);
  assert.equal(second.actualizados, 3);
  const list = await listBancoClandestinos({ query: "Barrio prueba" });
  assert.equal(list.total, 3);
  assert.equal(list.counts.sin_determinar, 3);
});

test("enviar a ficha crea la ficha y saca al candidato del banco", async () => {
  const { items } = await listBancoClandestinos({ query: "Casa sin cuenta" });
  await assert.rejects(() => enviarCandidatoAFicha(items[0].id, {}, campo), (error) => error.status === 403);
  const result = await enviarCandidatoAFicha(items[0].id, {}, tecnico);
  assert.equal(result.ficha_existente, false);
  assert.equal(result.candidato.estado, "enviado");
  assert.equal(result.candidato.inmueble_id, result.ficha.id);
  const ficha = await getByClave("997-01-01");
  assert.equal(ficha.conexion_agua, "Si");
  assert.match(ficha.comentarios, /Casa sin cuenta/);
  assert.equal((await listBancoClandestinos({ query: "Casa sin cuenta" })).total, 0);
  await assert.rejects(() => enviarCandidatoAFicha(items[0].id, {}, tecnico), (error) => error.status === 409);
});

test("sin clave pide escribirla; con la clave del técnico sí se envía", async () => {
  const { items } = await listBancoClandestinos({ query: "Solar baldío" });
  await assert.rejects(() => enviarCandidatoAFicha(items[0].id, {}, tecnico), /Escribe la clave/);
  const result = await enviarCandidatoAFicha(items[0].id, { clave_catastral: "997 1 2" }, tecnico);
  assert.equal(result.ficha.clave_catastral, "997-01-02");
  assert.equal(result.candidato.clave_catastral, "997-01-02");
});

test("una clave que ya tiene ficha se vincula sin crear otra", async () => {
  await importBancoClandestinos({ csv: "origen_ref,clave_catastral,comentario_campo\nt-4,997-01-01,Mismo predio", lote: "prueba" }, admin);
  const { items } = await listBancoClandestinos({ query: "Mismo predio" });
  const result = await enviarCandidatoAFicha(items[0].id, {}, tecnico);
  assert.equal(result.ficha_existente, true);
  assert.equal(result.ficha.clave_catastral, "997-01-01");
});

test("descartar exige motivo y se puede devolver al banco", async () => {
  const { items } = await listBancoClandestinos({ query: "Otra casa" });
  await assert.rejects(() => descartarCandidato(items[0].id, {}, tecnico), /motivo/);
  const discarded = await descartarCandidato(items[0].id, { motivo: "No hay conexión" }, tecnico);
  assert.equal(discarded.estado, "descartado");
  assert.equal((await restaurarCandidato(items[0].id, tecnico)).estado, "pendiente");
});

test("unifica abreviaturas de barrio al estilo de Alcaldía", () => {
  assert.equal(normalizarBarrio("BO. LA LIBERTAD"), "Barrio La Libertad");
  assert.equal(normalizarBarrio("BO.LAS COLINAS"), "Barrio Las Colinas");
  assert.equal(normalizarBarrio("COL.  JULIO MIDENCE"), "Colonia Julio Midence");
  assert.equal(normalizarBarrio("BOSQUES DEL NORTE"), "Bosques Del Norte");
});

test("reimportar no toca a los que ya se enviaron a ficha", async () => {
  const result = await importBancoClandestinos({ csv, lote: "prueba" }, admin);
  assert.deepEqual([result.nuevos, result.actualizados, result.sin_cambios_procesados], [0, 1, 2]);
  const { items } = await listBancoClandestinos({ query: "Casa sin cuenta", estado: "enviado" });
  assert.equal(items[0].estado, "enviado");
});

test("resume los barrios con más candidatos y su desglose por dictamen", () => {
  const barrios = resumirBarrios([
    { barrio_colonia: "Barrio Cabañas", dictamen: "clandestino", total: 3 },
    { barrio_colonia: "Barrio Cabañas", dictamen: "probable", total: "2" },
    { barrio_colonia: "Colonia Brasilia", dictamen: "registrado", total: 4 },
    { barrio_colonia: "", dictamen: "clandestino", total: 9 }
  ]);
  assert.deepEqual(barrios.map((item) => [item.barrio, item.total]), [["Barrio Cabañas", 5], ["Colonia Brasilia", 4]]);
  assert.equal(barrios[0].clandestino, 3);
  assert.equal(barrios[0].probable, 2);
  assert.equal(barrios[0].registrado, 0);
});

test("verificar descarta a los que aparecen en Aguas y deja a los demás", async () => {
  await importBancoClandestinos({ csv: "origen_ref,clave_catastral,comentario_campo\nv-1,22-35-01-01,Casa de Lucila\nv-2,89-13-15,Casa de Hilda", lote: "verificacion" }, admin);
  await assert.rejects(() => verificarBancoClandestinos(campo, { index }), (error) => error.status === 403);
  const result = await verificarBancoClandestinos(tecnico, { index });
  assert.ok(result.descartados >= 1);
  const [lucila] = (await listBancoClandestinos({ query: "Casa de Lucila", estado: "" })).items;
  assert.equal(lucila.estado, "descartado");
  assert.equal(lucila.dictamen, "registrado");
  assert.match(lucila.motivo_descarte, /Aparece en Aguas/);
  const [hilda] = (await listBancoClandestinos({ query: "Casa de Hilda", estado: "" })).items;
  assert.equal(hilda.estado, "pendiente");
  assert.equal(hilda.dictamen, "clandestino");
});
