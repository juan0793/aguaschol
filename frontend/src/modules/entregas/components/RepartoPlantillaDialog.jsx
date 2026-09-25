import { useMemo, useState } from "react";
import { formatNumber } from "../utils/entregasFormatters";
import { PLANTILLAS_REPARTO } from "../utils/repartoPlantillas";
import {
  asignacionesDePlantilla,
  emparejarNombre,
  formatoDesvio,
  metaPorPersona,
  participantesDelReparto,
  totalesPorResponsable
} from "../utils/repartoUtils";

const emparejamientoInicial = (plantilla, personal) =>
  Object.fromEntries(Object.keys(plantilla.zonas).map((nombre) => [nombre, emparejarNombre(nombre, personal)?.id || ""]));

// Carga de una vez un reparto de referencia (las hojas o la propuesta). Los
// nombres de la plantilla se emparejan con Personal de campo y se pueden
// corregir antes de aplicar; aplicar reemplaza el reparto completo.
export default function RepartoPlantillaDialog({ model, personal = [], notify, onClose }) {
  const [clave, setClave] = useState(PLANTILLAS_REPARTO[0].clave);
  const plantilla = PLANTILLAS_REPARTO.find((item) => item.clave === clave);
  const [emparejamiento, setEmparejamiento] = useState(() => emparejamientoInicial(plantilla, personal));
  const [aplicando, setAplicando] = useState(false);

  const activos = useMemo(
    () => personal.filter((persona) => persona.activo).sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo)),
    [personal]
  );

  const cambiarPlantilla = (nueva) => {
    setClave(nueva);
    setEmparejamiento(emparejamientoInicial(PLANTILLAS_REPARTO.find((item) => item.clave === nueva), personal));
  };

  const vista = useMemo(() => {
    const { asignaciones, desconocidos } = asignacionesDePlantilla(plantilla, emparejamiento, model.barrios);
    const porCodigo = new Map(asignaciones.map((item) => [item.barrio_codigo, item]));
    const simulados = model.barrios.map((barrio) => (porCodigo.has(barrio.codigo)
      ? { ...barrio, responsable_id: porCodigo.get(barrio.codigo).responsable_id }
      : barrio));
    const participantes = participantesDelReparto(simulados, personal);
    const { totales, sinAsignar } = totalesPorResponsable(simulados);
    return { asignaciones, desconocidos, totales, sinAsignar, meta: metaPorPersona(simulados, participantes) };
  }, [emparejamiento, model.barrios, personal, plantilla]);

  const usados = Object.values(emparejamiento).filter(Boolean).map(String);
  const repetidos = usados.filter((id, indice) => usados.indexOf(id) !== indice);
  const sinEmparejar = Object.entries(emparejamiento).filter(([, id]) => !id).map(([nombre]) => nombre);

  const aplicar = async () => {
    if (aplicando || repetidos.length) return;
    setAplicando(true);
    try {
      const resultado = await model.aplicarLote(vista.asignaciones, `Plantilla: ${plantilla.titulo}`);
      notify(`Reparto cargado: ${formatNumber(resultado.guardadas)} barrios actualizados.`);
      onClose();
    } catch (error) {
      notify(error.message || "No se pudo cargar el reparto.");
    } finally {
      setAplicando(false);
    }
  };

  return (
    <div className="cl-drawer-backdrop" role="dialog" aria-modal="true" aria-labelledby="reparto-plantilla-titulo" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
      <aside className="cl-drawer ent-drawer ent-reparto-plantilla">
        <header>
          <div>
            <span className="cl-kicker">Reparto por barrio</span>
            <h2 id="reparto-plantilla-titulo">Cargar un reparto completo</h2>
            <p>Reemplaza todas las asignaciones actuales. Después puedes cambiar barrios sueltos.</p>
          </div>
          <button type="button" className="cl-icon-button" onClick={onClose} aria-label="Cerrar">✕</button>
        </header>

        <div className="cl-drawer-scroll">
          <fieldset className="ent-reparto-opciones">
            <legend>Reparto de referencia</legend>
            {PLANTILLAS_REPARTO.map((item) => (
              <label key={item.clave} className={item.clave === clave ? "is-activa" : ""}>
                <input type="radio" name="plantilla-reparto" value={item.clave} checked={item.clave === clave} onChange={() => cambiarPlantilla(item.clave)} />
                <span>
                  <strong>{item.titulo}</strong>
                  <small>{item.descripcion}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <h3 className="ent-reparto-subtitulo">¿Quién es quién en Personal de campo?</h3>
          <p className="ent-reparto-nota">Se emparejó por nombre. Corrige lo que haga falta; quien quede sin persona deja sus barrios sin asignar.</p>
          <table className="cl-table ent-table ent-reparto-emparejar">
            <thead>
              <tr>
                <th>En la plantilla</th>
                <th>Persona</th>
                <th className="is-num">Claves</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(plantilla.zonas).map((nombre) => {
                const id = emparejamiento[nombre];
                const total = id ? vista.totales.get(Number(id))?.claves || 0 : 0;
                return (
                  <tr key={nombre}>
                    <td><strong>{nombre}</strong><small>{plantilla.zonas[nombre].length} barrios</small></td>
                    <td>
                      <select
                        aria-label={`Persona para ${nombre}`}
                        value={id}
                        onChange={(event) => setEmparejamiento({ ...emparejamiento, [nombre]: event.target.value })}
                      >
                        <option value="">Sin persona</option>
                        {activos.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombre_completo}</option>)}
                      </select>
                    </td>
                    <td className="is-num">
                      {id ? <>{formatNumber(total)}<small>{formatoDesvio(total, vista.meta)}</small></> : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {repetidos.length ? <p className="ent-reparto-aviso is-error" role="alert">Una misma persona quedó en dos nombres de la plantilla. Elige una persona distinta para cada uno.</p> : null}
          {sinEmparejar.length ? <p className="ent-reparto-aviso">Sin persona: {sinEmparejar.join(", ")}. Sus barrios quedarán sin asignar.</p> : null}
          {vista.sinAsignar.barrios ? (
            <p className="ent-reparto-nota">Quedarían {formatNumber(vista.sinAsignar.barrios)} barrios sin asignar ({formatNumber(vista.sinAsignar.claves)} claves).</p>
          ) : null}
          {vista.desconocidos.length ? (
            <p className="ent-reparto-nota">{vista.desconocidos.length} códigos de la plantilla no están en el padrón actual y se omiten.</p>
          ) : null}
        </div>

        <footer className="ent-drawer-footer">
          <button type="button" className="cl-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="cl-primary" onClick={aplicar} disabled={aplicando || Boolean(repetidos.length)}>
            {aplicando ? "Guardando…" : "Reemplazar reparto"}
          </button>
        </footer>
      </aside>
    </div>
  );
}
