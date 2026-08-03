import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../../components/Icon";

const today = () => new Date().toISOString().slice(0, 10);

export default function AvisoEditor({ record, onClose, onPreview }) {
  const [draft, setDraft] = useState(() => ({
    ...record,
    fecha_aviso: (record.fecha_aviso || today()).slice(0, 10),
    fecha_limite_aviso: (record.fecha_limite_aviso || "").slice(0, 10),
    aviso_destinatario: record.aviso_destinatario || record.abonado || record.inquilino || record.nombre_catastral || "",
    aviso_plazo_dias: String(record.aviso_plazo_dias || 7),
    aviso_instrucciones: record.aviso_instrucciones || "",
    firmante_aviso: record.firmante_aviso || "Jefatura de Comercialización",
    cargo_firmante: record.cargo_firmante || "Aguas de Choluteca"
  }));

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const change = (event) => setDraft((current) => ({ ...current, [event.target.name]: event.target.value }));

  return createPortal(
    <div className="cl-notice-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="cl-notice-editor" role="dialog" aria-modal="true" aria-labelledby="cl-notice-title">
        <header>
          <div>
            <span className="cl-kicker">Paso 4 · Preparar comunicación</span>
            <h2 id="cl-notice-title">Editar aviso al abonado</h2>
            <p>Revisa las fechas y el contenido antes de abrir la vista de impresión.</p>
          </div>
          <button type="button" className="cl-icon-button" onClick={onClose} aria-label="Cerrar editor de aviso">×</button>
        </header>

        <div className="cl-notice-editor-body">
          <section>
            <h3><Icon name="history" />Fechas y plazo</h3>
            <div className="cl-notice-fields">
              <label><span>Fecha del aviso</span><input type="date" name="fecha_aviso" value={draft.fecha_aviso} onInput={change} /></label>
              <label><span>Fecha límite (opcional)</span><input type="date" name="fecha_limite_aviso" value={draft.fecha_limite_aviso} onInput={change} /></label>
              <label><span>Plazo en días</span><input type="number" min="1" max="90" name="aviso_plazo_dias" value={draft.aviso_plazo_dias} onChange={change} /></label>
            </div>
            <p className="cl-notice-help">Si indicas una fecha límite, esa fecha tendrá prioridad sobre el plazo en días.</p>
          </section>

          <section>
            <h3><Icon name="users" />Destinatario y mensaje</h3>
            <div className="cl-notice-fields">
              <label className="is-wide"><span>Nombre del destinatario</span><input name="aviso_destinatario" value={draft.aviso_destinatario} onChange={change} placeholder="Nombre del abonado o responsable" /></label>
              <label className="is-wide"><span>Instrucciones o aclaración adicional (opcional)</span><textarea name="aviso_instrucciones" value={draft.aviso_instrucciones} onChange={change} rows="5" placeholder="Ej. Presentarse con documentación original o comunicarse al teléfono indicado." /></label>
            </div>
          </section>

          <section>
            <h3><Icon name="records" />Firma</h3>
            <div className="cl-notice-fields">
              <label><span>Firmante</span><input name="firmante_aviso" value={draft.firmante_aviso} onChange={change} /></label>
              <label><span>Cargo</span><input name="cargo_firmante" value={draft.cargo_firmante} onChange={change} /></label>
            </div>
          </section>
        </div>

        <footer>
          <p><Icon name="success" />La vista previa no cambia el estado de la ficha.</p>
          <div>
            <button type="button" className="cl-secondary" onClick={onClose}>Cancelar</button>
            <button type="button" className="cl-primary" onClick={() => onPreview(draft)}><Icon name="print" />Revisar e imprimir</button>
          </div>
        </footer>
      </section>
    </div>,
    document.body
  );
}
