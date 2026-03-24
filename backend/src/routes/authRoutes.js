import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { changeOwnPassword, loginUser, logoutUser } from "../services/authService.js";

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
