import { getMasterRecords, getMasterVersion } from "./claveLookupService.js";

// El padron maestro vive en memoria del proceso (claveLookupService), no en MySQL.
// searchClaveCatastral recorre linealmente los ~24,000 registros en cada llamada, lo cual es
// aceptable para una busqueda puntual pero inviable para miles de claves.
// Aqui se construye una sola vez un indice por clave base y se reutiliza hasta que cambie el padron.

let cache = { version: "", byBase: new Map(), byExact: new Map() };

const buildIndex = () => {
  const byBase = new Map();
  const byExact = new Map();

  getMasterRecords().forEach((record) => {
    if (record.clave_catastral) {
      const exactRows = byExact.get(record.clave_catastral);
      if (exactRows) exactRows.push(record);
      else byExact.set(record.clave_catastral, [record]);
    }

    if (record.clave_base) {
      const baseRows = byBase.get(record.clave_base);
      if (baseRows) baseRows.push(record);
      else byBase.set(record.clave_base, [record]);
    }
  });

  return { byBase, byExact };
};

export const getPadronIndex = () => {
  const version = getMasterVersion();
  if (cache.version !== version) {
    cache = { version, ...buildIndex() };
  }
  return cache;
};

export const getPadronMatchesForBase = (claveBase = "") =>
  (claveBase ? getPadronIndex().byBase.get(claveBase) : null) ?? [];

export const getPadronIndexStats = () => {
  const index = getPadronIndex();
  return { version: index.version, bases: index.byBase.size, claves: index.byExact.size };
};

// Solo para pruebas: fuerza la reconstruccion en la siguiente consulta.
export const __resetPadronIndexCache = () => {
  cache = { version: "", byBase: new Map(), byExact: new Map() };
};
