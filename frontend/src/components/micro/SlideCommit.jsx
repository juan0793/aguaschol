import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from "motion/react";

import "./SlideCommit.css";

// Deslizador de confirmacion para acciones que no se deshacen solas: el gesto
// completo es la confirmacion y la promesa de `onConfirm` mueve el estado
// (pendiente, hecho, fallo) sin que el llamador tenga que orquestarlo.
// Adaptado de React Bits (categoria Micro): iconos propios, paleta --ds-* y
// ancho fluido para que sirva igual en el cajon de escritorio y en movil.

const PAD = 4;
const SQUASH_MAX = 0.08;
const SQUASH_DIV = 110;
const SWELL = 1.03;
const MIN_PENDING = 300;
const EASE_OUT = [0.23, 1, 0.32, 1];
const SHAKE = [0, -5, 5, -3, 3, -1, 0];
const FALLBACK_WIDTH = 280;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Texto legible sobre un color de fondo dado (los colores llegan en hex).
const onColor = (hex) => {
  const raw = String(hex).replace("#", "");
  const full = raw.length === 3 ? [...raw].map((ch) => ch + ch).join("") : raw.slice(0, 6);
  const value = parseInt(full, 16);
  if (Number.isNaN(value)) return "#ffffff";
  const yiq = (((value >> 16) & 255) * 299 + ((value >> 8) & 255) * 587 + (value & 255) * 114) / 1000;
  return yiq >= 128 ? "#111111" : "#ffffff";
};

const velocityOf = (historial) => {
  if (historial.length < 2) return 0;
  const [t0, x0] = historial[0];
  const [t1, x1] = historial[historial.length - 1];
  return ((x1 - x0) / Math.max(1, t1 - t0)) * 1000;
};

const finePointer = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

const Flecha = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h13m0 0-5-5m5 5-5 5" />
  </svg>
);

