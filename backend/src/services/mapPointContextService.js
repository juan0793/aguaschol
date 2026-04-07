const contextCache = new Map();

const toKey = (latitude, longitude) => `${Number(latitude).toFixed(6)},${Number(longitude).toFixed(6)}`;

const normalizeZone = (address = {}) =>
  address.neighbourhood ||
  address.suburb ||
  address.city_district ||
  address.quarter ||
  address.hamlet ||
  address.village ||
  address.town ||
  address.city ||
  address.municipality ||
  address.county ||
  "";

const normalizeReference = (payload = {}) => {
  const address = payload.address ?? {};
  const direct =
    payload.name ||
    address.amenity ||
    address.tourism ||
    address.shop ||
    address.building ||
    address.road ||
    "";

  if (direct) {
    return direct;
  }

  const displayParts = String(payload.display_name ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return displayParts.slice(0, 2).join(", ");
};

const fetchContext = async (latitude, longitude) => {
  const key = toKey(latitude, longitude);
  if (contextCache.has(key)) {
    return contextCache.get(key);
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "es");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "aguaschol-field-report/1.0"
    }
  });

  if (!response.ok) {
    const error = new Error("No fue posible consultar la referencia geografica.");
    error.status = 502;
    throw error;
  }

  const payload = await response.json();
  const result = {
    key,
    latitude: Number(latitude),
    longitude: Number(longitude),
    zone: normalizeZone(payload.address) || "Zona no identificada",
    reference: normalizeReference(payload) || "Referencia no disponible",
    display_name: payload.display_name || ""
  };

  contextCache.set(key, result);
  return result;
};

export const fetchMapPointContexts = async (points = []) => {
  const uniquePoints = Array.from(
    new Map(
      points
        .filter((point) => Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude)))
        .map((point) => [toKey(point.latitude, point.longitude), point])
    ).values()
  ).slice(0, 120);

  const results = [];
  for (const point of uniquePoints) {
    try {
      results.push(await fetchContext(point.latitude, point.longitude));
    } catch {
      results.push({
        key: toKey(point.latitude, point.longitude),
        latitude: Number(point.latitude),
        longitude: Number(point.longitude),
        zone: "Zona no identificada",
        reference: "Referencia no disponible",
        display_name: ""
      });
    }
  }

  return results;
};
