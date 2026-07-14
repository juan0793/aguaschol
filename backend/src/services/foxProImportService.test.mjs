import assert from "node:assert/strict";
import test from "node:test";
import { hashFoxProRecords, normalizeFoxProRecord } from "./foxProImportService.js";
import { sameSecret } from "../middleware/foxProSyncAuth.js";

test("normaliza S y N conservando los valores originales", () => {
  const row = normalizeFoxProRecord({ abonado: " 21237 ", agua: " s ", alca: "N", barr: "", tren: "S", bomb: "N", valor: 100, intereses: 25 }, 1);
  assert.equal(row.codigo_abonado, "21237");
  assert.equal(row.agua_original, "s");
  assert.equal(row.agua_normalizada, "S");
  assert.equal(row.barrido_normalizado, null);
  assert.equal(row.saldo_total, 125);
  assert.equal(row.estado, "RECIBIDO");
});

test("marca errores sin descartar el dato original", () => {
  const row = normalizeFoxProRecord({ abonado: "", agua: "2", valor: "invalido", intereses: null }, 8);
  assert.equal(row.estado, "ERROR");
  assert.match(row.mensaje_error, /abonado/i);
  assert.match(row.mensaje_error, /agua/i);
  assert.match(row.mensaje_error, /principal/i);
  assert.equal(row.dato_original.agua, "2");
});

test("hash de bloque es estable y la clave se compara exactamente", () => {
  const records = [{ catastral: "45-54-09-01", abonado: "21237" }];
  assert.equal(hashFoxProRecords(records), hashFoxProRecords(records));
  assert.equal(hashFoxProRecords(records).length, 64);
  assert.equal(sameSecret("secreto", "secreto"), true);
  assert.equal(sameSecret("secreto", "otro"), false);
});

test("completa la colonia desde la clave cuando FoxPro no la incluye", () => {
  const row = normalizeFoxProRecord({ catastral: "45-54-09-01", abonado: "21237" }, 1);
  assert.equal(row.colonia, "Barrio Sagrado Corazon");
});
