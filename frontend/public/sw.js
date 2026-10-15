const SHELL_CACHE = "controlaguas-shell-v5";
const ASSET_CACHE = "controlaguas-assets-v5";
const APP_CACHES = [SHELL_CACHE, ASSET_CACHE];
const MAX_ASSET_ENTRIES = 160;
// Lo pesado y de oficina (PDF, planos, SIG con MapLibre) no se guarda de antemano:
// se baja la primera vez que se abre con señal. Lo demás de la app queda listo sin red.
const NO_PRECARGAR = /^(pdf\.worker|pdf-|jspdf|html2canvas|maplibre-gl|PlanosWorkspace)/;
const SHELL_FILES = [
  "/manifest.webmanifest",
  "/icons/icon-192.png?v=2",
  "/icons/icon-512.png?v=2",
  "/icons/apple-touch-icon.png?v=2",
  "/icons/favicon.svg?v=2",
  "/icons/favicon-32.png?v=2"
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
  if (/^\/(api|uploads|planos-pdf)(\/|$)/.test(url.pathname) || request.headers?.has("Authorization")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetchNavigation(request, event));
    return;
  }

  if (!url.pathname.startsWith("/assets/") && !url.pathname.startsWith("/icons/")) return;
  if (["script", "style", "image", "font"].includes(request.destination)) {
    event.respondWith(fetchAsset(request));
  }
});

async function cacheAppShell() {
  const response = await fetch("/", { cache: "reload" });
  if (!response.ok) throw new Error("No fue posible guardar la app para uso sin conexión.");
  const cache = await caches.open(SHELL_CACHE);
  await cache.put("/", response.clone());
  await precacheBuild(await response.text());
  await self.skipWaiting();
}

// Guarda todo lo que la versión publicada necesita para abrir sin red: el arranque y
// también los módulos que se cargan al entrar a cada pantalla (import() dinámico).
// Se repite cuando llega un index.html nuevo, porque cada despliegue cambia los
// nombres con hash sin cambiar este archivo; al final borra lo de versiones viejas.
async function precacheBuild(html) {
  const cache = await caches.open(SHELL_CACHE);
  const entryAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => new URL(match[1], self.location.origin))
    .filter((url) => url.origin === self.location.origin && url.pathname.startsWith("/assets/"));
  const visitedAssets = new Set();

  await Promise.all([
    ...SHELL_FILES.map((url) => cacheAsset(cache, url, visitedAssets)),
    ...entryAssets.map((url) => cacheAsset(cache, url.href, visitedAssets))
  ]);

  const keys = await cache.keys();
  await Promise.all(keys
    .filter((request) => new URL(request.url).pathname.startsWith("/assets/") && !visitedAssets.has(request.url))
    .map((request) => cache.delete(request)));
}

const assetReferences = (source, isScript) => isScript
  // Importaciones estáticas, import("./x.js") y la lista de dependencias de Vite ("assets/x.css").
  ? [...source.matchAll(/["'`]((?:\.\.?\/|\/?assets\/)[\w.@~-]+\.(?:js|css|woff2?|webp|png|svg))["'`]/g)].map((match) => match[1])
  : [...source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((match) => match[1]);

async function cacheAsset(cache, url, visitedAssets) {
  const assetUrl = new URL(url, self.location.origin);
  if (visitedAssets.has(assetUrl.href)) return;
  if (assetUrl.pathname.startsWith("/assets/") && NO_PRECARGAR.test(assetUrl.pathname.slice("/assets/".length))) return;
  visitedAssets.add(assetUrl.href);

  try {
    // Lo ya guardado no se vuelve a bajar: solo se lee para seguir sus dependencias.
    let response = await cache.match(assetUrl.href);
    const stored = Boolean(response);
    if (!response) {
      response = await fetch(assetUrl.href);
      if (!response.ok) return;
    }

    const isScript = assetUrl.pathname.endsWith(".js");
    const isStyle = assetUrl.pathname.endsWith(".css");
    const source = isScript || isStyle ? await response.clone().text() : "";
    const dependencies = (isScript || isStyle ? assetReferences(source, isScript) : []).flatMap((reference) => {
      try {
        // Las rutas "assets/x" de Vite son desde la raíz; las "./x" desde el propio archivo.
        const dependency = /^assets\//.test(reference) ? new URL(`/${reference}`, self.location.origin) : new URL(reference, assetUrl);
        return dependency.origin === self.location.origin &&
          (dependency.pathname.startsWith("/assets/") || dependency.pathname.startsWith("/icons/"))
          ? [dependency.href]
          : [];
      } catch {
        return [];
      }
    });

    if (!stored) await cache.put(assetUrl.href, response);
    await Promise.all(dependencies.map((dependency) => cacheAsset(cache, dependency, visitedAssets)));
  } catch {
    // Los recursos opcionales se guardan al cargarse cuando vuelve la conexión.
  }
}

async function fetchNavigation(request, event) {
  try {
    const response = await fetch(request);
    if (response.ok && !/private|no-store/i.test(response.headers.get("Cache-Control") || "")) {
      const cache = await caches.open(SHELL_CACHE);
      const previous = await cache.match("/");
      const html = await response.clone().text();
      await cache.put("/", response.clone());
      // Versión nueva publicada: deja listos sus módulos para el próximo uso sin señal.
      if (!previous || (await previous.text()) !== html) event.waitUntil(precacheBuild(html).catch(() => {}));
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
