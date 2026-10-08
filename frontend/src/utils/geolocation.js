export const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 18000,
  maximumAge: 0
};

export const GEOLOCATION_FALLBACK_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 22000,
  maximumAge: 60000
};

export const IOS_GPS_HELP =
  "En iPhone, la ubicación solo funciona si abres el sistema con HTTPS y das permiso en Safari. Mientras tanto, puedes tocar el mapa o escribir latitud y longitud para guardar el punto.";

export const getCurrentPosition = (options) =>
  new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });

export const isLocalSecureHost = () => {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "::1";
};

export const getGeolocationUnavailableMessage = () => {
  if (typeof window !== "undefined" && !window.isSecureContext && !isLocalSecureHost()) {
    return IOS_GPS_HELP;
  }

  return "Este dispositivo no soporta la geolocalización. Puedes tocar el mapa o escribir las coordenadas manualmente.";
};

export const getGeolocationErrorMessage = (error) => {
  if (typeof window !== "undefined" && !window.isSecureContext && !isLocalSecureHost()) {
    return IOS_GPS_HELP;
  }

  if (error?.code === error?.PERMISSION_DENIED || error?.code === 1) {
    return "El navegador bloqueó la ubicación. En iPhone, revisa Ajustes > Safari > Ubicación y permite el acceso; también puedes tocar el mapa para marcar el punto.";
  }

  if (error?.code === error?.TIMEOUT || error?.code === 3) {
    return "El GPS tardó demasiado en responder. Intenta al aire libre, toca el mapa o escribe latitud y longitud para registrar el punto.";
  }

  return "No fue posible obtener la ubicación actual. Puedes tocar el mapa o escribir las coordenadas manualmente.";
};
