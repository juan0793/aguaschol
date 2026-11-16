// Clave catastral canónica: la única forma de comparar una clave entre el padrón, la
// Alcaldía, el banco de clandestinos y las fichas. Un caso de clandestino es su clave
// canónica (docs/DISENO_SEGUIMIENTO_CLANDESTINOS.md, sección 2).
//
//   "89-13-15", "89 13 15", "89-13-5"   -> "89-13-05"   (bloques de dos cifras como mínimo)
//   "14-08-02-7"                        -> "14-08-02-07" (4 bloques: una unidad, caso propio)
//   "089-13-15"                         -> "89-13-15"    (el cero de más no hace otra clave)
//   "casa verde", "1-2", "00-00-00"     -> ""            (no es clave)
//
// Solo acepta 3 o 4 bloques de hasta 3 cifras. Una clave sin ninguna cifra distinta de
// cero no identifica nada (la misma regla de Inspecciones).
export const claveCanonica = (value = "") => {
  const parts = String(value ?? "").trim().split(/\D+/).filter(Boolean);
  if (![3, 4].includes(parts.length) || parts.some((part) => part.length > 3)) return "";
  if (parts.every((part) => Number(part) === 0)) return "";
  return parts.map((part) => String(Number(part)).padStart(2, "0")).join("-");
};

// Los tres primeros bloques: el lote. Sirve de pista ("mismo lote"), nunca de identidad.
export const loteDeClave = (clave = "") => String(clave ?? "").split("-").slice(0, 3).join("-");
