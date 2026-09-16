import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "../../../components/Icon";

/**
 * Menu de acciones secundarias. Atrapa el foco mientras esta abierto (flechas, Tab, Inicio y
 * Fin) y lo devuelve al boton al cerrarse. `items` acepta { label, icon, onSelect, danger,
 * disabled } o { separator: true } o { render: (close) => nodo } para contenido propio.
 */
export default function ActionMenu({ items, label = "Más acciones", icon = "more", buttonLabel = "", className = "", align = "end", onOpenChange }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  const setMenuOpen = (value) => {
    setOpen(value);
    onOpenChange?.(value);
  };

  const close = (restoreFocus = true) => {
    setMenuOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    const focusables = () => [...(menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled]), [role="radio"][tabindex="0"]') || [])];
    focusables()[0]?.focus();
    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) close(false);
    };
    const onKeyDown = (event) => {
      const items = focusables();
      const index = items.indexOf(document.activeElement);
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      } else if (event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey)) {
        if (event.target.getAttribute("role") === "radio" && event.key === "ArrowDown") return;
        event.preventDefault();
        items[(index + 1) % items.length]?.focus();
      } else if (event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey)) {
        if (event.target.getAttribute("role") === "radio" && event.key === "ArrowUp") return;
        event.preventDefault();
        items[(index - 1 + items.length) % items.length]?.focus();
      } else if (event.key === "Home") {
        event.preventDefault();
        items[0]?.focus();
      } else if (event.key === "End") {
        event.preventDefault();
        items[items.length - 1]?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    menuRef.current?.addEventListener("keydown", onKeyDown);
    const menu = menuRef.current;
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      menu?.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={`note-menu ${className}`} onClick={(event) => event.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        className={buttonLabel ? "note-button" : "note-icon-button"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={buttonLabel ? undefined : label}
        title={buttonLabel ? undefined : label}
        onClick={() => setMenuOpen(!open)}
      >
        <Icon name={icon} />
        {buttonLabel}
      </button>
      {open ? (
        <div ref={menuRef} id={menuId} className={`note-menu-popover is-${align}`} role="menu" aria-label={label}>
          {items.filter(Boolean).map((item, index) => {
            if (item.separator) return <div key={`sep-${index}`} className="note-menu-separator" role="separator" />;
            if (item.render) return <div key={`custom-${index}`} className="note-menu-custom">{item.render(close)}</div>;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={item.disabled}
                className={item.danger ? "is-danger" : ""}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
              >
                {item.icon ? <Icon name={item.icon} /> : null}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
