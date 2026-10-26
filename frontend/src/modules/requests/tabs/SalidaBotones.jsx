import { useState } from "react";
import { Icon } from "../../../components/Icon";

// Los dos botones de salida de cada consulta: imprimir (vista previa) y guardar el PDF
// directo, que sale con el mismo diseño. `onSalida(modo)` recibe "imprimir" o "pdf".
export default function SalidaBotones({ onSalida, disabled = false, notify, imprimir = "Imprimir", primario = false }) {
  const [guardando, setGuardando] = useState(false);
  const clase = `pq-btn${primario ? " is-primary" : ""}`;
  const guardarPdf = async () => {
    setGuardando(true);
    try {
      await onSalida("pdf");
    } catch (error) {
      notify?.(error.message || "No se pudo generar el PDF.");
    } finally {
      setGuardando(false);
    }
  };
  return <>
    <button type="button" className={clase} onClick={() => onSalida("imprimir")} disabled={disabled}><Icon name="print" />{imprimir}</button>
    <button type="button" className={clase} onClick={guardarPdf} disabled={disabled || guardando}><Icon name="download" className={guardando ? "ds-icon-spin" : ""} />{guardando ? "Guardando PDF…" : "Guardar PDF"}</button>
  </>;
}
