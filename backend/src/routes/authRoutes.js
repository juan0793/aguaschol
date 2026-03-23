import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { loginUser, logoutUser } from "../services/authService.js";

const router = Router();

router.post("/login", async (req, res, next) => {
  try {
    const session = await loginUser(req.body ?? {});
    res.json(session);
  } catch (error) {
    next(error);
  }
});

router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    await logoutUser(req.authToken, req.authUser);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
