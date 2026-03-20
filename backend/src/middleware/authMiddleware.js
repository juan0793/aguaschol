import { env } from "../config/env.js";

export const requireAuth = (req, res, next) => {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (token !== env.authToken) {
    return res.status(401).json({ message: "No autorizado." });
  }

  return next();
};
