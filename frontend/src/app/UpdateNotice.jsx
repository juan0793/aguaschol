import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { canSeeUpdateNotice, currentEntryScript, entryScriptOf, hasNewVersion } from "../utils/appVersion";
import "./updateNotice.css";

const CHECK_EVERY_MS = 5 * 60 * 1000;
const FIRST_CHECK_MS = 30 * 1000;
const SNOOZE_MS = 60 * 60 * 1000;

// Aviso de versión nueva para toda cuenta con sesión. Nunca recarga solo: así no se
// interrumpe lo que alguien esté escribiendo o capturando en campo.
export default function UpdateNotice({ session }) {
  const eligible = canSeeUpdateNotice(session?.user);
  const [available, setAvailable] = useState(() => import.meta.env.DEV && Boolean(window.__controlAguasForceUpdate));
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!eligible || !import.meta.env.PROD) return undefined;
    const current = currentEntryScript();
    if (!current) return undefined;
    let stopped = false;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/", { cache: "no-store", credentials: "same-origin" });
        if (!response.ok || stopped) return;
        if (hasNewVersion(current, entryScriptOf(await response.text())) && !stopped) { setAvailable(true); setTick((value) => value + 1); }
      } catch { /* sin red: se vuelve a intentar en la siguiente revisión */ }
    };
    const first = window.setTimeout(check, FIRST_CHECK_MS);
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", check);
    return () => { stopped = true; window.clearTimeout(first); window.clearInterval(timer); document.removeEventListener("visibilitychange", check); };
  }, [eligible]);

  if (!eligible || !available || Date.now() < snoozedUntil) return null;
  return <section className="update-notice no-print" role="status" aria-live="polite" aria-labelledby="update-notice-title">
    <Icon name="refresh" className="update-notice-icon" />
    <div className="update-notice-copy">
      <strong id="update-notice-title">Hay una nueva actualización disponible</strong>
      <span>Guarda lo que estés haciendo y actualiza para usar la versión más reciente.</span>
    </div>
    <div className="update-notice-actions">
      <button type="button" className="update-notice-later" onClick={() => setSnoozedUntil(Date.now() + SNOOZE_MS)}>Más tarde</button>
      <button type="button" className="update-notice-apply" onClick={() => window.location.reload()}>Actualizar</button>
    </div>
  </section>;
}
