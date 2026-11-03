import { useEffect, useRef, useState } from "react";
import "./ubicacionCompartida.css";

// GPS del teléfono del técnico para el mapa del equipo. Solo en teléfonos y
// tabletas, solo con la app abierta y visible (el navegador no deja seguir en
// segundo plano), y siempre con el aviso a la vista: el técnico sabe cuándo se comparte.
// Liviano para el servidor: quieto, una señal cada 2 min; caminando, una cada 30 s
// como máximo y solo si avanzó 25 m. Una lectura muy imprecisa no se manda.
const OPCIONES = { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 };
const QUIETO_MS = 120000;
const MOVIENDO_MS = 30000;
const MIN_METROS = 25;
const MAX_PRECISION_M = 200;

const metros = (a, b) => {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.latitude - a.latitude) * rad) / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(((b.longitude - a.longitude) * rad) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};
const esTelefono = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

export default function UbicacionCompartida({ apiFetch }) {
  const [estado, setEstado] = useState(() => (esTelefono() && navigator.geolocation ? "buscando" : "off"));
  const enviado = useRef(null);
  const fetchRef = useRef(apiFetch);
  fetchRef.current = apiFetch;
  const activo = estado !== "off";

  useEffect(() => {
    if (!activo) return undefined;
    let watchId = null;
    const enviar = (position) => {
      const lectura = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, heading: position.coords.heading, speed: position.coords.speed };
      const ahora = Date.now();
      const previo = enviado.current;
      setEstado("activo");
      if (lectura.accuracy > MAX_PRECISION_M) return;
      const toca = !previo || ahora - previo.at >= QUIETO_MS || (ahora - previo.at >= MOVIENDO_MS && metros(previo, lectura) >= MIN_METROS);
      if (!toca) return;
      enviado.current = { ...lectura, at: ahora };
      fetchRef.current("/profile/ubicacion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lectura) }).catch(() => { enviado.current = previo; });
    };
    const iniciar = () => {
      if (watchId != null || document.visibilityState !== "visible") return;
      watchId = navigator.geolocation.watchPosition(enviar, (error) => setEstado(error?.code === 1 ? "sin-permiso" : "buscando"), OPCIONES);
    };
    const detener = () => { if (watchId != null) navigator.geolocation.clearWatch(watchId); watchId = null; };
    const alCambiar = () => (document.visibilityState === "visible" ? iniciar() : detener());
    iniciar();
    document.addEventListener("visibilitychange", alCambiar);
    return () => { document.removeEventListener("visibilitychange", alCambiar); detener(); };
  }, [activo]);

  if (estado === "off") return null;
  const texto = estado === "activo" ? "Ubicación compartida" : estado === "sin-permiso" ? "Ubicación sin permiso" : "Buscando GPS…";
  const ayuda = estado === "sin-permiso"
    ? "Administración no ve dónde estás. Para compartirlo, permite la ubicación de este sitio en el navegador."
    : "Mientras la app está abierta, administración ve en el mapa del equipo dónde estás.";
  return <span className={`app-gps-chip is-${estado}`} title={ayuda} role="status" aria-label={`${texto}. ${ayuda}`}><i aria-hidden="true" />{texto}</span>;
}
