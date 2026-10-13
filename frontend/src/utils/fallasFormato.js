// Cómo se muestran las fallas del equipo en el icono del encabezado y en su pantalla.
export const TIPOS_FALLA = {
  sin_conexion: { label: "Sin conexión", detalle: "No llegó al servidor", tono: "amber" },
  rechazada: { label: "Rechazada", detalle: "El servidor no la aceptó", tono: "red" },
  error_servidor: { label: "Error del servidor", detalle: "Falló del lado del servidor", tono: "dark" }
};

export const tipoFalla = (tipo) => TIPOS_FALLA[tipo] || { label: "Falla", detalle: "", tono: "red" };

export function haceCuanto(iso, ahora = Date.now()) {
  const minutos = Math.max(0, Math.round((ahora - Date.parse(iso)) / 60000));
  if (!Number.isFinite(minutos)) return "";
  if (minutos < 1) return "Ahora";
  if (minutos < 60) return `Hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;
  return new Date(iso).toLocaleDateString("es-HN", { timeZone: "America/Tegucigalpa", day: "numeric", month: "short" }).replace(".", "");
}

// Detalle corto del código para quien no es técnico.
export const codigoLegible = (codigo) => {
  if (codigo == null) return "";
  if (codigo === 404) return "404 · no se encontró";
  if (codigo === 409) return "409 · ya había cambiado";
  if (codigo === 403) return "403 · sin permiso";
  if (codigo === 400 || codigo === 422) return `${codigo} · datos no válidos`;
  if (codigo === 413) return "413 · archivo muy grande";
  return String(codigo);
};

export const FALLAS_CAMBIARON = "aguaschol:fallas-cambiaron";
