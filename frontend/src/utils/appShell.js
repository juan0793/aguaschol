import { getWorkspaceViewFromPath } from "../components/sidebar/sidebarConfig";

export const readJsonResponse = async (response, fallbackMessage = "La API no devolvio una respuesta JSON valida.") => {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    if ((response.headers.get("content-type") || "").includes("text/html") || /^\s*<!doctype html/i.test(text)) {
      throw new Error("La app recibio una pagina HTML en vez de la API. Abre el dominio principal o configura VITE_API_URL/BACKEND_URL hacia el backend.");
    }

    throw new Error(fallbackMessage);
  }
};

export const getDefaultWorkspaceView = (role) => (role === "admin" ? "dashboard" : ["operator", "validadora_campo"].includes(role) ? "inspecciones" : "records");

export const getWorkspaceViewByRole = (role) => getWorkspaceViewFromPath(window.location.pathname) ?? getDefaultWorkspaceView(role);

export const getAlertDetails = (text) => {
  const value = String(text || "").toLowerCase();
  if (/no fue posible|no se pudo|error|fall[oó]|ses[ií]on venc/i.test(value)) {
    return { tone: "error", label: "No se pudo completar" };
  }
  if (/guardad|actualizad|generad|descargad|registrad|impres|cread|eliminad|enviad|validad|correctamente|completad|listo|comparaci[oó]n lista/i.test(value)) {
    return { tone: "success", label: "Listo" };
  }
  if (/atenci[oó]n|vencid|alerta|pendiente|selecciona|debes|primero|no concuerda|no se encontr[oó]/i.test(value)) {
    return { tone: "warning", label: "Atención" };
  }
  return { tone: "info", label: "Actualización" };
};
