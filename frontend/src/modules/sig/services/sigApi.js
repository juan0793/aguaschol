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
  barrioReport: () => apiFetch("/gis/barrios/report").then(json)
});
