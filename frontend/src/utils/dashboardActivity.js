import { DEFAULT_DASHBOARD_WIDGET_ORDER } from "../constants/workspace";

export const humanizeDashboardActivity = (log) => {
  const actor = log?.actor_name || log?.actor_email || "Sistema";
  const summary = String(log?.summary || "").trim();
  const entityId = log?.entity_id ? String(log.entity_id) : "";

  if (log?.action === "map_point.created") {
    return `${actor} agrego un punto de campo al mapa`;
  }
  if (log?.action === "inmueble.created") {
    return `${actor} creo la ficha ${entityId || summary.replace(/^Ficha\s+/i, "") || "reciente"}`;
  }
  if (log?.action === "inmueble.updated") {
    return `${actor} actualizo la ficha ${entityId || summary.replace(/^Ficha\s+/i, "") || "reciente"}`;
  }
  if (log?.action === "inmueble.photo_attached") {
    return `${actor} adjunto fotografia a ${entityId || "una ficha"}`;
  }
  if (log?.action === "auth.login") {
    return `${actor} inicio sesion en el sistema`;
  }
  if (log?.action === "auth.logout") {
    return `${actor} cerro sesion`;
  }
  if (log?.action === "transport.route_alert") {
    return summary || `Se genero una alerta operativa`;
  }

  return summary || `${actor} registro actividad operativa`;
};

export const normalizeDashboardWidgetPrefs = (value) => {
  const orderSource = Array.isArray(value?.order) ? value.order : [];
  const hiddenSource = Array.isArray(value?.hidden) ? value.hidden : [];
  const order = [
    ...orderSource.filter((item, index) => DEFAULT_DASHBOARD_WIDGET_ORDER.includes(item) && orderSource.indexOf(item) === index),
    ...DEFAULT_DASHBOARD_WIDGET_ORDER.filter((item) => !orderSource.includes(item))
  ];
  const hidden = hiddenSource.filter((item, index) => DEFAULT_DASHBOARD_WIDGET_ORDER.includes(item) && hiddenSource.indexOf(item) === index);

  return { order, hidden };
};
