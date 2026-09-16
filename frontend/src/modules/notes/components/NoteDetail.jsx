import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Icon } from "../../../components/Icon";
import ActionMenu from "./ActionMenu";
import ColorPicker from "./ColorPicker";
import NoteText from "./NoteText";
import { formatNoteLongDate, formatNoteShortDate, noteLinkLabel } from "../utils/notesOrder";
import { detectedItems } from "../utils/noteContent";

const AUTOSAVE_MS = 800;
const TEXT_FIELDS = ["title", "content", "category"];
const fromNote = (note) => ({ title: note.title || "", content: note.content || "", category: note.category || "" });

/**
 * Panel de detalle. Flota sobre el tablero (no lo desplaza) y guarda solo: al perder el foco y
 * tras 800 ms sin escribir. Cada guardado manda el updated_at vigente; un 409 muestra un aviso
 * en lugar de pisar el cambio hecho en otra pestaña.
 */
export default function NoteDetail({ note, mode, categories, sendTargets, actions, onClose, onUpdate, onUpsert }) {
  const [draft, setDraft] = useState(() => fromNote(note));
  const [status, setStatus] = useState("idle");
  const [conflict, setConflict] = useState(null);
  const panelRef = useRef(null);
  const contentRef = useRef(null);
  const timerRef = useRef(null);
  const savingRef = useRef(false);
  const queuedRef = useRef(false);
  const draftRef = useRef(draft);
  const noteRef = useRef(note);
  const retryRef = useRef(false);
  draftRef.current = draft;
  noteRef.current = note;
  const headingId = useId();
  const listId = useId();
  const isSheet = mode === "sheet";

  // Otra nota seleccionada: se reinicia el borrador.
  useEffect(() => {
    setDraft(fromNote(note));
    setStatus("idle");
    setConflict(null);
  }, [note.id]);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.max(element.scrollHeight, 160)}px`;
  }, [draft.content, note.id]);

  const flush = useCallback(async () => {
    clearTimeout(timerRef.current);
    const current = noteRef.current;
    const pending = draftRef.current;
    const changes = Object.fromEntries(TEXT_FIELDS.filter((field) => pending[field] !== (current[field] || "")).map((field) => [field, pending[field]]));
    if (!Object.keys(changes).length || conflict) return;
    if ("content" in changes && !changes.content.trim()) {
      setStatus("empty");
      return;
    }
    if (savingRef.current) {
      queuedRef.current = true;
      return;
    }
    savingRef.current = true;
    setStatus("saving");
    try {
      const saved = await onUpdate(current.id, changes, { optimistic: false, checkConflict: true });
      // El servidor normaliza titulo y categoria ("  proveedores" -> "Proveedores"). Si no se
      // volvio a escribir en ese campo, se adopta su version para no reenviarla en cada blur.
      if (saved) {
        setDraft((latest) => ({
          ...latest,
          ...Object.fromEntries(Object.keys(changes).filter((field) => latest[field] === changes[field]).map((field) => [field, saved[field] || ""]))
        }));
      }
      setStatus("saved");
    } catch (reason) {
      if (reason.status === 409 && reason.data?.note) {
        setConflict(reason.data.note);
        setStatus("conflict");
      } else {
        setStatus("error");
      }
    } finally {
      savingRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        // El siguiente guardado lee el updated_at nuevo tras el render.
        setTimeout(() => flushRef.current(), 0);
      }
    }
  }, [conflict, onUpdate]);
  const flushRef = useRef(flush);
  flushRef.current = flush;

  // "Conservar mi texto": se reintenta cuando el updated_at del servidor ya esta en el estado.
  useEffect(() => {
    if (retryRef.current) {
      retryRef.current = false;
      flushRef.current();
    }
  }, [note.updated_at]);

  const change = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setStatus((current) => (current === "conflict" ? current : "dirty"));
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flushRef.current(), AUTOSAVE_MS);
  };

  const close = useCallback(() => {
    flushRef.current();
    onClose();
  }, [onClose]);

  useEffect(() => () => {
    clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close]);

  useEffect(() => {
    if (isSheet) panelRef.current?.focus();
    else contentRef.current?.focus({ preventScroll: true });
  }, [note.id]);

  const statusText = {
    saving: "Guardando…",
    saved: "Guardado",
    dirty: "Cambios sin guardar",
    empty: "El apunte necesita contenido para guardarse.",
    error: "No se pudo guardar. Se reintentará al seguir escribiendo."
  }[status] || "";

  const detected = detectedItems(draft.content);
  const sendItems = sendTargets.map((target) => ({ label: target.label, icon: target.icon, onSelect: () => target.onSend({ ...note, ...draft }) }));

  return (
    <>
      {mode !== "floating" ? <div className="note-detail-veil" aria-hidden="true" onClick={close} /> : null}
      <aside
        ref={panelRef}
        className={`note-detail is-${mode}`}
        role={isSheet ? "dialog" : "complementary"}
        aria-modal={isSheet ? "true" : undefined}
        aria-labelledby={headingId}
        tabIndex={-1}
      >
        <header className="note-detail-head">
          <h2 id={headingId}>{note.is_archived ? "Apunte archivado" : "Apunte"}</h2>
          <button
            type="button"
            className={`note-icon-button ${note.is_pinned ? "is-on" : ""}`}
            aria-pressed={note.is_pinned}
            aria-label={note.is_pinned ? "Desfijar" : "Fijar"}
            title={note.is_pinned ? "Desfijar" : "Fijar"}
            disabled={note.is_archived}
            onClick={() => actions.onTogglePin(note)}
          >
            <Icon name="pin" />
          </button>
          <button type="button" className="note-icon-button" aria-label="Cerrar detalle" title="Cerrar (Esc)" onClick={close}>
            <Icon name="close" />
          </button>
        </header>

        <div className={`note-detail-body note-color-${note.color}`}>
          {conflict ? (
            <div className="note-conflict" role="alert">
              <p>Este apunte cambió en otra pestaña. Tu texto no se guardó para no pisar ese cambio.</p>
              <div>
                <button
                  type="button"
                  className="note-button"
                  onClick={() => {
                    onUpsert(conflict);
                    setDraft(fromNote(conflict));
                    setConflict(null);
                    setStatus("idle");
                  }}
                >
                  Ver la versión guardada
                </button>
                <button
                  type="button"
                  className="note-button is-primary"
                  onClick={() => {
                    retryRef.current = true;
                    setConflict(null);
                    onUpsert(conflict);
                  }}
                >
                  Conservar mi texto
                </button>
              </div>
            </div>
          ) : null}

          <input
            className="note-detail-title"
            placeholder="Título (opcional)"
            aria-label="Título"
            maxLength={200}
            value={draft.title}
            onChange={(event) => change("title", event.target.value)}
            onBlur={() => flushRef.current()}
          />
          <textarea
            ref={contentRef}
            className="note-detail-content"
            aria-label="Contenido"
            spellCheck
            lang="es"
            value={draft.content}
            onChange={(event) => change("content", event.target.value)}
            onBlur={() => flushRef.current()}
          />
          {detected.length ? (
            <div className="note-detail-detected">
              <span>Datos detectados</span>
              <NoteText text={detected.map((item) => item.value).join("   ")} onCopyPhone={actions.onCopyPhone} />
            </div>
          ) : null}

          <div className="note-detail-fields">
            <label>
              <span>Categoría</span>
              <input
                list={listId}
                placeholder="Sin categoría"
                maxLength={60}
                value={draft.category}
                onChange={(event) => change("category", event.target.value)}
                onBlur={() => flushRef.current()}
              />
              <datalist id={listId}>{categories.map((category) => <option key={category} value={category} />)}</datalist>
            </label>
            <div className="note-detail-color">
              <span>Color</span>
              <ColorPicker value={note.color} onChange={(color) => actions.onColor(note, color)} />
            </div>
          </div>

          <p className={`note-detail-status is-${status}`} aria-live="polite">{statusText}</p>

          <dl className="note-detail-meta">
            <div><dt>Creado</dt><dd>{formatNoteLongDate(note.created_at)}</dd></div>
            <div><dt>Última modificación</dt><dd>{formatNoteLongDate(note.updated_at)}</dd></div>
          </dl>

          {note.links?.length ? (
            <section className="note-detail-links" aria-label="Envíos a otros módulos">
              <h3>Trazabilidad</h3>
              <ul>
                {note.links.map((link) => (
                  <li key={link.id}>
                    <Icon name="send" />
                    <span>Enviado a {noteLinkLabel(link)} · {formatNoteShortDate(link.created_at)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <footer className="note-detail-foot">
          <div className="note-detail-actions">
            <button type="button" className="note-button" onClick={() => actions.onDuplicate(note)}><Icon name="copy" />Duplicar</button>
            <button type="button" className="note-button" onClick={() => actions.onCopy({ ...note, ...draft })}><Icon name="copy" />Copiar</button>
            {note.is_archived ? (
              <button type="button" className="note-button" onClick={() => actions.onUnarchive(note)}><Icon name="refresh" />Restaurar</button>
            ) : (
              <button type="button" className="note-button" onClick={() => actions.onArchive(note)}><Icon name="archive" />Archivar</button>
            )}
            <button type="button" className="note-button is-danger" onClick={() => actions.onDelete(note)}><Icon name="trash" />Eliminar</button>
          </div>
          {sendItems.length ? (
            <div className="note-detail-send">
              <ActionMenu items={sendItems} label="Enviar a" icon="send" buttonLabel="Enviar a…" align="start" />
            </div>
          ) : null}
        </footer>
      </aside>
    </>
  );
}
