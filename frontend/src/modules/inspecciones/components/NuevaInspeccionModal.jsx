import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import TecnicosApoyoSelector from "./TecnicosApoyoSelector";
import SugerenciasTecnico from "./SugerenciasTecnico";
import CorregirOrtografia, { SPELLCHECK_PROPS } from "./CorregirOrtografia";
import { MOTIVOS_SUGERIDOS, estadoLabel, formatShortDate, titleCase } from "../utils/inspeccionesFormatters";

const ABIERTAS = ["ASIGNADA", "EN_PROCESO", "SEGUIMIENTO"];

// Inspecciones que ya tiene la clave. Una clave puede tener varias cuentas: alarma solo si la
// abierta es de la cuenta elegida o si alguna de las dos es general de la clave; las de otras
// cuentas se muestran como referencia.
const esGeneral = (item) => Boolean(Number(item.inspeccion_general)) || !String(item.abonado_numero || "").trim();
function PreviasDeLaClave({ previas, abonado, general }) {
  if (!previas?.length) return null;
  const elegida = general || abonado;
  const cubre = (item) => general || esGeneral(item) || String(item.abonado_numero).trim() === String(abonado);
  const deEsta = elegida ? previas.filter(cubre) : previas;
  const otras = elegida ? previas.filter((item) => !cubre(item)) : [];
  const abiertas = deEsta.filter((item) => ABIERTAS.includes(item.estado));
  const cerradas = deEsta.filter((item) => !ABIERTAS.includes(item.estado));
  const otrasAbiertas = otras.filter((item) => ABIERTAS.includes(item.estado));
  const sujeto = !elegida ? "Esta clave" : general ? "Esta clave (inspección general)" : "Esta cuenta";
  const titulo = abiertas.length
    ? `${sujeto} ya tiene ${abiertas.length === 1 ? "una inspección abierta" : `${abiertas.length} inspecciones abiertas`}. Revisa antes de crear otra.`
    : cerradas.length ? `${sujeto} se inspeccionó ${cerradas.length === 1 ? "una vez" : `${cerradas.length} veces`} antes.` : "";
  const fila = (item) => <li key={item.id}>
    <span className="ins-previas-numero">{item.numero_inspeccion}</span>
    <span>{estadoLabel(item.estado)} · {titleCase(item.tecnico_responsable_nombre) || "Sin técnico"} · {formatShortDate(item.fecha_finalizacion || item.fecha_asignacion)}</span>
    <small>{esGeneral(item) ? "General de la clave" : `Abonado ${item.abonado_numero}`} · {item.motivo || "Sin motivo"}</small>
  </li>;
  return <div className="ins-previas-grupo">
    {titulo ? <div className={`ins-previas${abiertas.length ? " is-abierta" : ""}`} role="status">
      <strong><Icon name={abiertas.length ? "warning" : "history"} />{titulo}</strong>
      <ul>{[...abiertas, ...cerradas.slice(0, 3)].map(fila)}</ul>
      {cerradas.length > 3 ? <small>Y {cerradas.length - 3} más en el historial de Inspecciones.</small> : null}
    </div> : null}
    {otrasAbiertas.length ? <div className="ins-previas is-otras" role="status">
      <strong><Icon name="users" />{otrasAbiertas.length === 1 ? "Otra cuenta de esta clave tiene una inspección abierta" : `Otras cuentas de esta clave tienen ${otrasAbiertas.length} inspecciones abiertas`} (no es la misma visita).</strong>
      <ul>{otrasAbiertas.map(fila)}</ul>
    </div> : null}
  </div>;
}

