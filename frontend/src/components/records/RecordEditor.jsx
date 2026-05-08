import { fieldGroups, sectionDefinitions } from "../../constants/formsAndUi";
import RecordStepNav from "./RecordStepNav";

const RecordEditor = ({
  form,
  activeSection,
  selectedFile,
  selectedPhotoUrl,
  localSelectedPhotoUrl,
  validationIssues,
  saving,
  onChange,
  onFileChange,
  onSectionChange,
  onMoveSection,
  onSubmit
}) => (
  <form className="record-editor-shell" onSubmit={onSubmit}>
    <div className="record-editor-head">
      <div>
        <span className="sheet-kicker">Editor de ficha</span>
        <h2>Ficha tecnica catastral</h2>
      </div>
      <label className="record-editor-key">
        <span>Clave Catastral</span>
        <input name="clave_catastral" value={form.clave_catastral || ""} onChange={onChange} required />
      </label>
    </div>

    <RecordStepNav
      sections={sectionDefinitions}
      activeSection={activeSection}
      onChange={onSectionChange}
      onMove={onMoveSection}
    />

    {activeSection === "abonado" ? (
      <section className="sheet-section">
        <h3>Informacion del abonado</h3>
        <div className="form-grid padron-cross-grid">
          <label>
            <span>Clave Alcaldia</span>
            <input name="clave_alcaldia" value={form.clave_alcaldia || ""} onChange={onChange} />
          </label>
          <label>
            <span>Nombre Alcaldia</span>
            <input name="nombre_alcaldia" value={form.nombre_alcaldia || ""} onChange={onChange} />
          </label>
          <label>
            <span>Barrio Alcaldia</span>
            <input name="barrio_alcaldia" value={form.barrio_alcaldia || ""} onChange={onChange} />
          </label>
        </div>
        {fieldGroups.slice(0, 2).map((group, index) => (
          <div className="form-grid" key={index}>
            {group.map((field) => (
              <label key={field.key}>
                <span>{field.label}</span>
                <input name={field.key} value={form[field.key] || ""} onChange={onChange} />
              </label>
            ))}
          </div>
        ))}
      </section>
    ) : null}

    {activeSection === "inmueble" ? (
      <>
        <section className="sheet-section">
          <h3>Identificacion del inmueble</h3>
          <label>
            <span>Accion</span>
            <textarea name="accion_inspeccion" value={form.accion_inspeccion || ""} onChange={onChange} rows="4" />
          </label>
        </section>
        <section className="sheet-section">
          <h3>Datos del inmueble</h3>
          {fieldGroups.slice(2, 4).map((group, index) => (
            <div className="form-grid" key={index}>
              {group.map((field) => (
                <label key={field.key}>
                  <span>{field.label}</span>
                  <input name={field.key} value={form[field.key] || ""} onChange={onChange} />
                </label>
              ))}
            </div>
          ))}
        </section>
      </>
    ) : null}

    {activeSection === "servicios" ? (
      <section className="sheet-section">
        <h3>Datos de los servicios</h3>
        <div className="form-grid">
          {fieldGroups[4].map((field) => (
            <label key={field.key}>
              <span>{field.label}</span>
              <select name={field.key} value={form[field.key] || "No"} onChange={onChange}>
                <option value="Si">Si</option>
                <option value="No">No</option>
              </select>
            </label>
          ))}
        </div>
      </section>
    ) : null}

    {activeSection === "aviso" ? (
      <section className="sheet-section">
        <h3>Datos para aviso</h3>
        <div className="form-grid">
          <label>
            <span>Fecha del aviso</span>
            <input type="date" name="fecha_aviso" value={form.fecha_aviso || ""} onChange={onChange} />
          </label>
          <label>
            <span>Firmante</span>
            <input name="firmante_aviso" value={form.firmante_aviso || ""} onChange={onChange} />
          </label>
          <label>
            <span>Cargo</span>
            <input name="cargo_firmante" value={form.cargo_firmante || ""} onChange={onChange} />
          </label>
          <label>
            <span>Levantamiento de datos</span>
            <input name="levantamiento_datos" value={form.levantamiento_datos || ""} onChange={onChange} />
          </label>
          <label>
            <span>Analista de datos</span>
            <input name="analista_datos" value={form.analista_datos || ""} onChange={onChange} />
          </label>
        </div>
      </section>
    ) : null}

    {activeSection === "foto" ? (
      <section className="sheet-section">
        <h3>Fotografia del inmueble</h3>
        <div className="photo-workspace">
          <div>
            <label className="file-input">
              <span>Seleccionar foto</span>
              <input type="file" accept="image/*" capture="environment" onChange={onFileChange} />
            </label>
            <p className="helper-text">
              {selectedFile ? `Archivo listo: ${selectedFile.name}` : "Carga evidencia fotografica desde escritorio o camara movil."}
            </p>
          </div>
          {localSelectedPhotoUrl || selectedPhotoUrl ? (
            <img src={localSelectedPhotoUrl || selectedPhotoUrl} alt="Fotografia del inmueble" className="photo-preview" />
          ) : (
            <div className="photo-placeholder">Sin fotografia cargada</div>
          )}
        </div>
      </section>
    ) : null}

    {validationIssues.length ? (
      <div className="record-validation-card">
        <div className="record-validation-head">
          <strong>Revision previa</strong>
          <span>{validationIssues.length} puntos por revisar</span>
        </div>
        <div className="record-validation-list">
          {validationIssues.map((issue) => (
            <button key={`${issue.field}-${issue.text}`} type="button" className="record-validation-item" onClick={() => onSectionChange(issue.section)}>
              <span>{issue.text}</span>
            </button>
          ))}
        </div>
      </div>
    ) : null}

    <div className="action-row">
      <button type="submit" disabled={saving} data-intent="stay">
        {saving ? "Guardando..." : form.id ? "Actualizar ficha" : "Guardar ficha"}
      </button>
    </div>
  </form>
);

export default RecordEditor;
