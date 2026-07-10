import { getSessionUser } from "../services/authService.js";
import { env } from "../config/env.js";

const MEDIA_COOKIE_NAME = "aguaschol_media_session";
const mediaCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.isProduction,
  path: "/",
  maxAge: Math.max(env.authSessionDays, 1) * 24 * 60 * 60 * 1000
};
const mediaCookieClearOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.isProduction,
  path: "/"
};

const getCookieToken = (req) => {
  const cookie = String(req.headers.cookie || "")
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${MEDIA_COOKIE_NAME}=`));
  if (!cookie) return "";
  try {
    return decodeURIComponent(cookie.slice(MEDIA_COOKIE_NAME.length + 1));
  } catch {
    return "";
  }
};

export const setMediaSessionCookie = (res, token) => {
  if (token) res.cookie(MEDIA_COOKIE_NAME, token, mediaCookieOptions);
};

export const clearMediaSessionCookie = (res) =>
  res.clearCookie(MEDIA_COOKIE_NAME, mediaCookieClearOptions);

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
    setMediaSessionCookie(res, token);
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireMediaAuth = async (req, res, next) => {
  try {
    const token = getCookieToken(req);
    const user = await getSessionUser(token);
    if (!user) return res.status(401).json({ message: "No autorizado." });
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
