import test from "node:test";
import assert from "node:assert/strict";
import { asignarCandidatos, buildPadronIndex, candidatoDesdeAlcaldia, enviarClavesAlcaldiaAlBanco, listarRefsBanco, descartarCandidato, quitarAsignacion, repartirCandidatos, resumirBarrios, dictaminarCandidato, enviarCandidatoAFicha, importBancoClandestinos, listBancoClandestinos, normalizarBarrio, normalizarClaveBanco, parseCsv, restaurarCandidato, verificarBancoClandestinos } from "./bancoClandestinosService.js";
import { createInmueble, getByClave } from "./inmuebleService.js";

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

test("repartir deja bloques vecinos por barrio y cargas parejas", () => {
  const candidatos = [
    { id: 1, barrio_colonia: "Barrio B", clave_catastral: "20-01-02" },
    { id: 2, barrio_colonia: "Barrio A", clave_catastral: "10-01-10" },
    { id: 3, barrio_colonia: "Barrio A", clave_catastral: "10-01-02" },
    { id: 4, barrio_colonia: "Barrio B", clave_catastral: "20-01-01" },
    { id: 5, barrio_colonia: "Barrio C", clave_catastral: "30-01-01" }
  ];
  const plan = repartirCandidatos(candidatos, [7, 8]);
  assert.deepEqual(plan.map((item) => item.items.map((candidato) => candidato.id)), [[3, 2, 4], [1, 5]]);
  assert.deepEqual(repartirCandidatos(candidatos, []), []);
});

test("asignar reparte, ignora los ya procesados y la validadora solo trabaja lo suyo", async () => {
  await importBancoClandestinos({ csv: "origen_ref,clave_catastral,comentario_campo,barrio_colonia\na-1,998-01-01,Asignable uno,Barrio Asignar\na-2,998-01-02,Asignable dos,Barrio Asignar\na-3,998-01-03,Asignable tres,Barrio Asignar", lote: "asignar" }, admin);
  const { items } = await listBancoClandestinos({ query: "Asignable" });
  const ids = items.map((item) => item.id);
  await assert.rejects(() => asignarCandidatos({ ids, tecnico_ids: [campo.id] }, campo), (error) => error.status === 403);
  await assert.rejects(() => asignarCandidatos({ ids, tecnico_ids: [] }, admin), /técnico/);

  const preview = await asignarCandidatos({ ids, tecnico_ids: [tecnico.id, campo.id], preview: true }, admin);
  assert.deepEqual(preview.plan.map((item) => item.total), [2, 1]);
  assert.equal((await listBancoClandestinos({ query: "Asignable", asignado: String(campo.id) })).total, 0);

  await asignarCandidatos({ ids, tecnico_ids: [tecnico.id, campo.id] }, admin);
  const deCampo = await listBancoClandestinos({ query: "Asignable", asignado: String(campo.id) });
  assert.equal(deCampo.total, 1);
  assert.equal(deCampo.asignaciones.find((item) => item.id === campo.id).pendientes, 1);
  assert.equal((await listBancoClandestinos({ query: "Asignable", asignado: "none" })).total, 0);

  const ajeno = (await listBancoClandestinos({ query: "Asignable", asignado: String(tecnico.id) })).items[0];
  await assert.rejects(() => enviarCandidatoAFicha(ajeno.id, {}, campo), (error) => error.status === 403);
  const propio = deCampo.items[0];
  // Un descarte por error se deshace: la validadora devuelve lo suyo, no lo ajeno.
  await descartarCandidato(propio.id, { motivo: "Me equivoqué de punto" }, campo);
  assert.equal((await restaurarCandidato(propio.id, campo)).estado, "pendiente");
  await descartarCandidato(ajeno.id, { motivo: "No aplica" }, tecnico);
  await assert.rejects(() => restaurarCandidato(ajeno.id, campo), (error) => error.status === 403);
  await restaurarCandidato(ajeno.id, tecnico);

  const result = await enviarCandidatoAFicha(propio.id, {}, campo);
  assert.equal(result.candidato.estado, "enviado");

  const pendientes = ids.filter((id) => id !== propio.id);
  assert.equal((await quitarAsignacion({ ids: pendientes }, admin)).liberados, 2);
  await assert.rejects(() => asignarCandidatos({ ids: [propio.id], tecnico_ids: [tecnico.id] }, admin), (error) => error.status === 409);
});

