import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../../components/Icon";
import { diaLocal } from "../periodos";
import PlazoAvisoFields, { PLAZO_INICIAL, fechaLimiteValida } from "./PlazoAvisoFields";

// Hoy en hora local (toISOString daba el día siguiente desde las 6 p. m.).
const today = () => diaLocal(new Date());
const plazoDeFicha = (record) => {
  if (record.aviso_plazo_tipo === "fecha") return { tipo: "fecha", valor: null, fecha: String(record.fecha_limite_aviso || "").slice(0, 10) };
  if (record.aviso_plazo_tipo) return { tipo: record.aviso_plazo_tipo, valor: Number(record.aviso_plazo_valor), fecha: "" };
  return PLAZO_INICIAL;
};

export default function AvisoEditor({ record, api, onClose, onPreview }) {
  const [draft, setDraft] = useState(() => ({
    ...record,
    fecha_aviso: String(record.fecha_aviso || today()).slice(0, 10),
    aviso_destinatario: record.aviso_destinatario || record.abonado || record.inquilino || record.nombre_catastral || "",
    aviso_instrucciones: record.aviso_instrucciones || "",
    firmante_aviso: record.firmante_aviso || "Jefatura de Comercialización",
    cargo_firmante: record.cargo_firmante || "Aguas de Choluteca"
  }));
  const [plazo, setPlazo] = useState(() => plazoDeFicha(record));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const fechaLimite = fechaLimiteValida(draft.fecha_aviso, plazo);

  // El plazo se guarda en la ficha (como en el lote) antes de abrir la vista previa,
  // para que la columna Plazo y el aviso impreso digan lo mismo.
  const revisar = async () => {
    if (!fechaLimite) return;
    const conPlazo = { ...draft, aviso_plazo_tipo: plazo.tipo, aviso_plazo_valor: plazo.tipo === "fecha" ? null : plazo.valor, fecha_limite_aviso: fechaLimite };
    if (!record.id || !api) { onPreview(conPlazo); return; }
    setGuardando(true);
    setError("");
    try {
      const { items } = await api.avisoLote({ ids: [record.id], fecha_aviso: draft.fecha_aviso, plazo, firmante_aviso: draft.firmante_aviso, cargo_firmante: draft.cargo_firmante, aviso_instrucciones: draft.aviso_instrucciones });
      onPreview({ ...conPlazo, ...(items?.[0] || {}), aviso_destinatario: draft.aviso_destinatario });
    } catch (reason) {
      setError(reason.message || "No se pudo guardar el plazo del aviso.");
      setGuardando(false);
    }
  };

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
            <div className="cl-lote-plazo">
              <label className="cl-lote-fecha"><span>Fecha del aviso</span><input type="date" name="fecha_aviso" value={draft.fecha_aviso} onInput={change} /></label>
              <PlazoAvisoFields fechaAviso={draft.fecha_aviso} plazo={plazo} onChange={setPlazo} idPrefix="cl-aviso" />
            </div>
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
          {error ? <p className="cl-lote-alerta is-error" role="alert"><Icon name="warning" />{error}</p> : <p><Icon name="success" />La fecha y el plazo quedan guardados en la ficha.</p>}
          <div>
            <button type="button" className="cl-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
            <button type="button" className="cl-primary" onClick={revisar} disabled={!fechaLimite || guardando}><Icon name="print" />{guardando ? "Guardando…" : "Revisar e imprimir"}</button>
          </div>
        </footer>
      </section>
    </div>,
    document.body
  );
}
