const rawApiBase = (import.meta.env.VITE_API_URL?.trim() || "").replace(/\/$/, "");
export const API_URL = (rawApiBase ? (rawApiBase.endsWith("/api") ? rawApiBase : `${rawApiBase}/api`) : "/api").replace(
  /\/$/,
  ""
);
export const FILES_URL = (import.meta.env.VITE_FILES_URL?.trim() || rawApiBase).replace(/\/$/, "");

export const WS_URL = (() => {
  if (rawApiBase) {
    const normalized = rawApiBase.endsWith("/api") ? rawApiBase.slice(0, -4) : rawApiBase;
    return normalized.replace(/^http/i, "ws");
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
  }

  return "";
})();
