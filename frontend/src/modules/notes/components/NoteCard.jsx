import { useLayoutEffect, useRef, useState } from "react";
import { Icon } from "../../../components/Icon";
import ActionMenu from "./ActionMenu";
import ColorPicker from "./ColorPicker";
import NoteText from "./NoteText";
import { formatNoteShortDate, noteLinkLabel } from "../utils/notesOrder";

// Grid de alturas naturales sin masonry: filas de 8 px y cada tarjeta ocupa las filas que mide
// su contenido mas el espacio vertical entre tarjetas. El orden del DOM sigue siendo lineal.
export const GRID_ROW = 8;
export const GRID_GAP = 8;

/**
 * Celda del grid que se mide sola con su propio ResizeObserver: editar una nota solo vuelve a
 * medir esa celda. Escribe grid-row-end directo en el DOM para no re-renderizar el tablero.
 */
export function GridCell({ className = "", style, children, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const cell = ref.current;
    const inner = cell?.firstElementChild;
    if (!inner) return undefined;
    const measure = () => {
      const height = inner.getBoundingClientRect().height;
      cell.style.gridRowEnd = `span ${Math.max(1, Math.ceil((height + GRID_GAP) / GRID_ROW))}`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`notes-cell ${className}`} style={style} {...props}>{children}</div>;
}

export default function NoteCard({
  note,
  selected = false,
  ghost = false,
  dragState,
  actions
}) {
  const contentRef = useRef(null);
  const [clamped, setClamped] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Recorte a seis lineas con degradado solo cuando de verdad sobra texto.
  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) return undefined;
    const check = () => setClamped(element.scrollHeight > element.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(element);
    return () => observer.disconnect();
  }, [note.content]);

  const pending = Boolean(note.pending);
  const headingId = `note-title-${note.id}`;
  const open = () => !pending && actions?.onOpen(note);

  const menuItems = actions ? [
    { label: note.is_pinned ? "Desfijar" : "Fijar", icon: "pin", onSelect: () => actions.onTogglePin(note), disabled: note.is_archived },
    {
      render: () => (
        <div className="note-menu-colors">
          <span>Color</span>
          <ColorPicker compact value={note.color} onChange={(color) => actions.onColor(note, color)} />
        </div>
      )
    },
    { separator: true },
    { label: "Duplicar", icon: "copy", onSelect: () => actions.onDuplicate(note) },
    { label: "Copiar texto", icon: "copy", onSelect: () => actions.onCopy(note) },
    dragState?.canMove ? { label: "Mover antes", icon: "arrowLeft", onSelect: () => actions.onStep(note, -1) } : null,
    dragState?.canMove ? { label: "Mover después", icon: "arrowRight", onSelect: () => actions.onStep(note, 1) } : null,
    { separator: true },
    note.is_archived
      ? { label: "Restaurar al tablero", icon: "refresh", onSelect: () => actions.onUnarchive(note) }
      : { label: "Archivar", icon: "archive", onSelect: () => actions.onArchive(note) },
    { label: "Eliminar", icon: "trash", danger: true, onSelect: () => actions.onDelete(note) }
  ] : [];

  return (
    <article
      className={[
        "note-card",
        `note-color-${note.color}`,
        note.is_pinned ? "is-pinned" : "",
        selected ? "is-selected" : "",
        ghost ? "is-ghost" : "",
        pending ? "is-pending" : "",
        menuOpen ? "is-menu-open" : ""
      ].filter(Boolean).join(" ")}
      tabIndex={ghost ? -1 : 0}
      aria-labelledby={headingId}
      aria-busy={pending || undefined}
      data-note-card={note.id}
      onClick={open}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          open();
        }
      }}
    >
      <header className={`note-card-head ${note.title ? "" : "is-bare"}`}>
        {note.is_pinned ? <span className="note-pin-flag" title="Fijado"><Icon name="pin" /><span className="note-sr">Fijado</span></span> : null}
        <h3 id={headingId} className={note.title ? "note-card-title" : "note-sr"}>
          {note.title || note.content.split("\n")[0].slice(0, 80)}
        </h3>
        {actions && !ghost ? (
          <div className="note-card-actions">
            {dragState ? (
              <button
                type="button"
                className={`note-icon-button note-drag ${dragState.enabled ? "" : "is-disabled"}`}
                aria-label={dragState.enabled ? "Arrastrar para reordenar" : dragState.reason}
                title={dragState.enabled ? "Arrastrar para reordenar" : dragState.reason}
                aria-disabled={!dragState.enabled}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => dragState.enabled && dragState.onPointerDown(event, note)}
              >
                <Icon name="grip" />
              </button>
            ) : null}
            <button
              type="button"
              className={`note-icon-button note-quick-pin ${note.is_pinned ? "is-on" : ""}`}
              aria-pressed={note.is_pinned}
              aria-label={note.is_pinned ? "Desfijar" : "Fijar"}
              title={note.is_pinned ? "Desfijar" : "Fijar"}
              disabled={pending || note.is_archived}
              onClick={(event) => {
                event.stopPropagation();
                actions.onTogglePin(note);
              }}
            >
              <Icon name="pin" />
            </button>
            {pending ? null : <ActionMenu items={menuItems} label={`Acciones de ${note.title || "apunte"}`} onOpenChange={setMenuOpen} />}
          </div>
        ) : null}
      </header>

      <div ref={contentRef} className={`note-card-content ${clamped ? "is-clamped" : ""}`}>
        <NoteText text={note.content} onCopyPhone={(segment) => actions?.onCopyPhone(segment)} />
      </div>

      {note.links?.length ? (
        <p className="note-card-link">
          <Icon name="send" />
          <span>{note.links.length === 1 ? `Enviado a ${noteLinkLabel(note.links[0])}` : `Enviado a ${note.links.length} destinos`}</span>
        </p>
      ) : null}

      <footer className="note-card-foot">
        <time dateTime={note.updated_at}>{pending ? "Guardando…" : formatNoteShortDate(note.updated_at)}</time>
        {note.category ? <span className="note-chip">{note.category}</span> : null}
        {note.is_archived ? <span className="note-chip is-archived">Archivado</span> : null}
      </footer>
    </article>
  );
}
