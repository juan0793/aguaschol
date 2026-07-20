import { useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import { printDocument } from "../utils/printDocument";

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
  const tableRef = useRef(null);
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
  const printSummary = () => tableRef.current && printDocument(
    "Resumen de codigos de barrios",
    `<style>.barrio-code-print-table th:last-child,.barrio-code-print-table td:last-child{display:none}.barrio-code-print-table tr{break-inside:avoid}</style><section class="print-header"><h1>Codigos de barrios</h1><p>${activeTotal} activos · ${inactiveTotal} inactivos · ${visibleBarrios.length} en lista</p></section><table class="field-report-table barrio-code-print-table">${tableRef.current.innerHTML}</table>`,
    { pageSize: "Letter portrait", showPageFooter: true }
  );

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
            <button type="button" className="barrio-code-small-button" onClick={printSummary} title="Imprimir resumen">
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

      <article className="barrio-code-list-card">
        <div className="admin-section-head barrio-code-list-head">
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

        <form className="barrio-code-form" onSubmit={onSubmit}>
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

        <div className="barrio-code-table-wrap">
          <table className="barrio-code-admin-table" ref={tableRef}>
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
                  <tr className={form.codigo === item.codigo ? "is-selected" : ""} key={item.codigo}>
                    <td><span className="barrio-code-number">{item.codigo}</span></td>
                    <td>
                      <strong>{item.barrio}</strong>
                      <small>{item.activo ? "Activo para autollenado" : "Inactivo"}</small>
                    </td>
                    <td>
                      <span className={`barrio-code-status ${item.activo ? "is-active" : "is-inactive"}`}>
                        {item.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>
                      <div className="barrio-code-row-actions">
                        <button type="button" className="barrio-code-small-button is-secondary" onClick={() => onEdit(item)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="barrio-code-small-button is-danger"
                          onClick={() => onDelete(item.codigo)}
                          disabled={saving}
                        >
                          {item.activo ? "Desactivar" : "Eliminar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4">
                    <div className="barrio-code-empty">
                      <span>No hay codigos con ese filtro.</span>
                      {normalizedSearchedCode && !searchedCodeExists ? (
                        <button type="button" className="barrio-code-small-button" onClick={() => onPrepareAdd(normalizedSearchedCode)}>
                          <Icon name="plus" />
                          Agregar codigo {normalizedSearchedCode}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
};

export { emptyBarrioForm };
export default BarrioCodesWorkspace;
