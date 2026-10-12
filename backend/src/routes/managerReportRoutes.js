import { Router } from "express";
import { requireRoles } from "../middleware/authMiddleware.js";
import { createRateLimit } from "../middleware/rateLimit.js";
import { prepareManagerReport, registerManagerReportEvent, getOwnManagerReportArchive } from "../services/managerReportService.js";

const router = Router();
router.use(requireRoles("admin", "gerente"), (_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
router.post("/manager", createRateLimit({ windowMs: 60000, max: 6 }), async (req, res, next) => {
  try { res.status(201).json(await prepareManagerReport(req.body, req.authUser, req.authToken)); }
  catch (error) { next(error); }
});
router.post("/manager/:id/events", createRateLimit({ windowMs: 60000, max: 30 }), async (req, res, next) => {
  try { res.json(await registerManagerReportEvent(req.params.id, req.body, req.authUser, req.authToken)); }
  catch (error) { next(error); }
});
router.get("/manager/:id", async (req, res, next) => {
  try { res.json(await getOwnManagerReportArchive(req.params.id, req.authUser)); }
  catch (error) { next(error); }
});
export default router;
