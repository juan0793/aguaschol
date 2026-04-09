import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import { env } from "../config/env.js";
import { createAuditLog } from "./auditService.js";

const maestroPath = path.resolve(env.dbRoot, "backend", "data", "maestro-claves.json");
const maestroMetaPath = path.resolve(env.dbRoot, "backend", "data", "maestro-meta.json");

const sortByClave = (items) =>
  [...items].sort((a, b) => a.clave_catastral.localeCompare(b.clave_catastral, "es"));

const normalizeHeader = (value = "") =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const formatLookupKeyFromDigits = (digits = "") => {
  const cleanedDigits = String(digits).replace(/\D/g, "");

  if (![6, 7, 8, 9].includes(cleanedDigits.length)) {
    return "";
  }

  const chunkSizes = [7, 9].includes(cleanedDigits.length) ? [3, 2, 2, 2] : [2, 2, 2, 2];
  const groups = [];
  let cursor = 0;

  for (const size of chunkSizes) {
    if (cursor >= cleanedDigits.length) break;
    groups.push(cleanedDigits.slice(cursor, cursor + size));
    cursor += size;
  }

  return groups.join("-");
};

const normalizeLookupKey = (value = "") => {
  const raw = value
    .toString()
    .trim();
  const digitsOnly = raw.replace(/\D/g, "");
  const inferred = raw.includes("-") ? "" : formatLookupKeyFromDigits(digitsOnly);
  const cleaned = (inferred || raw)
    .replace(/[^\d-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const parts = cleaned.split("-").filter(Boolean);

  const [firstPart, ...rest] = parts;

  if (
    ![3, 4].includes(parts.length) ||
    !/^\d{2,3}$/.test(firstPart || "") ||
    rest.some((part) => !/^\d{2}$/.test(part))
  ) {
    const error = new Error("La clave debe tener formato 00-00-00, 000-00-00, 00-00-00-00 o 000-00-00-00.");
    error.status = 400;
    throw error;
  }

  return parts.join("-");
};

const buildBaseKey = (clave = "") => {
  const parts = clave.split("-").filter(Boolean);
  return parts.length >= 3 ? parts.slice(0, 3).join("-") : "";
};

const ensureDataDir = () => {
  fs.mkdirSync(path.dirname(maestroPath), { recursive: true });
};

const readJsonFile = (filePath, fallback) => {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const writeJsonFile = (filePath, data) => {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
};

const summarizePadronChanges = (currentRows = [], nextRows = []) => {
  const currentMap = new Map(currentRows.map((item) => [item.clave_catastral, item]));
  const nextMap = new Map(nextRows.map((item) => [item.clave_catastral, item]));

  let added = 0;
  let removed = 0;
  let changed = 0;

  nextMap.forEach((nextItem, clave) => {
    const currentItem = currentMap.get(clave);
    if (!currentItem) {
      added += 1;
      return;
    }

    if (
      (currentItem.inquilino ?? "") !== (nextItem.inquilino ?? "") ||
      (currentItem.nombre ?? "") !== (nextItem.nombre ?? "") ||
      Number(currentItem.total ?? 0) !== Number(nextItem.total ?? 0)
    ) {
      changed += 1;
    }
  });

  currentMap.forEach((_currentItem, clave) => {
    if (!nextMap.has(clave)) {
      removed += 1;
    }
  });

  return {
    added,
    removed,
    changed
  };
};

const parseNumericValue = (value) => {
  if (value == null || value === "") return 0;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value)
    .trim()
    .replace(/,/g, "")
    .replace(/\s+/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeServiceFlag = (value) => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "S") return "S";
  if (normalized === "N") return "N";
  return normalized || "";
};

const normalizeLookupText = (value = "") =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

const normalizeMasterRows = (rows = []) =>
  sortByClave(
    rows
      .map((item) => {
        try {
          const clave = normalizeLookupKey(String(item?.clave_catastral ?? item?.catastral ?? ""));
          const valor = parseNumericValue(item?.valor);
          const intereses = parseNumericValue(item?.intereses);
          const inquilino = String(item?.inquilino ?? item?.nombre ?? "").trim();
          const nombre = String(item?.nombre ?? "").trim();
          const abonado = String(item?.abonado ?? "").trim();
          const barrioColonia = String(item?.des_coloni ?? item?.barrio_colonia ?? "").trim();
          return {
            clave_catastral: clave,
            clave_base: buildBaseKey(clave),
            inquilino,
            nombre,
            abonado,
            barrio_colonia: barrioColonia,
            agua: normalizeServiceFlag(item?.agua),
            alcantarillado: normalizeServiceFlag(item?.alcantarillado ?? item?.alca),
            barrido: normalizeServiceFlag(item?.barrido ?? item?.barr),
            recoleccion: normalizeServiceFlag(item?.recoleccion ?? item?.tren),
            desechos_peligrosos: normalizeServiceFlag(item?.desechos_peligrosos ?? item?.bomb),
            search_name: normalizeLookupText(`${inquilino} ${nombre}`),
            search_abonado: normalizeLookupText(abonado),
            valor,
            intereses,
            total: Number((valor + intereses).toFixed(2))
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
  );

const detectColumnKey = (columns, candidates) => {
  const normalizedColumns = columns.map((column) => ({
    original: column,
    normalized: normalizeHeader(column)
  }));

  for (const candidate of candidates) {
    const match = normalizedColumns.find((column) => column.normalized === candidate);
    if (match) {
      return match.original;
    }
  }

  return "";
};

const parseWorkbookRows = (buffer) => {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    const error = new Error("El archivo no contiene hojas para procesar.");
    error.status = 400;
    throw error;
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const catastralKey = detectColumnKey(columns, ["catastral", "clave_catastral", "clave", "catastral"]);
  const abonadoKey = detectColumnKey(columns, ["abonado", "abonada", "cuenta", "numero_abonado"]);
  const inquilinoKey = detectColumnKey(columns, ["inquilino", "nombre", "propietario", "abonado"]);
  const nombreKey = detectColumnKey(columns, ["nombre", "propietario", "titular", "razon_social"]);
  const desColoniKey = detectColumnKey(columns, ["des_coloni", "barrio_colonia", "colonia", "barrio"]);
  const aguaKey = detectColumnKey(columns, ["agua"]);
  const alcaKey = detectColumnKey(columns, ["alca", "alcantarillado"]);
  const barrKey = detectColumnKey(columns, ["barr", "barrido"]);
  const trenKey = detectColumnKey(columns, ["tren", "recoleccion"]);
  const bombKey = detectColumnKey(columns, ["bomb", "desechos_peligrosos"]);
  const valorKey = detectColumnKey(columns, ["valor", "saldo", "principal"]);
  const interesesKey = detectColumnKey(columns, ["intereses", "mora", "recargo"]);

  if (!catastralKey) {
    const error = new Error("No se encontro una columna de clave catastral en el Excel.");
    error.status = 400;
    throw error;
  }

  const rowsWithClave = rows.filter((row) => String(row[catastralKey] ?? "").trim());
  const discardedMissingClave = rows.length - rowsWithClave.length;
  const normalizedRows = rowsWithClave
    .map((row) => ({
      clave_catastral: row[catastralKey],
      abonado: abonadoKey ? row[abonadoKey] : "",
      inquilino: inquilinoKey ? row[inquilinoKey] : "",
      nombre: nombreKey ? row[nombreKey] : "",
      des_coloni: desColoniKey ? row[desColoniKey] : "",
      agua: aguaKey ? row[aguaKey] : "",
      alca: alcaKey ? row[alcaKey] : "",
      barr: barrKey ? row[barrKey] : "",
      tren: trenKey ? row[trenKey] : "",
      bomb: bombKey ? row[bombKey] : "",
      valor: valorKey ? row[valorKey] : 0,
      intereses: interesesKey ? row[interesesKey] : 0
    }));

  return {
    sheetName: firstSheetName,
    rows: normalizeMasterRows(normalizedRows),
    stats: {
      source_rows: rows.length,
      discarded_missing_clave: discardedMissingClave
    }
  };
};

let masterRecords = normalizeMasterRows(readJsonFile(maestroPath, []));
let masterMeta = readJsonFile(maestroMetaPath, {
  file_name: fs.existsSync(maestroPath) ? path.basename(maestroPath) : "",
  sheet_name: "",
  total_records: masterRecords.length,
  updated_at: fs.existsSync(maestroPath) ? fs.statSync(maestroPath).mtime.toISOString() : null,
  last_import_summary: {
    added: 0,
    removed: 0,
    changed: 0
  }
});

export const getClaveLookupMeta = async () => ({
  ok: true,
  meta: {
    file_name: masterMeta.file_name || "",
    sheet_name: masterMeta.sheet_name || "",
    total_records: Number(masterMeta.total_records) || masterRecords.length,
    updated_at: masterMeta.updated_at || null,
    last_import_summary: masterMeta.last_import_summary ?? {
      added: 0,
      removed: 0,
      changed: 0
    }
  }
});

export const uploadClavePadron = async ({ buffer, originalName = "" }, options = {}) => {
  if (!buffer || !buffer.length) {
    const error = new Error("Debes seleccionar un archivo de padron maestro.");
    error.status = 400;
    throw error;
  }

  const { sheetName, rows, stats } = parseWorkbookRows(buffer);

  if (!rows.length) {
    const error = new Error("El archivo no contiene claves catastrales validas.");
    error.status = 400;
    throw error;
  }

  const importSummary = summarizePadronChanges(masterRecords, rows);
  writeJsonFile(maestroPath, rows);

  masterMeta = {
    file_name: originalName || "padron-maestro.xlsx",
    sheet_name: sheetName,
    total_records: rows.length,
    updated_at: new Date().toISOString(),
    last_import_summary: {
      ...importSummary,
      discarded_missing_clave: stats?.discarded_missing_clave ?? 0,
      source_rows: stats?.source_rows ?? rows.length
    }
  };
  writeJsonFile(maestroMetaPath, masterMeta);
  masterRecords = rows;

  try {
    await createAuditLog({
      actorUserId: options.actorUserId ?? null,
      action: "padron.updated",
      entityType: "padron",
      entityId: "maestro",
      summary: `Padron maestro actualizado con ${rows.length} claves`,
      details: {
        file_name: masterMeta.file_name,
        sheet_name: masterMeta.sheet_name,
        total_records: masterMeta.total_records,
        import_summary: masterMeta.last_import_summary
      }
    });
  } catch {
    // The padrón should still be updated even if audit logging is temporarily unavailable.
  }

  return {
    ok: true,
    meta: masterMeta,
    import_summary: masterMeta.last_import_summary
  };
};

export const searchClaveCatastral = async (value, options = {}) => {
  const field = ["clave", "nombre", "abonado"].includes(options.field) ? options.field : "clave";
  let normalized = String(value ?? "").trim();
  let mode = "contains";

  if (field === "clave") {
    normalized = normalizeLookupKey(value);
    const parts = normalized.split("-");
    mode = parts.length === 4 ? "exact" : "base";
  } else if (field === "nombre") {
    normalized = normalizeLookupText(value);
    if (normalized.length < 3) {
      const error = new Error("El nombre debe tener al menos 3 caracteres.");
      error.status = 400;
      throw error;
    }
  } else if (field === "abonado") {
    normalized = String(value ?? "").replace(/\D/g, "").trim();
    if (normalized.length < 3) {
      const error = new Error("El numero de abonado debe tener al menos 3 digitos.");
      error.status = 400;
      throw error;
    }
  }

  const matches = sortByClave(
    masterRecords.filter((item) => {
      if (field === "clave") {
        return mode === "exact" ? item.clave_catastral === normalized : item.clave_base === normalized;
      }

      if (field === "nombre") {
        return item.search_name?.includes(normalized);
      }

      return String(item.abonado ?? "").includes(normalized);
    })
  );

  return {
    ok: true,
    query: value,
    normalized_query: normalized,
    field,
    mode,
    exists: matches.length > 0,
    total_matches: matches.length,
    matches
  };
};

export const exportClavePadronWorkbook = async () => {
  const workbook = XLSX.utils.book_new();
  const rows = masterRecords.map((item) => ({
    catastral: item.clave_catastral,
    nombre: item.inquilino ?? "",
    numero_abonado: item.abonado ?? "",
    titular: item.nombre ?? "",
    barrio_colonia: item.barrio_colonia ?? "",
    agua: item.agua ?? "",
    alcantarillado: item.alcantarillado ?? "",
    barrido: item.barrido ?? "",
    recoleccion: item.recoleccion ?? "",
    desechos_peligrosos: item.desechos_peligrosos ?? "",
    valor: Number(item.valor ?? 0),
    intereses: Number(item.intereses ?? 0),
    total: Number(item.total ?? 0)
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, masterMeta.sheet_name || "padron");

  return {
    fileName: `padron-maestro-${new Date().toISOString().slice(0, 10)}.xlsx`,
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
  };
};
