import { useLayoutEffect, useRef } from "react";

import "./LiveNumber.css";

// Cifras "vivas" para los tableros: cuando llega un valor distinto, el número
// cuenta desde el anterior y la tarjeta que lo contiene destella una vez.
// Nada de esto pasa por el estado de React: el conteo escribe directo en el
// nodo de texto que React ya creó (nodeValue), así que una animación de 600 ms
// no provoca 36 renders del tablero. Si el valor llega igual, no pasa nada.

const EASE_OUT = (t) => 1 - (1 - t) ** 3;

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const defaultFormat = (value) => Math.round(Number(value) || 0).toLocaleString("es-HN");

/**
 * Marca un elemento como "recién cambiado" (atributo data-live="up|down") el
 * tiempo que dura su animación CSS. Reinicia la animación si vuelve a cambiar.
 */
export const flashElement = (element, direction = "up") => {
  if (!element || prefersReducedMotion()) return;
  element.removeAttribute("data-live");
  // Forzar el reflow para que la animación arranque de nuevo aunque ya estuviera puesta.
  void element.offsetWidth;
  element.setAttribute("data-live", direction);
  const clear = (event) => { if (event.target === element) { element.removeAttribute("data-live"); element.removeEventListener("animationend", clear); } };
  element.addEventListener("animationend", clear);
};

/**
 * Número que anima el cambio de valor.
 * - format: cómo se escribe cada cuadro (por defecto entero es-HN).
 * - flash: selector del contenedor que destella al cambiar (se busca con closest).
 * - duration: 150–700 ms según el peso de la cifra.
 */
export default function LiveNumber({ value, format = defaultFormat, flash = "", duration = 600, as: Tag = "span", className = "", ...rest }) {
  const ref = useRef(null);
  const shown = useRef(Number(value) || 0); // lo que se ve en pantalla ahora mismo
  const target = useRef(Number(value) || 0);
  const frame = useRef(0);
  const formatRef = useRef(format);
  formatRef.current = format;

  useLayoutEffect(() => {
    const next = Number(value) || 0;
    const previous = target.current;
    target.current = next;
    if (next === previous) return undefined;
    const node = ref.current?.firstChild;
    if (flash) flashElement(ref.current?.closest(flash), next > previous ? "up" : "down");
    // Con la pestaña oculta el navegador no corre cuadros de animación: el
    // número se quedaría en el valor viejo. Nadie lo ve, así que va directo.
    if (!node || prefersReducedMotion() || document.hidden) { cancelAnimationFrame(frame.current); shown.current = next; if (node) node.nodeValue = formatRef.current(next); return undefined; }
    // React ya escribió el valor final; se vuelve a pintar desde lo que se veía
    // (si otra animación estaba a medias, sigue desde ahí sin saltar).
    const from = shown.current;
    const start = performance.now();
    cancelAnimationFrame(frame.current);
    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const current = from + (next - from) * EASE_OUT(progress);
      shown.current = current;
      node.nodeValue = formatRef.current(progress < 1 ? current : next);
      if (progress < 1) frame.current = requestAnimationFrame(step);
    };
    node.nodeValue = formatRef.current(from);
    frame.current = requestAnimationFrame(step);
    // Red de seguridad: si la pestaña se oculta a medio conteo el navegador
    // deja de dar cuadros; al vencer el tiempo se escribe el valor final.
    const guard = setTimeout(() => {
      if (target.current !== next || shown.current === next) return;
      cancelAnimationFrame(frame.current);
      shown.current = next;
      node.nodeValue = formatRef.current(next);
    }, duration + 80);
    return () => clearTimeout(guard);
  }, [value, duration, flash]);

  useLayoutEffect(() => () => cancelAnimationFrame(frame.current), []);

  return <Tag ref={ref} className={className} {...rest}>{format(Number(value) || 0)}</Tag>;
}
