import { useState } from "react";
import { AUTH_STORAGE_KEY } from "../constants/storageKeys";

export function useSessionState() {
  const [session, setSession] = useState(() => {
    const saved = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!saved) return null;

    try {
      return JSON.parse(saved);
    } catch {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
  });
  // Valida la sesión guardada antes de montar los módulos protegidos; una sesión
  // vencida no debe disparar todas las consultas del tablero en paralelo.
  const [sessionVerified, setSessionVerified] = useState(
    () => !window.localStorage.getItem(AUTH_STORAGE_KEY)
  );
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: ""
  });
  const [authFx, setAuthFx] = useState(null);

  return {
    session,
    setSession,
    sessionVerified,
    setSessionVerified,
    loginForm,
    setLoginForm,
    loginLoading,
    setLoginLoading,
    showLoginPassword,
    setShowLoginPassword,
    changingPassword,
    setChangingPassword,
    showPasswordModal,
    setShowPasswordModal,
    passwordFeedback,
    setPasswordFeedback,
    passwordForm,
    setPasswordForm,
    authFx,
    setAuthFx
  };
}
