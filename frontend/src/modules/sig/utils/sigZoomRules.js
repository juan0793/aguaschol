export const sigVisibleLayerGroups = (zoom = 0) => {
  if (zoom <= 11) return ["cobertura", "barrios_simplificados"];
  if (zoom <= 13) return ["barrios", "quebradas", "red_principal"];
  if (zoom <= 15) return ["manzanas", "tuberias_principales", "lotes_simplificados"];
  if (zoom <= 16) return ["lotes", "red_distribucion", "puntos_agrupados"];
  return ["usuarios", "numeros_lote", "numeros_manzana", "construcciones"];
};
