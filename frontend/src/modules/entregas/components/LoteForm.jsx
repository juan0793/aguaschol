import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import { estadoLoteLabel, formatNumber, tipoDocumentoLabel, tipoPersonalLabel } from "../utils/entregasFormatters";

const hoy = () => new Date().toISOString().slice(0, 10);
const OTRO_BARRIO = "__otro__";

const FORM_INICIAL = {
  fecha: hoy(),
  responsable_id: "",
  barrio_codigo: "",
  barrio_nombre: "",
  tipo_documento: "FACTURA",
  total_asignadas: "",
  observacion_inicial: ""
};

// Al crear el lote NO se registra factura por factura: solo el total asignado.
export default function LoteForm({ config, personal, notify, lote, onSaved, onCancel }) {
  const formDesdeLote = (item) => item ? {
    fecha: String(item.fecha || "").slice(0, 10),
    responsable_id: item.responsable_id || "",
    barrio_codigo: item.barrio_codigo || "",
    barrio_nombre: item.barrio_nombre || "",
    tipo_documento: item.tipo_documento || "FACTURA",
    total_asignadas: item.total_asignadas || "",
    observacion_inicial: item.observacion_inicial || ""
  } : FORM_INICIAL;

  // El barrio no siempre esta en el catalogo; si el lote ya trae un codigo que
  // no reconocemos, asumimos que se guardo con nombre libre y abrimos ese modo.
  const esBarrioLibre = (item) => {
    const inicial = formDesdeLote(item);
    if (!inicial.barrio_codigo) return Boolean(inicial.barrio_nombre);
    return !config.barrios.some((barrioItem) => barrioItem.codigo === inicial.barrio_codigo);
  };

  const editando = Boolean(lote?.id);
  const [form, setForm] = useState(() => formDesdeLote(lote));
  const [barrioLibre, setBarrioLibre] = useState(() => esBarrioLibre(lote));
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setForm(formDesdeLote(lote));
    setBarrioLibre(esBarrioLibre(lote));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lote]);

  const activos = useMemo(
    () => personal.filter((persona) => persona.activo || String(persona.id) === String(form.responsable_id)),
    [form.responsable_id, personal]
  );
  const responsable = personal.find((persona) => String(persona.id) === String(form.responsable_id));
  const barrioNombre = barrioLibre ? form.barrio_nombre : config.barrios.find((item) => item.codigo === form.barrio_codigo)?.barrio;
  const patch = (cambios) => setForm((actual) => ({ ...actual, ...cambios }));

  const cambiarBarrio = (valor) => {
    if (valor === OTRO_BARRIO) {
      setBarrioLibre(true);
      patch({ barrio_codigo: "" });
    } else {
      setBarrioLibre(false);
      patch({ barrio_codigo: valor, barrio_nombre: "" });
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (guardando) return;
    setGuardando(true);
    try {
      const guardado = await onSaved({
        ...form,
        total_asignadas: Number(form.total_asignadas)
      });
      if (guardado && !editando) setForm({ ...FORM_INICIAL, fecha: form.fecha, tipo_documento: form.tipo_documento });
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
            <h3>{editando ? `Editar lote #${lote.id}` : "Datos del lote"}</h3>
            <p>{editando ? "Corrige los datos del lote antes de cerrarlo." : "Registra el lote que sale a campo. El detalle de sobrantes se captura al cerrarlo."}</p>
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
              disabled={editando && !config.permissions.can_view_all}
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
              value={barrioLibre ? OTRO_BARRIO : form.barrio_codigo}
              onChange={(event) => cambiarBarrio(event.target.value)}
              required
            >
              <option value="">Selecciona el barrio del recorrido</option>
              {config.barrios.map((item) => (
                <option key={item.codigo} value={item.codigo}>
                  {item.codigo} · {item.barrio}
                </option>
              ))}
              <option value={OTRO_BARRIO}>Otro (especificar)</option>
            </select>
            {barrioLibre ? (
              <input
                value={form.barrio_nombre}
                onChange={(event) => patch({ barrio_nombre: event.target.value })}
                placeholder="Escribe el nombre del barrio"
                maxLength={180}
                required
              />
            ) : null}
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
        <h3>{editando ? "Cambios" : "Antes de guardar"}</h3>
        <dl>
          <div>
            <dt>Estado</dt>
            <dd>
              <span className={`cl-status is-${String(lote?.estado || "ABIERTO").toLowerCase()}`}>
                <i />
                {estadoLoteLabel(lote?.estado || "ABIERTO")}
              </span>
            </dd>
          </div>
          <div>
            <dt>Responsable</dt>
            <dd>{responsable?.nombre_completo || "—"}</dd>
          </div>
          <div>
            <dt>Barrio</dt>
            <dd>{barrioNombre || "—"}</dd>
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
            <Icon name={guardando ? "refresh" : editando ? "edit" : "plus"} />
            {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear lote"}
          </button>
        </div>
      </aside>
    </form>
  );
}
