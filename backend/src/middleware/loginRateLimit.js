import { env } from "../config/env.js";

const attemptsByIp = new Map();

const getKey = (req) => req.loginRateLimitKey || req.ip || req.socket?.remoteAddress || "unknown";
const getWindowMs = () => Math.max(1, env.authLoginWindowMinutes) * 60 * 1000;
const getMaxAttempts = () => Math.max(1, env.authLoginMaxAttempts);

const pruneExpired = (now) => {
  if (attemptsByIp.size < 1000) return;
  attemptsByIp.forEach((state, key) => {
    if (state.expiresAt <= now) attemptsByIp.delete(key);
  });
};

// ponytail: limite por proceso; usar un almacen compartido si Railway escala a varias replicas.
export const limitLoginAttempts = (req, res, next) => {
  const now = Date.now();
  const key = getKey(req);
  const state = attemptsByIp.get(key);
  req.loginRateLimitKey = key;
  pruneExpired(now);

  if (state?.blockedUntil > now) {
    res.set("Retry-After", String(Math.ceil((state.blockedUntil - now) / 1000)));
    return res.status(429).json({ message: "Demasiados intentos. Intenta nuevamente mas tarde." });
  }

  if (state?.expiresAt <= now) attemptsByIp.delete(key);
  return next();
};

export const recordLoginFailure = (req) => {
  const now = Date.now();
  const key = getKey(req);
  const current = attemptsByIp.get(key);
  const failures = current?.expiresAt > now ? current.failures + 1 : 1;
  const windowMs = getWindowMs();

  attemptsByIp.set(key, {
    failures,
    expiresAt: now + windowMs,
    blockedUntil: failures >= getMaxAttempts() ? now + windowMs : 0
  });
};

export const clearLoginFailures = (req) => attemptsByIp.delete(getKey(req));
export const resetLoginRateLimits = () => attemptsByIp.clear();
