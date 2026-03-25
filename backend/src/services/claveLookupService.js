import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";

const maestroPath = path.resolve(env.dbRoot, "backend", "data", "maestro-claves.json");

const sortByClave = (items) =>
  [...items].sort((a, b) => a.clave_catastral.localeCompare(b.clave_catastral, "es"));

const readMasterRecords = () => {
  if (!fs.existsSync(maestroPath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(maestroPath, "utf8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const masterRecords = sortByClave(
  readMasterRecords().map((item) => ({
    clave_catastral: String(item?.clave_catastral ?? "").trim().toUpperCase(),
    clave_base: String(item?.clave_base ?? "").trim().toUpperCase(),
    inquilino: String(item?.inquilino ?? "").trim()
  }))
);

const normalizeLookupKey = (value = "") => {
  const cleaned = value
    .toString()
    .trim()
    .replace(/[^\d-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const parts = cleaned.split("-").filter(Boolean);

  if (![3, 4].includes(parts.length) || parts.some((part) => !/^\d{2}$/.test(part))) {
    const error = new Error("La clave debe tener formato 00-00-00 o 00-00-00-00.");
    error.status = 400;
    throw error;
  }

  return parts.join("-");
};

export const searchClaveCatastral = async (value) => {
  const normalized = normalizeLookupKey(value);
  const parts = normalized.split("-");
  const mode = parts.length === 4 ? "exact" : "base";
  const matches = sortByClave(
    masterRecords.filter((item) =>
      mode === "exact" ? item.clave_catastral === normalized : item.clave_base === normalized
    )
  );

  return {
    ok: true,
    query: value,
    normalized_query: normalized,
    mode,
    exists: matches.length > 0,
    total_matches: matches.length,
    matches
  };
};
