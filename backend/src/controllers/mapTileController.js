const TILE_PROVIDERS = [
  "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
  "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
  "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
  "https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
  "https://b.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
  "https://c.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
  "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
  "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
  "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
  "https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
];

const buildTileUrl = (template, z, x, y) =>
  template.replace("{z}", encodeURIComponent(z)).replace("{x}", encodeURIComponent(x)).replace("{y}", encodeURIComponent(y));

const isValidTileCoordinate = (value) => /^\d+$/.test(String(value ?? ""));

export const getMapTileHandler = async (req, res, next) => {
  const { z, x, y } = req.params;

  if (![z, x, y].every(isValidTileCoordinate)) {
    return res.status(400).json({ message: "Coordenadas de tile invalidas." });
  }

  for (const provider of TILE_PROVIDERS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const response = await fetch(buildTileUrl(provider, z, x, y), {
        signal: controller.signal,
        headers: {
          "User-Agent": "aguaschol-field-map/1.0"
        }
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      res.setHeader("Content-Type", response.headers.get("content-type") || "image/png");
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.send(Buffer.from(arrayBuffer));
      return;
    } catch {
      // Try next provider.
    }
  }

  return res.status(502).json({ message: "No fue posible cargar la capa base del mapa." });
};
