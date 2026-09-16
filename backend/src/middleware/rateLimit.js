// Limite de frecuencia por usuario autenticado (o IP), en memoria del proceso. Mismo criterio
// que loginRateLimit.js: basta para una sola replica; usar un almacen compartido si se escala.
export const createRateLimit = ({ windowMs, max, message = "Demasiadas solicitudes. Intenta de nuevo en un momento." }) => {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.authUser?.id ? `user:${req.authUser.id}` : `ip:${req.ip || "unknown"}`;
    const state = hits.get(key);
    if (!state || state.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      if (hits.size > 1000) hits.forEach((value, entry) => value.resetAt <= now && hits.delete(entry));
      return next();
    }
    state.count += 1;
    if (state.count > max) {
      res.set("Retry-After", String(Math.ceil((state.resetAt - now) / 1000)));
      return res.status(429).json({ message });
    }
    return next();
  };
};
