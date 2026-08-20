import { Router } from "express";
import {
  barrio,
  barrios,
  barriosGeoJson,
  barrioSummary,
  config,
  health,
  importReport,
  manzanas,
  quebradas
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

export default router;
