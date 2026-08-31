const json = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "No fue posible cargar SIG Territorial.");
  return data;
};

export const createSigApi = (apiFetch) => ({
  config: () => apiFetch("/gis/config").then(json),
  health: () => apiFetch("/gis/health").then(json),
  barrios: () => apiFetch("/gis/barrios").then(json),
  barriosGeoJson: () => apiFetch("/gis/barrios.geojson").then(json),
  barrioSummary: (id) => apiFetch(`/gis/barrios/${id}/summary`).then(json),
  manzanas: () => apiFetch("/gis/manzanas").then(json),
  quebradas: () => apiFetch("/gis/quebradas").then(json),
  barrioReport: () => apiFetch("/gis/barrios/report").then(json),
  catastroReport: () => apiFetch("/gis/catastro/report").then(json),
  lotes: ({ bbox, limit = 800 }) => apiFetch(`/gis/lotes?bbox=${bbox.join(",")}&limit=${limit}`).then(json),
  catastro: ({ bbox, zoom, limit = 1000 }) => apiFetch(`/gis/catastro?bbox=${bbox.join(",")}&zoom=${zoom}&limit=${limit}`).then(json),
  lote: (id) => apiFetch(`/gis/lotes/${id}`).then(json),
  catastroPunto: (id) => apiFetch(`/gis/catastro/${id}`).then(json),
  search: (query) => apiFetch(`/gis/search?q=${encodeURIComponent(query)}`).then(json),
  resolveClave: (clave) => apiFetch(`/gis/resolve?clave=${encodeURIComponent(clave)}`).then(json),
  levantamientos: ({ bbox, limit = 500 }) => apiFetch(`/gis/levantamientos?bbox=${bbox.join(",")}&limit=${limit}`).then(json),
  levantamiento: (id) => apiFetch(`/gis/levantamientos/${id}`).then(json)
});
