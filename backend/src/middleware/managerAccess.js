// Lista cerrada: una ruta nueva no concede acceso gerencial por ser GET.
export const READ_ROUTES = {
  "/api/reports": /^\/manager\/RPT-\d{8}-\d{6}-[A-F0-9]{8}$/,
  "/api/inmuebles": /^\/(?:summary|clave\/[^/]+|\d+\/(?:history|aviso))?\/?$/,
  "/api/clandestinos": /^\/(?:config|fichas(?:\/ritmo)?|reportes|history\/[^/]+\/\d+|banco(?:\/(?:listado|refs))?)\/?$/,
  "/api/inspecciones": /^\/(?:config|tecnicos|resumen|stats(?:\/tablero)?|\d+(?:\/(?:tecnicos|gps|historial|print-data|print-history))?)?\/?$/,
  "/api/entregas": /^\/(?:config|resumen|avance-mes|descartes|personal|reparto(?:\/mapa)?|lotes(?:\/\d+)?|no-entregadas(?:\/\d+)?|reportes\/semanales(?:\/(?:preview|\d+))?)\/?$/,
  "/api/claves": /^\/(?:meta|alcaldia\/(?:meta|compare|search(?:\/[^/]+)?)|requests\/meta|services\/(?:report|accounts)|search(?:\/[^/]+)?)\/?$/,
  "/api/field-validation": /^\/(?:findings)?\/?$/,
  "/api/map-points": /^\/(?:diary-groups)?\/?$/,
  "/api/barrios": /^\/(?:lookup(?:\/[^/]+)?)?\/?$/,
  "/api/transport": /^\/?$/,
  "/api/admin/team-activity": /^\/?$/,
  "/api/railway": /^\/summary\/?$/,
  "/api/fallas": /^\/?$/,
  "/api/planos": /^\/(?:barrios|versiones|\d+\/elementos)\/?$/,
  "/api/gis": /^\/(?:config|health|barrios(?:\.geojson|\/report|\/\d+(?:\/summary)?)?|manzanas|quebradas|lotes(?:\/\d+)?|catastro(?:\/report|\/\d+)?|search|resolve|levantamientos(?:\/\d+)?)\/?$/
};
export const QUERY_POSTS = {
  "/api/reports": ["/manager"],
  "/api/claves": ["/requests/run"],
  "/api/field-validation": ["/analytics"],
  "/api/map-points": ["/context"],
  "/api/clandestinos": ["/fichas/por-ids", "/fichas/compare-padrones"]
};

export const requireManagerAccess = (req, res, next) => {
  if (req.authUser?.role !== "gerente") return next();
  if (req.authUser.preview && req.baseUrl === "/api/auth" && req.method === "DELETE" && req.path === "/preview") return next();

  res.setHeader("Cache-Control", "private, no-store");

  const accountAction = req.baseUrl === "/api/auth" && (
    (req.method === "GET" && req.path === "/me") ||
    (req.method === "POST" && ["/logout", "/change-password"].includes(req.path))
  ) || (req.baseUrl === "/api/admin/team-activity" && req.method === "POST" && req.path === "/seen");
  // "Visto" de la campana solo mueve la marca de la propia cuenta; no toca datos operativos.
  if (accountAction) return next();

  const path = req.path.replace(/\/$/, "") || "/";
  const read = ["GET", "HEAD"].includes(req.method);
  const media = (req.baseUrl === "" && /^\/(?:api\/)?uploads\/[^/]+$/.test(path)) ||
    (["/planos-pdf", "/api/planos-pdf"].includes(req.baseUrl) && /^\/[^/]+$/.test(path));
  const query = req.method === "POST" && (QUERY_POSTS[req.baseUrl]?.includes(path) ||
    (req.baseUrl === "/api/reports" && /^\/manager\/RPT-\d{8}-\d{6}-[A-F0-9]{8}\/events$/.test(path)));
  if ((read && (READ_ROUTES[req.baseUrl]?.test(path) || media)) || query) return next();

  return res.status(403).json({ message: "Gerencia General no tiene permiso para esta operación." });
};
