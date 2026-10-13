import { useLayoutEffect, useRef } from "react";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const MOVE_MS = 340;
const ENTER_MS = 260;
const STAGGER_MS = 22;
const STAGGER_MAX_MS = 220;

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Continuidad del tablero: despues de cada render compara donde estaba cada celda y donde
 * quedo, y la desliza desde su lugar anterior (FLIP). Una nota que fijas sube a Fijados, la
 * que archivas deja un hueco que el resto cierra, y un filtro reacomoda en vez de saltar.
 * Las celdas nuevas entran con un leve fundido, escalonado y con tope cuando llegan en lote.
 * Las posiciones son relativas al tablero, asi el scroll de la pagina no cuenta como movimiento.
 */
export const useBoardMotion = (boardRef, { paused = false } = {}) => {
  const previous = useRef(new Map());
  const boardWidth = useRef(0);

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const origin = board.getBoundingClientRect();
    const cells = [...board.querySelectorAll("[data-note-id]:not([data-placeholder])")];
    const next = new Map();
    for (const cell of cells) {
      const rect = cell.getBoundingClientRect();
      next.set(cell.dataset.noteId, { cell, x: rect.left - origin.left, y: rect.top - origin.top });
    }

    const before = previous.current;
    const resized = Math.abs(origin.width - boardWidth.current) > 1;
    previous.current = next;
    boardWidth.current = origin.width;
    if (paused || reducedMotion() || typeof Element.prototype.animate !== "function") return;

    // Primera pintura del tablero (o de una vista nueva): entrada escalonada, sin movimiento.
    const firstPaint = before.size === 0;
    let entering = 0;
    for (const [id, { cell, x, y }] of next) {
      const last = before.get(id);
      if (!last) {
        const delay = Math.min(entering * STAGGER_MS, firstPaint ? STAGGER_MAX_MS : 0);
        entering += 1;
        cell.animate(
          [{ opacity: 0, transform: "translateY(6px) scale(.985)" }, { opacity: 1, transform: "none" }],
          { duration: ENTER_MS, delay, easing: EASE, fill: "backwards" }
        );
        continue;
      }
      const dx = last.x - x;
      const dy = last.y - y;
      if (resized || (Math.abs(dx) < 1 && Math.abs(dy) < 1)) continue;
      cell.getAnimations().forEach((animation) => animation.cancel());
      cell.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
        { duration: MOVE_MS, easing: EASE }
      );
    }
  });
};
