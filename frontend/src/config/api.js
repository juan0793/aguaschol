const rawApiBase = (import.meta.env.VITE_API_URL?.trim() || "").replace(/\/$/, "");
export const API_URL = (rawApiBase ? (rawApiBase.endsWith("/api") ? rawApiBase : `${rawApiBase}/api`) : "/api").replace(
  /\/$/,
  ""
);
export const FILES_URL = (import.meta.env.VITE_FILES_URL?.trim() || rawApiBase).replace(/\/$/, "");
