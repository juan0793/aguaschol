import { BellOff, BellRing, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { activarAvisos, desactivarAvisos, enviarSuscripcion, estadoServidor, registroActivo, soportePush, suscripcionActual } from "../utils/pushAvisos.js";

// La suscripción de este dispositivo se reenvía una vez por carga: si el servidor la
// perdió o el teléfono cambió de usuario, vuelve a quedar a nombre de quien entró.
let sincronizada = false;

// Pie de la campana: activar los avisos con la app cerrada en este dispositivo.
// El permiso del navegador solo se pide al tocar el botón.
export function AvisosPush({ apiFetch }) {
  const [estado, setEstado] = useState("cargando");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    (async () => {
      const soporte = soportePush();
      if (soporte !== "si") { if (vivo) setEstado(soporte === "ios-instalar" ? "ios" : "no"); return; }
      const servidor = await estadoServidor(apiFetch).catch(() => null);
      if (!servidor?.disponible || !(await registroActivo())) { if (vivo) setEstado("oculto"); return; }
      if (!vivo) return;
      setClave(servidor.clave_publica);
      if (Notification.permission === "denied") { setEstado("bloqueado"); return; }
      const suscripcion = Notification.permission === "granted" ? await suscripcionActual().catch(() => null) : null;
      if (suscripcion && !sincronizada) {
        sincronizada = true;
        enviarSuscripcion(apiFetch, suscripcion).catch(() => { sincronizada = false; });
      }
      if (vivo) setEstado(suscripcion ? "activo" : "apagado");
    })();
    return () => { vivo = false; };
  }, [apiFetch]);

  const activar = async () => {
    setEstado("trabajando"); setError("");
    try {
      const permiso = await activarAvisos(apiFetch, clave);
      setEstado(permiso === "granted" ? "activo" : permiso === "denied" ? "bloqueado" : "apagado");
    } catch (reason) {
      setError(reason?.message || "No se pudieron activar los avisos.");
      setEstado("apagado");
    }
  };
  const desactivar = async () => {
    setEstado("desactivando"); setError("");
    await desactivarAvisos(apiFetch);
    setEstado("apagado");
  };

  if (estado === "cargando" || estado === "oculto" || estado === "no") return null;

  return <div className={`avisos-push is-${estado}`}>
    {estado === "ios" ? <>
      <Smartphone size={16} aria-hidden="true" />
      <p><strong>Avisos con la app cerrada en iPhone</strong>Agrega Control Aguas a la pantalla de inicio (Compartir › Agregar a inicio), ábrela desde ahí y activa los avisos. Requiere iOS 16.4 o más reciente.</p>
    </> : null}
    {estado === "bloqueado" ? <>
      <BellOff size={16} aria-hidden="true" />
      <p><strong>Avisos bloqueados en este navegador</strong>Para recibirlos con la app cerrada, permite las notificaciones de este sitio en los ajustes del navegador.</p>
    </> : null}
    {estado === "activo" || estado === "desactivando" ? <>
      <BellRing size={16} aria-hidden="true" />
      <p><strong>Avisos activos en este dispositivo</strong>Llegan aunque la app esté cerrada.</p>
      <button type="button" className="avisos-push-enlace" onClick={desactivar} disabled={estado === "desactivando"}>{estado === "desactivando" ? "Desactivando…" : "Desactivar"}</button>
    </> : null}
    {estado === "apagado" || estado === "trabajando" ? <>
      <BellRing size={16} aria-hidden="true" />
      <p><strong>Recibe los avisos con la app cerrada</strong>El teléfono te avisa de reclamos, entregas y mensajes aunque no tengas la app abierta.</p>
      <button type="button" className="avisos-push-boton" onClick={activar} disabled={estado === "trabajando"}>{estado === "trabajando" ? "Activando…" : "Activar avisos"}</button>
    </> : null}
    {error ? <p className="avisos-push-error" role="alert">{error}</p> : null}
  </div>;
}
