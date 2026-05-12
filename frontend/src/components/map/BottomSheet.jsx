function BottomSheet({ children, isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <aside className="field-map-bottom-sheet">
      <button type="button" className="field-map-sheet-handle" onClick={onClose} aria-label="Cerrar detalle" />
      {children}
    </aside>
  );
}

export default BottomSheet;
