import { useEffect } from "react";
import { API_URL } from "../config/api";
import { AUTH_STORAGE_KEY, SIDEBAR_COLLAPSED_STORAGE_KEY } from "../constants/storageKeys";
import { getDefaultWorkspaceView } from "../utils/appShell";
import { getPathForWorkspaceView } from "../components/sidebar/sidebarConfig";
import { installSearchScrollGuard } from "../utils/searchScrollGuard";
import { MANAGER_NAVIGATION } from "../utils/roleAccess.js";
import { sessionMode } from "../utils/rolePreview.js";

export function useAppShellEffects({
  apiFetch,
  clearSession,
  intentionalLogoutRef,
  isAdmin,
  isAuthenticated,
  isFieldValidator,
  mustChangePassword,
  session,
  sessionInvalidatingRef,
  setIsCompactMapView,
  setSession,
  setSessionVerified,
  setShowMobileModuleMenu,
  setShowPasswordModal,
  setShowUserMenu,
  setUnreadMessagesCount,
  setWorkspaceView,
  showAlert,
  sidebarCollapsed,
  workspaceView
}) {
  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(max-width: 768px), (pointer: coarse)");
    if (!mediaQuery) return undefined;

    const handleChange = () => setIsCompactMapView(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener?.("change", handleChange);
    return () => mediaQuery.removeEventListener?.("change", handleChange);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      setShowMobileModuleMenu(false);
      setShowUserMenu(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    if (!session?.token) return undefined;

    let cancelled = false;
    let verifiedOnce = false;
    const refreshStoredSession = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          cache: "no-store",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${session.token}`
          }
        });

        if (cancelled) return;
        if (response.status === 401) {
          sessionInvalidatingRef.current = true;
          clearSession();
          if (!intentionalLogoutRef.current) showAlert("Tu sesión venció. Ingresa de nuevo para continuar.");
          return;
        }
        if (!response.ok) {
          if (!verifiedOnce) setSessionVerified(false);
          return;
        }

        const data = await response.json();
        if (!data?.user) return;
        if (sessionMode(session) !== sessionMode({ user: data.user })) {
          window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ ...session, user: data.user }));
          window.location.reload();
          return;
        }

        setSession((current) => {
          if (current?.token !== session.token) return current;
          const nextSession = { ...current, user: data.user };
          window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
          return nextSession;
        });
        sessionInvalidatingRef.current = false;
        verifiedOnce = true;
        setSessionVerified(true);
      } catch {
        setSessionVerified(verifiedOnce || (!session.user?.preview && session.user?.role !== "admin"));
      }
    };

    refreshStoredSession();
    const timer = session.user?.preview || session.user?.role === "admin" ? window.setInterval(refreshStoredSession, 60000) : null;
    const handleVisibility = () => { if (document.visibilityState === "visible") refreshStoredSession(); };
    const handleStorage = (event) => {
      if (event.key === AUTH_STORAGE_KEY && event.oldValue !== event.newValue) {
        let next;
        try { next = JSON.parse(event.newValue); } catch { next = null; }
        if (next?.token !== session.token || sessionMode(next) !== sessionMode(session)) window.location.reload();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("storage", handleStorage);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("storage", handleStorage);
    };
  }, [session?.token, showAlert]);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowPasswordModal(false);
      return;
    }

    if (mustChangePassword) {
      setShowPasswordModal(true);
    }
  }, [isAuthenticated, mustChangePassword]);

  // Cargar conteo de mensajes sin leer periodicamente
  useEffect(() => {
    if (!isAuthenticated || !session?.user?.id || session.user.role === "gerente" || session.user.preview) return;

    const loadUnreadMessagesCount = async () => {
      try {
        const response = await apiFetch("/profile");
        const data = await response.json();
        if (response.ok && data.messages) {
          const unreadCount = (data.messages ?? []).filter(
            (m) => m.recipient_user_id === session.user.id && !m.read_at
          ).length;
          setUnreadMessagesCount(unreadCount);
        }
      } catch (error) {
        console.error("Error cargando conteo de mensajes:", error);
      }
    };

    // Cargar al iniciar
    loadUnreadMessagesCount();

    // Actualizar cada 30 segundos
    const intervalId = window.setInterval(loadUnreadMessagesCount, 30000);

    return () => window.clearInterval(intervalId);
  }, [isAuthenticated, session?.user?.id, session?.user?.role, apiFetch]);

  useEffect(() => {
    const allowedViews = session?.user?.preview && session.user.role === "transport" ? ["transport"] : session?.user?.role === "gerente" ? ["dashboard", ...MANAGER_NAVIGATION.map((item) => item.key)] : isFieldValidator
      ? ["reclamos", "profile", "inspecciones", "entregas", "records", "lookup", "sigTerritorial", "map", "fieldValidation", "planos"]
      : ["reclamos", "profile", "inspecciones", "entregas", "records", "lookup", "sigTerritorial", "map", "planos"];
    if (isAuthenticated && !isAdmin && !allowedViews.includes(workspaceView)) {
      const defaultView = getDefaultWorkspaceView(session?.user?.role);
      setWorkspaceView(allowedViews.includes(defaultView) ? defaultView : allowedViews[0]);
    }
  }, [isAuthenticated, isAdmin, isFieldValidator, session?.user?.role, workspaceView]);

  // Buscadores sin saltos: al filtrar mientras se escribe, la página no se acorta
  // bajo la vista (ver utils/searchScrollGuard.js).
  useEffect(() => installSearchScrollGuard(), []);

  // La direccion refleja la vista abierta: recargar o compartir el enlace lleva al mismo
  // lugar. replaceState porque la app no escucha popstate; el hash de cada modulo se conserva.
  useEffect(() => {
    if (!isAuthenticated) return;
    const path = getPathForWorkspaceView(workspaceView);
    if (window.location.pathname !== path) {
      window.history.replaceState(window.history.state, "", `${path}${window.location.search}${window.location.hash}`);
    }
  }, [isAuthenticated, workspaceView]);

  useEffect(() => {
    setShowMobileModuleMenu(false);
    window.scrollTo(0, 0);
  }, [workspaceView]);
}
