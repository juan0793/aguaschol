// Formato de moneda aislado de la configuracion de la API para que los modulos
// puros (por ejemplo los constructores de reportes imprimibles) se puedan
// importar y testear sin arrastrar import.meta.env de Vite.
export const formatCurrency = (value) =>
  new Intl.NumberFormat("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
