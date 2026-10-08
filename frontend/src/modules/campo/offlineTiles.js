// Mapa sin señal: cada mosaico del mapa base se guarda en la caché del navegador
// (Cache Storage) al verse, y se puede guardar la vista general de una zona antes
// de salir. La capa lee primero de la caché, así el mapa sigue viéndose sin datos.
//
// Los mosaicos vienen de OpenStreetMap (vía /api/map-tiles). Su política de uso
// prohíbe descargar zonas a zoom 17 o más para uso sin conexión sin permiso de sus
// administradores, por eso "Guardar zona" baja solo de 14 a 16. Lo que el técnico
// ya miró se guarda en todos los zooms (uso normal) y, sin señal, un mosaico de
// detalle que falta se dibuja ampliando el más cercano que sí está guardado.

export const TILE_CACHE_NAME = "aguaschol-mapa-base-v1";
const TILE_VERSION = "osm-20260407";
// Una sola dirección para el mapa y para "Guardar zona": así comparten caché.
export const buildTileTemplate = (apiUrl) => `${apiUrl}/map-tiles/{z}/{x}/{y}.png?v=${encodeURIComponent(TILE_VERSION)}`;
const ZONES_KEY = "aguaschol.campo.zonasGuardadas.v1";
export const AVERAGE_TILE_BYTES = 18 * 1024;
export const MAX_ZONE_TILES = 400;
export const ZONE_MIN_ZOOM = 14;
export const ZONE_MAX_ZOOM = 16;
const MAX_OVERZOOM_LEVELS = 5;

const cacheAvailable = () => typeof caches !== "undefined" && typeof window !== "undefined" && window.isSecureContext !== false;

// Coordenadas de mosaico (esquema XYZ de OpenStreetMap).
export const lngToTileX = (lng, z) => Math.floor(((lng + 180) / 360) * 2 ** z);
export const latToTileY = (lat, z) => {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
};

export const tilesForBounds = ({ north, south, east, west }, zMin, zMax) => {
  const tiles = [];
  for (let z = zMin; z <= zMax; z += 1) {
    const xMin = lngToTileX(west, z);
    const xMax = lngToTileX(east, z);
    const yMin = latToTileY(north, z);
    const yMax = latToTileY(south, z);
    for (let x = xMin; x <= xMax; x += 1) {
      for (let y = yMin; y <= yMax; y += 1) tiles.push({ z, x, y });
    }
  }
  return tiles;
};

// Vista general de la zona visible (zooms 14 a 16). Si la zona es tan grande que
// pasa del límite, no se guarda: hay que acercarse a un barrio.
export const planZoneDownload = (bounds) => {
  const tiles = tilesForBounds(bounds, ZONE_MIN_ZOOM, ZONE_MAX_ZOOM);
  return {
    zMin: ZONE_MIN_ZOOM,
    zMax: ZONE_MAX_ZOOM,
    tiles,
    estimatedBytes: tiles.length * AVERAGE_TILE_BYTES,
    tooLarge: tiles.length > MAX_ZONE_TILES
  };
};

// Recorta y amplía el mosaico guardado más cercano de menor zoom para cubrir un
// mosaico de detalle que no está en la caché.
const overzoomFromCache = async (template, { z, x, y }) => {
  if (!cacheAvailable()) return null;
  const cache = await caches.open(TILE_CACHE_NAME);
  for (let level = 1; level <= MAX_OVERZOOM_LEVELS && z - level >= 0; level += 1) {
    const factor = 2 ** level;
    const parent = { z: z - level, x: Math.floor(x / factor), y: Math.floor(y / factor) };
    const cached = await cache.match(tileUrl(template, parent));
    if (!cached) continue;
    const bitmap = await createImageBitmap(await cached.blob());
    const size = bitmap.width / factor;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = true;
    context.drawImage(bitmap, (x % factor) * size, (y % factor) * size, size, size, 0, 0, 256, 256);
    bitmap.close?.();
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }
  return null;
};

