import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";
import { createAuditLog } from "./auditService.js";

const barrioCodesPath = path.resolve(env.dbRoot, "backend", "data", "barrio-codes.json");

const defaultBarrioCodes = [
  ["01", "Barrio Suyapa"],
  ["02", "Lotificacion Carranza"],
  ["03", "Barrio Nueva Esperanza"],
  ["04", "Brisas del Sur"],
  ["05", "Barrio Campo Sol"],
  ["06", "Barrio La Ceiba"],
  ["07", "Barrio Campo Luna"],
  ["08", "Barrio Piedras Azules"],
  ["09", "Barrio Santa Lucia"],
  ["10", "Barrio San Juan Bosco"],
  ["11", "Barrio Los Graneros"],
  ["12", "Barrio El Hospital"],
  ["13", "Barrio Corbeta"],
  ["14", "Barrio El Centro"],
  ["15", "Barrio La Cruz"],
  ["16", "Barrio Los Mangos"],
  ["17", "Barrio Morazan"],
  ["18", "Barrio Los Fuertes"],
  ["19", "Aterrizaje"],
  ["20", "Barrio Alegria"],
  ["21", "Barrio El Cortijo"],
  ["22", "Barrio Cabanas"],
  ["23", "Barrio El Estadio"],
  ["24", "La Libertad"],
  ["25", "Barrio Guadalupe"],
  ["26", "Barrio Tamarindo"],
  ["27", "Barrio La Esperanza"],
  ["28", "Barrio El Porvenir"],
  ["29", "Barrio Valle"],
  ["30", "Las Colinas"],
  ["31", "Barrio El Brasil"],
  ["33", "Colonia 9 de Enero"],
  ["34", "Barrio Gracias a Dios"],
  ["35", "Barrio San Pedro Sur"],
  ["36", "Las Acacias"],
  ["37", "Colonia Santa Marta"],
  ["38", "Barrio El Recreo"],
  ["39", "Buenos Aires"],
  ["40", "Las Vegas"],
  ["42", "Barrio El Estruendo"],
  ["43", "La Venecia"],
  ["44", "Colonia Monsenor Marcelo Gerin"],
  ["45", "Barrio Sagrado Corazon"],
  ["46", "Barrio La Providencia"],
  ["47", "Colonia Iberia"],
  ["48", "Colonia Victor Argenal"],
  ["49", "Colonia 15 de Septiembre"],
  ["50", "Las Arenas"],
  ["51", "Barrio El Progreso"],
  ["54", "Barrio San Fco del Palomar"],
  ["55", "Colonia Miramonte"],
  ["56", "Julio Midence"],
  ["59", "Colonia Maria Milagrosa"],
  ["62", "Barrio Los Llanos"],
  ["64", "Colonia Isidro Pineda"],
  ["70", "Colonia El Eden"],
  ["81", "Barrio San Luis"],
  ["90", "Barrio Nueva Jerusalen"],
  ["91", "Villas del Cortijo"],
  ["96", "Cumbre Chorotega"],
  ["100", "Stybis"],
  ["114", "Lotificacion Beel"],
  ["115", "Barrio San Pedro del Norte"],
  ["117", "Colonia Luis Alonso Narvaez"],
  ["125", "Colonia Rotaria"],
  ["136", "Colonia Cristo de Esquipulas"],
  ["141", "Nueva Bella Vista"]
].map(([codigo, barrio]) => ({ codigo, barrio, activo: true }));
const defaultCodeSet = new Set(defaultBarrioCodes.map((item) => item.codigo));

const ensureDataDir = () => {
  fs.mkdirSync(path.dirname(barrioCodesPath), { recursive: true });
};

const normalizeCode = (value = "") => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length <= 2 ? digits.padStart(2, "0") : digits;
};

const normalizeBarrio = (value = "") => String(value ?? "").trim().replace(/\s+/g, " ");

