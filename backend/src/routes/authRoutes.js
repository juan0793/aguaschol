import { Router } from "express";
import { env } from "../config/env.js";

const router = Router();

router.post("/login", (req, res) => {
  const { username, password } = req.body ?? {};

  if (username !== env.authUsername || password !== env.authPassword) {
    return res.status(401).json({ message: "Usuario o contrasena incorrectos." });
  }

  return res.json({
    token: env.authToken,
    user: {
      username: env.authUsername,
      role: "admin"
    }
  });
});

export default router;