export const tileUrl = (template, { z, x, y }) => template.replace("{z}", z).replace("{x}", x).replace("{y}", y);

const fetchAndStore = async (cache, url, signal) => {
  const response = await fetch(url, { mode: "cors", credentials: "omit", signal });
  if (!response.ok) throw new Error(`Mosaico ${response.status}`);
  await cache.put(url, response.clone());
  return response;
};

// Lee de la caché; si no está, lo baja y lo guarda. Devuelve un Blob.
export const loadTileBlob = async (url) => {
  if (!cacheAvailable()) {
    const response = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!response.ok) throw new Error(`Mosaico ${response.status}`);
    return response.blob();
  }
  const cache = await caches.open(TILE_CACHE_NAME);
  const cached = await cache.match(url);
  if (cached) return cached.blob();
  return (await fetchAndStore(cache, url)).blob();
};

// Capa de Leaflet que pinta cada mosaico desde la caché (o la red) como blob y,
// sin señal, recurre a un mosaico ampliado de menor zoom.
export const createCachedTileLayer = (L, template, options) => {
  const CachedTileLayer = L.TileLayer.extend({
    createTile(coords, done) {
      const tile = document.createElement("img");
      tile.alt = "";
      tile.setAttribute("role", "presentation");
      const tileCoords = { z: this._getZoomForUrl(), x: coords.x, y: coords.y };
      loadTileBlob(this.getTileUrl(coords))
        .catch(async (error) => {
          const fallback = await overzoomFromCache(template, tileCoords).catch(() => null);
          if (!fallback) throw error;
          tile.classList.add("is-overzoom");
          return fallback;
        })
        .then((blob) => {
          tile.onload = () => {
            URL.revokeObjectURL(tile.src);
            done(null, tile);
          };
          tile.onerror = () => done(new Error("Mosaico ilegible"), tile);
          tile.src = URL.createObjectURL(blob);
        })
        .catch((error) => done(error, tile));
      return tile;
    }
  });
  return new CachedTileLayer(template, options);
};

export const downloadZone = async ({ template, tiles, onProgress, signal, concurrency = 6 }) => {
  if (!cacheAvailable()) throw new Error("Este navegador no permite guardar el mapa. Abre el sistema con HTTPS.");
  const cache = await caches.open(TILE_CACHE_NAME);
  let done = 0;
  let failed = 0;
  let index = 0;
  const worker = async () => {
    while (index < tiles.length) {
      if (signal?.aborted) return;
      const url = tileUrl(template, tiles[index]);
      index += 1;
      try {
        if (!(await cache.match(url))) await fetchAndStore(cache, url, signal);
      } catch (error) {
        if (signal?.aborted) return;
        failed += 1;
      }
      done += 1;
      onProgress?.({ done, failed, total: tiles.length });
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, tiles.length) }, worker));
  return { done, failed, total: tiles.length, cancelled: Boolean(signal?.aborted) };
};

export const listSavedZones = () => {
  try {
    const zones = JSON.parse(window.localStorage.getItem(ZONES_KEY) || "[]");
    return Array.isArray(zones) ? zones : [];
  } catch {
    return [];
  }
};

export const rememberZone = (zone) => {
  const zones = [zone, ...listSavedZones()].slice(0, 12);
  try {
    window.localStorage.setItem(ZONES_KEY, JSON.stringify(zones));
  } catch {
    // Sin espacio: la zona quedó en la caché igual, solo no se lista.
  }
  return zones;
};

export const clearSavedMap = async () => {
  if (cacheAvailable()) await caches.delete(TILE_CACHE_NAME);
  try {
    window.localStorage.removeItem(ZONES_KEY);
  } catch {
    // nada que limpiar
  }
};

export const estimateMapStorage = async () => {
  try {
    const estimate = await navigator.storage?.estimate?.();
    return estimate ? { usage: estimate.usage || 0, quota: estimate.quota || 0 } : null;
  } catch {
    return null;
  }
};
