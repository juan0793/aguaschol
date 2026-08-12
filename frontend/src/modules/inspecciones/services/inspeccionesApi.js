const json = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "No fue posible completar la operación.");
  return data;
};

const jsonBody = (payload) => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

export const createInspeccionesApi = (apiFetch) => ({
  config: () => apiFetch("/inspecciones/config").then(json),
  tecnicos: () => apiFetch("/inspecciones/tecnicos").then(json),
  resumen: () => apiFetch("/inspecciones/resumen").then(json),
  stats: (params = {}) => apiFetch(`/inspecciones/stats?${new URLSearchParams(params)}`).then(json),
  list: (params = {}) => apiFetch(`/inspecciones?${new URLSearchParams(params)}`).then(json),
  detail: (id) => apiFetch(`/inspecciones/${id}`).then(json),
  create: (payload) => apiFetch("/inspecciones", { method: "POST", ...jsonBody(payload) }).then(json),
  update: (id, payload) => apiFetch(`/inspecciones/${id}`, { method: "PATCH", ...jsonBody(payload) }).then(json),
  changeEstado: (id, estado, motivo = "") => apiFetch(`/inspecciones/${id}/estado`, { method: "PATCH", ...jsonBody({ estado, motivo }) }).then(json),
  finalizar: (id, payload) => apiFetch(`/inspecciones/${id}/finalizar`, { method: "PATCH", ...jsonBody(payload) }).then(json),
  reasignar: (id, tecnico_responsable_id) => apiFetch(`/inspecciones/${id}/reasignar`, { method: "PATCH", ...jsonBody({ tecnico_responsable_id }) }).then(json),
  tecnicosDeInspeccion: (id) => apiFetch(`/inspecciones/${id}/tecnicos`).then(json),
  addTecnico: (id, tecnico_id) => apiFetch(`/inspecciones/${id}/tecnicos`, { method: "POST", ...jsonBody({ tecnico_id }) }).then(json),
  removeTecnico: (id, tecnicoId) => apiFetch(`/inspecciones/${id}/tecnicos/${tecnicoId}`, { method: "DELETE" }).then(json),
  gps: (id) => apiFetch(`/inspecciones/${id}/gps`).then(json),
  addGps: (id, payload) => apiFetch(`/inspecciones/${id}/gps`, { method: "POST", ...jsonBody(payload) }).then(json),
  historial: (id) => apiFetch(`/inspecciones/${id}/historial`).then(json),
  printData: (id, tipo) => apiFetch(`/inspecciones/${id}/print-data?tipo=${tipo}`).then(json),
  printEvent: (id, tipo_documento, accion) => apiFetch(`/inspecciones/${id}/print-events`, { method: "POST", ...jsonBody({ tipo_documento, accion }) }).then(json),
  searchClave: (value, field = "clave") => apiFetch(`/claves/search?field=${field}&clave=${encodeURIComponent(value)}`).then(json)
});
