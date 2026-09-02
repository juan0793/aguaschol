export const deriveLoteVinculo = ({ lote = {}, catastro = [], padron = null } = {}) => {
  if (catastro.length > 1) return { estado: "ambiguous", motivo: "Hay varias coincidencias de catastro para este lote." };
  if (padron && (catastro.length === 1 || lote.clave_catastral)) return { estado: "linked", motivo: "Cruce con padrón disponible." };
  if (catastro.length === 1 || lote.clave_catastral || padron) return { estado: "partial", motivo: "Hay datos territoriales incompletos para confirmar el vínculo." };
  return { estado: "unlinked", motivo: "Sin clave ni cruce administrativo disponible." };
};
