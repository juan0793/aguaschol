import { useCallback, useEffect, useState } from "react";
import "./accesosAdicionales.css";

const fechaLegible = (iso) => {
  if (!iso) return "";
  const [anio, mes, dia] = String(iso).slice(0, 10).split("-");
  return `${dia}/${mes}/${anio}`;
};

const sumarDias = (iso, dias) => {
  const fecha = new Date(`${iso}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
};

// Accesos adicionales de un usuario: abren a esta persona una pantalla que su perfil
// no tiene, sin dársela a los demás de su perfil. Cada cambio se guarda al momento.
export default function AccesosAdicionales({ apiFetch, user, disabled = false }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState("");

  const pedir = useCallback(async (ruta, opciones) => {
    const respuesta = await apiFetch(ruta, opciones);
    const cuerpo = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(cuerpo.message || "No se pudo actualizar el acceso.");
    return cuerpo;
  }, [apiFetch]);

  useEffect(() => {
    let vivo = true;
    setDatos(null);
    setError("");
    pedir(`/users/${user.id}/accesos`)
      .then((cuerpo) => { if (vivo) setDatos(cuerpo); })
      .catch((problema) => { if (vivo) setError(problema.message); });
    return () => { vivo = false; };
  }, [pedir, user.id, user.role]);

  const guardar = async (clave, cambios) => {
    setGuardando(clave);
    setError("");
    try {
      const actual = datos.accesos.find((item) => item.clave === clave);
      setDatos(await pedir(`/users/${user.id}/accesos/${encodeURIComponent(clave)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alcance: actual?.alcance, vence: actual?.vence || "", ...cambios })
      }));
    } catch (problema) {
      setError(problema.message);
    } finally {
      setGuardando("");
    }
  };

  const quitar = async (clave) => {
    setGuardando(clave);
    setError("");
    try {
      setDatos(await pedir(`/users/${user.id}/accesos/${encodeURIComponent(clave)}`, { method: "DELETE" }));
    } catch (problema) {
      setError(problema.message);
    } finally {
      setGuardando("");
    }
  };

  return (
    <section className="users-access-section ua-accesos" aria-labelledby="users-access-extra">
      <h3 id="users-access-extra">Accesos adicionales</h3>
      {!datos && !error ? <p className="users-access-note">Cargando accesos…</p> : null}
      {datos && !datos.catalogo.length ? (
        <p className="users-access-note">Este perfil no necesita accesos adicionales: ya ve lo que le corresponde o no trabaja en esas pantallas.</p>
      ) : null}
      {datos?.catalogo.length ? (
        <p className="ua-ayuda">Abren a esta persona una pantalla que su perfil no tiene. Los demás de su perfil no la ven y el servidor les niega la consulta.</p>
      ) : null}
      {datos?.catalogo.map((item) => {
        const acceso = datos.accesos.find((fila) => fila.clave === item.clave);
        const activo = Boolean(acceso);
        const ocupado = guardando === item.clave || disabled;
        const idBase = `ua-${user.id}-${item.clave.replace(/\W/g, "-")}`;
        return (
          <div key={item.clave} className={`ua-acceso${activo ? " is-activo" : ""}${acceso && !acceso.vigente ? " is-vencido" : ""}`}>
            <div className="ua-acceso-cabeza">
              <div>
                <strong id={`${idBase}-titulo`}>{item.modulo} · {item.titulo}</strong>
                <small>{item.descripcion}</small>
              </div>
              <button
                type="button"
                className={`ua-switch${activo ? " is-on" : ""}`}
                role="switch"
                aria-checked={activo}
                aria-labelledby={`${idBase}-titulo`}
                disabled={ocupado}
                onClick={() => (activo ? quitar(item.clave) : guardar(item.clave, { alcance: item.alcances[0].valor, vence: "" }))}
              />
            </div>
            {activo ? (
              <div className="ua-acceso-opciones">
                <fieldset disabled={ocupado}>
                  <legend>Qué barrios ve</legend>
                  {item.alcances.map((alcance) => (
                    <label key={alcance.valor} className="ua-radio">
                      <input
                        type="radio"
                        name={`${idBase}-alcance`}
                        value={alcance.valor}
                        checked={acceso.alcance === alcance.valor}
                        onChange={() => guardar(item.clave, { alcance: alcance.valor })}
                      />
                      {alcance.titulo}
                    </label>
                  ))}
                </fieldset>
                <div className="ua-vence">
                  <label htmlFor={`${idBase}-vence`}>Hasta</label>
                  <div className="ua-vence-fila">
                    <input
                      id={`${idBase}-vence`}
                      type="date"
                      value={acceso.vence || ""}
                      min={datos.hoy}
                      max={sumarDias(datos.hoy, 366)}
                      disabled={ocupado}
                      onChange={(event) => guardar(item.clave, { vence: event.target.value })}
                    />
                    {acceso.vence ? (
                      <button type="button" className="ua-link" disabled={ocupado} onClick={() => guardar(item.clave, { vence: "" })}>Sin fecha</button>
                    ) : null}
                  </div>
                  <small>{acceso.vence ? (acceso.vigente ? `Se quita solo después del ${fechaLegible(acceso.vence)}.` : `Venció el ${fechaLegible(acceso.vence)}: ya no la ve.`) : "Sin fecha: dura hasta que se quite."}</small>
                </div>
                <p className="ua-pie">
                  {guardando === item.clave ? "Guardando…" : `Dado por ${acceso.otorgado_por_nombre || "administración"}. Queda en la auditoría.`}
                </p>
              </div>
            ) : null}
          </div>
        );
      })}
      {error ? <p className="ua-error" role="alert">{error}</p> : null}
    </section>
  );
}
