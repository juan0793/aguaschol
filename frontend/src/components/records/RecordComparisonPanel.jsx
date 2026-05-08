const StatusChip = ({ tone, children }) => <span className={`record-status-chip ${tone}`}>{children}</span>;

const findCandidate = (comparison, form) => {
  const clave = String(form.clave_catastral || form.clave_alcaldia || "").trim();
  if (!clave) return null;
  const lists = [comparison?.candidates, comparison?.matches, comparison?.partial_matches, comparison?.records];
  for (const list of lists) {
    const item = Array.isArray(list)
      ? list.find((entry) =>
          [entry.clave_catastral, entry.clave_alcaldia, entry.clave_aguas_formato]
            .map((value) => String(value || "").trim())
            .includes(clave)
        )
      : null;
    if (item) return item;
  }
  return null;
};

const RecordComparisonPanel = ({ form, padronMeta, alcaldiaMeta, alcaldiaComparison, loadingAlcaldiaComparison, onValidate, onCompare }) => {
  const alcaldiaCandidate = findCandidate(alcaldiaComparison, form);
  const hasAguas = form.estado_padron === "varios_padrones" || Boolean(alcaldiaCandidate?.exists_in_aguas);
  const hasAlcaldia = Boolean(form.clave_alcaldia || form.nombre_alcaldia || alcaldiaCandidate);
  const partial = !hasAlcaldia && Boolean(form.nombre_catastral || form.barrio_colonia);

  return (
    <aside className="record-comparison-panel">
      <div className="record-panel-head">
        <div>
          <span className="sheet-kicker">Comparacion</span>
          <h3>Padron Aguas y Alcaldia</h3>
        </div>
        <button type="button" className="button-secondary" onClick={onValidate}>
          Validar ficha
        </button>
      </div>

      <div className="record-comparison-grid">
        <article>
          <strong>Padron de Aguas</strong>
          <StatusChip tone={hasAguas ? "is-success" : "is-warning"}>
            {hasAguas ? "Existe en Aguas" : "No aparece en Aguas"}
          </StatusChip>
          <small>{padronMeta?.total_records ?? 0} claves cargadas</small>
        </article>
        <article>
          <strong>Base de Alcaldia</strong>
          <StatusChip tone={hasAlcaldia ? "is-success" : "is-warning"}>
            {hasAlcaldia ? "Existe en Alcaldia" : "No aparece en Alcaldia"}
          </StatusChip>
          <small>{alcaldiaMeta?.total_records ?? 0} claves cargadas</small>
        </article>
        <article>
          <strong>Lectura de coincidencia</strong>
          <StatusChip tone={partial ? "is-warning" : hasAlcaldia || hasAguas ? "is-success" : "is-muted"}>
            {partial ? "Coincidencia parcial" : hasAlcaldia || hasAguas ? "Coincidencia exacta" : "Revisar manualmente"}
          </StatusChip>
          <small>{loadingAlcaldiaComparison ? "Comparando padrones..." : "Visible para tecnico y admin"}</small>
        </article>
      </div>

      <div className="record-comparison-details">
        <div>
          <span>Clave Alcaldia</span>
          <strong>{form.clave_alcaldia || alcaldiaCandidate?.clave_catastral || "--"}</strong>
        </div>
        <div>
          <span>Nombre Alcaldia</span>
          <strong>{form.nombre_alcaldia || alcaldiaCandidate?.nombre || "--"}</strong>
        </div>
        <div>
          <span>Barrio Alcaldia</span>
          <strong>{form.barrio_alcaldia || alcaldiaCandidate?.caserio || alcaldiaCandidate?.direccion || "--"}</strong>
        </div>
      </div>

      <button type="button" className="button-secondary record-wide-button" onClick={onCompare} disabled={loadingAlcaldiaComparison}>
        {loadingAlcaldiaComparison ? "Comparando..." : "Actualizar comparacion general"}
      </button>
    </aside>
  );
};

export default RecordComparisonPanel;
