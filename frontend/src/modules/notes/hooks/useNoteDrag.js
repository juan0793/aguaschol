import { useCallback, useEffect, useRef, useState } from "react";
import { neighborsForDrop } from "../utils/notesOrder";

const MOUSE_THRESHOLD = 4;
const TOUCH_HOLD_MS = 250;
const TOUCH_TOLERANCE = 8;
const EDGE = 72;
const SCROLL_STEP = 14;

/**
 * Arrastre por puntero (mouse, lapiz y tactil) con el orden lineal del DOM. En tactil se activa
 * con pulsacion larga para no competir con el scroll. La seccion se renderiza sin la nota
 * arrastrada y con un hueco punteado en `drag.index`; al soltar se calculan los vecinos.
 */
export const useNoteDrag = ({ onDrop }) => {
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef(0);
  const cleanupRef = useRef(null);

  const targetIndex = (current, x, y) => {
    const element = document.elementFromPoint(x, y)?.closest("[data-note-id]");
    if (!element || element.dataset.section !== current.section) return current.index;
    if (element.dataset.placeholder) return current.index;
    const id = Number(element.dataset.noteId);
    const index = current.list.findIndex((note) => note.id === id);
    if (index === -1) return current.index;
    const rect = element.getBoundingClientRect();
    return x < rect.left + rect.width / 2 ? index : index + 1;
  };

  const updatePosition = (x, y) => {
    pointerRef.current = { x, y };
    setDrag((current) => {
      if (!current) return current;
      // El ref se actualiza aqui y no solo al renderizar: al soltar se lee la ultima posicion.
      const next = { ...current, x, y, index: targetIndex(current, x, y) };
      dragRef.current = next;
      return next;
    });
  };

  const autoScroll = () => {
    const { x, y } = pointerRef.current;
    const step = y < EDGE ? -SCROLL_STEP : y > window.innerHeight - EDGE ? SCROLL_STEP : 0;
    if (step) {
      window.scrollBy(0, step);
      updatePosition(x, y);
    }
    frameRef.current = requestAnimationFrame(autoScroll);
  };

  useEffect(() => () => cleanupRef.current?.(), []);

  const onPointerDown = useCallback((event, note, section, sectionNotes) => {
    if (event.button > 0) return;
    event.stopPropagation();
    const card = event.currentTarget.closest("[data-note-id]");
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const isTouch = event.pointerType === "touch";
    let started = false;
    let holdTimer = null;

    const begin = () => {
      started = true;
      const originIndex = sectionNotes.findIndex((item) => item.id === note.id);
      pointerRef.current = { x: startX, y: startY };
      const initial = {
        note,
        section,
        list: sectionNotes.filter((item) => item.id !== note.id),
        originIndex,
        index: originIndex,
        x: startX,
        y: startY,
        offsetX: startX - rect.left,
        offsetY: startY - rect.top,
        width: rect.width,
        height: rect.height
      };
      dragRef.current = initial;
      setDrag(initial);
      if (isTouch) navigator.vibrate?.(12);
      document.body.classList.add("notes-is-dragging");
      frameRef.current = requestAnimationFrame(autoScroll);
    };

    const cleanup = () => {
      clearTimeout(holdTimer);
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey, true);
      document.body.classList.remove("notes-is-dragging");
      cleanupRef.current = null;
    };

    function onMove(moveEvent) {
      if (!started) {
        const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
        if (isTouch) {
          if (distance > TOUCH_TOLERANCE) cleanup();
          return;
        }
        if (distance < MOUSE_THRESHOLD) return;
        begin();
      }
      moveEvent.preventDefault();
      updatePosition(moveEvent.clientX, moveEvent.clientY);
    }

    function onUp() {
      const current = dragRef.current;
      cleanup();
      dragRef.current = null;
      setDrag(null);
      if (started && current && current.index !== current.originIndex) {
        onDrop(current.note, neighborsForDrop(current.list, current.index, current.note));
      }
    }

    function onCancel() {
      cleanup();
      dragRef.current = null;
      setDrag(null);
    }

    function onKey(keyEvent) {
      if (keyEvent.key === "Escape" && started) {
        keyEvent.preventDefault();
        keyEvent.stopPropagation();
        onCancel();
      }
    }

    if (isTouch) holdTimer = setTimeout(begin, TOUCH_HOLD_MS);
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey, true);
    cleanupRef.current = cleanup;
  }, [onDrop]);

  return { drag, onPointerDown };
};
