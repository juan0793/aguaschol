import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import TecnicosApoyoSelector from "./TecnicosApoyoSelector";
import { MOTIVOS_SUGERIDOS } from "../utils/inspeccionesFormatters";

export default function NuevaInspeccionModal({ api, tecnicos, notify, onClose, onCreated }) {
  const [claveInput, setClaveInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [lookup, setLookup] = useState(null);
  const [abonadoSeleccionado, setAbonadoSeleccionado] = useState("");
  const [inspeccionGeneral, setInspeccionGeneral] = useState(false);
  const [motivo, setMotivo] = useState(MOTIVOS_SUGERIDOS[0]);
  const [motivoOtro, setMotivoOtro] = useState("");
  const [trabajoSolicitado, setTrabajoSolicitado] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [apoyos, setApoyos] = useState([]);
  const [saving, setSaving] = useState(false);

  const buscarClave = async (event) => {
    event?.preventDefault();
    if (!claveInput.trim()) return;
    setSearching(true);
    setLookup(null);
    try {
      const result = await api.searchClave(claveInput.trim(), "clave");
      setLookup(result);
      if (result.matches?.length === 1) setAbonadoSeleccionado(String(result.matches[0].abonado));
    } catch (error) {
      notify(error.message);
    } finally {
      setSearching(false);
    }
  };

  const toggleApoyo = (id) => setApoyos((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const seleccion = useMemo(
    () => lookup?.matches?.find((match) => String(match.abonado) === abonadoSeleccionado) || null,
    [lookup, abonadoSeleccionado]
  );

  useEffect(() => {
    if (inspeccionGeneral) setAbonadoSeleccionado("");
  }, [inspeccionGeneral]);

  const puedeGuardar =
    lookup?.exists &&
    (inspeccionGeneral || abonadoSeleccionado) &&
    (motivo !== "Otro" || motivoOtro.trim()) &&
    trabajoSolicitado.trim() &&
    responsableId;

  const guardar = async (event) => {
    event.preventDefault();
    if (!puedeGuardar || saving) return;
    setSaving(true);
    try {
      const created = await api.create({
        clave_catastral: claveInput.trim(),
        abonado_numero: inspeccionGeneral ? "" : abonadoSeleccionado,
        inspeccion_general: inspeccionGeneral,
        motivo: motivo === "Otro" ? motivoOtro.trim() : motivo,
        trabajo_solicitado: trabajoSolicitado.trim(),
        tecnico_responsable_id: Number(responsableId),
        apoyos
      });
      notify(`Inspección ${created.numero_inspeccion} asignada.`);
      onCreated(created);
    } catch (error) {
      notify(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cl-drawer-backdrop" role="dialog" aria-modal="true" aria-label="Nueva inspección">
      <div className="cl-drawer">
        <header>
          <div>
            <span className="cl-kicker">Inspecciones</span>
            <h2>Nueva inspección</h2>
          </div>
          <button type="button" className="cl-icon-button" onClick={onClose} aria-label="Cerrar">
            <Icon name="logout" />
          </button>
        </header>
        <form onSubmit={guardar}>
          <div className="cl-drawer-scroll">
            <section className="ins-form-section">
              <h3>1. Clave catastral</h3>
              <div className="ins-clave-search">
                <input
                  placeholder="Ej. 01-02-15-0045"
                  value={claveInput}
                  onChange={(event) => setClaveInput(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && buscarClave(event)}
                />
                <button type="button" className="cl-secondary" onClick={buscarClave} disabled={searching}>
                  <Icon name="search" />
                  {searching ? "Buscando…" : "Buscar"}
                </button>
              </div>
              {lookup && !lookup.exists ? <p className="cl-alert">No se encontró la clave catastral en el padrón.</p> : null}
              {lookup?.exists ? (
                <div className="ins-abonados-list">
                  <label className="ins-apoyo-chip">
                    <input type="checkbox" checked={inspeccionGeneral} onChange={(event) => setInspeccionGeneral(event.target.checked)} />
                    <span>
                      <strong>Inspección general de la clave</strong>
                      <small>No se vincula a un abonado específico</small>
                    </span>
                  </label>
                  {!inspeccionGeneral
                    ? lookup.matches.map((match) => (
                        <label key={match.abonado} className={`ins-apoyo-chip ${abonadoSeleccionado === String(match.abonado) ? "is-active" : ""}`}>
                          <input
                            type="radio"
                            name="abonado"
                            checked={abonadoSeleccionado === String(match.abonado)}
                            onChange={() => setAbonadoSeleccionado(String(match.abonado))}
                          />
                          <span>
                            <strong>{match.inquilino || match.nombre || "Sin nombre"}</strong>
                            <small>Cuenta {match.abonado} · {match.barrio_colonia || "Sin barrio"}</small>
                          </span>
                        </label>
                      ))
                    : null}
                </div>
              ) : null}
              {seleccion || (inspeccionGeneral && lookup?.exists) ? (
                <div className="cl-padron-result">
                  <strong>{seleccion?.inquilino || "Inspección general"}</strong>
                  <span>Clave</span>
                  <span>{lookup.normalized_query}</span>
                  <span>Barrio</span>
                  <span>{seleccion?.barrio_colonia || lookup.matches[0]?.barrio_colonia || "—"}</span>
                </div>
              ) : null}
            </section>

            <section className="ins-form-section">
              <h3>2. Motivo y trabajo solicitado</h3>
              <div className="cl-fields">
                <label className="cl-field">
                  <span>Motivo</span>
                  <select value={motivo} onChange={(event) => setMotivo(event.target.value)}>
                    {MOTIVOS_SUGERIDOS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                    <option value="Otro">Otro</option>
                  </select>
                </label>
                {motivo === "Otro" ? (
                  <label className="cl-field">
                    <span>Especifica el motivo</span>
                    <input value={motivoOtro} onChange={(event) => setMotivoOtro(event.target.value)} />
                  </label>
                ) : null}
                <label className="cl-field is-wide">
                  <span>Trabajo solicitado</span>
                  <textarea
                    rows={3}
                    placeholder="Ej. Verificar acometida y medidor, y confirmar si existen derivaciones adicionales."
                    value={trabajoSolicitado}
                    onChange={(event) => setTrabajoSolicitado(event.target.value)}
                  />
                </label>
              </div>
            </section>

            <section className="ins-form-section">
              <h3>3. Técnico responsable</h3>
              <select value={responsableId} onChange={(event) => setResponsableId(event.target.value)}>
                <option value="">Selecciona un técnico</option>
                {tecnicos.map((tecnico) => (
                  <option key={tecnico.id} value={tecnico.id}>
                    {tecnico.full_name} · {tecnico.inspecciones_activas} activas
                  </option>
                ))}
              </select>
            </section>

            <section className="ins-form-section">
              <h3>4. Técnicos de apoyo (opcional)</h3>
              <TecnicosApoyoSelector tecnicos={tecnicos} responsableId={responsableId} selected={apoyos} onToggle={toggleApoyo} />
            </section>
          </div>
          <footer>
            <div className="cl-drawer-main-actions">
              <button type="button" className="cl-secondary" onClick={onClose}>Cancelar</button>
              <button type="submit" className="cl-primary" disabled={!puedeGuardar || saving}>
                <Icon name="success" />
                {saving ? "Asignando…" : "Asignar inspección"}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
