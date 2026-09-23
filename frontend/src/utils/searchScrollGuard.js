// Los buscadores filtran mientras se escribe. Si el resultado es más corto, la
// página pierde altura y el navegador reacomoda el scroll: todo "sube y baja"
// bajo el cursor. Esta guarda, instalada una vez para toda la app, evita eso:
//
// - Al teclear en cualquier campo de texto, la página no puede quedar más corta
//   que lo que se está viendo (html min-height = scroll + alto de ventana). El
//   espacio extra queda debajo de la vista, donde no se nota.
// - Ese piso baja a medida que el usuario sube, y se suelta en cuanto el
//   contenido real vuelve a alcanzar (nunca provoca un salto al soltarse).

const TIPOS_TEXTO = new Set(["text", "search", "email", "tel", "url", ""]);
const REVISION_MS = 450;

export const installSearchScrollGuard = () => {
  if (typeof window === "undefined") return () => {};
  const root = document.documentElement;
  let piso = 0;
  let revision = 0;

  const vista = () => Math.ceil(window.scrollY + window.innerHeight);
  const soltar = () => { piso = 0; root.style.minHeight = ""; };
  const fijar = (valor) => { piso = valor; root.style.minHeight = `${valor}px`; };

  // Con el contenido real alcanzando la vista, soltar el piso no mueve nada.
  const revisar = () => {
    if (!piso) return;
    const actual = vista();
    if (document.body.offsetHeight >= actual) soltar();
    else if (actual < piso) fijar(actual);
  };

  const alEscribir = (event) => {
    const campo = event.target;
    if (!(campo instanceof HTMLInputElement) || !TIPOS_TEXTO.has(campo.type)) return;
    // Captura: corre antes de que React actualice la lista con el nuevo filtro.
    const necesario = vista();
    if (necesario > piso) fijar(necesario);
    clearTimeout(revision);
    revision = setTimeout(revisar, REVISION_MS);
  };

  document.addEventListener("input", alEscribir, true);
  window.addEventListener("scroll", revisar, { passive: true });
  window.addEventListener("resize", revisar);
  return () => {
    clearTimeout(revision);
    document.removeEventListener("input", alEscribir, true);
    window.removeEventListener("scroll", revisar);
    window.removeEventListener("resize", revisar);
    soltar();
  };
};
