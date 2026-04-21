import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import { env } from "../config/env.js";
import { createAuditLog } from "./auditService.js";

const maestroPath = path.resolve(env.dbRoot, "backend", "data", "maestro-claves.json");
const maestroMetaPath = path.resolve(env.dbRoot, "backend", "data", "maestro-meta.json");
const maestroSourcePath = path.resolve(env.dbRoot, "backend", "data", "maestro-source-upload.bin");

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

const writeBinaryFile = (filePath, buffer) => {
  ensureDataDir();
  fs.writeFileSync(filePath, buffer);
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
          const barrioColonia = String(
            item?.des_coloni ??
              item?.barrio_colonia ??
              item?.direccion ??
              item?.domicilio ??
              item?.ubicacion ??
              ""
          ).trim();
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
            search_barrio: normalizeLookupText(barrioColonia),
            search_target: normalizeLookupText(`${inquilino} ${nombre} ${abonado} ${clave} ${barrioColonia}`),
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
  const desColoniKey = detectColumnKey(columns, [
    "des_coloni",
    "barrio_colonia",
    "colonia",
    "barrio",
    "direccion",
    "domicilio",
    "ubicacion"
  ]);
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

const PADRON_REQUEST_TEMPLATES = [
  {
    id: "apartamentos",
    label: "Apartamentos",
    description: "Apartamentos y unidades habitacionales agrupadas por barrio para control administrativo.",
    title: "Reporte general de apartamentos",
    keywords: ["apart", "apartamento", "apartamentos", "apto", "aptos"]
  },
  {
    id: "salud",
    label: "Salud",
    description: "Clinicas, hospitales, odontologia y laboratorios agrupados por barrio.",
    title: "Listado institucional de establecimientos de salud",
    keywords: [
      "clinica",
      "hospital",
      "odont",
      "dental",
      "laborat",
      "policlinica",
      "salud",
      "medic"
    ]
  },
  {
    id: "plazas_comerciales",
    label: "Plazas comerciales",
    description: "Locales y plazas comerciales agrupados por barrio para revision institucional.",
    title: "Listado institucional de plazas comerciales",
    keywords: ["plaza", "comercial", "mall", "centro comercial"]
  },
  {
    id: "farmacias",
    label: "Farmacias",
    description: "Farmacias y establecimientos relacionados agrupados por barrio.",
    title: "Listado institucional de farmacias",
    keywords: ["farmacia", "botica", "drogueria"]
  },
  {
    id: "educacion",
    label: "Educacion",
    description: "Escuelas, colegios, institutos, universidades y centros educativos.",
    title: "Listado institucional de centros educativos",
    keywords: ["escuela", "colegio", "instituto", "universidad", "kinder", "jardin"]
  },
  {
    id: "hoteles",
    label: "Hoteles",
    description: "Hoteles, hostales y hospedajes agrupados por barrio.",
    title: "Listado institucional de hoteles y hospedajes",
    keywords: ["hotel", "hostal", "hospedaje"]
  },
  {
    id: "restaurantes",
    label: "Restaurantes",
    description: "Restaurantes, cafeterias y comedores agrupados por barrio.",
    title: "Listado institucional de restaurantes y cafeterias",
    keywords: ["restaurante", "cafeteria", "comedor", "pollos", "pizzeria"]
  },
  {
    id: "talleres",
    label: "Talleres",
    description: "Talleres mecanicos, electricos y de servicio tecnico agrupados por barrio.",
    title: "Listado institucional de talleres y servicios tecnicos",
    keywords: ["taller", "mecanica", "mecanico", "electrico", "reparacion"]
  },
  {
    id: "gasolineras",
    label: "Gasolineras",
    description: "Gasolineras, estaciones de servicio y expendios de combustible.",
    title: "Listado institucional de gasolineras y estaciones de servicio",
    keywords: ["gasolinera", "estacion", "combustible", "bomba"]
  }
];

const buildRequestSearchTarget = (item = {}) =>
  normalizeLookupText([item.inquilino, item.nombre, item.barrio_colonia, item.abonado, item.clave_catastral].filter(Boolean).join(" "));

const REQUEST_FIELD_ALIASES = {
  any: "any",
  texto: "any",
  general: "any",
  nombre: "name",
  inquilino: "name",
  titular: "name",
  abonado: "abonado",
  cuenta: "abonado",
  clave: "clave",
  catastral: "clave",
  barrio: "barrio",
  colonia: "barrio",
  ubicacion: "barrio"
};

const stripWrappedQuotes = (value = "") => {
  const trimmed = String(value ?? "").trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

const parseRequestKeyword = (keyword = "") => {
  const raw = String(keyword ?? "").trim();
  if (!raw) {
    return null;
  }

  const isExclude = raw.startsWith("-");
  const unsignedRaw = (isExclude ? raw.slice(1) : raw).trim();
  if (!unsignedRaw) {
    return null;
  }

  const fieldMatch = unsignedRaw.match(/^([a-zA-Z_áéíóúñÁÉÍÓÚÑ]+)\s*:\s*(.+)$/);
  const rawField = fieldMatch?.[1] ? normalizeLookupText(fieldMatch[1]) : "any";
  const field = REQUEST_FIELD_ALIASES[rawField] || "any";
  const rawTerm = fieldMatch?.[2] ?? unsignedRaw;
  const term = normalizeLookupText(stripWrappedQuotes(rawTerm));

  if (term.length < 2) {
    return null;
  }

  return {
    raw,
    mode: isExclude ? "exclude" : "include",
    field,
    term
  };
};

const normalizeRequestKeywords = (keywords = []) => {
  const uniqueMap = new Map();

  (Array.isArray(keywords) ? keywords : []).forEach((keyword) => {
    const parsed = parseRequestKeyword(keyword);
    if (!parsed) {
      return;
    }

    const dedupeKey = `${parsed.mode}:${parsed.field}:${parsed.term}`;
    if (!uniqueMap.has(dedupeKey)) {
      uniqueMap.set(dedupeKey, parsed);
    }
  });

  return Array.from(uniqueMap.values());
};

const matchRequestCriterion = (item, criterion) => {
  const fields = {
    any: item.search_target || buildRequestSearchTarget(item),
    name: item.search_name || normalizeLookupText([item.inquilino, item.nombre].filter(Boolean).join(" ")),
    abonado: item.search_abonado || normalizeLookupText(item.abonado),
    clave: normalizeLookupText(item.clave_catastral),
    barrio: item.search_barrio || normalizeLookupText(item.barrio_colonia)
  };

  const target = fields[criterion.field] || fields.any;
  return target.includes(criterion.term);
};

const buildPadronRequestRows = (keywords = []) => {
  const criteria = normalizeRequestKeywords(keywords);
  const includeCriteria = criteria.filter((criterion) => criterion.mode === "include");
  const excludeCriteria = criteria.filter((criterion) => criterion.mode === "exclude");

  const rows = sortByClave(
    masterRecords
      .map((item) => {
        const matchedIncludeCriteria = includeCriteria.filter((criterion) => matchRequestCriterion(item, criterion));
        if (!matchedIncludeCriteria.length) {
          return null;
        }

        const matchedExcludeCriteria = excludeCriteria.filter((criterion) => matchRequestCriterion(item, criterion));
        if (matchedExcludeCriteria.length) {
          return null;
        }

        return {
          clave_catastral: item.clave_catastral,
          abonado: item.abonado ?? "",
          nombre: item.inquilino ?? "",
          barrio_colonia: item.barrio_colonia || "Sin barrio",
          tarifa: Number(item.valor ?? 0),
          intereses: Number(item.intereses ?? 0),
          total: Number(item.total ?? 0),
          matched_keywords: matchedIncludeCriteria.map((criterion) => criterion.raw),
          excluded_by: matchedExcludeCriteria.map((criterion) => criterion.raw)
        };
      })
      .filter(Boolean)
  );

  return rows;
};

const buildPadronRequestSummary = (rows = []) => {
  const totalsByBarrio = rows.reduce((accumulator, row) => {
    const barrio = row.barrio_colonia || "Sin barrio";
    const current = accumulator.get(barrio) ?? {
      barrio_colonia: barrio,
      total_registros: 0,
      tarifa_total: 0,
      total_con_interes: 0,
      rows: []
    };

    current.total_registros += 1;
    current.tarifa_total += Number(row.tarifa ?? 0);
    current.total_con_interes += Number(row.total ?? 0);
    current.rows.push(row);
    accumulator.set(barrio, current);
    return accumulator;
  }, new Map());

  const barrios = Array.from(totalsByBarrio.values()).sort((left, right) =>
    left.barrio_colonia.localeCompare(right.barrio_colonia, "es")
  );

  return {
    total_registros: rows.length,
    total_barrios: barrios.length,
    tarifa_total: Number(rows.reduce((sum, row) => sum + Number(row.tarifa ?? 0), 0).toFixed(2)),
    total_con_interes: Number(rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0).toFixed(2)),
    barrios
  };
};

export const getClaveLookupMeta = async () => ({
  ok: true,
  meta: {
    file_name: masterMeta.file_name || "",
    source_file_name: masterMeta.source_file_name || masterMeta.file_name || "",
    sheet_name: masterMeta.sheet_name || "",
    total_records: Number(masterMeta.total_records) || masterRecords.length,
    updated_at: masterMeta.updated_at || null,
    source_file_available: fs.existsSync(maestroSourcePath),
    last_import_summary: masterMeta.last_import_summary ?? {
      added: 0,
      removed: 0,
      changed: 0
    }
  }
});

export const getPadronRequestTemplates = async () => ({
  ok: true,
  templates: PADRON_REQUEST_TEMPLATES
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
  writeBinaryFile(maestroSourcePath, buffer);
  writeJsonFile(maestroPath, rows);

  masterMeta = {
    file_name: originalName || "padron-maestro.xlsx",
    source_file_name: originalName || "padron-maestro.xlsx",
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

export const reprocessClavePadron = async (options = {}) => {
  if (!fs.existsSync(maestroSourcePath)) {
    const error = new Error("No hay un Excel fuente guardado para reprocesar el padron.");
    error.status = 404;
    throw error;
  }

  const buffer = fs.readFileSync(maestroSourcePath);
  return uploadClavePadron(
    {
      buffer,
      originalName: masterMeta.source_file_name || masterMeta.file_name || "padron-maestro.xlsx"
    },
    options
  );
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

export const generatePadronRequestReport = async (payload = {}) => {
  const presetId = String(payload.preset_id ?? "").trim();
  const template = PADRON_REQUEST_TEMPLATES.find((item) => item.id === presetId) ?? null;
  const providedKeywords = Array.isArray(payload.keywords) ? payload.keywords : [];
  const customKeywords = normalizeRequestKeywords(providedKeywords);
  const templateKeywords = template?.keywords ?? [];
  const keywords = customKeywords.length ? customKeywords.map((item) => item.raw) : templateKeywords;
  const parsedCriteria = normalizeRequestKeywords(keywords);

  if (!parsedCriteria.some((criterion) => criterion.mode === "include")) {
    const error = new Error("Debes indicar al menos una palabra clave para generar la peticion.");
    error.status = 400;
    throw error;
  }

  const rows = buildPadronRequestRows(keywords);
  const summary = buildPadronRequestSummary(rows);

  return {
    ok: true,
    request: {
      preset_id: template?.id || "custom",
      title: String(payload.title ?? template?.title ?? "Peticion de padron").trim() || "Peticion de padron",
      description:
        String(payload.description ?? template?.description ?? "").trim() ||
        "Consulta administrativa filtrada desde el padron maestro.",
      keywords,
      criteria: {
        include: parsedCriteria.filter((criterion) => criterion.mode === "include").map((criterion) => criterion.raw),
        exclude: parsedCriteria.filter((criterion) => criterion.mode === "exclude").map((criterion) => criterion.raw)
      }
    },
    summary,
    rows
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
