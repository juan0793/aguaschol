import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import EntregasDrawer from "./EntregasDrawer";
import LoteSobrantesPrint from "../print/LoteSobrantesPrint";
import { estadoLoteLabel, formatDate, formatNumber, tipoDocumentoLabel } from "../utils/entregasFormatters";

// Textos de la marcha atras administrativa. Reabrir es la unica via de vuelta de
// un lote cerrado; eliminar exige que ya este abierto, para que el motivo del
// cierre revertido quede registrado antes del borrado.
const ACCIONES = {
  reabrir: {
    titulo: "Reabrir lote",
    aviso: "El lote vuelve a estado abierto y admite edición, altas de no entregadas y un cierre corregido. El informe semanal ya emitido no cambia.",
    etiqueta: "Motivo de la reapertura",
    confirmar: "Confirmar reapertura",
    ok: "Lote reabierto. Corrige los datos y vuelve a cerrarlo."
  },
  eliminar: {
    titulo: "Eliminar lote",
    aviso: "Se borra el lote junto con sus documentos no entregados, intentos y avisos. No se puede deshacer; queda constancia en la auditoría.",
    etiqueta: "Motivo del borrado",
    confirmar: "Eliminar definitivamente",
    ok: "Lote eliminado."
  }
};

export default function LoteDetalle({ lote, permissions, motivos = [], api, notify, onClose, onEdit, onCerrar, onChanged, onDeleted }) {
  const [nota, setNota] = useState(lote.observacion_responsable || "");
  const [saving, setSaving] = useState(false);
  const [accion, setAccion] = useState("");
  const [motivo, setMotivo] = useState("");
  // El acta se monta fuera de pantalla en cuanto el lote tiene sobrantes, para
  // que el logo ya este cargado cuando se dispare la impresion. `intento` solo
  // existe para volver a imprimir sin cambiar nada mas.
  const [impresion, setImpresion] = useState({ en: "", intento: 0 });
  const abierto = lote.estado === "ABIERTO";
  const sobrantes = lote.no_entregadas || [];

  useEffect(() => {
    if (!impresion.intento) return undefined;
    const temporizador = setTimeout(() => window.print(), 60);
    return () => clearTimeout(temporizador);
  }, [impresion]);

  // La marca en <body> es la que saca la aplicacion del flujo al imprimir. Va
  // por eventos para que Ctrl+P con el cajon abierto se comporte igual que el
  // boton, y se limpia siempre al desmontar.
  useEffect(() => {
    if (!sobrantes.length) return undefined;
    const marcar = () => document.body.classList.add("ent-imprimiendo-acta");
    const limpiar = () => document.body.classList.remove("ent-imprimiendo-acta");
    window.addEventListener("beforeprint", marcar);
    window.addEventListener("afterprint", limpiar);
    return () => {
      window.removeEventListener("beforeprint", marcar);
      window.removeEventListener("afterprint", limpiar);
      limpiar();
    };
  }, [sobrantes.length]);

  const imprimirSobrantes = () => {
    // beforeprint no es universal; marcar aqui tambien es idempotente.
    document.body.classList.add("ent-imprimiendo-acta");
    setImpresion((actual) => ({ en: new Date().toISOString(), intento: actual.intento + 1 }));
  };
  const dialogo = ACCIONES[accion];
  const guardarNota = async () => {
    if (!nota.trim()) return;
    setSaving(true);
    try { await api.actualizarLote(lote.id, { observacion_responsable: nota }); onChanged(); notify("Justificación registrada. El lote continúa pendiente de cierre."); }
    catch (error) { notify(error.message); }
    finally { setSaving(false); }
  };
  const confirmarAccion = async () => {
    if (motivo.trim().length < 5) { notify("Escribe un motivo de al menos 5 caracteres."); return; }
    setSaving(true);
    try {
      if (accion === "eliminar") { await api.eliminarLote(lote.id, { motivo: motivo.trim() }); notify(dialogo.ok); onDeleted(); return; }
      await api.reabrirLote(lote.id, { motivo: motivo.trim() });
      setAccion(""); setMotivo(""); onChanged(); notify(dialogo.ok);
    }
    catch (error) { notify(error.message); }
    finally { setSaving(false); }
  };
  const pedir = (siguiente) => { setAccion(siguiente); setMotivo(""); };
  return <><EntregasDrawer title={`Detalle del lote ${lote.id}`} onClose={onClose} busy={saving}>
    <header><div><span className="cl-kicker">Lote #{lote.id} · {estadoLoteLabel(lote.estado)}</span><h2>{lote.responsable_nombre}</h2><p>{formatDate(lote.fecha)} · {lote.barrio_nombre} · {tipoDocumentoLabel(lote.tipo_documento)}</p></div><button type="button" className="cl-icon-button" aria-label="Cerrar detalle" onClick={onClose} disabled={saving}>✕</button></header>
    <div className="cl-drawer-scroll">
      <dl className="ent-metrics"><div><dt>Asignadas</dt><dd>{formatNumber(lote.total_asignadas)}</dd></div><div><dt>Entregadas</dt><dd>{abierto ? "—" : formatNumber(lote.total_entregadas)}</dd></div><div><dt>No entregadas</dt><dd>{abierto ? "—" : formatNumber(lote.total_sobrantes)}</dd></div></dl>
      {!abierto ? <p className="ent-close-receipt">Cerrado por <strong>{lote.closed_by_nombre || `Usuario #${lote.closed_by || "—"}`}</strong><br />{lote.closed_at ? new Date(lote.closed_at).toLocaleString("es-HN") : "Sin fecha de cierre registrada"}</p> : <p className="cl-alert">Este lote debe cerrarse al finalizar el recorrido. Una justificación no sustituye el cierre.</p>}
      <section className="ent-card"><h3>Observaciones</h3><p>{lote.observacion_inicial || "Sin observaciones iniciales."}</p><p>{lote.observacion_responsable || "Sin observaciones del responsable."}</p></section>
      {abierto && permissions.can_edit_lote ? <section className="ent-card"><label className="cl-field">Justificar cierre pendiente<textarea rows={3} value={nota} onChange={(event) => setNota(event.target.value)} placeholder="Explica por qué el recorrido sigue abierto" /></label><button type="button" className="cl-secondary" disabled={saving || !nota.trim()} onClick={guardarNota}>Guardar justificación</button></section> : null}
      <section className="ent-card"><div className="ent-card-head"><h3>Documentos no entregados ({sobrantes.length})</h3>{sobrantes.length ? <button type="button" className="cl-secondary" onClick={imprimirSobrantes}>Imprimir acta</button> : null}</div>{sobrantes.length ? <ul className="ent-detail-documents">{sobrantes.map((item) => <li key={item.id}><strong>{item.numero_abonado || item.clave_catastral}</strong><span>{item.abonado_nombre || item.clave_catastral}</span><small>{motivos.find((opcion) => opcion.codigo === item.motivo)?.etiqueta || String(item.motivo || "").replaceAll("_", " ")} · {item.estado.replaceAll("_", " ")}</small>{item.observacion ? <p>{item.observacion}</p> : null}</li>)}</ul> : <p>No se han registrado documentos sobrantes.</p>}</section>
      {dialogo ? <section className={`ent-card ent-danger-zone${accion === "eliminar" ? " is-critical" : ""}`}><h3>{dialogo.titulo}</h3><p>{dialogo.aviso}</p><label className="cl-field">{dialogo.etiqueta}<textarea rows={2} autoFocus value={motivo} onChange={(event) => setMotivo(event.target.value)} maxLength={255} placeholder="Queda registrado en la auditoría" /></label><div className="ent-danger-actions"><button type="button" className="cl-quiet" disabled={saving} onClick={() => pedir("")}>Cancelar</button><button type="button" className={accion === "eliminar" ? "cl-danger" : "cl-primary"} disabled={saving || motivo.trim().length < 5} onClick={confirmarAccion}>{saving ? "Procesando…" : dialogo.confirmar}</button></div></section> : null}
      {!dialogo && (permissions.can_reopen_lote || permissions.can_delete_lote) ? <section className="ent-card ent-danger-zone"><h3>Corrección administrativa</h3><p>{abierto ? "Usa el borrado solo para lotes cargados por error." : "Reabre el lote si el cierre quedó mal registrado."}</p><div className="ent-danger-actions">{!abierto && permissions.can_reopen_lote ? <button type="button" className="cl-secondary" onClick={() => pedir("reabrir")}>Reabrir lote</button> : null}{abierto && permissions.can_delete_lote ? <button type="button" className="cl-secondary" onClick={() => pedir("eliminar")}>Eliminar lote</button> : null}</div></section> : null}
    </div>
    <footer className="ent-drawer-footer">{sobrantes.length ? <button type="button" className="cl-secondary" onClick={imprimirSobrantes}>Imprimir sobrantes</button> : null}{permissions.can_edit_lote && (abierto || permissions.can_force_close) ? <button type="button" className="cl-secondary" onClick={() => onEdit(lote)}>Editar lote</button> : null}{abierto && permissions.can_close_own_lote ? <button type="button" className="cl-primary" onClick={() => onCerrar(lote)}>Cerrar lote</button> : null}</footer>
  </EntregasDrawer>
  {/* Hija directa de <body> a proposito. Al imprimir se oculta #root con
      display:none y el acta queda como unico contenido en el flujo: si se
      dejara dentro del arbol de la app, el alto de la pagina completa se
      seguiria paginando como hojas en blanco. */}
  {sobrantes.length
    ? createPortal(
        <div className="ent-acta-portal">
          <LoteSobrantesPrint lote={lote} motivos={motivos} generadoEn={impresion.en} />
        </div>,
        document.body
      )
    : null}
  </>;
}
