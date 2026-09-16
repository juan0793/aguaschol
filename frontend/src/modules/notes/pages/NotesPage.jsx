import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "../../../components/Icon";
import { createNotesApi } from "../services/notesApi";
import { useNotesBoard } from "../hooks/useNotesBoard";
import { useNoteDrag } from "../hooks/useNoteDrag";
import NoteCard, { GridCell } from "../components/NoteCard";
import NoteDetail from "../components/NoteDetail";
import QuickCreate from "../components/QuickCreate";
import { NOTE_SORTS, neighborsForDrop } from "../utils/notesOrder";
import { formatPhone } from "../utils/noteContent";
import "../styles/notes.css";

const VIEWS = [
  { key: "all", label: "Todos" },
  { key: "pinned", label: "Fijados" },
  { key: "archived", label: "Archivados" }
];

const subscribeResize = (callback) => {
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
};
const detailMode = () => (window.innerWidth < 768 ? "sheet" : window.innerWidth < 1280 ? "overlay" : "floating");

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
};

const isTypingTarget = (element) => element?.closest?.("input, textarea, select, [contenteditable='true']");

function EmptyState({ icon, title, text, action }) {
  return (
    <div className="notes-empty" role="status">
      <span className="notes-empty-icon"><Icon name={icon} /></span>
      <strong>{title}</strong>
      {text ? <p>{text}</p> : null}
      {action}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="notes-grid" aria-busy="true" aria-label="Cargando apuntes">
      {[132, 96, 180, 110, 150, 88].map((height, index) => (
        <GridCell key={index}>
          <div className="note-skeleton" style={{ height }} />
        </GridCell>
      ))}
    </div>
  );
}

