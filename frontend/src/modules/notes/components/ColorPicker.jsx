import { NOTE_COLORS } from "../utils/notesOrder";

/** Seis tokens cerrados como grupo de radio: flechas para moverse, espacio para elegir. */
export default function ColorPicker({ value = "default", onChange, label = "Color del apunte", compact = false }) {
  const move = (event, index) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = NOTE_COLORS[(index + step + NOTE_COLORS.length) % NOTE_COLORS.length];
    onChange(next.key);
    event.currentTarget.parentElement.querySelector(`[data-color="${next.key}"]`)?.focus();
  };

  return (
    <div className={`note-colors ${compact ? "is-compact" : ""}`} role="radiogroup" aria-label={label}>
      {NOTE_COLORS.map((color, index) => {
        const checked = value === color.key;
        return (
          <button
            key={color.key}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={color.label}
            title={color.label}
            data-color={color.key}
            tabIndex={checked ? 0 : -1}
            className={`note-swatch note-color-${color.key}`}
            onClick={(event) => {
              event.stopPropagation();
              onChange(color.key);
            }}
            onKeyDown={(event) => move(event, index)}
          />
        );
      })}
    </div>
  );
}
