const SHELL_CACHE = "controlaguas-shell-v1";
const ASSET_CACHE = "controlaguas-assets-v1";
const APP_CACHES = [SHELL_CACHE, ASSET_CACHE];
const MAX_ASSET_ENTRIES = 160;
const SHELL_FILES = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("controlaguas-") && !APP_CACHES.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (/^\/(api|uploads)(\/|$)/.test(url.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith(fetchNavigation(request));
    return;
  }

  if (!url.pathname.startsWith("/assets/") && !url.pathname.startsWith("/icons/")) return;
  if (["script", "style", "image", "font"].includes(request.destination)) {
    event.respondWith(fetchAsset(request));
  }
});

async function cacheAppShell() {
  const cache = await caches.open(SHELL_CACHE);
  const response = await fetch("/", { cache: "reload" });
  if (!response.ok) throw new Error("No fue posible guardar la app para uso sin conexión.");

  await cache.put("/", response.clone());
  const html = await response.text();
  const entryAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => new URL(match[1], self.location.origin))
    .filter((url) => url.origin === self.location.origin && url.pathname.startsWith("/assets/"));
  const visitedAssets = new Set();

  await Promise.all([
    ...SHELL_FILES.map((url) => cacheAsset(cache, url, visitedAssets)),
    ...entryAssets.map((url) => cacheAsset(cache, url.href, visitedAssets))
  ]);
  await self.skipWaiting();
}

async function cacheAsset(cache, url, visitedAssets) {
  const assetUrl = new URL(url, self.location.origin);
  if (visitedAssets.has(assetUrl.href)) return;
  visitedAssets.add(assetUrl.href);

  try {
    const response = await fetch(assetUrl.href);
    if (!response.ok) return;

    const isScript = assetUrl.pathname.endsWith(".js");
    const isStyle = assetUrl.pathname.endsWith(".css");
    const source = isScript || isStyle ? await response.clone().text() : "";
    const references = isScript
      ? [...source.matchAll(/(?:\bfrom\s*|\bimport\s*)["']([^"']+)["']/g)]
      : isStyle
        ? [...source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)]
        : [];
    const dependencies = references.flatMap((match) => {
      try {
        const dependency = new URL(match[1], assetUrl);
        return dependency.origin === self.location.origin &&
          (dependency.pathname.startsWith("/assets/") || dependency.pathname.startsWith("/icons/"))
          ? [dependency.href]
          : [];
      } catch {
        return [];
      }
    });

    await cache.put(assetUrl.href, response);
    await Promise.all(dependencies.map((dependency) => cacheAsset(cache, dependency, visitedAssets)));
  } catch {
    // Los recursos opcionales se guardan al cargarse cuando vuelve la conexión.
  }
}

async function fetchNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put("/", response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || (await caches.match("/")) || Response.error();
  }
}

async function fetchAsset(request) {
  const cache = await caches.open(ASSET_CACHE);
  const shell = await caches.open(SHELL_CACHE);
  const findCached = async () => (await cache.match(request)) || (await shell.match(request));

  // Los iconos no llevan hash: se piden a la red y la copia guardada solo cubre el modo sin conexión.
  if (new URL(request.url).pathname.startsWith("/icons/")) {
    try {
      const response = await fetch(request);
      if (response.ok && response.type === "basic") await cache.put(request, response.clone());
      return response;
    } catch {
      return (await findCached()) || Response.error();
    }
  }

  const cached = await findCached();
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
    await trimAssetCache(cache);
  }
  return response;
}

// Cada versión publicada trae archivos con hash nuevo; se descartan los más antiguos para no crecer sin límite.
async function trimAssetCache(cache) {
  const keys = await cache.keys();
  const excess = keys.length - MAX_ASSET_ENTRIES;
  if (excess > 0) await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
}
