import { Router } from "express";
import {
  clearMediaSessionCookie,
  requireAdmin,
  requireAuth,
  setMediaSessionCookie
} from "../middleware/authMiddleware.js";
import { clearLoginFailures, limitLoginAttempts, recordLoginFailure } from "../middleware/loginRateLimit.js";
import { changeOwnPassword, getSessionUser, loginUser, logoutAllSessions, logoutUser } from "../services/authService.js";
import { changeRolePreview } from "../services/rolePreviewService.js";
import { createRateLimit } from "../middleware/rateLimit.js";

const router = Router();
const previewLimit = createRateLimit({ windowMs: 60000, max: 12 });
router.post("/preview", requireAuth, requireAdmin, previewLimit, async (req, res, next) => {
  try {
    if (!req.body || Object.keys(req.body).some((key) => key !== "role") || typeof req.body.role !== "string") {
      return res.status(400).json({ message: "Selecciona un perfil de prueba válido." });
    }
    await changeRolePreview(req.authToken, req.body.role);
    res.setHeader("Clear-Site-Data", '"cache"');
    res.json({ user: await getSessionUser(req.authToken) });
  } catch (error) { next(error); }
});
router.delete("/preview", requireAuth, previewLimit, async (req, res, next) => {
  try {
    await changeRolePreview(req.authToken, null);
    res.setHeader("Clear-Site-Data", '"cache"');
    res.json({ user: await getSessionUser(req.authToken) });
  } catch (error) { next(error); }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.authUser });
});

router.post("/login", limitLoginAttempts, async (req, res, next) => {
  try {
    const session = await loginUser(req.body ?? {});
    clearLoginFailures(req);
    setMediaSessionCookie(res, session.token);
    res.json(session);
  } catch (error) {
    if (error.status === 401) recordLoginFailure(req);
    next(error);
  }
});

router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    await logoutUser(req.authToken, req.authUser);
    clearMediaSessionCookie(res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/logout-on-exit", async (req, res, next) => {
  try {
    const token = req.body?.token ?? "";
    const user = await getSessionUser(token);
    if (user) await logoutUser(token, user);
    clearMediaSessionCookie(res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/logout-all", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const closedSessions = await logoutAllSessions(req.authUser);
    clearMediaSessionCookie(res);
    res.json({ ok: true, closedSessions });
  } catch (error) {
    next(error);
  }
});

router.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const user = await changeOwnPassword({
      userId: req.authUser.id,
      currentPassword: req.body?.current_password,
      newPassword: req.body?.new_password
    });

    res.json({
      ok: true,
      user
    });
  } catch (error) {
    next(error);
  }
});

export default router;
