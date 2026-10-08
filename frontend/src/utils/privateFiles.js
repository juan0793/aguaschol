import { useEffect, useState } from "react";
import { API_URL, FILES_URL } from "../config/api.js";

// Los archivos privados del backend (/uploads, /planos-pdf) piden sesion. El
// frontend vive en www.controlaguas.com y el backend en Railway: son sitios
// distintos y la cookie de medios (SameSite=Lax) no viaja con un <img>, un <a> o
// un fetch normal. Por eso se piden con apiFetch, que manda el token en
// Authorization, y se muestran como blob.
const PRIVATE_FILE_PATH = /^(?:\/api)?(\/(?:uploads|planos-pdf)\/.+)$/;

const originOf = (value) => {
  try {
    return new URL(value || window.location.href, window.location.href).origin;
  } catch {
    return "";
  }
};

// Ruta para apiFetch ("/uploads/foto.jpg?v=...") si el valor apunta a un archivo
// privado del backend; "" si es una URL publica (Cloudinary), blob: o data:.
export const toPrivateFilePath = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw || /^(?:blob|data):/i.test(raw)) return "";

  let url;
  try {
    url = new URL(raw, window.location.href);
  } catch {
    return "";
  }

  const backendOrigins = [window.location.origin, originOf(API_URL), originOf(FILES_URL)];
  if (!backendOrigins.includes(url.origin)) return "";

  const match = url.pathname.match(PRIVATE_FILE_PATH);
  return match ? `${match[1]}${url.search}` : "";
};

export const fetchPrivateFile = (value, apiFetch, options = {}) => {
  const privatePath = toPrivateFilePath(value);
  if (privatePath && apiFetch) return apiFetch(privatePath, { cache: "default", ...options });
  return fetch(value, { cache: "default", credentials: "omit", ...options });
};

// URL lista para <img src>/<a href>: los archivos privados se descargan con el
// token y se entregan como object URL, que se revoca al cambiar o desmontar. Las
// URL publicas se devuelven tal cual. Mientras carga (o si falla) url es "".
export function usePrivateFileUrl(value, apiFetch) {
  const privatePath = toPrivateFilePath(value);
  const [state, setState] = useState({ path: "", url: "", failed: false });

  useEffect(() => {
    if (!privatePath || !apiFetch) return undefined;

    let cancelled = false;
    let objectUrl = "";
    setState({ path: privatePath, url: "", failed: false });

    apiFetch(privatePath, { cache: "default" })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ path: privatePath, url: objectUrl, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ path: privatePath, url: "", failed: true });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [privatePath, apiFetch]);

  if (!privatePath || !apiFetch) return { url: String(value || "").trim(), loading: false, failed: false };
  const current = state.path === privatePath ? state : { url: "", failed: false };
  return { url: current.url, loading: !current.url && !current.failed, failed: current.failed };
}
