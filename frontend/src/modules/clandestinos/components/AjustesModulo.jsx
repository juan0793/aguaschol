import { useState } from "react";
import { Icon } from "../../../components/Icon";

/**
 * Ajustes del módulo que administración cambia sin tocar código. Hoy: el "Analista de
 * datos" que firma las fichas técnicas. Se aplica a las fichas nuevas (las que ya tienen
 * analista conservan el suyo: son documentos ya emitidos).
 */
export default function AjustesModulo({ api, ajustes = {}, notify, onSaved }) {
  const [analista, setAnalista] = useState(ajustes.analista_datos || "");
  const [guardando, setGuardando] = useState(false);
  const cambio = analista.trim() !== (ajustes.analista_datos || "").trim();
  const guardar = async (event) => {
    event.preventDefault();
    if (!analista.trim()) { notify?.("Escribe el nombre del analista de datos."); return; }
    setGuardando(true);
    try {
      const { ajustes: nuevos } = await api.saveAjustes({ analista_datos: analista });
      onSaved?.(nuevos);
      setAnalista(nuevos.analista_datos || "");
      notify?.("Analista de datos guardado. Las fichas nuevas saldrán con ese nombre.");
    } catch (error) { notify?.(error.message); } finally { setGuardando(false); }
  };
  return <form className="cl-ajustes" onSubmit={guardar} aria-labelledby="cl-ajustes-title">
    <header>
      <h3 id="cl-ajustes-title">Firmas de la ficha técnica</h3>
      <p>El técnico que levanta la ficha se toma de quien la manda a ficha. El analista de datos es fijo y se cambia aquí.</p>
    </header>
    <label className="cl-field">
      <span>Analista de datos</span>
      <input value={analista} maxLength={180} onChange={(event) => setAnalista(event.target.value)} placeholder="Ej. Ing. Juan Ordoñez Bonilla" />
    </label>
    <button type="submit" className="cl-primary" disabled={guardando || !cambio}><Icon name="checkCircle" />{guardando ? "Guardando…" : "Guardar"}</button>
    <small>Se aplica a las fichas nuevas. Las que ya tienen analista conservan el suyo.</small>
  </form>;
}
