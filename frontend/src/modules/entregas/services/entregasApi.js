// Cliente HTTP del modulo Control de Entregas. Recibe el `apiFetch` global de la
// aplicacion para reutilizar sesion, cabeceras y manejo de credenciales.

const json = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.message || "No fue posible completar la operación."), {
    status: response.status
  });
  return data;
};

const jsonBody = (payload) => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

const query = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : "";
};

export const createEntregasApi = (apiFetch) => ({
  config: () => apiFetch("/entregas/config").then(json),
  resumen: (params = {}) => apiFetch(`/entregas/resumen${query(params)}`).then(json),

  personal: (params = {}) => apiFetch(`/entregas/personal${query(params)}`).then(json),
  crearPersonal: (payload) => apiFetch("/entregas/personal", { method: "POST", ...jsonBody(payload) }).then(json),
  actualizarPersonal: (id, payload) =>
    apiFetch(`/entregas/personal/${id}`, { method: "PATCH", ...jsonBody(payload) }).then(json),

  lotes: (params = {}) => apiFetch(`/entregas/lotes${query(params)}`).then(json),
  lote: (id) => apiFetch(`/entregas/lotes/${id}`).then(json),
  crearLote: (payload) => apiFetch("/entregas/lotes", { method: "POST", ...jsonBody(payload) }).then(json),
  actualizarLote: (id, payload) => apiFetch(`/entregas/lotes/${id}`, { method: "PATCH", ...jsonBody(payload) }).then(json),
  cerrarLote: (id, payload) => apiFetch(`/entregas/lotes/${id}/cerrar`, { method: "POST", ...jsonBody(payload) }).then(json),
  agregarNoEntregadas: (id, payload) =>
    apiFetch(`/entregas/lotes/${id}/no-entregadas`, { method: "POST", ...jsonBody(payload) }).then(json),

  noEntregadas: (params = {}) => apiFetch(`/entregas/no-entregadas${query(params)}`).then(json),
  noEntregada: (id) => apiFetch(`/entregas/no-entregadas/${id}`).then(json),
  actualizarNoEntregada: (id, payload) =>
    apiFetch(`/entregas/no-entregadas/${id}`, { method: "PATCH", ...jsonBody(payload) }).then(json),
  eliminarNoEntregada: (id) => apiFetch(`/entregas/no-entregadas/${id}`, { method: "DELETE" }).then(json),
  registrarIntento: (id, payload) =>
    apiFetch(`/entregas/no-entregadas/${id}/intentos`, { method: "POST", ...jsonBody(payload) }).then(json),

  reportes: (params = {}) => apiFetch(`/entregas/reportes/semanales${query(params)}`).then(json),
  reportePreview: (params = {}) => apiFetch(`/entregas/reportes/semanales/preview${query(params)}`).then(json),
  reporte: (id) => apiFetch(`/entregas/reportes/semanales/${id}`).then(json),
  generarReporte: (payload) =>
    apiFetch("/entregas/reportes/semanales", { method: "POST", ...jsonBody(payload) }).then(json),
  generarCorreccion: (id, payload) =>
    apiFetch(`/entregas/reportes/semanales/${id}/correccion`, { method: "POST", ...jsonBody(payload) }).then(json),
  anularReporte: (id, payload) =>
    apiFetch(`/entregas/reportes/semanales/${id}/anular`, { method: "POST", ...jsonBody(payload) }).then(json),

  // Reutiliza el buscador de padrón ya existente para autocompletar abonado/clave.
  buscarClave: (value, field = "clave") =>
    apiFetch(`/claves/search?field=${field}&clave=${encodeURIComponent(value)}`).then(json)
});
