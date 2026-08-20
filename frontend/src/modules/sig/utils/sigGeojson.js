export const emptyFeatureCollection = { type: "FeatureCollection", features: [] };

export const extendBounds = (bounds, coordinates) => {
  if (typeof coordinates[0] === "number") {
    const [lng, lat] = coordinates;
    return [
      [Math.min(bounds[0][0], lng), Math.min(bounds[0][1], lat)],
      [Math.max(bounds[1][0], lng), Math.max(bounds[1][1], lat)]
    ];
  }
  return coordinates.reduce(extendBounds, bounds);
};

export const geometryBounds = (geometry) => extendBounds([[Infinity, Infinity], [-Infinity, -Infinity]], geometry.coordinates);
