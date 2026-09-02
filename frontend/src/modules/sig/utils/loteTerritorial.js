export const money = (value) => `L ${Number(value || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const text = (value, fallback = "Sin dato") => {
  const clean = String(value ?? "").trim();
  return clean || fallback;
};

export const activeServices = (servicios = {}) =>
  Object.entries(servicios)
    .filter(([, value]) => String(value).toUpperCase() === "S")
    .map(([key]) => key.replaceAll("_", " "));

export const vinculoLabel = (estado) => ({
  linked: "Vinculado",
  partial: "Vínculo parcial",
  unlinked: "Sin vínculo",
  ambiguous: "Vínculo ambiguo"
}[estado] || "Sin vínculo");

export const loteTitle = (data = {}) => `Lote ${text(data.numero_lote || data.id, "sin número")}`;
