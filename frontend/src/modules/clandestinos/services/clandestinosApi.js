const json = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "No fue posible completar la operación.");
  return data;
};

export const createClandestinosApi = (apiFetch) => ({
  config: () => apiFetch("/clandestinos/config").then(json),
  fichas: (params = {}) => apiFetch(`/clandestinos/fichas?${new URLSearchParams(params)}`).then(json),
  compareFichas: (ids) => apiFetch("/clandestinos/fichas/compare-padrones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) }).then(json),
  saveFicha: (record) => apiFetch(record.id ? `/inmuebles/${record.id}` : "/inmuebles", { method: record.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record) }).then(json),
  validatePadron: (clave) => apiFetch(`/claves/alcaldia/search?field=clave&clave=${encodeURIComponent(clave)}`).then(json),
  searchAguas: (value, field) => apiFetch(`/claves/search?field=${field}&clave=${encodeURIComponent(value)}`).then(json),
  fichaState: (id, state, reason = "") => apiFetch(`/clandestinos/fichas/${id}/state`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state, reason }) }).then(json),
  internalNotes: (id, observaciones_internas) => apiFetch(`/clandestinos/fichas/${id}/internal-notes`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ observaciones_internas }) }).then(json),
  history: (type, id) => apiFetch(`/clandestinos/history/${type}/${id}`).then(json),
  reports: (params = {}) => apiFetch(`/clandestinos/reportes?${new URLSearchParams(params)}`).then(json),
  createReport: (payload) => apiFetch("/clandestinos/reportes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then(json),
  reportState: (id, state, reason = "") => apiFetch(`/clandestinos/reportes/${id}/state`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state, reason }) }).then(json),
  linkReport: (id, inmueble_id) => apiFetch(`/clandestinos/reportes/${id}/link`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inmueble_id }) }).then(json),
  banco: (params = {}) => apiFetch(`/clandestinos/banco?${new URLSearchParams(params)}`).then(json),
  bancoImport: (csv, lote) => apiFetch("/clandestinos/banco/importar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv, lote, origen: "qfield" }) }).then(json),
  bancoVerify: () => apiFetch("/clandestinos/banco/verificar", { method: "POST" }).then(json),
  bancoSend: (id, clave_catastral = "") => apiFetch(`/clandestinos/banco/${id}/enviar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clave_catastral }) }).then(json),
  bancoDiscard: (id, motivo) => apiFetch(`/clandestinos/banco/${id}/descartar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motivo }) }).then(json),
  bancoListado: (params = {}) => apiFetch(`/clandestinos/banco/listado?${new URLSearchParams(params)}`).then(json),
  bancoTecnicos: () => apiFetch("/clandestinos/banco/tecnicos").then(json),
  bancoAssign: (payload) => apiFetch("/clandestinos/banco/asignar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then(json),
  bancoUnassign: (ids) => apiFetch("/clandestinos/banco/desasignar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) }).then(json),
  bancoRestore: (id) => apiFetch(`/clandestinos/banco/${id}/restaurar`, { method: "POST" }).then(json),
  evidence: (id, file, description = "") => { const body = new FormData(); body.append("evidence", file); body.append("description", description); return apiFetch(`/clandestinos/reportes/${id}/evidencias`, { method: "POST", body }).then(json); }
});
