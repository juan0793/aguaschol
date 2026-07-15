import { useEffect, useRef } from "react";

export default function ReportDialog({ open, onClose, title, children, variant = "modal", labelledBy }) {
  const panelRef = useRef(null);
  const previousFocusRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement;
    const panel = panelRef.current;
    const focusable = () => [...panel.querySelectorAll("button, input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter((item) => !item.disabled);
    focusable()[0]?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const titleId = labelledBy || `report-dialog-${variant}`;
  return (
    <div className={`reports-dialog-backdrop is-${variant}`} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={panelRef} className={`reports-dialog reports-dialog-${variant}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header><h2 id={titleId}>{title}</h2><button type="button" className="reports-icon-button" onClick={onClose} aria-label="Cerrar">×</button></header>
        {children}
      </section>
    </div>
  );
}
