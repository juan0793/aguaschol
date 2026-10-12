// Cada compilación de Vite cambia el nombre del script de entrada (/assets/index-<hash>.js).
// Comparar el de esta página con el que sirve hoy index.html dice si hay una versión nueva.
const ENTRY_SCRIPT = /<script\b[^>]*\bsrc="([^"]*\/assets\/index-[^"]+\.js)"/i;

export const entryScriptOf = (html) => {
  const src = String(html || "").match(ENTRY_SCRIPT)?.[1];
  return src ? new URL(src, "https://local.invalid").pathname : null;
};

export const currentEntryScript = (doc = document) => {
  const src = doc.querySelector('script[type="module"][src*="/assets/index-"]')?.getAttribute("src");
  return src ? new URL(src, "https://local.invalid").pathname : null;
};

export const hasNewVersion = (current, published) => Boolean(current && published && current !== published);

// Toda cuenta con sesión recibe el aviso. Nadie se recarga solo: en campo, cada quien
// actualiza cuando termina lo que está capturando.
export const canSeeUpdateNotice = (user) => Boolean(user?.id);
