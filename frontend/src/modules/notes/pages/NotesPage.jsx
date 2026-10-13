import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Keyboard, LayoutGrid, Rows3 } from "lucide-react";
import { Icon } from "../../../components/Icon";
import { createNotesApi } from "../services/notesApi";
import { useNotesBoard } from "../hooks/useNotesBoard";
import { useNoteDrag } from "../hooks/useNoteDrag";
import { useBoardMotion } from "../hooks/useBoardMotion";
import NoteCard, { GridCell } from "../components/NoteCard";
import NoteDetail from "../components/NoteDetail";
import QuickCreate from "../components/QuickCreate";
import { NOTE_COLORS, NOTE_SORTS, groupNotesByTime, neighborsForDrop } from "../utils/notesOrder";
import { formatPhone } from "../utils/noteContent";
import "../styles/notes.css";

const VIEWS = [
  { key: "all", label: "Todos", count: "activos" },
  { key: "pinned", label: "Fijados", count: "fijados" },
  { key: "archived", label: "Archivados", count: "archivados" }
];

const SHORTCUTS = [
  [["N"], "Nuevo apunte"],
  [["/"], "Buscar"],
  [["Flechas"], "Moverse entre apuntes"],
  [["Enter"], "Abrir el apunte"],
  [["F"], "Fijar o desfijar"],
  [["A"], "Archivar o restaurar"],
  [["D"], "Duplicar"],
  [["C"], "Copiar el texto"],
  [["Supr"], "Eliminar (se puede deshacer)"],
  [["Ctrl", "Enter"], "Guardar el apunte nuevo"],
  [["Esc"], "Cerrar o limpiar"]
];

