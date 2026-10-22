// Inspecciones de una misma clave catastral: para no repetir una visita sin saberlo.
// Una clave puede tener varias cuentas (abonados): dos inspecciones solo se repiten si son de la
// misma cuenta o si alguna es "general de la clave" (cubre todas sus cuentas). Las de otras
// cuentas de la clave se informan aparte, sin alarma.
// Reglas puras (sin BD); pruebas en inspeccionesRepeticion.test.mjs.

const ACTIVAS = ["ASIGNADA", "EN_PROCESO", "SEGUIMIENTO"];

// Una clave vacía o de relleno ("00-00-00-00") no identifica un inmueble.
export const claveIdentifica = (clave = "") => /[1-9]/.test(String(clave));

const esGeneral = (item) => Boolean(Number(item?.inspeccion_general)) || !String(item?.abonado_numero ?? "").trim();
// ¿Cubren la misma cuenta? Sí si es el mismo abonado o si alguna de las dos es general.
export const mismaCuenta = (a, b) => esGeneral(a) || esGeneral(b) || String(a.abonado_numero).trim() === String(b.abonado_numero).trim();

const fechaDe = (item) => item.fecha_finalizacion || item.fecha_asignacion || item.created_at || null;
const resumen = (item) => ({
  id: item.id,
  numero_inspeccion: item.numero_inspeccion,
  estado: item.estado,
  abonado_numero: esGeneral(item) ? "" : String(item.abonado_numero).trim(),
  inspeccion_general: esGeneral(item),
  tecnico_responsable_nombre: item.tecnico_responsable_nombre || "",
  fecha: fechaDe(item)
});

// Para una inspección: las abiertas que la repiten (misma cuenta o general), las abiertas de
// otras cuentas de la clave y la última finalizada que cubrió su misma cuenta.
export const repeticionesDe = (item, todas = []) => {
  if (!claveIdentifica(item?.clave_catastral)) return null;
  const mismas = todas.filter((otra) => Number(otra.id) !== Number(item.id) && otra.clave_catastral === item.clave_catastral);
  if (!mismas.length) return null;
  const abiertas = mismas.filter((otra) => ACTIVAS.includes(otra.estado));
  const ultimaFinalizada = mismas
    .filter((otra) => otra.estado === "FINALIZADA" && mismaCuenta(item, otra))
    .sort((a, b) => new Date(fechaDe(b)) - new Date(fechaDe(a)))[0];
  const resultado = {
    repetidas: abiertas.filter((otra) => mismaCuenta(item, otra)).map(resumen),
    otras_cuentas: abiertas.filter((otra) => !mismaCuenta(item, otra)).map(resumen),
    ultima_finalizada: ultimaFinalizada ? resumen(ultimaFinalizada) : null,
    total: mismas.length
  };
  return resultado.repetidas.length || resultado.otras_cuentas.length || resultado.ultima_finalizada ? resultado : null;
};
