import { Icon } from "../Icon";

const workspaceFilters = [
  { key: "all", label: "Todas" },
  { key: "pending", label: "Pendientes" },
  { key: "no_photo", label: "Sin foto" },
  { key: "print_ready", label: "Para imprimir" },
  { key: "reportada", label: "Reportadas" },
  { key: "archived", label: "Archivadas" },
  { key: "discarded", label: "Descartadas" },
  { key: "varios_padrones", label: "Varios padrones" }
];

const matchesWorkspaceFilter = (record, filterKey) => {
  const comments = String(record.comentarios || "").toLowerCase();
  if (filterKey === "pending") return record.estado_padron !== "reportada";
  if (filterKey === "no_photo") return !String(record.foto_path || "").trim();
  if (filterKey === "print_ready") return Boolean(record.fecha_aviso && record.firmante_aviso && record.cargo_firmante);
  if (filterKey === "reportada") return record.estado_padron === "reportada";
  if (filterKey === "archived") return Boolean(record.archived_at);
  if (filterKey === "discarded") return comments.includes("descart");
  if (filterKey === "varios_padrones") return record.estado_padron === "varios_padrones";
  return true;
};

const RecordsSidebar = ({
  records,
  form,
  draftForm,
  loading,
  search,
  filter,
  onSearchChange,
  onFilterChange,
  onSelectRecord,
  onRestoreDraft,
  onNewRecord
}) => {
  const filteredRecords = records.filter((record) => matchesWorkspaceFilter(record, filter));

  return (
    <aside className="records-workspace-sidebar">
      <div className="records-sidebar-top">
        <div>
          <span className="sheet-kicker">Busqueda</span>
          <h2>Fichas</h2>
        </div>
        <button type="button" className="button-secondary" onClick={onNewRecord}>
          <Icon name="plus" />
          Nueva
        </button>
      </div>

      <label className="record-filter-field">
        <span>Buscar por clave</span>
        <input type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Ej. 18-09-18" />
      </label>

      <div className="records-workspace-filters" aria-label="Filtros rapidos de fichas">
        {workspaceFilters.map((item) => (
          <button
            key={item.key}
            type="button"
            className={filter === item.key ? "is-active" : ""}
            onClick={() => onFilterChange(item.key)}
          >
            {item.label}
            <span>{records.filter((record) => matchesWorkspaceFilter(record, item.key)).length}</span>
          </button>
        ))}
      </div>

      {draftForm ? (
        <button type="button" className={`record-card draft-card ${!form.id ? "active" : ""}`} onClick={onRestoreDraft}>
          <strong>{draftForm.clave_catastral || "Borrador nuevo"}</strong>
          <span>{draftForm.barrio_colonia || "Edicion local"}</span>
        </button>
      ) : null}

      <div className="record-mobile-drawer">
        {loading ? <p className="helper-text">Cargando fichas...</p> : null}
        {filteredRecords.length ? (
          filteredRecords.map((record) => (
            <button
              type="button"
              key={record.id ?? record.clave_catastral}
              className={`record-card ${form.id === record.id ? "active" : ""}`}
              onClick={() => onSelectRecord(record)}
            >
              <strong>{record.clave_catastral || "Sin clave"}</strong>
              <span>{record.inquilino || record.nombre_catastral || record.abonado || "Sin abonado"}</span>
              <small>{record.barrio_colonia || "Sin barrio"} · {record.estado_padron || "clandestino"}</small>
            </button>
          ))
        ) : (
          <p className="helper-text">No hay fichas con este filtro.</p>
        )}
      </div>
    </aside>
  );
};

export default RecordsSidebar;