const DENSITY_KEY = "aguas.notes.density.v1";
const readDensity = () => {
  try {
    return window.localStorage.getItem(DENSITY_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
};

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
const plural = (count, one, many) => `${count.toLocaleString("es-HN")} ${count === 1 ? one : many}`;

// Navegacion espacial: la tarjeta mas cercana en la direccion de la flecha, castigando el
// desvio lateral para que en un tablero de columnas "abajo" siga la misma columna.
const ARROWS = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
const nearestCard = (board, from, [dirX, dirY]) => {
  const center = (rect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  const origin = center(from.getBoundingClientRect());
  let best = null;
  let bestScore = Infinity;
  for (const card of board.querySelectorAll(".note-card[data-note-card]")) {
    if (card === from) continue;
    const point = center(card.getBoundingClientRect());
    const along = (point.x - origin.x) * dirX + (point.y - origin.y) * dirY;
    const across = Math.abs((point.x - origin.x) * dirY) + Math.abs((point.y - origin.y) * dirX);
    if (along <= 8) continue;
    const score = along + across * 2;
    if (score < bestScore) {
      best = card;
      bestScore = score;
    }
  }
  return best;
};

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

function ShortcutsPopover({ open, onToggle, onClose }) {
  const rootRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onClose, open]);

  return (
    <div className="notes-shortcuts" ref={rootRef}>
      <button
        type="button"
        className="notes-tool-button"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Atajos de teclado (?)"
        onClick={onToggle}
      >
        <Keyboard size={17} aria-hidden="true" />
        <span>Atajos</span>
      </button>
      {open ? (
        <section className="notes-shortcuts-panel" role="dialog" aria-label="Atajos de teclado">
          <h2>Atajos de teclado</h2>
          <dl>
            {SHORTCUTS.map(([keys, label]) => (
              <div key={label}>
                <dt>{keys.map((key, index) => <span key={key}>{index ? " + " : ""}<kbd>{key}</kbd></span>)}</dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}

export default function NotesPage({ apiFetch, onSendToInspeccion }) {
  const api = useMemo(() => createNotesApi(apiFetch), [apiFetch]);
  const board = useNotesBoard(api);
  const [selectedId, setSelectedId] = useState(null);
  const [density, setDensityState] = useState(readDensity);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const mode = useSyncExternalStore(subscribeResize, detailMode, () => "floating");
  const quickRef = useRef(null);
  const searchRef = useRef(null);
  const boardRef = useRef(null);
  const originRef = useRef(null);
  const historyEntryRef = useRef(false);

  const selected = selectedId != null ? board.records[selectedId] : null;
  const searching = Boolean(board.query.trim());
  const filtersActive = Boolean(board.filters.color || board.filters.category);
  const dragEnabled = board.sort === "manual" && !searching;
  const dragReason = board.sort !== "manual" ? "Cambia a Orden manual para reordenar" : "Limpia la búsqueda para reordenar";

  const { drag, onPointerDown } = useNoteDrag({ onDrop: board.move });
  useBoardMotion(boardRef, { paused: Boolean(drag) });

  // "Hace 5 min" envejece: el tablero se vuelve a pintar cada minuto.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const setDensity = (value) => {
    setDensityState(value);
    try {
      window.localStorage.setItem(DENSITY_KEY, value);
    } catch {
      // Preferencia de conveniencia: sin almacenamiento se vuelve a tarjetas.
    }
  };

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

  const notify = board.showToast;
  const actions = {
    onOpen: openDetail,
    onTogglePin: board.togglePin,
    onColor: board.setColor,
    onDuplicate: board.duplicate,
    onArchive: board.archive,
    onUnarchive: board.unarchive,
    onDelete: board.remove,
    onFilterCategory: (category) => board.setFilters({ category: board.filters.category === category ? "" : category }),
    onCopy: async (note) => notify((await copyText([note.title, note.content].filter(Boolean).join("\n\n"))) ? "Texto copiado" : "No se pudo copiar"),
    onCopyPhone: async (segment) => notify((await copyText(formatPhone(segment.digits))) ? `Teléfono ${formatPhone(segment.digits)} copiado` : "No se pudo copiar")
  };

  // Atajos del tablero. N crea, / busca, ? muestra la lista; sobre una tarjeta con foco las
  // flechas navegan y las letras actuan sobre ese apunte.
  const keyHandler = useRef(null);
  keyHandler.current = (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
    if (event.target.closest?.(".note-menu-popover, .note-detail")) return;
    const key = event.key;
    if (key === "n" || key === "N") {
      event.preventDefault();
      quickRef.current?.focus();
      return;
    }
    if (key === "/") {
      event.preventDefault();
      searchRef.current?.focus();
      return;
    }
    if (key === "?") {
      event.preventDefault();
      setShortcutsOpen((value) => !value);
      return;
    }
    if (key === "Escape" && shortcutsOpen) {
      setShortcutsOpen(false);
      return;
    }
    const card = event.target.closest?.(".note-card[data-note-card]");
    if (!card || card !== event.target || !boardRef.current?.contains(card)) return;
    if (ARROWS[key]) {
      const target = nearestCard(boardRef.current, card, ARROWS[key]);
      event.preventDefault();
      if (target) {
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
      return;
    }
    const note = board.records[card.dataset.noteCard];
    if (!note || note.pending) return;
    const lower = key.toLowerCase();
    // Al fijar, la tarjeta se vuelve a montar en otra seccion: el foco la sigue. Al archivar o
    // eliminar desaparece, y el foco pasa a la vecina para seguir trabajando con el teclado.
    const neighbor = () => nearestCard(boardRef.current, card, ARROWS.ArrowRight) || nearestCard(boardRef.current, card, ARROWS.ArrowLeft);
    const refocus = () => window.setTimeout(() => document.querySelector(`[data-note-card="${note.id}"]`)?.focus({ preventScroll: true }), 30);
    if (lower === "f" && !note.is_archived) {
      actions.onTogglePin(note);
      refocus();
    } else if (lower === "a" || key === "Delete") {
      const next = neighbor();
      if (key === "Delete") actions.onDelete(note);
      else (note.is_archived ? actions.onUnarchive : actions.onArchive)(note);
      next?.focus({ preventScroll: true });
    } else if (lower === "d") actions.onDuplicate(note);
    else if (lower === "c") actions.onCopy(note);
    else return;
    event.preventDefault();
  };
  useEffect(() => {
    const onKeyDown = (event) => keyHandler.current(event);
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const pinnedNotes = board.view === "all" ? board.visibleNotes.filter((note) => note.is_pinned) : [];
  const otherNotes = board.view === "all" ? board.visibleNotes.filter((note) => !note.is_pinned) : board.visibleNotes;
  // En orden manual hay una sola lista; ordenado por fecha, se agrupa por cercania.
  const otherSections = board.sort === "manual" || board.view === "archived"
    ? [{ key: "others", title: pinnedNotes.length ? "Otros apuntes" : "", notes: otherNotes }]
    : groupNotesByTime(otherNotes, board.sort, now);
  const sections = [
    pinnedNotes.length ? { key: "pinned", title: "Fijados", notes: pinnedNotes } : null,
    ...otherSections
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

  const highlight = board.query.trim();
  const lastSection = sections[sections.length - 1]?.key;

  const renderSection = (section) => {
    const dragging = drag?.section === section.key;
    const list = dragging ? drag.list : section.notes;
    const cells = list.map((note) => (
      <GridCell key={note.id} data-note-id={note.id} data-section={section.key}>
        <NoteCard
          note={note}
          now={now}
          highlight={highlight}
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
    const more = section.key === lastSection && board.hasMore;
    return (
      <section key={section.key} className="notes-section" aria-label={section.title || "Apuntes"}>
        {section.title ? (
          <h2 className="notes-section-title">
            {section.key === "pinned" ? <Icon name="pin" /> : null}
            <span>{section.title}</span>
            <span className="notes-section-count">{more ? `${section.notes.length}+` : section.notes.length}</span>
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
    } else if (filtersActive) {
      body = <EmptyState icon="filter" title="Ningún apunte con estos filtros." text="Prueba con otro color o categoría, o escribe uno nuevo: tomará los filtros activos." action={<button type="button" className="note-link" onClick={board.clearFilters}>Quitar filtros</button>} />;
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

  const summary = board.summary;
  const colorFilters = summary
    ? NOTE_COLORS.filter((color) => color.key !== "default" && (summary.colores?.[color.key] || board.filters.color === color.key))
    : [];
  const categoryFilters = summary ? [...(summary.categorias || [])] : [];
  if (board.filters.category && !categoryFilters.some((item) => item.nombre.toLowerCase() === board.filters.category.toLowerCase())) {
    categoryFilters.unshift({ nombre: board.filters.category, total: 0 });
  }
  const showFilters = colorFilters.length > 0 || categoryFilters.length > 0;

  return (
    <main className={`notes-module ${selected && mode === "floating" ? "has-detail" : ""}`}>
      <header className="notes-header">
        <div className="notes-heading">
          <h1>Tablero de Apuntes</h1>
          <p>
            Privado del administrador
            {summary ? <> · {plural(summary.activos, "apunte activo", "apuntes activos")}</> : null}
            {summary?.semana ? <> · <span className="notes-heading-fresh">{plural(summary.semana, "nuevo", "nuevos")} esta semana</span></> : null}
          </p>
        </div>
        <div className="notes-header-tools">
          <div className="notes-density" role="group" aria-label="Vista del tablero">
            <button type="button" aria-pressed={density === "grid"} title="Tarjetas" onClick={() => setDensity("grid")}>
              <LayoutGrid size={17} aria-hidden="true" /><span className="note-sr">Tarjetas</span>
            </button>
            <button type="button" aria-pressed={density === "list"} title="Lista" onClick={() => setDensity("list")}>
              <Rows3 size={17} aria-hidden="true" /><span className="note-sr">Lista</span>
            </button>
          </div>
          <ShortcutsPopover open={shortcutsOpen} onToggle={() => setShortcutsOpen((value) => !value)} onClose={() => setShortcutsOpen(false)} />
        </div>
      </header>

      <QuickCreate ref={quickRef} onCreate={board.create} onError={notify} categories={board.categories} preset={board.filters} />

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
          {board.searchPending ? <span className="notes-search-state" aria-live="polite">Buscando…</span> : <kbd className="notes-search-key" aria-hidden="true">/</kbd>}
        </label>
        <div className="notes-pills" role="group" aria-label="Filtrar apuntes">
          {VIEWS.map((view) => {
            const count = summary?.[view.count];
            return (
              <button key={view.key} type="button" aria-pressed={board.view === view.key} className={board.view === view.key ? "is-active" : ""} onClick={() => board.setView(view.key)}>
                {view.label}
                {count != null ? <span className="notes-pill-count">{count}</span> : null}
              </button>
            );
          })}
        </div>
        <label className="notes-sort">
          <span>Orden</span>
          <select value={board.sort} onChange={(event) => board.setSort(event.target.value)}>
            {NOTE_SORTS.map((sort) => <option key={sort.key} value={sort.key}>{sort.label}</option>)}
          </select>
        </label>
      </div>

      {showFilters ? (
        <div className="notes-filters">
          {colorFilters.length ? (
            <div className="notes-filter-colors" role="group" aria-label="Filtrar por color">
              {colorFilters.map((color) => {
                const active = board.filters.color === color.key;
                const count = summary.colores?.[color.key] || 0;
                return (
                  <button
                    key={color.key}
                    type="button"
                    className={`notes-color-filter note-color-${color.key}`}
                    aria-pressed={active}
                    aria-label={`${color.label}: ${plural(count, "apunte", "apuntes")}`}
                    title={`${color.label}: ${plural(count, "apunte activo", "apuntes activos")}`}
                    onClick={() => board.setFilters({ color: active ? "" : color.key })}
                  >
                    <span className="notes-color-dot" aria-hidden="true" />
                    {count}
                  </button>
                );
              })}
            </div>
          ) : null}
          {categoryFilters.length ? (
            <div className="notes-filter-categories" role="group" aria-label="Filtrar por categoría">
              {categoryFilters.map((category) => {
                const active = board.filters.category.toLowerCase() === category.nombre.toLowerCase();
                return (
                  <button
                    key={category.nombre}
                    type="button"
                    className="notes-category-filter"
                    aria-pressed={active}
                    onClick={() => board.setFilters({ category: active ? "" : category.nombre })}
                  >
                    {category.nombre}
                    {category.total ? <span>{category.total}</span> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          {filtersActive ? (
            <button type="button" className="notes-filters-clear" onClick={board.clearFilters}>
              <Icon name="close" />Quitar filtros
            </button>
          ) : null}
        </div>
      ) : null}

      {board.error ? (
        <p className="notes-error" role="alert">
          {board.error}
          <button type="button" className="note-link" onClick={board.reload}>Reintentar</button>
        </p>
      ) : null}

      <div ref={boardRef} className={`notes-board ${density === "list" ? "is-list" : ""}`}>{body}</div>

      {board.hasMore && !board.loading ? (
        <div className="notes-more">
          <button type="button" className="note-button" disabled={board.loadingMore} onClick={board.loadMore}>
            {board.loadingMore ? "Cargando…" : "Cargar más apuntes"}
          </button>
        </div>
      ) : null}

      {drag ? (
        <div className={`note-drag-ghost ${density === "list" ? "is-list" : ""}`} style={{ width: drag.width, transform: `translate(${drag.x - drag.offsetX}px, ${drag.y - drag.offsetY}px)` }} aria-hidden="true">
          <NoteCard note={drag.note} now={now} ghost />
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
