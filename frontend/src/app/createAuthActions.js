import { API_URL } from "../config/api";
import { AUTH_STORAGE_KEY } from "../constants/storageKeys";
import { getWorkspaceViewByRole, readJsonResponse } from "../utils/appShell";
import { pause } from "../utils/printDocument";

export function createAuthActions({
  apiFetch,
  clearSession,
  intentionalLogoutRef,
  loadAuditLogs,
  loginForm,
  passwordForm,
  session,
  sessionInvalidatingRef,
  setAuthFx,
  setChangingPassword,
  setLoginForm,
  setLoginLoading,
  setPasswordFeedback,
  setPasswordForm,
  setSession,
  setSessionVerified,
  setShowPasswordModal,
  setWorkspaceView,
  showAlert
}) {
  const handleLoginChange = (event) => {
    const { name, value } = event.target;
    setLoginForm((current) => ({ ...current, [name]: value }));
  };

  const handlePasswordFormChange = (event) => {
    const { name, value } = event.target;
    setPasswordFeedback("");
    setPasswordForm((current) => ({ ...current, [name]: value }));
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    intentionalLogoutRef.current = false;
    setLoginLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(loginForm)
      }).catch(() => {
        throw new Error("No se pudo conectar con la API. Revisa que el backend este disponible.");
      });
      const data = await readJsonResponse(
        response,
        "La API no devolvio JSON. Revisa que el backend este disponible y que la base de datos este lista."
      );

      if (!response.ok) {
        throw new Error(data.message || "No fue posible iniciar sesión.");
      }

      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
      sessionInvalidatingRef.current = false;
      setSessionVerified(true);
      setAuthFx({ mode: "login", text: "Abriendo sesión..." });
      await pause(550);
      setSession(data);
      setShowPasswordModal(Boolean(data?.user?.force_password_change));
      setPasswordFeedback("");
      setPasswordForm({
        current_password: loginForm.password,
        new_password: "",
        confirm_password: ""
      });
      setWorkspaceView(getWorkspaceViewByRole(data?.user?.role));
    } catch (error) {
      showAlert(error.message);
    } finally {
      setAuthFx(null);
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    intentionalLogoutRef.current = true;
    try {
      setAuthFx({ mode: "logout", text: "Cerrando sesión..." });
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // The local session should still be removed even if the request fails.
    } finally {
      await pause(450);
      clearSession();
      // Quien entre despues no debe caer en la ultima vista de esta sesion.
      window.history.replaceState(null, "", "/");
      setAuthFx(null);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    setPasswordFeedback("");

    if (!passwordForm.current_password.trim()) {
      setPasswordFeedback("Ingresa la contraseña actual.");
      return;
    }

    if (passwordForm.new_password.trim().length < 8) {
      setPasswordFeedback("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordFeedback("La confirmación de la nueva contraseña no coincide.");
      return;
    }

    setChangingPassword(true);

    try {
      const response = await apiFetch("/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(passwordForm)
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No se pudo actualizar la contraseña.");
      }

      const nextSession = {
        ...session,
        user: data.user
      };

      setSession(nextSession);
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
      setShowPasswordModal(false);
      setPasswordFeedback("");
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: ""
      });
      showAlert("Contraseña actualizada correctamente.");
      loadAuditLogs();
    } catch (error) {
      setPasswordFeedback(error.message || "No se pudo actualizar la contraseña.");
      showAlert(error.message || "No se pudo actualizar la contraseña.");
    } finally {
      setChangingPassword(false);
    }
  };

  return { handleLoginChange, handlePasswordFormChange, handleLogin, handleLogout, handleChangePassword };
}
