import {
  getGisConfig,
  getGisStatus,
  getTerritoryBarrio,
  getTerritoryBarrioSummary,
  getTerritoryBarrios,
  getTerritoryBarriosGeoJson,
  getTerritoryImportReport,
  getTerritoryManzanas,
  getTerritoryQuebradas
} from "./gis.service.js";

export const config = (req, res) => res.json(getGisConfig(req.authUser));

export const health = async (_req, res) => res.json(await getGisStatus());

const sendMaybe = (res, data) => data ? res.json(data) : res.status(404).json({ message: "No encontrado." });

export const barrios = async (_req, res) => res.json(await getTerritoryBarrios());
export const barriosGeoJson = async (_req, res) => res.json(await getTerritoryBarriosGeoJson());
export const barrio = async (req, res) => sendMaybe(res, await getTerritoryBarrio(req.params.id));
export const barrioSummary = async (req, res) => sendMaybe(res, await getTerritoryBarrioSummary(req.params.id));
export const manzanas = async (req, res) => res.json(await getTerritoryManzanas(req.query.barrioId));
export const quebradas = async (_req, res) => res.json(await getTerritoryQuebradas());
export const importReport = async (_req, res) => res.json(await getTerritoryImportReport());