export default function NuevaInspeccionModal({ api, tecnicos, initialData, notify, onClose, onCreated }) {
  const [claveInput, setClaveInput] = useState(initialData?.clave_catastral || "");
  const [searching, setSearching] = useState(false);
  const [lookup, setLookup] = useState(null);
  const [abonadoSeleccionado, setAbonadoSeleccionado] = useState("");
  const [inspeccionGeneral, setInspeccionGeneral] = useState(false);
  const [motivo, setMotivo] = useState(MOTIVOS_SUGERIDOS[0]);
  const [motivoOtro, setMotivoOtro] = useState("");
  const [trabajoSolicitado, setTrabajoSolicitado] = useState(initialData?.trabajo_solicitado || (initialData?.referencia ? `Verificar inmueble desde ${initialData.referencia}.` : ""));
  // auto: lo puso la sugerencia, asi que una clave nueva lo puede cambiar; si lo eligio la persona, no.
  const [responsable, setResponsable] = useState({ id: "", auto: false });
  const responsableId = responsable.id;
  const [sugerencia, setSugerencia] = useState(null);
  const [apoyos, setApoyos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [previas, setPrevias] = useState(null);

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

  useEffect(() => {
    if (!initialData?.clave_catastral) return;
    setClaveInput(initialData.clave_catastral);
    setTrabajoSolicitado((current) => current || `Verificar inmueble desde ${initialData.referencia || "SIG Territorial"}.`);
    (async () => {
      setSearching(true);
      try {
        const result = await api.searchClave(initialData.clave_catastral, "clave");
        setLookup(result);
        const abonado = initialData.abonado || result.matches?.[0]?.abonado;
        if (abonado) setAbonadoSeleccionado(String(abonado));
      } catch (error) {
        notify(error.message);
      } finally {
        setSearching(false);
      }
    })();
  }, [api, initialData, notify]);

  // Tecnico mas cercano segun el reparto de barrios. Es solo una ayuda: si falla, se elige a mano.
  useEffect(() => {
    const clave = lookup?.exists ? lookup.normalized_query : "";
    setSugerencia(null);
    if (!clave) return undefined;
    let vigente = true;
    api.sugerenciaTecnico(clave)
      .then((resultado) => {
        if (!vigente) return;
        setSugerencia(resultado);
        const primero = resultado.sugerencias?.[0];
        setResponsable((actual) => (actual.id && !actual.auto
          ? actual
          : { id: primero ? String(primero.tecnico_id) : "", auto: Boolean(primero) }));
      })
      .catch(() => {});
    return () => { vigente = false; };
  }, [api, lookup]);

  // Lo que ya existe en esta clave (solo coincidencias exactas; el filtro del servidor es parcial).
  useEffect(() => {
    const clave = lookup?.exists ? lookup.normalized_query : "";
    setPrevias(null);
    if (!clave) return undefined;
    let vigente = true;
    api.list({ clave, limit: 50 })
      .then((resultado) => {
        if (!vigente) return;
        const mismas = (resultado.items || []).filter((item) => item.clave_catastral === clave);
        setPrevias(mismas.sort((a, b) => new Date(b.fecha_asignacion || 0) - new Date(a.fecha_asignacion || 0)));
      })
      .catch(() => {});
    return () => { vigente = false; };
  }, [api, lookup]);

  const elegirResponsable = (id) => setResponsable({ id: String(id), auto: false });

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
              <PreviasDeLaClave previas={previas} abonado={inspeccionGeneral ? "" : abonadoSeleccionado} general={inspeccionGeneral} />
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
                    {...SPELLCHECK_PROPS}
                    placeholder="Ej. Verificar acometida y medidor, y confirmar si existen derivaciones adicionales."
                    value={trabajoSolicitado}
                    onChange={(event) => setTrabajoSolicitado(event.target.value)}
                  />
                  <CorregirOrtografia api={api} value={trabajoSolicitado} onApply={setTrabajoSolicitado} />
                </label>
              </div>
            </section>

            <section className="ins-form-section">
              <h3>3. Técnico responsable</h3>
              <SugerenciasTecnico sugerencia={sugerencia} selectedId={responsableId} onSelect={elegirResponsable} />
              <select value={responsableId} onChange={(event) => elegirResponsable(event.target.value)}>
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