const Tick = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const Spinner = ({ size }) => (
  <svg className="slide-commit__spinner" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeOpacity="0.25" />
    <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

export default function SlideCommit({
  label = "Desliza para confirmar",
  doneLabel = "Confirmado",
  errorLabel = "No se pudo confirmar",
  onConfirm,
  onDone,
  onError,
  trackColor = "#eaf2fd",
  handleColor = "#1465d9",
  successColor = "#16704b",
  dangerColor = "#9b202d",
  labelColor = "#597087",
  width = FALLBACK_WIDTH,
  minWidth = 280,
  height = 44,
  radius = 10,
  speed = 50,
  returnBounce = 0.38,
  landingDip = 0.026,
  holdMs = 1500,
  disabled = false,
  icon,
  describedBy,
  title,
  className = ""
}) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState("idle");
  const [held, setHeld] = useState(false);
  const [hot, setHot] = useState(false);

  const hostRef = useRef(null);
  const trackRef = useRef(null);
  const capsuleRef = useRef(null);
  const grip = useRef(null);
  const timer = useRef(0);
  const homeTimer = useRef(0);
  const run = useRef(0);
  const unwatch = useRef(null);
  const live = useRef({ move: () => {}, up: () => {} });
  const lastPercent = useRef(0);

  // Ancho fluido: la geometria necesita un numero, asi que se mide el hueco
  // real cuando el llamador pide "fill" (el cajon es angosto en movil).
  const fluido = width === "fill";
  const [medido, setMedido] = useState(null);
  useLayoutEffect(() => {
    if (!fluido) return undefined;
    const host = hostRef.current;
    if (!host) return undefined;
    const medir = () => setMedido(host.offsetWidth || null);
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(host);
    return () => observer.disconnect();
  }, [fluido]);

  const box = fluido ? medido || FALLBACK_WIDTH : width;
  const GRIP = height - PAD * 2;
  const INNER = box - PAD * 2;
  const TRAVEL = Math.max(1, INNER - GRIP);
  const r = clamp(radius, 0, height / 2);
  const gripR = Math.max(0, r - PAD);
  const k = 260 + (clamp(speed, 0, 100) / 100) * 640;
  const mass = 0.9;
  const critical = 2 * Math.sqrt(k * mass);
  const commitSpring = { type: "spring", stiffness: k, damping: critical, mass };
  const homeSpring = { ...commitSpring, damping: critical * (1 - clamp(returnBounce, 0, 0.5)) };

  const x = useMotionValue(0);
  const anchor = useMotionValue(0);
  const shown = useMotionValue(1);
  const spin = useMotionValue(0);
  const pulse = useMotionValue(1);
  const shake = useMotionValue(0);
  const seen = useTransform(x, (v) => clamp(v, 0, TRAVEL));
  const edge = useTransform([seen, anchor], ([v, a]) => v + GRIP + clamp(a - v, 0, TRAVEL));
  const clip = useTransform(edge, (R) => `inset(0 ${INNER - R}px 0 0 round ${gripR}px)`);
  const content = useTransform([seen, edge], ([v, R]) => `translateX(${(v + R) / 2 - INNER / 2}px)`);
  const swell = hot && !held && phase === "idle" && !reduce ? SWELL : 1;
  const shape = useTransform(x, (v) => {
    const q = 1 - Math.min(SQUASH_MAX, Math.max(0, -v) / SQUASH_DIV);
    return `scale(${q * swell}, ${swell / q})`;
  });
  const origin = useTransform(seen, (v) => `${v}px 50%`);
  const say = useTransform(seen, [0, TRAVEL * 0.55], [1, 0]);
  const arrow = useTransform([seen, shown], ([v, on]) => on * clamp(1 - (v - TRAVEL * 0.55) / (TRAVEL * 0.4), 0, 1));
  const trackTransform = useTransform([shake, pulse], ([s, p]) => `translateX(${s}px) scale(${p})`);

  const labelText = typeof label === "string" ? label : "Desliza para confirmar";
  useMotionValueEvent(seen, "change", (v) => {
    const percent = Math.round((v / TRAVEL) * 100);
    if (percent === lastPercent.current || !capsuleRef.current) return;
    lastPercent.current = percent;
    capsuleRef.current.setAttribute("aria-valuenow", String(percent));
    capsuleRef.current.setAttribute("aria-valuetext", `${labelText}, ${percent}%`);
  });

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(homeTimer.current);
      unwatch.current?.();
      run.current += 1;
    },
    []
  );

  const local = (clientX) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return (clientX - rect.left) / (rect.width / box || 1);
  };

  const goHome = (velocity) => {
    if (reduce) animate(x, 0, { duration: 0.2, ease: EASE_OUT });
    else animate(x, 0, { ...homeSpring, velocity: Math.min(0, velocity) });
  };

  const settle = () => {
    setPhase("idle");
    animate(shown, 1, { duration: 0.2, delay: 0.12 });
    if (reduce) anchor.set(0);
    else animate(anchor, 0, { type: "spring", duration: 0.3, bounce: 0 });
  };

  const resolve = (viaKey) => {
    setPhase("done");
    anchor.set(x.get());
    animate(spin, 0, { duration: 0.12 });
    if (reduce) x.set(0);
    else {
      animate(x, 0, commitSpring);
      if (!viaKey && landingDip > 0) {
        animate(pulse, [1, 1 - landingDip, 1], { duration: 0.46, times: [0, 0.62, 1], ease: EASE_OUT, delay: 0.1 });
      }
    }
    onDone?.();
    if (holdMs > 0) timer.current = setTimeout(settle, holdMs);
  };

  const reject = (reason) => {
    setPhase("error");
    onError?.(reason);
    animate(spin, 0, { duration: 0.12 });
    animate(shown, 1, { duration: 0.2, delay: 0.12 });
    if (reduce) goHome(0);
    else {
      animate(shake, SHAKE, { duration: 0.45, ease: EASE_OUT });
      homeTimer.current = setTimeout(() => {
        if (!grip.current) goHome(0);
      }, 300);
    }
    timer.current = setTimeout(() => setPhase("idle"), Math.max(holdMs, 1500));
  };

  const commit = (viaKey) => {
    clearTimeout(timer.current);
    const id = ++run.current;
    x.set(TRAVEL);
    let salida;
    try {
      salida = onConfirm?.();
    } catch (reason) {
      reject(reason);
      return;
    }
    const pendiente = salida && typeof salida.then === "function" ? salida : null;
    if (!pendiente) {
      animate(shown, 0, { duration: 0.12 });
      resolve(viaKey);
      return;
    }
    setPhase("pending");
    animate(shown, 0, { duration: 0.2 });
    animate(spin, 1, { duration: 0.2 });
    const inicio = performance.now();
    const luego = (fn) => {
      setTimeout(
        () => {
          if (id === run.current) fn();
        },
        Math.max(0, MIN_PENDING - (performance.now() - inicio))
      );
    };
    pendiente.then(
      () => luego(() => resolve(viaKey)),
      (reason) => luego(() => reject(reason))
    );
  };

  const down = (event) => {
    if (disabled || grip.current || phase === "pending" || phase === "done" || event.button !== 0) return;
    x.stop();
    grip.current = { id: event.pointerId, grab: null, moved: false, hist: [] };
    setHeld(true);
    try {
      trackRef.current?.setPointerCapture(event.pointerId);
    } catch {
      /* el navegador puede rechazar la captura; el gesto sigue funcionando */
    }
    unwatch.current?.();
    const onMove = (ev) => ev.isTrusted && live.current.move(ev);
    const onUp = (ev) => ev.isTrusted && live.current.up(ev);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    unwatch.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      unwatch.current = null;
    };
  };

  const move = (event) => {
    const g = grip.current;
    if (!g || g.id !== event.pointerId) return;
    const at = local(event.clientX);
    if (g.grab === null) {
      g.grab = at - x.get();
      return;
    }
    const next = clamp(at - g.grab, 0, TRAVEL);
    if (Math.abs(next - x.get()) > 0.5) g.moved = true;
    g.hist.push([event.timeStamp, next]);
    if (g.hist.length > 4) g.hist.shift();
    x.set(next);
  };

  const up = (event) => {
    const g = grip.current;
    if (!g || g.id !== event.pointerId) return;
    grip.current = null;
    unwatch.current?.();
    try {
      trackRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      /* ver comentario anterior */
    }
    setHeld(false);
    if (x.get() >= TRAVEL) commit(false);
    else if (g.moved) goHome(velocityOf(g.hist));
  };
  live.current = { move, up };

  const onKeyDown = (event) => {
    if (disabled || phase === "pending" || phase === "done") return;
    const paso = TRAVEL / 10;
    if (event.key === "End") {
      event.preventDefault();
      commit(true);
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = Math.min(TRAVEL, x.get() + paso);
      x.set(next);
      if (next >= TRAVEL) commit(true);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      x.set(Math.max(0, x.get() - paso));
    } else if (event.key === "Home" || event.key === "Escape") {
      event.preventDefault();
      if (grip.current) up({ pointerId: grip.current.id });
      else x.set(0);
    }
  };

  const fontSize = clamp(Math.round(height * 0.3), 13, 16);
  const iconSize = Math.round(GRIP * 0.5);
  const done = phase === "done";

  return (
    <div
      ref={hostRef}
      className={`slide-commit${className ? ` ${className}` : ""}`}
      data-phase={phase}
      data-held={held ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      title={title}
      style={{
        width: fluido ? "100%" : width,
        minWidth: fluido ? minWidth : undefined,
        height,
        "--sl-track": trackColor,
        "--sl-ink": handleColor,
        "--sl-ok": successColor,
        "--sl-no": dangerColor,
        "--sl-label": labelColor,
        "--sl-on-ink": onColor(handleColor),
        "--sl-on-ok": onColor(successColor),
        "--sl-on-no": onColor(dangerColor),
        "--sl-grip": `${GRIP}px`,
        "--sl-radius": `${r}px`,
        "--sl-grip-r": `${gripR}px`,
        "--sl-pad": `${PAD}px`,
        "--sl-font": `${fontSize}px`
      }}
    >
      <motion.div
        ref={trackRef}
        className="slide-commit__track"
        style={{ transform: trackTransform }}
        onPointerDown={down}
      >
        <motion.span className="slide-commit__label" style={{ opacity: say }} aria-hidden="true">
          <span className="slide-commit__text slide-commit__text--plain">{label}</span>
          <span className="slide-commit__text slide-commit__text--error">{errorLabel}</span>
        </motion.span>
        <motion.div
          ref={capsuleRef}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={labelText}
          aria-describedby={describedBy}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
          aria-busy={phase === "pending" || undefined}
          aria-disabled={disabled || undefined}
          className="slide-commit__capsule"
          style={{ clipPath: clip, transform: shape, transformOrigin: origin }}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse" && finePointer()) setHot(true);
          }}
          onPointerLeave={() => setHot(false)}
          onKeyDown={onKeyDown}
        >
          <motion.div className="slide-commit__content" style={{ transform: content }}>
            <motion.span className="slide-commit__arrow" style={{ opacity: arrow }} aria-hidden="true">
              {icon ?? <Flecha size={iconSize} />}
            </motion.span>
            <motion.span className="slide-commit__spin" style={{ opacity: spin }} aria-hidden="true">
              <Spinner size={iconSize} />
            </motion.span>
            <motion.span
              className="slide-commit__done"
              aria-hidden="true"
              initial={false}
              animate={{ opacity: done ? 1 : 0, scale: done || reduce ? 1 : 0.95 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
            >
              <Tick size={Math.round(GRIP * 0.45)} />
              {doneLabel}
            </motion.span>
          </motion.div>
        </motion.div>
        <span className="slide-commit__sr" aria-live="polite">
          {phase === "pending" ? "Procesando" : phase === "done" ? doneLabel : phase === "error" ? errorLabel : ""}
        </span>
      </motion.div>
    </div>
  );
}