export default function NotesPage({ apiFetch, onSendToInspeccion }) {
  const api = useMemo(() => createNotesApi(apiFetch), [apiFetch]);
  const board = useNotesBoard(api);
  const [selectedId, setSelectedId] = useState(null);
  const mode = useSyncExternalStore(subscribeResize, detailMode, () => "floating");
  const quickRef = useRef(null);
  const searchRef = useRef(null);
  const originRef = useRef(null);
  const historyEntryRef = useRef(false);

  const selected = selectedId != null ? board.records[selectedId] : null;
  const searching = Boolean(board.query.trim());
  const dragEnabled = board.sort === "manual" && !searching;
  const dragReason = board.sort !== "manual" ? "Cambia a Orden manual para reordenar" : "Limpia la búsqueda para reordenar";

  const { drag, onPointerDown } = useNoteDrag({ onDrop: board.move });

  // Si la nota abierta desaparece (borrada, archivada fuera de vista, recarga) se cierra el panel.
  useEffect(() => {
    if (selectedId != null && (!selected || selected.deleted)) setSelectedId(null);
  }, [selected, selectedId]);

  const closeDetail = useCallback(() => {
    const originId = originRef.current;
    setSelectedId(null);
    if (historyEntryRef.current) {
      historyEntryRef.current = false;
      window.history.back();
    }
    // El foco vuelve a la tarjeta de origen; el scroll no cambia porque el panel flota.
    setTimeout(() => document.querySelector(`[data-note-card="${originId}"]`)?.focus({ preventScroll: true }), 0);
  }, []);

  const openDetail = (note) => {
    if (note.pending) return;
    originRef.current = note.id;
    setSelectedId(note.id);
    // En movil el gesto de retroceso cierra el detalle en vez de salir del modulo.
    if (mode === "sheet" && !historyEntryRef.current) {
      window.history.pushState({ ...(window.history.state || {}), notesDetail: true }, "");
      historyEntryRef.current = true;
    }
  };

  useEffect(() => {
    const onPopState = () => {
      if (historyEntryRef.current) {
        historyEntryRef.current = false;
        setSelectedId(null);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Panel flotante (>= 1280 px): un clic fuera lo cierra, salvo sobre otra tarjeta o un aviso.
  useEffect(() => {
    if (selectedId == null || mode !== "floating") return undefined;
    const onPointerDown = (event) => {
      if (event.target.closest?.(".note-detail, .note-card, .notes-toast, .note-menu-popover")) return;
      closeDetail();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [closeDetail, mode, selectedId]);

  // Atajos: N o / enfocan la creacion rapida desde el tablero.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
      if (event.key === "n" || event.key === "N" || event.key === "/") {
        event.preventDefault();
        quickRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const notify = board.showToast;
  const actions = {
    onOpen: openDetail,
    onTogglePin: board.togglePin,
    onColor: board.setColor,
    onDuplicate: board.duplicate,
    onArchive: board.archive,
    onUnarchive: board.unarchive,
    onDelete: board.remove,
    onCopy: async (note) => notify((await copyText([note.title, note.content].filter(Boolean).join("\n\n"))) ? "Texto copiado" : "No se pudo copiar"),
    onCopyPhone: async (segment) => notify((await copyText(formatPhone(segment.digits))) ? `Teléfono ${formatPhone(segment.digits)} copiado` : "No se pudo copiar")
  };

  const pinnedNotes = board.view === "all" ? board.visibleNotes.filter((note) => note.is_pinned) : [];
  const otherNotes = board.view === "all" ? board.visibleNotes.filter((note) => !note.is_pinned) : board.visibleNotes;
  const sections = [
    pinnedNotes.length ? { key: "pinned", title: "Fijados", notes: pinnedNotes } : null,
    { key: "others", title: pinnedNotes.length ? "Otros apuntes" : "", notes: otherNotes }
  ].filter(Boolean);

  actions.onStep = (note, direction) => {
    const section = sections.find((item) => item.notes.some((candidate) => candidate.id === note.id));
    if (!section) return;
    const index = section.notes.findIndex((candidate) => candidate.id === note.id);
    const target = index + direction;
    if (target < 0 || target >= section.notes.length) return;
    const list = section.notes.filter((candidate) => candidate.id !== note.id);
    board.move(note, neighborsForDrop(list, target, note));
  };

  const sendTargets = onSendToInspeccion
    ? [{ key: "inspeccion", label: "Inspección", icon: "activity", onSend: (note) => onSendToInspeccion(note) }]
    : [];

  const renderSection = (section) => {
    const dragging = drag?.section === section.key;
    const list = dragging ? drag.list : section.notes;
    const cells = list.map((note) => (
      <GridCell key={note.id} data-note-id={note.id} data-section={section.key}>
        <NoteCard
          note={note}
          selected={note.id === selectedId}
          actions={actions}
          dragState={{
            enabled: dragEnabled && !note.pending,
            reason: dragReason,
            canMove: dragEnabled && section.notes.length > 1,
            onPointerDown: (event, current) => onPointerDown(event, current, section.key, section.notes)
          }}
        />
      </GridCell>
    ));
    if (dragging) {
      cells.splice(drag.index, 0, (
        <GridCell key="placeholder" data-note-id="placeholder" data-placeholder="1" data-section={section.key}>
          <div className="note-drop-placeholder" style={{ height: drag.height }} aria-hidden="true" />
        </GridCell>
      ));
    }
    return (
      <section key={section.key} className="notes-section" aria-label={section.title || "Apuntes"}>
        {section.title ? (
          <h2 className="notes-section-title">
            {section.key === "pinned" ? <Icon name="pin" /> : null}
            {section.title}
            <span className="notes-section-count">{section.key === "others" && board.hasMore ? `${section.notes.length}+` : section.notes.length}</span>
          </h2>
        ) : null}
        <div className="notes-grid">{cells}</div>
      </section>
    );
  };

  let body;
  if (board.loading && !board.visibleNotes.length) {
    body = <SkeletonGrid />;
  } else if (!board.visibleNotes.length) {
    if (searching && !board.searchPending) {
      body = (
        <EmptyState
          icon="search"
          title="Sin coincidencias para ese término."
          action={<button type="button" className="note-link" onClick={() => { board.setQuery(""); searchRef.current?.focus(); }}>Limpiar búsqueda</button>}
        />
      );
    } else if (searching) {
      body = <SkeletonGrid />;
    } else if (board.view === "archived") {
      body = <EmptyState icon="archive" title="No has archivado ningún apunte." action={<button type="button" className="note-link" onClick={() => board.setView("all")}>Volver a Todos</button>} />;
    } else if (board.view === "pinned") {
      body = <EmptyState icon="pin" title="No has fijado ningún apunte." text="Fija los apuntes que consultas a menudo para tenerlos arriba." action={<button type="button" className="note-link" onClick={() => board.setView("all")}>Volver a Todos</button>} />;
    } else {
      body = (
        <EmptyState
          icon="notes"
          title="Aquí van tus apuntes."
          text="Escribe lo primero que necesites recordar."
          action={<button type="button" className="note-button is-primary" onClick={() => quickRef.current?.focus()}><Icon name="plus" />Crear primer apunte</button>}
        />
      );
    }
  } else {
    body = sections.filter((section) => section.notes.length || drag?.section === section.key).map(renderSection);
  }

  return (
    <main className={`notes-module ${selected && mode === "floating" ? "has-detail" : ""}`}>
      <header className="notes-header">
        <h1>Tablero de Apuntes</h1>
        <p>Privado del administrador</p>
      </header>

      <QuickCreate ref={quickRef} onCreate={board.create} onError={notify} />

      <div className="notes-tools">
        <label className="notes-search">
          <Icon name="search" />
          <input
            ref={searchRef}
            type="search"
            placeholder="Buscar en apuntes"
            aria-label="Buscar en título, contenido y categoría"
            value={board.query}
            onChange={(event) => board.setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && board.query) {
                event.preventDefault();
                event.stopPropagation();
                board.setQuery("");
              }
            }}
          />
          {board.searchPending ? <span className="notes-search-state" aria-live="polite">Buscando…</span> : null}
        </label>
        <div className="notes-pills" role="group" aria-label="Filtrar apuntes">
          {VIEWS.map((view) => (
            <button key={view.key} type="button" aria-pressed={board.view === view.key} className={board.view === view.key ? "is-active" : ""} onClick={() => board.setView(view.key)}>
              {view.label}
            </button>
          ))}
        </div>
        <label className="notes-sort">
          <span>Orden</span>
          <select value={board.sort} onChange={(event) => board.setSort(event.target.value)}>
            {NOTE_SORTS.map((sort) => <option key={sort.key} value={sort.key}>{sort.label}</option>)}
          </select>
        </label>
      </div>

      {board.error ? (
        <p className="notes-error" role="alert">
          {board.error}
          <button type="button" className="note-link" onClick={board.reload}>Reintentar</button>
        </p>
      ) : null}

      <div className="notes-board">{body}</div>

      {board.hasMore && !board.loading ? (
        <div className="notes-more">
          <button type="button" className="note-button" disabled={board.loadingMore} onClick={board.loadMore}>
            {board.loadingMore ? "Cargando…" : "Cargar más apuntes"}
          </button>
        </div>
      ) : null}

      {drag ? (
        <div className="note-drag-ghost" style={{ width: drag.width, transform: `translate(${drag.x - drag.offsetX}px, ${drag.y - drag.offsetY}px)` }} aria-hidden="true">
          <NoteCard note={drag.note} ghost />
        </div>
      ) : null}

      {selected ? (
        <NoteDetail
          key={selected.id}
          note={selected}
          mode={mode}
          categories={board.categories}
          sendTargets={selected.is_archived ? [] : sendTargets}
          actions={actions}
          onClose={closeDetail}
          onUpdate={board.update}
          onUpsert={board.upsert}
        />
      ) : null}

      <div className="notes-toast-region" aria-live="polite" role="status">
        {board.toast ? (
          <div className="notes-toast" key={board.toast.id}>
            <span>{board.toast.message}</span>
            {board.toast.action ? (
              <button
                type="button"
                onClick={() => {
                  const action = board.toast.action;
                  board.dismissToast();
                  action.run();
                }}
              >
                {board.toast.action.label}
              </button>
            ) : null}
            <button type="button" className="notes-toast-close" aria-label="Cerrar aviso" onClick={board.dismissToast}><Icon name="close" /></button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
