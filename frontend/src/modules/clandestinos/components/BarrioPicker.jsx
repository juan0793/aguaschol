import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "../../../components/Icon";

const normalizar = (value = "") => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Selector de barrio con buscador: la lista nativa con cien barrios era
 * imposible de recorrer. Muestra cuántos candidatos tiene cada barrio.
 * options: [{ barrio, total }] ordenados de más a menos.
 */
export default function BarrioPicker({ value, options, onChange, allLabel = "Todos los barrios" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();
  const total = options.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const filtered = useMemo(() => {
    const term = normalizar(query.trim());
    return term ? options.filter((item) => normalizar(item.barrio).includes(term)) : options;
  }, [options, query]);
  // La primera fila es "todos" (solo sin búsqueda); luego los barrios.
  const rows = query.trim() ? filtered : [{ barrio: "", total }, ...filtered];

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => { setCursor(0); }, [query, open]);
  useEffect(() => { listRef.current?.querySelector(`[data-index="${cursor}"]`)?.scrollIntoView({ block: "nearest" }); }, [cursor]);

  const choose = (barrio) => { onChange(barrio); setOpen(false); setQuery(""); };
  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setCursor((current) => Math.min(rows.length - 1, current + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setCursor((current) => Math.max(0, current - 1)); }
    else if (event.key === "Enter") { event.preventDefault(); if (rows[cursor]) choose(rows[cursor].barrio); }
    else if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
  };
  const current = options.find((item) => item.barrio === value);

  return <div className={`cl-picker ${open ? "is-open" : ""}`.trim()} ref={rootRef}>
    <button type="button" className="cl-picker-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((state) => !state)}>
      <Icon name="map" />
      <span>{value || allLabel}</span>
      {value ? <small>{current?.total ?? 0}</small> : null}
      <Icon name="chevronDown" className="cl-picker-caret" />
    </button>
    {open ? <div className="cl-picker-pop">
      <label className="cl-picker-search"><Icon name="search" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onKeyDown} placeholder="Buscar barrio o colonia" aria-controls={listId} aria-label="Buscar barrio" /></label>
      <ul id={listId} role="listbox" ref={listRef} aria-label="Barrios">
        {rows.length ? rows.map((item, index) => <li key={item.barrio || "todos"} role="option" data-index={index} aria-selected={value === item.barrio} className={`${index === cursor ? "is-cursor" : ""} ${value === item.barrio ? "is-selected" : ""}`.trim()} onPointerEnter={() => setCursor(index)} onClick={() => choose(item.barrio)}>
          <span>{item.barrio || allLabel}</span>
          <small>{item.total}</small>
          {value === item.barrio ? <Icon name="success" /> : null}
        </li>) : <li className="cl-picker-empty">Ningún barrio coincide con “{query.trim()}”</li>}
      </ul>
    </div> : null}
  </div>;
}
