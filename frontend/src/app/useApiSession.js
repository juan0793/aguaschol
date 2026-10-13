import { useCallback, useEffect, useRef } from "react";
import { API_URL } from "../config/api";
import { getAlertDetails } from "../utils/appShell";
import { toast } from "sonner";
import { anotarFallaSinSenal, enviarFallasPendientes, fallasPendientes } from "../utils/fallasPendientes";

export function useApiSession({ clearSession, intentionalLogoutRef, session, sessionInvalidatingRef, setCargandoDatos }) {
  const peticionesEnCursoRef = useRef(0);
  const actividadTimerRef = useRef(0);

  const showAlert = useCallback((text) => {
    if (!text || (intentionalLogoutRef.current && /la sesi[oó]n venci[oó]/i.test(text))) return;
    const details = getAlertDetails(text);
    toast[details.tone](details.label, {
      description: text,
      duration: 5000,
      closeButton: true
    });
  }, []);

  // La barra de actividad cuenta peticiones en curso, no renderiza por cada una:
  // el contador vive en una ref y el estado solo cambia al empezar y al terminar
  // una tanda. Espera 180 ms antes de mostrarse para que una consulta rápida no
  // dispare un parpadeo.
  const marcarPeticionInicio = useCallback(() => {
    peticionesEnCursoRef.current += 1;
    if (peticionesEnCursoRef.current === 1) {
      window.clearTimeout(actividadTimerRef.current);
      actividadTimerRef.current = window.setTimeout(() => setCargandoDatos(true), 180);
    }
  }, []);

  const marcarPeticionFin = useCallback(() => {
    peticionesEnCursoRef.current = Math.max(0, peticionesEnCursoRef.current - 1);
    if (peticionesEnCursoRef.current === 0) {
      window.clearTimeout(actividadTimerRef.current);
      setCargandoDatos(false);
    }
  }, []);

  // Revalidacion por ETag hecha a mano. Express ya envia ETag en cada GET, pero
  // Chrome no guarda respuestas cross-origin que llevan Authorization, asi que
  // nunca mandaba If-None-Match: cada sondeo del tablero rebajaba la respuesta
  // entera. Aqui se guarda el ETag y el ultimo cuerpo por ruta y se revalida a
  // mano: el servidor sigue consultandose siempre (los datos nunca se sirven sin
  // preguntar), pero cuando nada cambio responde 304 sin cuerpo y se reutiliza
  // lo ya recibido. Solo para las rutas que se sondean, via `revalidate: true`.
  const apiRevalidateCacheRef = useRef(new Map());

  // Fallas sin señal: se envían a "Fallas del equipo" al volver la conexión, o tras una
  // respuesta buena, como mucho cada 30 s. Van con fetch directo para no anotarse a sí mismas.
  const ultimoEnvioFallasRef = useRef(0);
  // El usuario se lee de una ref: al revisar la sesión (p. ej. al volver a la app) llega un
  // objeto nuevo con los mismos datos, y si apiFetch dependiera de él cambiaría de identidad
  // y cada pantalla volvería a cargar todo, perdiendo lo que el técnico estaba capturando.
  const usuarioRef = useRef(session?.user);
  usuarioRef.current = session?.user;
  const enviarFallas = useCallback(() => {
    const user = usuarioRef.current;
    if (!user?.id || !session?.token || !fallasPendientes(user.id).length || Date.now() - ultimoEnvioFallasRef.current < 30000) return;
    ultimoEnvioFallasRef.current = Date.now();
    enviarFallasPendientes(user.id, async (fallas) => {
      const response = await fetch(`${API_URL}/fallas`, {
        method: "POST", credentials: "include", cache: "no-store",
        headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fallas })
      });
      return response.ok;
    });
  }, [session?.token]);
  useEffect(() => {
    const alVolver = () => { ultimoEnvioFallasRef.current = 0; enviarFallas(); };
    window.addEventListener("online", alVolver);
    enviarFallas();
    return () => window.removeEventListener("online", alVolver);
  }, [enviarFallas]);

  const apiFetch = useCallback(async (path, options = {}) => {
    const headers = new Headers(options.headers ?? {});

    if (session?.token) {
      headers.set("Authorization", `Bearer ${session.token}`);
    }

    const { revalidate, ...fetchOptions } = options;
    const cacheKey = revalidate && !session?.user?.preview ? `${session?.token} ${session?.user?.role} ${fetchOptions.method ?? "GET"} ${path}` : "";
    const cached = cacheKey ? apiRevalidateCacheRef.current.get(cacheKey) : null;

    if (cached?.etag) {
      headers.set("If-None-Match", cached.etag);
    }

    marcarPeticionInicio();
    try {
      let response;
      try {
        response = await fetch(`${API_URL}${path}`, {
          ...fetchOptions,
          cache: fetchOptions.cache ?? "no-store",
          credentials: fetchOptions.credentials ?? "include",
          headers
        });
      } catch (error) {
        // La petición ni siquiera salió (sin señal): queda anotada para "Fallas del equipo".
        if (error?.name !== "AbortError") anotarFallaSinSenal(usuarioRef.current, { metodo: fetchOptions.method || "GET", ruta: path, mensaje: "Sin conexión con el servidor." });
        throw error;
      }
      if (response.ok) enviarFallas();

      if (cacheKey) {
        if (response.status === 304 && cached) {
          // Se devuelve una respuesta equivalente para que quien llama siga
          // haciendo `await response.json()` sin enterarse del 304.
          return new Response(cached.body, {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }

        if (response.ok) {
          const etag = response.headers.get("ETag");
          if (etag) {
            const body = await response.clone().text();
            apiRevalidateCacheRef.current.set(cacheKey, { etag, body });
          } else {
            apiRevalidateCacheRef.current.delete(cacheKey);
          }
        }
      }
      if (response.status === 401 && session?.token && !sessionInvalidatingRef.current) {
        sessionInvalidatingRef.current = true;
        clearSession();
        if (!intentionalLogoutRef.current) showAlert("Tu sesión venció. Ingresa de nuevo para continuar.");
      }
      return response;
    } finally {
      marcarPeticionFin();
    }
  }, [session?.token, session?.user?.role, session?.user?.preview, marcarPeticionInicio, marcarPeticionFin, enviarFallas]);

  return { showAlert, apiFetch };
}
