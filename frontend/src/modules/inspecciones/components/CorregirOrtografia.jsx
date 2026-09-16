import { useState } from "react";
import { Icon } from "../../../components/Icon";
import { polishInspectionText } from "../utils/inspectionPrintText";

// Atributos para que el navegador y el teclado del teléfono marquen y autocorrijan en español
// mientras el técnico escribe.
export const SPELLCHECK_PROPS = { spellCheck: true, lang: "es", autoCapitalize: "sentences", autoCorrect: "on" };

/**
 * Botón "Corregir ortografía" bajo un campo de texto libre. Usa la IA del backend y, si no está
 * disponible, la corrección básica local. El resultado reemplaza el texto y se puede deshacer
 * mientras el técnico no vuelva a escribir.
 */
export default function CorregirOrtografia({ api, value, onApply, disabled = false }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [undo, setUndo] = useState(null);

  const texto = String(value ?? "");
  const puedeDeshacer = undo && undo.applied === texto;

  const corregir = async () => {
    if (!texto.trim()) return;
    setBusy(true);
    setNote("");
    let corregido;
    let mensaje;
    try {
      corregido = (await api.corregirTexto(texto)).text;
      mensaje = "Ortografía corregida.";
    } catch {
      corregido = polishInspectionText(texto);
      mensaje = "Corrección básica aplicada.";
    } finally {
      setBusy(false);
    }
    if (!corregido || corregido.trim() === texto.trim()) {
      setUndo(null);
      setNote("No se encontraron errores.");
      return;
    }
    onApply(corregido);
    setUndo({ previous: texto, applied: corregido });
    setNote(mensaje);
  };

  const deshacer = () => {
    onApply(undo.previous);
    setUndo(null);
    setNote("");
  };

  return (
    <div className="ins-spell">
      <button type="button" className="ins-spell-btn" disabled={disabled || busy || !texto.trim()} onClick={corregir}>
        <Icon name={busy ? "refresh" : "spellCheck"} className={busy ? "is-spinning" : ""} />
        {busy ? "Corrigiendo…" : "Corregir ortografía"}
      </button>
      {note && (puedeDeshacer || !undo) ? <small role="status">{note}</small> : null}
      {puedeDeshacer ? <button type="button" className="ins-spell-undo" onClick={deshacer}>Deshacer</button> : null}
    </div>
  );
}
