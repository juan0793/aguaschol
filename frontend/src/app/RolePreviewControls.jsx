import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { API_URL } from "../config/api";
import { AUTH_STORAGE_KEY } from "../constants/storageKeys";
import { getDefaultWorkspaceView } from "../utils/appShell";
import { getPathForWorkspaceView } from "../components/sidebar/sidebarConfig";
import { Icon } from "../components/Icon";
import "./rolePreview.css";

const ROLES = [
  ["gerente", "Gerente General", "Tablero de supervisión, cartera e informes."],
  ["operator", "Técnico / Operador", "Empieza en Inspecciones, con permisos de operador."],
  ["validadora_campo", "Validación de campo", "Empieza en Inspecciones, con permisos de validación."],
  ["transport", "Transporte", "Empieza en Transporte."]
];
const roleName = (role) => ROLES.find(([key]) => key === role)?.[1] || role;

function useRolePreviewSwitch(session) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const change = async (role) => {
    setBusy(true); setError("");
    let rejected = false;
    try {
      const response = await fetch(`${API_URL}/auth/preview`, {
        method: role ? "POST" : "DELETE", credentials: "include", cache: "no-store",
        headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
        ...(role ? { body: JSON.stringify({ role }) } : {})
      });
      const data = await response.json();
      if (!response.ok || !data.user) {
        rejected = response.status < 500;
        throw new Error(data.message || "No se pudo cambiar el modo.");
      }
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ ...session, user: data.user }));
      // Recargar descarta consultas, respuestas y componentes del perfil anterior.
      window.location.replace(getPathForWorkspaceView(data.user.preview && data.user.role === "transport" ? "transport" : getDefaultWorkspaceView(data.user.role)));
    } catch (err) {
      // Una respuesta perdida puede ocurrir después del commit: revalidar antes de reutilizar la interfaz.
      if (!rejected) { window.location.reload(); return; }
      setError(err.message); setBusy(false);
    }
  };
  return { busy, error, change };
}

const minutesUntil = (expiresAt) => Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 60000));

function useMinutesLeft(expiresAt) {
  const [minutes, setMinutes] = useState(() => minutesUntil(expiresAt));
  useEffect(() => {
    setMinutes(minutesUntil(expiresAt));
    const timer = window.setInterval(() => setMinutes(minutesUntil(expiresAt)), 15000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  return Number.isFinite(minutes) ? minutes : 0;
}

// Barra visible solo mientras dura la prueba: quién soy ahora, cuánto falta y cómo volver.
export default function RolePreviewBar({ session }) {
  const preview = session.user.preview;
  const { busy, error, change } = useRolePreviewSwitch(session);
  const minutes = useMinutesLeft(preview?.expires_at);
  if (!preview) return null;
  const expired = preview.expired || minutes === 0;
  const time = expired ? "La prueba venció" : minutes === 1 ? "Queda 1 minuto" : `Quedan ${minutes} minutos`;
  return <section className={`role-preview-bar no-print${expired ? " is-expired" : minutes <= 3 ? " is-ending" : ""}`} aria-label="Prueba de perfil">
    <Icon name="eye" className="role-preview-bar-icon" />
    <p className="role-preview-bar-copy">
      <span>Viendo como <strong>{roleName(session.user.role)}</strong></span>
      <span className="role-preview-bar-meta">Solo lectura · <span aria-live="polite">{time}</span></span>
    </p>
    {error ? <p className="role-preview-bar-error" role="alert">{error}</p> : null}
    <button type="button" className="role-preview-bar-exit" onClick={() => change(null)} disabled={busy}>
      <Icon name="arrowLeft" />{busy ? "Volviendo…" : <><span className="role-preview-long">Volver a administrador</span><span className="role-preview-short">Volver</span></>}
    </button>
  </section>;
}

// Selector que abre la acción "Probar como otro rol" del menú de cuenta.
export function RolePreviewPicker({ session, anchor, onClose }) {
  const [role, setRole] = useState("gerente");
  const [position, setPosition] = useState(null);
  const { busy, error, change } = useRolePreviewSwitch(session);
  const panelRef = useRef(null);

  useLayoutEffect(() => {
    const place = () => {
      const rect = anchor?.getBoundingClientRect();
      if (!rect || window.innerWidth <= 640) { setPosition(null); return; }
      const sidebar = anchor.closest(".control-sidebar")?.getBoundingClientRect();
      setPosition({ left: Math.round((sidebar?.right ?? rect.right) + 10), bottom: Math.max(12, Math.round(window.innerHeight - rect.bottom)) });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [anchor]);

  useEffect(() => {
    panelRef.current?.querySelector("input:checked")?.focus();
    const onKey = (event) => { if (event.key === "Escape" && !busy) { onClose(); anchor?.focus(); } };
    const onPointer = (event) => { if (!busy && !panelRef.current?.contains(event.target) && !anchor?.contains(event.target)) onClose(); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onPointer); };
  }, [anchor, busy, onClose]);

  return <>
    {!position ? <div className="role-preview-scrim no-print" aria-hidden="true" /> : null}
    <form ref={panelRef} className={`role-preview-picker no-print${position ? "" : " is-sheet"}`} style={position || undefined}
      role="dialog" aria-labelledby="role-preview-title" aria-describedby="role-preview-note"
      onSubmit={(event) => { event.preventDefault(); change(role); }}>
      <header>
        <h2 id="role-preview-title">Probar como otro rol</h2>
        <button type="button" className="role-preview-close" onClick={onClose} disabled={busy} aria-label="Cerrar"><Icon name="close" /></button>
      </header>
      <fieldset disabled={busy}>
        <legend className="sr-only">Perfil</legend>
        {ROLES.map(([key, name, description]) => <label key={key} className={role === key ? "is-selected" : ""}>
          <input type="radio" name="role-preview" value={key} checked={role === key} onChange={() => setRole(key)} />
          <span><strong>{name}</strong><small>{description}</small></span>
        </label>)}
      </fieldset>
      <p id="role-preview-note" className="role-preview-note">Solo lectura durante 15 minutos. Tu cuenta sigue siendo administradora y el cambio queda en la bitácora.</p>
      {error ? <p className="role-preview-picker-error" role="alert">{error}</p> : null}
      <button type="submit" className="role-preview-start" disabled={busy}><Icon name="eye" />{busy ? "Cambiando…" : `Ver como ${roleName(role)}`}</button>
    </form>
  </>;
}
