import crypto from "node:crypto";
import { env } from "../config/env.js";

const attempts = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;

const sameSecret = (left, right) => {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
};

export const requireFoxProSyncKey = (req, res, next) => {
  if (!env.foxProSyncApiKey) return res.status(503).json({ message: "Integracion FoxPro no configurada." });

  const now = Date.now();
  const key = req.ip || req.socket?.remoteAddress || "unknown";
  const current = attempts.get(key);
  const entry = !current || now - current.startedAt >= WINDOW_MS ? { startedAt: now, count: 0 } : current;
  entry.count += 1;
  attempts.set(key, entry);
  if (entry.count > MAX_REQUESTS) return res.status(429).json({ message: "Demasiadas solicitudes de integracion." });

  const authorization = String(req.headers.authorization || "");
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!sameSecret(token, env.foxProSyncApiKey)) return res.status(401).json({ message: "Credencial de integracion invalida." });
  return next();
};

export { sameSecret };
