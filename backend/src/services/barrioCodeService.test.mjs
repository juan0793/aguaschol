// Modo memoria: saveBarrioCode escribe el JSON y despues registra la auditoria,
// que sin pool rechaza. Los casos de exito comprueban el estado persistido y
// toleran ese rechazo posterior; los de validacion fallan antes de escribir.
//   node --test src/services/barrioCodeService.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

process.env.USE_MEMORY_DB = "true";
const { env } = await import("../config/env.js");
const { saveBarrioCode, listBarrioCodes } = await import("./barrioCodeService.js");

// El archivo esta versionado: se respalda y se restaura para no ensuciar el repo.
const codesPath = path.resolve(env.dbRoot, "backend", "data", "barrio-codes.json");
const backup = fs.existsSync(codesPath) ? fs.readFileSync(codesPath, "utf8") : null;

test.after(() => {
  if (backup === null) fs.rmSync(codesPath, { force: true });
  else fs.writeFileSync(codesPath, backup);
});

/** Guarda ignorando el fallo de auditoria, que aqui no tiene base de datos. */
const guardar = async (payload) => {
  try {
    return await saveBarrioCode(payload);
  } catch (error) {
    if (error.status === 400 || error.status === 409) throw error;
    return null;
  }
};

const buscar = async (codigo) => (await listBarrioCodes()).find((item) => item.codigo === codigo);

test("un codigo no numerico se rechaza en vez de pisar otro barrio", async () => {
  const antes = await listBarrioCodes();
  const barrio01 = antes.find((item) => item.codigo === "01");
  assert.ok(barrio01, "el barrio 01 debe existir en los datos base");

  // normalizeCode descartaba lo no numerico: "QA1" se volvia "01" y el alta
  // entraba como actualizacion del barrio 01, cambiandole el nombre sin avisar.
  await assert.rejects(
    () => saveBarrioCode({ codigo: "QA1", barrio: "Colonia inventada" }),
    (error) => error.status === 400
  );

  const despues = await listBarrioCodes();
  assert.equal((await buscar("01")).barrio, barrio01.barrio);
  assert.equal(despues.length, antes.length);
});

test("el codigo numerico corto se sigue rellenando a dos digitos", async () => {
  await guardar({ codigo: "201", barrio: "Colonia Prueba QA" });
  await guardar({ codigo: "7", barrio: "Barrio Campo Luna Editado" });
  assert.equal((await buscar("07")).barrio, "Barrio Campo Luna Editado");
});

test("el nombre se recorta y no admite duplicados por caso o espacios", async () => {
  await guardar({ codigo: "202", barrio: "  Colonia   Doble   Espacio  " });
  assert.equal((await buscar("202")).barrio, "Colonia Doble Espacio");

  await assert.rejects(
    () => saveBarrioCode({ codigo: "203", barrio: "colonia doble espacio" }),
    (error) => error.status === 409
  );

  // Renombrar el mismo codigo no debe chocar consigo mismo.
  await guardar({ codigo: "202", barrio: "Colonia Doble Espacio" });
  assert.equal((await buscar("202")).barrio, "Colonia Doble Espacio");
  assert.equal(await buscar("203"), undefined);
});

test("codigo o barrio vacios siguen devolviendo 400", async () => {
  await assert.rejects(() => saveBarrioCode({ codigo: "", barrio: "" }), (error) => error.status === 400);
  await assert.rejects(() => saveBarrioCode({ codigo: "204", barrio: "   " }), (error) => error.status === 400);
});
