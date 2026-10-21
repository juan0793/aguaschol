import { useState } from "react";
import { Icon } from "../../../components/Icon";

// Administracion o Gerencia mandan al tecnico del lote un mensaje predefinido sobre
// un documento no entregado. Llega a su campana; el texto nunca lleva montos.
export default function AvisoTecnico({ api, documento, plantillas = [], notify, onEnviado, onCancel }) {
  const [plantilla, setPlantilla] = useState(plantillas[0]?.codigo || "");
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const elegida = plantillas.find((item) => item.codigo === plantilla);
  const notaObligatoria = plantilla === "OTRO";
  const listo = plantilla && (!notaObligatoria || nota.trim().length >= 5);
  const responsable = documento.responsable_nombre || "el técnico del lote";

  const enviar = async (event) => {
    event.preventDefault();
    if (!listo || enviando) return;
    setEnviando(true);
    try {
      const actualizado = await api.avisarTecnico(documento.id, { plantilla, nota: nota.trim() });
      notify(`Aviso enviado a ${responsable}.`);
      setNota("");
      onEnviado?.(actualizado);
    } catch (error) {
      notify(error.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="ent-aviso" onSubmit={enviar}>
      <label className="cl-field">
        Mensaje para {responsable}
        <select value={plantilla} onChange={(event) => setPlantilla(event.target.value)} disabled={enviando}>
          {plantillas.map((item) => <option key={item.codigo} value={item.codigo}>{item.etiqueta}</option>)}
        </select>
      </label>
      {elegida?.texto ? <p className="ent-aviso-texto">{elegida.texto}</p> : null}
      <label className="cl-field">
        {notaObligatoria ? "Mensaje" : "Nota (opcional)"}
        <textarea rows={2} maxLength={300} value={nota} onChange={(event) => setNota(event.target.value)} disabled={enviando}
          placeholder={notaObligatoria ? "Escribe lo que necesita saber el técnico" : "Se agrega al final del mensaje"} />
      </label>
      <div className="ent-aviso-acciones">
        {onCancel ? <button type="button" className="cl-quiet" onClick={onCancel} disabled={enviando}>Cancelar</button> : null}
        <button type="submit" className="cl-primary" disabled={!listo || enviando}>
          <Icon name="send" />
          {enviando ? "Enviando…" : "Enviar aviso"}
        </button>
      </div>
    </form>
  );
}