const normalizeItems = (items = []) => {
  const byCode = new Map();

  items.forEach((item) => {
    const codigo = normalizeCode(item?.codigo ?? item?.code);
    const barrio = normalizeBarrio(item?.barrio ?? item?.nombre ?? item?.name);
    if (!codigo || !barrio) return;
    byCode.set(codigo, {
      codigo,
      barrio,
      activo: item?.activo === false ? false : true,
      created_at: item?.created_at || new Date().toISOString(),
      updated_at: item?.updated_at || new Date().toISOString()
    });
  });

  return Array.from(byCode.values()).sort((left, right) => {
    const leftNumber = Number(left.codigo);
    const rightNumber = Number(right.codigo);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }
    return left.codigo.localeCompare(right.codigo, "es");
  });
};

const readStoredCodes = () => {
  if (!fs.existsSync(barrioCodesPath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(barrioCodesPath, "utf8").replace(/^\uFEFF/, ""));
    return Array.isArray(parsed?.barrios) ? parsed.barrios : Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeStoredCodes = (items) => {
  ensureDataDir();
  fs.writeFileSync(
    barrioCodesPath,
    JSON.stringify(
      {
        updated_at: new Date().toISOString(),
        barrios: normalizeItems(items)
      },
      null,
      2
    ),
    "utf8"
  );
};

const getMergedCodes = () => {
  const stored = readStoredCodes();
  const merged = normalizeItems([...defaultBarrioCodes, ...stored]);
  if (!fs.existsSync(barrioCodesPath)) {
    writeStoredCodes(merged);
  }
  return merged;
};

export const listBarrioCodes = async () => getMergedCodes();

export const resolveBarrioNameFromClave = (clave = "", fallback = "") => {
  const firstPart = String(clave ?? "").trim().split("-").filter(Boolean)[0] || "";
  const codigo = normalizeCode(firstPart);
  if (!codigo) return normalizeBarrio(fallback);
  const match = getMergedCodes().find((item) => item.activo && item.codigo === codigo);
  return match?.barrio || normalizeBarrio(fallback);
};

export const resolveBarrioFromRecord = (record = {}, fallback = "") =>
  normalizeBarrio(record.barrio_colonia) ||
  resolveBarrioNameFromClave(record.clave_catastral ?? record.clave_aguas_formato ?? record.clave_alcaldia, fallback);

export const getBarrioByClave = async (clave = "") => {
  const barrio = resolveBarrioNameFromClave(clave);
  if (!barrio) return null;
  const codigo = normalizeCode(String(clave ?? "").trim().split("-").filter(Boolean)[0] || "");
  return getMergedCodes().find((item) => item.activo && item.codigo === codigo) ?? null;
};

export const saveBarrioCode = async (payload = {}, options = {}) => {
  const codigo = normalizeCode(payload.codigo);
  const barrio = normalizeBarrio(payload.barrio);

  if (!codigo || !barrio) {
    const error = new Error("Debes indicar codigo y barrio.");
    error.status = 400;
    throw error;
  }

  const current = getMergedCodes();
  const existing = current.find((item) => item.codigo === codigo);
  const nextItem = {
    codigo,
    barrio,
    activo: payload.activo === false ? false : true,
    created_at: existing?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const next = normalizeItems([...current.filter((item) => item.codigo !== codigo), nextItem]);
  writeStoredCodes(next);

  await createAuditLog({
    actorUserId: options.actorUserId ?? null,
    action: existing ? "barrio_code.updated" : "barrio_code.created",
    entityType: "barrio_code",
    entityId: codigo,
    summary: `Codigo ${codigo} asignado a ${barrio}`
  });

  return nextItem;
};

export const deleteBarrioCode = async (codigoValue = "", options = {}) => {
  const codigo = normalizeCode(codigoValue);
  const current = getMergedCodes();
  const existing = current.find((item) => item.codigo === codigo);

  if (!existing) {
    const error = new Error("Codigo de barrio no encontrado.");
    error.status = 404;
    throw error;
  }

  const next = defaultCodeSet.has(codigo)
    ? current.map((item) => (item.codigo === codigo ? { ...item, activo: false, updated_at: new Date().toISOString() } : item))
    : current.filter((item) => item.codigo !== codigo);
  writeStoredCodes(next);

  await createAuditLog({
    actorUserId: options.actorUserId ?? null,
    action: "barrio_code.deleted",
    entityType: "barrio_code",
    entityId: codigo,
    summary: `Codigo ${codigo} eliminado del catalogo de barrios`
  });

  return { codigo };
};
