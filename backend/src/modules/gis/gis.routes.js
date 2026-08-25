import { Router } from "express";
import {
  barrio,
  barrios,
  barriosGeoJson,
  barrioSummary,
  catastro,
  catastroPunto,
  catastroReport,
  config,
  health,
  importReport,
  levantamiento,
  levantamientos,
  lote,
  lotes,
  manzanas,
  quebradas,
  resolveClave,
  search
} from "./gis.controller.js";

const router = Router();
const route = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.get("/config", config);
router.get("/health", route(health));
router.get("/barrios", route(barrios));
router.get("/barrios.geojson", route(barriosGeoJson));
router.get("/barrios/report", route(importReport));
router.get("/barrios/:id", route(barrio));
router.get("/barrios/:id/summary", route(barrioSummary));
router.get("/manzanas", route(manzanas));
router.get("/quebradas", route(quebradas));
router.get("/lotes", route(lotes));
router.get("/lotes/:id", route(lote));
router.get("/catastro", route(catastro));
router.get("/catastro/report", route(catastroReport));
router.get("/catastro/:id", route(catastroPunto));
router.get("/search", route(search));
router.get("/resolve", route(resolveClave));
router.get("/levantamientos", route(levantamientos));
router.get("/levantamientos/:id", route(levantamiento));

export default router;
