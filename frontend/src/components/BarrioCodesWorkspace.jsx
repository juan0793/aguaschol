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
  onReset,
  onPrepareAdd
}) => {
  const [search, setSearch] = useState("");
  const activeTotal = barrios.filter((item) => item.activo !== false).length;
  const inactiveTotal = Math.max(0, barrios.length - activeTotal);
  const searchedCode = search.replace(/\D/g, "");
  const normalizedSearchedCode = searchedCode
    ? searchedCode.length <= 2
      ? searchedCode.padStart(2, "0")
      : searchedCode
    : "";
  const searchedCodeExists = normalizedSearchedCode
    ? barrios.some((item) => item.codigo === normalizedSearchedCode)
    : false;
  const visibleBarrios = useMemo(() => {
    const query = search.trim().toLowerCase();
    const safeBarrios = Array.isArray(barrios) ? barrios : [];
    const sortedBarrios = [...safeBarrios].sort((left, right) => {
      const leftNumber = Number(left.codigo);
      const rightNumber = Number(right.codigo);
      if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
      return String(left.codigo || "").localeCompare(String(right.codigo || ""));
    });
    if (!query) return sortedBarrios;
    return sortedBarrios.filter((item) =>
      [item.codigo, item.barrio].some((value) => String(value || "").toLowerCase().includes(query))
    );
  }, [barrios, search]);
  const isEditing = Boolean(form.codigo);

  return (
    <section className="preview-panel barrio-codes-workspace">
      <div className="barrio-codes-hero">
        <div className="admin-section-head">
          <div>
            <p className="sheet-kicker">Catalogo territorial</p>
            <h2><Icon name="map" className="title-icon" />Codigos de barrios</h2>
            <p className="workspace-title">
              El primer bloque de la clave catastral se usa para completar el barrio en fichas, avisos y reportes.
            </p>
          </div>
          <div className="barrio-codes-actions">
            <span className="panel-pill">{barrios.length} codigos</span>
            <button type="button" onClick={() => onPrepareAdd("")}> 
              <Icon name="plus" />
              Agregar codigo
            </button>
            <button type="button" className="barrio-code-small-button" onClick={() => window.print()} title="Imprimir resumen">
              <Icon name="print" />
              Imprimir resumen
            </button>
          </div>
        </div>
        <div className="barrio-codes-metrics">
          <div><strong>{activeTotal}</strong><span>Activos</span></div>
          <div><strong>{inactiveTotal}</strong><span>Inactivos</span></div>
          <div><strong>{visibleBarrios.length}</strong><span>En lista</span></div>
        </div>
      </div>

      <div className="barrio-codes-grid">
        <article className="barrio-code-list-card">
          <div className="admin-section-head">
            <div>
              <p className="sheet-kicker">Listado</p>
              <h3>Barrios registrados</h3>
            </div>
            <div className="barrio-code-list-tools">
              <label className="compact-search">
                <span>Buscar</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Codigo o barrio" />
              </label>
              <button type="button" className="barrio-code-small-button" onClick={() => onPrepareAdd(normalizedSearchedCode)}>
                <Icon name="plus" />
                Agregar
              </button>
            </div>
          </div>
          <div className="barrio-code-list">
            {loading ? (
              <div className="barrio-code-empty">
                <span>Cargando codigos...</span>
              </div>
            ) : visibleBarrios.length ? (
              visibleBarrios.map((item) => (
                <div className={`barrio-code-row ${form.codigo === item.codigo ? "is-selected" : ""}`} key={item.codigo}>
                  <button type="button" className="barrio-code-row-main" onClick={() => onEdit(item)}>
                    <span className="barrio-code-number">{item.codigo}</span>
                    <span>
                      <strong>{item.barrio}</strong>
                      <small>{item.activo ? "Activo para autollenado" : "Inactivo"}</small>
                    </span>
                  </button>
                  <div className="barrio-code-row-actions">
                    <button type="button" className="barrio-code-icon-button" onClick={() => onEdit(item)} title="Editar codigo">
                      <Icon name="records" />
                    </button>
                    <button
                      type="button"
                      className="barrio-code-icon-button is-danger"
                      onClick={() => onDelete(item.codigo)}
                      disabled={saving}
                      title={item.activo ? "Desactivar o eliminar codigo" : "Eliminar codigo"}
                    >
                      <Icon name="archive" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="barrio-code-empty">
                <span>No hay codigos con ese filtro.</span>
                {normalizedSearchedCode && !searchedCodeExists ? (
                  <button type="button" className="barrio-code-small-button" onClick={() => onPrepareAdd(normalizedSearchedCode)}>
                    <Icon name="plus" />
                    Agregar codigo {normalizedSearchedCode}
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </article>

        <form className="barrio-code-form" onSubmit={onSubmit}>
          <div className="admin-section-head">
            <div>
              <p className="sheet-kicker">Gestion</p>
              <h3>{isEditing ? `Codigo ${form.codigo}` : "Agregar codigo"}</h3>
            </div>
            <button type="button" className="barrio-code-small-button is-secondary" onClick={() => onPrepareAdd("")}>
              <Icon name="plus" />
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
              {saving ? "Guardando..." : isEditing ? "Actualizar codigo" : "Guardar codigo"}
            </button>
            {isEditing ? (
              <button type="button" className="button-secondary" onClick={onReset}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
};

export { emptyBarrioForm };
export default BarrioCodesWorkspace;
