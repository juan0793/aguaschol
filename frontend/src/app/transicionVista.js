// Cambio de pantalla sin sobresaltos (2026-11-15).
// Cada módulo traía su propia entrada (subir 8–12 px, desenfoque, escalonados de
// hasta 0.6 s), y todas se notaban juntas al tocar un menú. Al cambiar de vista:
//  - las animaciones CSS de entrada del contenido nuevo (finitas y cortas) se
//    terminan de inmediato, así el contenido queda en su lugar final;
//  - el contenido entra con un solo fundido corto, sin moverse.
// No toca la barra superior, el menú lateral ni los diálogos, ni las animaciones
// que se repiten (spinners, pulsos). Con "reducir movimiento" no hay fundido.

export const FUNDIDO_MS = 160;
const VENTANA_MS = 900; // los módulos perezosos montan después del Suspense
const ENTRADA_MAX_MS = 1500;
const FUERA = ".app-chrome, .control-sidebar, .control-sidebar-backdrop, .app-bottom-nav, [role='dialog'], [aria-modal='true']";

export function esEntradaCorta(timing) {
  if (!timing) return false;
  if (!Number.isFinite(timing.iterations)) return false;
  return Number(timing.endTime) > 0 && Number(timing.endTime) <= ENTRADA_MAX_MS;
}

function esContenido(el, view) {
  if (!el || el.nodeType !== 1 || el.matches(FUERA)) return false;
  const estilo = view.getComputedStyle(el);
  if (estilo.position === "fixed" || estilo.display === "none") return false;
  return el.getBoundingClientRect().height > 0;
}

export function suavizarCambioDeVista({ doc = globalThis.document, view = globalThis.window } = {}) {
  const shell = doc?.querySelector?.(".page-shell");
  if (!shell || typeof doc.getAnimations !== "function") return () => {};
  const reducir = Boolean(view.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const CssAnimation = view.CSSAnimation;
  const vistas = new WeakSet();
  const fundidos = new WeakSet();
  const inicio = view.performance.now();
  let frame = 0;

  const paso = () => {
    for (const anim of doc.getAnimations()) {
      if (vistas.has(anim)) continue;
      vistas.add(anim);
      if (!CssAnimation || !(anim instanceof CssAnimation)) continue;
      const target = anim.effect?.target;
      if (!target || !shell.contains(target) || target.closest(FUERA)) continue;
      if (esEntradaCorta(anim.effect.getComputedTiming())) anim.finish();
    }
    if (!reducir) {
      for (const el of shell.children) {
        if (fundidos.has(el) || !esContenido(el, view)) continue;
        fundidos.add(el);
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FUNDIDO_MS, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" });
      }
    }
    if (view.performance.now() - inicio < VENTANA_MS) frame = view.requestAnimationFrame(paso);
  };

  paso();
  return () => view.cancelAnimationFrame(frame);
}
