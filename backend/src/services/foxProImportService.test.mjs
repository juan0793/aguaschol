import assert from "node:assert/strict";
import test from "node:test";
import XLSX from "xlsx";
import { classifyFoxProRow, deleteHistoricalFoxProBatch, exportFoxProBatchWorkbook, foxProRowsToMaster, hashFoxProRecords, hashMasterRecords, normalizeFoxProRecord, pruneOldBatchDetails } from "./foxProImportService.js";
import { normalizeMasterRecords } from "./claveLookupService.js";
import { sameSecret } from "../middleware/foxProSyncAuth.js";

test("normaliza S y N conservando los valores originales", () => {
  const row = normalizeFoxProRecord({ catastral: "45-54-09-01", abonado: " 21237 ", agua: " s ", alca: "N", barr: "", tren: "S", bomb: "N", valor: 100, intereses: 25 }, 1);
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
  assert.match(row.mensaje_error, /principal/i);
  assert.equal(row.dato_original.agua, "2");
});

test("usa el abonado cuando la clave catastral es inutilizable", () => {
  const row = normalizeFoxProRecord({ abonado: "21237", catastral: "SIN-CLAVE", agua: "S", valor: 0, intereses: 0 }, 1);
  assert.equal(row.estado, "RECIBIDO");
  assert.equal(row.clave_catastral, "");
});

test("conserva los valores de servicio propios de FoxPro", () => {
  const row = normalizeFoxProRecord({ abonado: "11045", catastral: "36-02-04-01", agua: "2", alca: "2", barr: "/", bomb: "7" }, 1);
  assert.equal(row.estado, "RECIBIDO");
  assert.deepEqual(
    [row.agua_normalizada, row.alcantarillado_normalizado, row.barrido_normalizado, row.bombeo_normalizado],
    ["2", "2", "/", "7"]
  );
});

test("acepta la clave historica enviada por FoxPro", () => {
  const row = normalizeFoxProRecord({ abonado: "3984", catastral: "22-37-116-03", agua: "S", valor: 0, intereses: 0 }, 1);
  assert.equal(row.estado, "RECIBIDO");
  assert.equal(row.clave_catastral, "22-37-116-03");
});

