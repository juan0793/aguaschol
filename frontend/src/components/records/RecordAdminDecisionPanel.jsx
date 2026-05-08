const decisions = [
  { key: "confirmada_clandestina", label: "Confirmar clandestina" },
  { key: "descartada", label: "Descartar" },
  { key: "archivada", label: "Archivar" },
  { key: "varios_padrones", label: "Marcar varios padrones" },
  { key: "requiere_correccion", label: "Solicitar correccion" },
  { key: "reportada", label: "Marcar reportada" }
];

const reasonOptions = [
  "Existe en padron de Aguas",
  "Existe en base de Alcaldia",
  "Clave duplicada",
  "Informacion incompleta",
  "Foto no corresponde",
  "Zona incorrecta",
  "Otro"
];

const askReason = (label) => {
  const reason = window.prompt(
    `${label}. Motivo obligatorio:\n\n${reasonOptions.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
    ""
  );
  return reason?.trim() || "";
};

const RecordAdminDecisionPanel = ({ form, processing, onDecision }) => {
  if (!form?.id) {
    return (
      <aside className="record-admin-decision-panel">
        <span className="sheet-kicker">Decision administrativa</span>
        <p className="helper-text">Guarda o selecciona una ficha para habilitar decisiones admin.</p>
      </aside>
    );
  }

  return (
    <aside className="record-admin-decision-panel">
      <div className="record-panel-head">
        <div>
          <span className="sheet-kicker">Solo admin</span>
          <h3>Decision administrativa</h3>
        </div>
        <span className={`record-status-chip is-${form.estado_padron || "clandestino"}`}>{form.estado_padron || "clandestino"}</span>
      </div>
      <div className="record-admin-actions">
        {decisions.map((decision) => (
          <button
            key={decision.key}
            type="button"
            className={["descartada", "archivada"].includes(decision.key) ? "button-danger" : "button-secondary"}
            disabled={processing}
            onClick={() => {
              const reason = askReason(decision.label);
              if (!reason) return;
              onDecision(decision.key, reason);
            }}
          >
            {decision.label}
          </button>
        ))}
      </div>
      <p className="helper-text">Descartar y archivar no borran registros. En esta fase se conserva trazabilidad en comentarios e historial existente.</p>
    </aside>
  );
};

export default RecordAdminDecisionPanel;
