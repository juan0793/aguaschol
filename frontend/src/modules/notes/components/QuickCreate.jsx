import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Icon } from "../../../components/Icon";
import ColorPicker from "./ColorPicker";

const DRAFT_KEY = "aguas.notes.draft.v1";
const EMPTY = { title: "", content: "", color: "default" };

const readDraft = () => {
  try {
    return { ...EMPTY, ...JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "{}") };
  } catch {
    return EMPTY;
  }
};
const writeDraft = (draft) => {
  try {
    if (draft.content || draft.title) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Si el almacenamiento local no esta disponible solo se pierde la recuperacion del borrador.
  }
};

/**
 * Creacion rapida: solo el contenido es obligatorio. Al enfocarse muestra titulo y color;
 * Ctrl/Cmd+Enter guarda y deja el campo listo para la siguiente nota; Escape lo colapsa.
 * El borrador sobrevive a cerrar la pestaña.
 */
const QuickCreate = forwardRef(function QuickCreate({ onCreate, onError }, ref) {
  const [draft, setDraft] = useState(readDraft);
  const [expanded, setExpanded] = useState(() => Boolean(readDraft().content || readDraft().title));
  const rootRef = useRef(null);
  const contentRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      setExpanded(true);
      setTimeout(() => contentRef.current?.focus(), 0);
    }
  }));

  useEffect(() => writeDraft(draft), [draft]);

  // El textarea crece con el texto hasta un maximo; despues hace scroll.
  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 320)}px`;
  }, [draft.content, expanded]);

  const change = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const hasText = Boolean(draft.content.trim());

  const save = async () => {
    if (!hasText) {
      contentRef.current?.focus();
      return;
    }
    const pending = draft;
    setDraft(EMPTY);
    contentRef.current?.focus();
    try {
      await onCreate({ title: pending.title.trim(), content: pending.content, color: pending.color });
    } catch (reason) {
      setDraft((current) => (current.content || current.title ? current : pending));
      onError?.(reason.message);
    }
  };

  const collapse = () => {
    setExpanded(false);
    contentRef.current?.blur();
  };

  return (
    <section
      ref={rootRef}
      className={`notes-quick ${expanded ? "is-expanded" : ""}`}
      aria-label="Crear apunte"
      onFocus={() => setExpanded(true)}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget) && !draft.content && !draft.title) setExpanded(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          collapse();
        } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          save();
        }
      }}
    >
      {expanded ? (
        <input
          className="notes-quick-title"
          placeholder="Título (opcional)"
          aria-label="Título del apunte (opcional)"
          maxLength={200}
          value={draft.title}
          onChange={(event) => change("title", event.target.value)}
        />
      ) : null}
      <div className="notes-quick-row">
        <textarea
          ref={contentRef}
          className="notes-quick-content"
          rows={1}
          placeholder="Escribe un apunte rápido..."
          aria-label="Contenido del apunte"
          spellCheck
          lang="es"
          value={draft.content}
          onChange={(event) => change("content", event.target.value)}
        />
        {expanded ? null : (
          <button type="button" className="note-button is-primary" onClick={() => (hasText ? save() : contentRef.current?.focus())}>
            <Icon name="plus" />
            Nuevo apunte
          </button>
        )}
      </div>
      {expanded ? (
        <div className="notes-quick-foot">
          <ColorPicker compact value={draft.color} onChange={(color) => change("color", color)} />
          <span className="notes-quick-hint"><kbd>Ctrl</kbd> + <kbd>Enter</kbd> para guardar</span>
          <button type="button" className="note-button" onClick={collapse}>Cerrar</button>
          <button type="button" className="note-button is-primary" disabled={!hasText} onClick={save}>
            <Icon name="plus" />
            Guardar apunte
          </button>
        </div>
      ) : null}
    </section>
  );
});

export default QuickCreate;
