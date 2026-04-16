import { getSessionUser } from "../services/authService.js";

export const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const user = await getSessionUser(token);

    if (!user) {
      return res.status(401).json({ message: "No autorizado." });
    }

    req.authToken = token;
    req.authUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.authUser?.role !== "admin") {
    return res.status(403).json({ message: "Solo administradores." });
  }

  return next();
};

export const requireRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.authUser?.role)) {
    return res.status(403).json({ message: "No tienes permisos para realizar esta accion." });
  }

  return next();
};
