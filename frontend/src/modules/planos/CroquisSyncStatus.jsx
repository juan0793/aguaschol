const saveStateLabel = {
  saving: "Guardando...",
  dirty: "Cambios sin guardar",
  local: "Borrador local pendiente de subir",
  error: "Error al guardar",
  saved: "Todo guardado"
};

export function CroquisSyncStatus({ saveState }) {
  return <span className={`planos-save-state is-${saveState}`}>{saveStateLabel[saveState] || saveStateLabel.saved}</span>;
}
