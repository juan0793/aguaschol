import { useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import { formatNumber, tipoDocumentoLabel, tipoPersonalLabel } from "../utils/entregasFormatters";

const hoy = () => new Date().toISOString().slice(0, 10);

const FORM_INICIAL = {
  fecha: hoy(),
  responsable_id: "",
  barrio_codigo: "",
  tipo_documento: "FACTURA",
  total_asignadas: "",
  observacion_inicial: ""
};

// Al crear el lote NO se registra factura por factura: solo el total asignado.
export default function LoteForm({ config, personal, notify, onCreated, onCancel }) {
  const [form, setForm] = useState(FORM_INICIAL);
  const [guardando, setGuardando] = useState(false);

  const activos = useMemo(() => personal.filter((persona) => persona.activo), [personal]);
  const responsable = activos.find((persona) => String(persona.id) === String(form.responsable_id));
  const barrio = config.barrios.find((item) => item.codigo === form.barrio_codigo);
  const patch = (cambios) => setForm((actual) => ({ ...actual, ...cambios }));

  const submit = async (event) => {
    event.preventDefault();
    if (guardando) return;
    setGuardando(true);
    try {
      const creado = await onCreated({
        ...form,
        total_asignadas: Number(form.total_asignadas)
      });
      if (creado) setForm({ ...FORM_INICIAL, fecha: form.fecha, tipo_documento: form.tipo_documento });
    } catch (error) {
      notify(error.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form className="ent-nuevo-lote" onSubmit={submit}>
      <section className="ent-card">
        <header className="ent-card-head">
          <div>
            <span className="cl-kicker">Paso 1</span>
            <h3>Datos del lote</h3>
            <p>Registra el lote que sale a campo. El detalle de sobrantes se captura al cerrarlo.</p>
          </div>
        </header>

        <div className="ent-grid-2">
          <label className="cl-field">
            Fecha
            <input type="date" value={form.fecha} onChange={(event) => patch({ fecha: event.target.value })} required />
          </label>
          <label className="cl-field">
            Responsable
            <select
              value={form.responsable_id}
              onChange={(event) => patch({ responsable_id: event.target.value })}
              required
            >
              <option value="">Selecciona una persona registrada</option>
              {activos.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nombre_completo} — {tipoPersonalLabel(persona.tipo_personal)}
                  {persona.tiene_acceso ? "" : " (sin acceso)"}
                </option>
              ))}
            </select>
          </label>
          <label className="cl-field">
            Barrio
            <select
              value={form.barrio_codigo}
              onChange={(event) => patch({ barrio_codigo: event.target.value })}
              required
            >
              <option value="">Selecciona el barrio del recorrido</option>
              {config.barrios.map((item) => (
                <option key={item.codigo} value={item.codigo}>
                  {item.codigo} · {item.barrio}
                </option>
              ))}
            </select>
          </label>
          <label className="cl-field">
            Tipo de documento
            <select
              value={form.tipo_documento}
              onChange={(event) => patch({ tipo_documento: event.target.value })}
              required
            >
              {config.tipos_documento.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipoDocumentoLabel(tipo)}
                </option>
              ))}
            </select>
          </label>
          <label className="cl-field is-wide">
            Total asignado
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              placeholder="Cantidad de documentos entregados al responsable"
              value={form.total_asignadas}
              onChange={(event) => patch({ total_asignadas: event.target.value })}
              required
            />
          </label>
          <label className="cl-field is-wide">
            Observaciones iniciales (opcional)
            <textarea
              rows={3}
              value={form.observacion_inicial}
              onChange={(event) => patch({ observacion_inicial: event.target.value })}
              placeholder="Instrucciones o notas para el recorrido"
            />
          </label>
        </div>
      </section>

      <aside className="ent-card ent-resumen-lateral">
        <span className="cl-kicker">Resumen</span>
        <h3>Antes de guardar</h3>
        <dl>
          <div>
            <dt>Estado</dt>
            <dd>
              <span className="cl-status is-abierto">
                <i />
                Abierto
              </span>
            </dd>
          </div>
          <div>
            <dt>Responsable</dt>
            <dd>{responsable?.nombre_completo || "—"}</dd>
          </div>
          <div>
            <dt>Barrio</dt>
            <dd>{barrio?.barrio || "—"}</dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>{tipoDocumentoLabel(form.tipo_documento)}</dd>
          </div>
          <div>
            <dt>Asignadas</dt>
            <dd>{form.total_asignadas ? formatNumber(form.total_asignadas) : "—"}</dd>
          </div>
        </dl>
        <div className="ent-acciones">
          <button type="button" className="cl-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="cl-primary" disabled={guardando}>
            <Icon name={guardando ? "refresh" : "plus"} />
            {guardando ? "Guardando…" : "Crear lote"}
          </button>
        </div>
      </aside>
    </form>
  );
}
