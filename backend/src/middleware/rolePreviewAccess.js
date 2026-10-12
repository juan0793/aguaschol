import { READ_ROUTES, QUERY_POSTS } from "./managerAccess.js";
export function requireRolePreviewAccess(req, res, next) {
  if (!req.authUser?.preview) return next();
  res.setHeader("Cache-Control", "private, no-store");
  const path = req.path.replace(/\/$/, "") || "/";
  const recovery = req.baseUrl === "/api/auth" && (
    (req.method === "DELETE" && path === "/preview") ||
    (req.method === "GET" && path === "/me") ||
    (req.method === "POST" && path === "/logout"));
  if (recovery) return next();
  if (req.authUser.preview.expired) return res.status(403).json({ message: "El modo de prueba venció. Vuelve a administrador." });
  const read = ["GET", "HEAD"].includes(req.method);
  const media = (req.baseUrl === "" && /^\/(?:api\/)?uploads\/[^/]+$/.test(path)) ||
    (["/planos-pdf", "/api/planos-pdf"].includes(req.baseUrl) && /^\/[^/]+$/.test(path));
  const query = req.method === "POST" && req.baseUrl !== "/api/reports" && QUERY_POSTS[req.baseUrl]?.includes(path);
  const exportReport = req.authUser.role === "gerente" && req.baseUrl === "/api/reports" && req.method === "POST" &&
    (path === "/manager" || /^\/manager\/RPT-\d{8}-\d{6}-[A-F0-9]{8}\/events$/.test(path));
  if ((read && (READ_ROUTES[req.baseUrl]?.test(path) || media)) || query || exportReport) return next();
  return res.status(403).json({ message: "Modo de prueba: solo consulta. Esta operación está bloqueada." });
}