test("conserva la clave actual cuando FoxPro la omite para un abonado existente", () => {
  const row = normalizeFoxProRecord({ abonado: "21237", catastral: "", valor: 20, intereses: 0 }, 1);
  const result = classifyFoxProRow(
    row,
    new Map([["21237", 1]]),
    new Map([["21237", [{ abonado: "21237", clave_catastral: "45-54-09-01", valor: 10, intereses: 0 }]]])
  );
  assert.equal(row.estado, "RECIBIDO");
  assert.equal(result.estado, "MODIFICADO");
  assert.equal(result.claveCatastral, "45-54-09-01");

  const newSubscriber = classifyFoxProRow(row, new Map([["21237", 1]]), new Map());
  assert.equal(newSubscriber.estado, "NUEVO");
  assert.equal(newSubscriber.claveCatastral, "");
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

test("convierte un lote FoxPro en registros del padron activo", () => {
  const [row] = foxProRowsToMaster([{ clave_catastral: "45-54-09-01", codigo_abonado: "21237", nombre: "JUAN", colonia: "BO. SAGRADO CORAZON", agua_normalizada: "S", valor: 100, intereses: 25 }]);
  assert.deepEqual({ clave: row.clave_catastral, abonado: row.abonado, agua: row.agua, total: row.valor + row.intereses }, { clave: "45-54-09-01", abonado: "21237", agua: "S", total: 125 });
});

test("la huella del padron detecta cambios pero no depende del orden", () => {
  const rows = [{ abonado: "1", valor: 100 }, { abonado: "2", valor: 200 }];
  assert.equal(hashMasterRecords(rows), hashMasterRecords([...rows].reverse()));
  assert.notEqual(hashMasterRecords(rows), hashMasterRecords([{ abonado: "1", valor: 101 }, rows[1]]));
});

test("la verificacion usa la clave normalizada que consulta el sistema", () => {
  const [row] = normalizeMasterRecords([{ clave_catastral: "01050901", abonado: "1" }]);
  assert.equal(row.clave_catastral, "01-05-09-01");
});

test("no limpia detalles si el respaldo activo no esta verificado en R2", async () => {
  const statements = [];
  const pool = { query: async (sql) => {
    statements.push(sql);
    return [[]];
  } };
  const result = await pruneOldBatchDetails({ pool });
  assert.equal(result.pruned, false);
  assert.equal(result.reason, "active_r2_not_verified");
  assert.equal(statements.some((sql) => /^DELETE/i.test(sql.trim())), false);
});

test("crea el respaldo historico faltante antes de eliminar un lote antiguo", async () => {
  const statements = [];
  const historicalKey = "padron/historico/2026-07-15-FOXPRO-ANTIGUO.json.gz";
  const lot = {
    id: 2,
    codigo_lote: "FOXPRO-ANTIGUO",
    estado: "APLICADO",
    total_registros: 2,
    fecha_extraccion: new Date("2026-07-15T07:45:00Z"),
    r2_historico_key: null,
    r2_historico_verificado_at: null
  };
  const records = [
    { numero_fila: 1, codigo_abonado: "100", clave_catastral: "01-02-03-04", nombre: "ANA", colonia: "CENTRO", agua_normalizada: "S", valor: 10, intereses: 1 },
    { numero_fila: 2, codigo_abonado: "101", clave_catastral: "01-02-03-05", nombre: "LUIS", colonia: "CENTRO", agua_normalizada: "N", valor: 20, intereses: 2 }
  ];
  const pool = { query: async (sql) => {
    statements.push(sql);
    if (sql.includes("FROM importacion_padron_lotes")) return [[lot]];
    if (sql.includes("FROM padron_maestro_snapshot")) return [[{ codigo_lote: "FOXPRO-ACTIVO" }]];
    if (sql.includes("FROM importacion_padron_registros")) return [records];
    return [{ affectedRows: 1 }];
  } };
  let verified = false;
  let uploaded = false;
  const r2 = {
    listHistorical: async () => [],
    uploadHistorical: async (snapshot, code, date) => {
      assert.equal(snapshot.length, 2);
      assert.equal(code, lot.codigo_lote);
      assert.equal(date, lot.fecha_extraccion);
      uploaded = true;
      return { key: historicalKey, total_records: snapshot.length };
    },
    getHistoricalStatus: async (key) => {
      assert.equal(key, historicalKey);
      verified = true;
      return { key, total_records: 2 };
    }
  };

  const result = await deleteHistoricalFoxProBatch(lot.codigo_lote, { id: 1 }, {
    pool,
    r2,
    password: "secreta",
    verifyAdminPassword: async (_userId, password) => assert.equal(password, "secreta")
  });
  assert.equal(result.deleted, true);
  assert.equal(uploaded, true);
  assert.equal(verified, true);
  assert.equal(statements.some((sql) => /^DELETE FROM importacion_padron_lotes/i.test(sql.trim())), true);
});

test("descarga el lote FoxPro como padron en Excel sin los registros con error", async () => {
  const statements = [];
  const pool = { query: async (sql, params) => {
    statements.push([sql, params]);
    if (/FROM importacion_padron_lotes/.test(sql)) return [[{ id: 7 }]];
    return [[
      { clave_catastral: "89-13-15", codigo_abonado: "1201", nombre: "MARIA FUNEZ", colonia: "BO. CABAÑAS", agua_normalizada: "S", alcantarillado_normalizado: "N", valor: "120.50", intereses: "9.50" },
      { clave_catastral: "", codigo_abonado: "1202", nombre: "SIN CLAVE", colonia: "", agua_normalizada: "S", valor: 0, intereses: 0 }
    ]];
  } };
  const file = await exportFoxProBatchWorkbook("FOXPRO-20260917-145012-f636fb8c", { pool });
  assert.equal(file.fileName, "padron-FOXPRO-20260917-145012-f636fb8c.xlsx");
  assert.match(statements[1][0], /estado NOT IN \('ERROR','DESCARTADO'\)/);
  const workbook = XLSX.read(file.buffer, { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
  assert.deepEqual(Object.keys(rows[0]), ["catastral", "abonado", "inquilino", "des_coloni", "agua", "alca", "barr", "tren", "bomb", "valor", "intereses", "total"]);
  const maria = rows.find((row) => row.abonado === "1201");
  assert.deepEqual([maria.catastral, maria.inquilino, maria.agua, maria.alca, maria.valor, maria.total], ["89-13-15", "MARIA FUNEZ", "S", "N", 120.5, 130]);
  assert.ok(rows.some((row) => row.abonado === "1202" && row.catastral === ""));
});

test("avisa cuando el lote ya no conserva registros para exportar", async () => {
  const pool = { query: async (sql) => {
    if (/FROM importacion_padron_lotes/.test(sql)) return [[{ id: 3 }]];
    if (/COUNT\(\*\)/.test(sql)) return [[{ total: 0 }]];
    return [[]];
  } };
  await assert.rejects(() => exportFoxProBatchWorkbook("FOXPRO-20260801-000000-aaaa", { pool }), (error) => error.status === 409 && /ya no conserva/.test(error.message));
});
