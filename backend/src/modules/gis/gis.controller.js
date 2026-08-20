import {
  getGisConfig,
  getGisStatus,
  getCatastroBbox,
  getTerritoryBarrio,
  getTerritoryBarrioSummary,
  getTerritoryBarrios,
  getTerritoryBarriosGeoJson,
  getTerritoryCatastro,
  getTerritoryCatastroReport,
  getTerritoryImportReport,
  getTerritoryLote,
  getLotesBbox,
  getTerritoryManzanas,
  getTerritoryQuebradas,
  searchTerritorialGis
} from "./gis.service.js";

export const config = (req, res) => res.json(getGisConfig(req.authUser));

export const health = async (_req, res) => res.json(await getGisStatus());

const sendMaybe = (res, data) => data ? res.json(data) : res.status(404).json({ message: "No encontrado." });
const parseBbox = (value = "") => {
  const parts = String(value).split(",").map(Number);
  if (parts.length !== 4 || parts.some((item) => !Number.isFinite(item))) {
    const error = new Error("bbox debe tener minLng,minLat,maxLng,maxLat.");
    error.status = 400;
    throw error;
  }
  const [minLng, minLat, maxLng, maxLat] = parts;
  if (minLng >= maxLng || minLat >= maxLat || minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) {
    const error = new Error("bbox fuera de rango.");
    error.status = 400;
    throw error;
  }
  return parts;
};
const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

export const barrios = async (_req, res) => res.json(await getTerritoryBarrios());
export const barriosGeoJson = async (_req, res) => res.json(await getTerritoryBarriosGeoJson());
export const barrio = async (req, res) => sendMaybe(res, await getTerritoryBarrio(req.params.id));
export const barrioSummary = async (req, res) => sendMaybe(res, await getTerritoryBarrioSummary(req.params.id));
export const manzanas = async (req, res) => res.json(await getTerritoryManzanas(req.query.barrioId));
export const quebradas = async (_req, res) => res.json(await getTerritoryQuebradas());
export const importReport = async (_req, res) => res.json(await getTerritoryImportReport());
export const lotes = async (req, res) => res.json(await getLotesBbox({
  bbox: parseBbox(req.query.bbox),
  limit: clamp(req.query.limit, 50, 1200, 800)
}));
export const catastro = async (req, res) => res.json(await getCatastroBbox({
  bbox: parseBbox(req.query.bbox),
  zoom: clamp(req.query.zoom, 1, 22, 15),
  limit: clamp(req.query.limit, 50, 1500, 1000)
}));
export const search = async (req, res) => res.json(await searchTerritorialGis(req.query.q));
export const lote = async (req, res) => sendMaybe(res, await getTerritoryLote(req.params.id));
export const catastroPunto = async (req, res) => sendMaybe(res, await getTerritoryCatastro(req.params.id));
export const catastroReport = async (_req, res) => res.json(await getTerritoryCatastroReport());
