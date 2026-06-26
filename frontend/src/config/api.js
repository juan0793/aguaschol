const API_BASE_URL = import.meta.env.VITE_API_URL?.trim() || (import.meta.env.DEV ? "http://127.0.0.1:4000" : "/api");
const FILES_BASE_URL = import.meta.env.VITE_FILES_URL?.trim() || (import.meta.env.DEV ? API_BASE_URL : "");
const rawApiBase = API_BASE_URL.replace(/\/$/, "");
const isAbsoluteApiBase = /^https?:\/\//i.test(rawApiBase);

export const API_URL = (rawApiBase ? (rawApiBase.endsWith("/api") ? rawApiBase : `${rawApiBase}/api`) : "").replace(
  /\/$/,
  ""
);
export const FILES_URL = FILES_BASE_URL.replace(/\/$/, "");

export const WS_URL = (() => {
  if (rawApiBase && isAbsoluteApiBase) {
    const normalized = rawApiBase.endsWith("/api") ? rawApiBase.slice(0, -4) : rawApiBase;
    return normalized.replace(/^http/i, "ws");
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
  }

  return "";
})();
