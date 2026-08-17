import { FILES_URL } from "../config/api.js";
import { formatCurrency } from "./currency.js";

export { formatCurrency };

export const formatLookupAmount = (value) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "--";
  return formatCurrency(numeric);
};

export const getLookupTotalMeta = (value) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return {
      text: "--",
      helper: "Sin referencia",
      tone: "",
      icon: "activity"
    };
  }

  if (numeric === 0) {
    return {
      text: "Sin saldo",
      helper: "Cuenta al dia",
      tone: "is-zero",
      icon: "success"
    };
  }

  if (numeric < 0) {
    return {
      text: formatCurrency(Math.abs(numeric)),
      helper: "Pago adelantado",
      tone: "is-credit",
      icon: "refresh"
    };
  }

  return {
    text: formatCurrency(numeric),
    helper: "Saldo pendiente",
    tone: "is-debt",
    icon: "activity"
  };
};

export const buildPhotoUrl = (photoPath = "", version = "") => {
  if (!photoPath) return "";

  const separator = photoPath.includes("?") ? "&" : "?";
  const versionSuffix = version ? `${separator}v=${encodeURIComponent(version)}` : "";

  if (/^https?:\/\//i.test(photoPath)) {
    return `${photoPath}${versionSuffix}`;
  }

  return `${FILES_URL}${photoPath}${versionSuffix}`;
};

export const roleLabel = (role) =>
  (
    {
      admin: "Administrador",
      transport: "Transporte",
      validadora_campo: "Validacion campo",
      operator: "Operador"
    }[role] ?? "Operador"
  );

export const actionLabel = (action) =>
  (
    {
      "auth.login": "Inicio de sesion",
      "auth.logout": "Cierre de sesion",
      "auth.password_changed": "Contrasena actualizada",
      "user.created": "Usuario creado",
      "user.role_updated": "Perfil actualizado",
      "padron.updated": "Padron actualizado",
      "map_point.created": "Punto de campo creado",
      "map_point.validated": "Punto de campo validado",
      "map_point.deleted": "Punto de campo eliminado",
      "transport.route_created": "Ruta de transporte creada",
      "transport.route_updated": "Ruta de transporte actualizada",
      "transport.route_started": "Recorrido iniciado",
      "transport.route_completed": "Recorrido completado",
      "transport.position_logged": "Posicion registrada",
      "transport.route_alert": "Desvio detectado",
      "inmueble.created": "Ficha creada",
      "inmueble.updated": "Ficha actualizada",
      "inmueble.printed": "Ficha impresa",
      "inmueble.archived": "Ficha archivada",
      "inmueble.deleted": "Ficha eliminada",
      "inmueble.restored": "Ficha restaurada",
      "inmueble.photo_attached": "Fotografia cargada"
    }[action] ?? action
  );
