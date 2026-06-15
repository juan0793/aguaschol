import { motion } from "motion/react";
import { Save } from "lucide-react";
import { fieldGroups, sectionDefinitions } from "../../constants/formsAndUi";
import { Button } from "@/components/ui/button";
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
      <motion.section className="sheet-section" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <div className="sheet-section-head">
          <div>
            <span className="sheet-kicker">Paso 1</span>
            <h3>Informacion del abonado</h3>
          </div>
          <small>Base para buscar, validar y generar documentos.</small>
        </div>
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
      </motion.section>
    ) : null}

    {activeSection === "inmueble" ? (
      <>
        <motion.section className="sheet-section" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <div className="sheet-section-head">
            <div>
              <span className="sheet-kicker">Paso 2</span>
              <h3>Identificacion del inmueble</h3>
            </div>
            <small>Describe el hallazgo y la accion tomada en campo.</small>
          </div>
          <label>
            <span>Accion</span>
            <textarea name="accion_inspeccion" value={form.accion_inspeccion || ""} onChange={onChange} rows="4" />
          </label>
        </motion.section>
        <motion.section className="sheet-section" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.04 }}>
          <div className="sheet-section-head">
            <div>
              <span className="sheet-kicker">Clasificacion</span>
              <h3>Datos del inmueble</h3>
            </div>
            <small>Uso, situacion y comentarios administrativos.</small>
          </div>
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
        </motion.section>
      </>
    ) : null}

    {activeSection === "servicios" ? (
      <motion.section className="sheet-section" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <div className="sheet-section-head">
          <div>
            <span className="sheet-kicker">Paso 3</span>
            <h3>Datos de los servicios</h3>
          </div>
          <small>Marca los servicios observados para la ficha tecnica.</small>
        </div>
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
      </motion.section>
    ) : null}

    {activeSection === "aviso" ? (
      <motion.section className="sheet-section" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <div className="sheet-section-head">
          <div>
            <span className="sheet-kicker">Paso 4</span>
            <h3>Datos para aviso</h3>
          </div>
          <small>Estos datos alimentan el documento de aviso.</small>
        </div>
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
      </motion.section>
    ) : null}

    {activeSection === "foto" ? (
      <motion.section className="sheet-section" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <div className="sheet-section-head">
          <div>
            <span className="sheet-kicker">Paso 5</span>
            <h3>Fotografia del inmueble</h3>
          </div>
          <small>Evidencia visual para imprimir y archivar.</small>
        </div>
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
      </motion.section>
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
      <Button type="submit" disabled={saving} data-intent="stay">
        <Save />
        {saving ? "Guardando..." : form.id ? "Actualizar ficha" : "Guardar ficha"}
      </Button>
    </div>
  </form>
);

export default RecordEditor;
