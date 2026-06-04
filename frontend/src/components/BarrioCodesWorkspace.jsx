import { useMemo, useState } from "react";
import { Icon } from "./Icon";

const emptyBarrioForm = {
  codigo: "",
  barrio: "",
  activo: true
};

const BarrioCodesWorkspace = ({
  barrios,
  form,
  loading,
  saving,
  onFormChange,
  onSubmit,
  onEdit,
  onDelete,
  onReset
}) => {
  const [search, setSearch] = useState("");
  const visibleBarrios = useMemo(() => {
    const query = search.trim().toLowerCase();
    const safeBarrios = Array.isArray(barrios) ? barrios : [];
    if (!query) return safeBarrios;
    return safeBarrios.filter((item) =>
      [item.codigo, item.barrio].some((value) => String(value || "").toLowerCase().includes(query))
    );
  }, [barrios, search]);

  return (
    <section className="preview-panel barrio-codes-workspace">
      <div className="document-block barrio-codes-hero">
        <div className="admin-section-head">
          <div>
            <p className="sheet-kicker">Catalogo territorial</p>
            <h2><Icon name="map" className="title-icon" />Codigos de barrios</h2>
            <p className="workspace-title">
              El primer bloque de la clave catastral se usa para completar el barrio en fichas, avisos y reportes.
            </p>
          </div>
          <span className="panel-pill">{barrios.length} codigos</span>
        </div>
      </div>

      <div className="barrio-codes-grid">
        <form className="document-block barrio-code-form" onSubmit={onSubmit}>
          <div className="admin-section-head">
            <div>
              <p className="sheet-kicker">Gestion</p>
              <h3>{form.codigo ? `Codigo ${form.codigo}` : "Agregar codigo"}</h3>
            </div>
            <button type="button" className="button-secondary" onClick={onReset}>
              Nuevo
            </button>
          </div>
          <label>
            <span>Codigo inicial</span>
            <input
              name="codigo"
              value={form.codigo}
              onChange={onFormChange}
              placeholder="Ej. 04, 91, 117"
              inputMode="numeric"
              required
            />
          </label>
          <label>
            <span>Barrio / colonia</span>
            <input
              name="barrio"
              value={form.barrio}
              onChange={onFormChange}
              placeholder="Nombre del barrio o colonia"
              required
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              name="activo"
              checked={Boolean(form.activo)}
              onChange={onFormChange}
            />
            <span>Activo para autollenado</span>
          </label>
          <div className="map-form-actions">
            <button type="submit" disabled={saving}>
              <Icon name="success" />
              {saving ? "Guardando..." : "Guardar codigo"}
            </button>
          </div>
        </form>

        <article className="document-block barrio-code-list-card">
          <div className="admin-section-head">
            <div>
              <p className="sheet-kicker">Listado</p>
              <h3>Barrios registrados</h3>
            </div>
            <label className="compact-search">
              <span>Buscar</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Codigo o barrio" />
            </label>
          </div>
          <div className="barrio-code-table-wrap">
            <table className="map-report-table barrio-code-table">
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Barrio / colonia</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4">Cargando codigos...</td>
                  </tr>
                ) : visibleBarrios.length ? (
                  visibleBarrios.map((item) => (
                    <tr key={item.codigo}>
                      <td><strong>{item.codigo}</strong></td>
                      <td>{item.barrio}</td>
                      <td>{item.activo ? "Activo" : "Inactivo"}</td>
                      <td>
                        <div className="table-action-row">
                          <button type="button" className="button-secondary" onClick={() => onEdit(item)}>
                            Editar
                          </button>
                          <button type="button" className="button-danger" onClick={() => onDelete(item.codigo)}>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4">No hay codigos con ese filtro.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
};

export { emptyBarrioForm };
export default BarrioCodesWorkspace;
