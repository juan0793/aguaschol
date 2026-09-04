export const sigVisibleLayerGroups = (zoom = 0) => {
  if (zoom <= 11) return ["cobertura", "barrios_simplificados"];
  if (zoom <= 13) return ["barrios", "quebradas", "red_principal"];
  if (zoom <= 15) return ["manzanas", "tuberias_principales", "lotes_simplificados"];
  if (zoom <= 16) return ["lotes", "red_distribucion", "puntos_agrupados"];
  return ["usuarios", "numeros_lote", "numeros_manzana", "construcciones"];
};

// MapLibre requires zoom interpolation at the top level.
export const loteLineWidth = ["interpolate", ["linear"], ["zoom"],
  14, ["case", ["boolean", ["feature-state", "selected"], false], 2.2, 0.45],
  18, ["case", ["boolean", ["feature-state", "selected"], false], 2.2, 0.85],
  21, ["case", ["boolean", ["feature-state", "selected"], false], 2.2, 1.1]
];
