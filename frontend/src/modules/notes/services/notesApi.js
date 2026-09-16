const json = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(data.message || "No fue posible completar la operación."), { status: response.status, data });
  }
  return data;
};

const body = (payload) => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

export const createNotesApi = (apiFetch) => ({
  list: (params = {}, options = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== "" && value != null && value !== false));
    return apiFetch(`/admin/notes?${query}`, options).then(json);
  },
  categories: () => apiFetch("/admin/notes/categories").then(json),
  create: (payload) => apiFetch("/admin/notes", { method: "POST", ...body(payload) }).then(json),
  update: (id, payload) => apiFetch(`/admin/notes/${id}`, { method: "PATCH", ...body(payload) }).then(json),
  move: (id, payload) => apiFetch(`/admin/notes/${id}/move`, { method: "PATCH", ...body(payload) }).then(json),
  duplicate: (id) => apiFetch(`/admin/notes/${id}/duplicate`, { method: "POST" }).then(json),
  remove: (id) => apiFetch(`/admin/notes/${id}`, { method: "DELETE" }).then(json),
  restore: (id) => apiFetch(`/admin/notes/${id}/restore`, { method: "POST" }).then(json),
  link: (id, payload) => apiFetch(`/admin/notes/${id}/links`, { method: "POST", ...body(payload) }).then(json)
});
