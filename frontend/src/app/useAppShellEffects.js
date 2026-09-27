import { useEffect } from "react";
import { API_URL } from "../config/api";
import { AUTH_STORAGE_KEY, SIDEBAR_COLLAPSED_STORAGE_KEY } from "../constants/storageKeys";
import { getDefaultWorkspaceView } from "../utils/appShell";
import { getPathForWorkspaceView } from "../components/sidebar/sidebarConfig";
import { installSearchScrollGuard } from "../utils/searchScrollGuard";

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
          setSessionVerified(true);
          return;
        }

        const data = await response.json();
        if (!data?.user) return;

        setSession((current) => {
          if (current?.token !== session.token) return current;
          const nextSession = { ...current, user: data.user };
          window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
          return nextSession;
        });
        sessionInvalidatingRef.current = false;
        setSessionVerified(true);
      } catch {
        // Keep the stored session if the API is temporarily unreachable.
        setSessionVerified(true);
      }
    };

    refreshStoredSession();
    return () => {
      cancelled = true;
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
    if (!isAuthenticated || !session?.user?.id) return;

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
  }, [isAuthenticated, session?.user?.id, apiFetch]);

  useEffect(() => {
    const allowedViews = isFieldValidator
      ? ["profile", "inspecciones", "entregas", "records", "lookup", "sigTerritorial", "map", "fieldValidation", "planos"]
      : ["profile", "inspecciones", "entregas", "records", "lookup", "sigTerritorial", "map", "planos"];
    if (isAuthenticated && !isAdmin && !allowedViews.includes(workspaceView)) {
      const defaultView = getDefaultWorkspaceView(session?.user?.role);
      setWorkspaceView(allowedViews.includes(defaultView) ? defaultView : "records");
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