test("las claves de Alcaldía elegidas entran al banco una sola vez", async () => {
  const registros = [
    { clave_catastral: "0301-05-012", clave_aguas_formato: "301-05-12", nombre: "ROSA AGUILAR", caserio: "Residencial Villa Bertilia" },
    { clave_catastral: "0301-05-013", clave_aguas_formato: "301-05-13", nombre: "LUIS HERRERA", direccion: "Col. San Pedro" }
  ];
  const candidato = candidatoDesdeAlcaldia(registros[0]);
  assert.equal(candidato.origen_ref, "0301-05-012");
  assert.equal(candidato.clave_catastral, "301-05-12");
  assert.equal(candidato.barrio_colonia, "Residencial Villa Bertilia");

  await assert.rejects(enviarClavesAlcaldiaAlBanco({ claves: ["0301-05-012"] }, campo, { registros }), { status: 403 });
  await assert.rejects(enviarClavesAlcaldiaAlBanco({ claves: [] }, admin, { registros }), /al menos una clave/);
  await assert.rejects(enviarClavesAlcaldiaAlBanco({ claves: ["no-existe"] }, admin, { registros }), { status: 404 });

  const primera = await enviarClavesAlcaldiaAlBanco({ claves: ["0301-05-012", "0301-05-013", "no-existe"] }, tecnico, { registros });
  assert.equal(primera.nuevos, 2);
  assert.equal(primera.enviados, 2);
  assert.equal(primera.omitidos, 1);
  const segunda = await enviarClavesAlcaldiaAlBanco({ claves: ["0301-05-012"] }, admin, { registros });
  assert.equal(segunda.nuevos, 0);
  assert.equal(segunda.actualizados, 1);

  const refs = await listarRefsBanco({ origen: "alcaldia" }, admin);
  assert.deepEqual(refs.items.map((item) => item.origen_ref).sort(), ["0301-05-012", "0301-05-013"]);
  await assert.rejects(listarRefsBanco({ origen: "alcaldia" }, campo), { status: 403 });
});

test("no duplica predios que ya están en el banco por otro origen o que ya tienen ficha", async () => {
  await importBancoClandestinos({ csv: "origen_ref,clave_catastral,comentario_campo\nq-301,301-05-20,Levantado en campo", lote: "prueba" }, admin);
  await createInmueble({ clave_catastral: "302-6-1", barrio_colonia: "Barrio Prueba", nombre_catastral: "YA TIENE FICHA" }, { user: admin });
  assert.ok(await getByClave("302-6-1")); // misma clave, escrita sin ceros
  const registros = [
    { clave_catastral: "0301-05-020", clave_aguas_formato: "301-05-20", nombre: "YA EN EL BANCO", caserio: "Barrio Prueba" },
    { clave_catastral: "0302-06-001", clave_aguas_formato: "302-06-01", nombre: "YA TIENE FICHA", caserio: "Barrio Prueba" },
    { clave_catastral: "0301-05-021", clave_aguas_formato: "301-05-21", nombre: "NUEVO", caserio: "Barrio Prueba" }
  ];
  const resultado = await enviarClavesAlcaldiaAlBanco({ claves: registros.map((row) => row.clave_catastral) }, admin, { registros });
  assert.equal(resultado.ya_en_banco, 1);
  assert.equal(resultado.con_ficha, 1);
  assert.equal(resultado.nuevos, 1);
  assert.equal(resultado.enviados, 1);
  const soloRepetidos = await enviarClavesAlcaldiaAlBanco({ claves: ["0301-05-020", "0302-06-001"] }, admin, { registros });
  assert.equal(soloRepetidos.nuevos, 0);
  assert.equal(soloRepetidos.enviados, 0);
});

test("una clave repetida en el padrón de Alcaldía cuenta una sola vez", async () => {
  const fila = { clave_catastral: "0303-07-001", clave_aguas_formato: "303-07-01", nombre: "REPETIDA", caserio: "Barrio Prueba" };
  const resultado = await enviarClavesAlcaldiaAlBanco({ claves: ["0303-07-001"] }, admin, { registros: [fila, { ...fila }] });
  assert.equal(resultado.enviados, 1);
  assert.equal(resultado.nuevos, 1);
  assert.equal(resultado.actualizados, 0);
  assert.equal(resultado.omitidos, 0);
});
