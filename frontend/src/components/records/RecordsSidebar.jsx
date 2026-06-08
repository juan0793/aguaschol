import { AnimatePresence, motion } from "motion/react";
import { CameraOff, FileText, Plus, Search, Sparkles } from "lucide-react";
import { Icon } from "../Icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      <motion.div
        className="records-sidebar-top"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div>
          <span className="sheet-kicker">Busqueda</span>
          <h2>Fichas</h2>
          <p className="records-sidebar-subtitle">{filteredRecords.length} visibles de {records.length}</p>
        </div>
        <Button type="button" variant="secondary" onClick={onNewRecord}>
          <Plus />
          Nueva
        </Button>
      </motion.div>

      <label className="record-filter-field">
        <span>Buscar por clave</span>
        <div className="record-search-control">
          <Search aria-hidden="true" />
          <Input type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Ej. 18-09-18" />
        </div>
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
            <Badge variant="secondary">{records.filter((record) => matchesWorkspaceFilter(record, item.key)).length}</Badge>
          </button>
        ))}
      </div>

      {draftForm ? (
        <motion.button
          type="button"
          className={`record-card draft-card ${!form.id ? "active" : ""}`}
          onClick={onRestoreDraft}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <Sparkles aria-hidden="true" className="record-card-leading-icon" />
          <strong>{draftForm.clave_catastral || "Borrador nuevo"}</strong>
          <span>{draftForm.barrio_colonia || "Edicion local"}</span>
        </motion.button>
      ) : null}

      <div className="record-mobile-drawer">
        {loading ? (
          <div className="records-loading-list" aria-label="Cargando fichas">
            <span />
            <span />
            <span />
          </div>
        ) : null}
        <AnimatePresence mode="popLayout">
          {filteredRecords.length ? (
            filteredRecords.map((record) => {
            const isPrinted = record.estado_padron === "reportada";

            return (
              <motion.button
                type="button"
                key={record.id ?? record.clave_catastral}
                className={`record-card ${form.id === record.id ? "active" : ""} ${isPrinted ? "is-printed" : ""}`}
                onClick={() => onSelectRecord(record)}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <FileText aria-hidden="true" className="record-card-leading-icon" />
                <div className="record-card-title-line">
                  <strong>{record.clave_catastral || "Sin clave"}</strong>
                  {isPrinted ? <span className="record-status-chip is-printed">Impresa</span> : null}
                  {!String(record.foto_path || "").trim() ? <CameraOff aria-hidden="true" className="record-card-warning-icon" /> : null}
                </div>
                <span>{record.inquilino || record.nombre_catastral || record.abonado || "Sin abonado"}</span>
                <small>{record.barrio_colonia || "Sin barrio"} - {isPrinted ? "impresa/reportada" : record.estado_padron || "clandestino"}</small>
              </motion.button>
            );
          })
        ) : (
          <motion.div className="records-empty-state" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Icon name="records" />
            <strong>No hay fichas con este filtro</strong>
            <p>Prueba otra clave o cambia el estado seleccionado.</p>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </aside>
  );
};

export default RecordsSidebar;
