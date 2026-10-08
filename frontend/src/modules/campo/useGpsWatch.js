import { useCallback, useEffect, useRef, useState } from "react";
import { getGeolocationErrorMessage, getGeolocationUnavailableMessage, isLocalSecureHost } from "../../utils/geolocation";

const WATCH_OPTIONS = { enableHighAccuracy: true, maximumAge: 5000, timeout: 25000 };

// Calidad de la lectura para el técnico: buena (≤ 8 m), regular (≤ 25 m) o mala.
export const gpsQuality = (accuracy) => {
  if (!Number.isFinite(accuracy)) return "sin-dato";
  if (accuracy <= 8) return "buena";
  if (accuracy <= 25) return "regular";
  return "mala";
};

// Sigue la ubicación mientras la pantalla está abierta y visible. Se pausa al
// ocultar la pestaña para no gastar batería y retoma al volver.
export function useGpsWatch({ onFirstFix } = {}) {
  const [fix, setFix] = useState(null);
  const [status, setStatus] = useState("apagado");
  const [message, setMessage] = useState("");
  const watchIdRef = useRef(null);
  const wantedRef = useRef(false);
  const firstFixRef = useRef(true);
  const onFirstFixRef = useRef(onFirstFix);
  onFirstFixRef.current = onFirstFix;

  const clearWatch = () => {
    if (watchIdRef.current !== null) navigator.geolocation?.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
  };

  const startWatch = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("no-disponible");
      setMessage(getGeolocationUnavailableMessage());
      return;
    }
    if (!window.isSecureContext && !isLocalSecureHost()) {
      setStatus("https");
      setMessage(getGeolocationUnavailableMessage());
      return;
    }
    clearWatch();
    setStatus((current) => (current === "activo" ? current : "buscando"));
    setMessage("");
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy || 0),
          timestamp: position.timestamp
        };
        setFix(next);
        setStatus("activo");
        setMessage("");
        if (firstFixRef.current) {
          firstFixRef.current = false;
          onFirstFixRef.current?.(next);
        }
      },
      (error) => {
        if (error?.code === 1) {
          setStatus("sin-permiso");
          clearWatch();
          wantedRef.current = false;
        } else {
          setStatus((current) => (current === "activo" ? current : "esperando"));
        }
        setMessage(getGeolocationErrorMessage(error));
      },
      WATCH_OPTIONS
    );
  }, []);

  const locate = useCallback(() => {
    wantedRef.current = true;
    firstFixRef.current = true;
    startWatch();
  }, [startWatch]);

  const stop = useCallback(() => {
    wantedRef.current = false;
    clearWatch();
    setStatus("apagado");
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") clearWatch();
      else if (wantedRef.current) startWatch();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      clearWatch();
    };
  }, [startWatch]);

  return { fix, status, message, locate, stop, quality: gpsQuality(fix?.accuracy) };
}
