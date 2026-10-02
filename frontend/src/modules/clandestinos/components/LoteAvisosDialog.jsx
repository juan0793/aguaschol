import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../../components/Icon";
import { diaLocal } from "../periodos";
import { etiquetaPlazo } from "../avisoPlazo";
import { LOTE_IMPRESION_MAX } from "../printing/loteImpresion";
import PlazoAvisoFields, { PLAZO_INICIAL, fechaLarga, fechaLimiteValida } from "./PlazoAvisoFields";
import { radioKeys, radioTabIndex } from "./radioKeys";

const DOCUMENTOS = [
  { key: "ambos", label: "Aviso y ficha técnica", detail: "Intercalados por inmueble" },
  { key: "avisos", label: "Solo avisos", detail: "Carta vertical" },
  { key: "fichas", label: "Solo fichas técnicas", detail: "Carta horizontal" }
];
const FIRMANTE = "Jefatura de Comercialización";
const CARGO = "Aguas de Choluteca";

// El valor que más se repite en la selección (o el de siempre si nadie lo tiene).
const masComun = (records, key, fallback) => {
  const counts = new Map();
  records.forEach((record) => { const value = String(record[key] || "").trim(); if (value) counts.set(value, (counts.get(value) || 0) + 1); });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || fallback;
};
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// Preparar e imprimir avisos y fichas técnicas de todas las fichas marcadas a la vez:
// el plazo, la fecha y la firma se guardan en cada ficha y luego sale una sola vista
// previa con todas las hojas.
export default function LoteAvisosDialog({ records, api, onPrint, onClose, onDone }) {
  const [documentos, setDocumentos] = useState("ambos");
  const [fechaAviso, setFechaAviso] = useState(() => diaLocal(new Date()));
  const [plazo, setPlazo] = useState(PLAZO_INICIAL);
  const [firmante, setFirmante] = useState(() => masComun(records, "firmante_aviso", FIRMANTE));
  const [cargo, setCargo] = useState(() => masComun(records, "cargo_firmante", CARGO));
  const [instrucciones, setInstrucciones] = useState("");
  const [fase, setFase] = useState("form"); // form | guardando | preparando | imprimiendo
  const [avance, setAvance] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const dialogRef = useRef(null);

  const avisos = documentos !== "fichas";
  const fichas = documentos !== "avisos";
  const ocupado = fase !== "form";
  const total = records.length;
  const excede = total > LOTE_IMPRESION_MAX;
  const fechaLimite = avisos ? fechaLimiteValida(fechaAviso, plazo) : null;
  const listo = total > 0 && !excede && (!avisos || Boolean(fechaLimite)) && (!avisos || firmante.trim());

  const datos = useMemo(() => ({
    sinClave: records.filter((record) => !String(record.clave_catastral || "").trim()).length,
    conPlazo: records.filter((record) => record.aviso_plazo_tipo).length,
    avisoImpreso: records.filter((record) => record.aviso_impreso_at).length,
    fichaImpresa: records.filter((record) => record.printed_at).length,
    plazos: new Set(records.map((record) => etiquetaPlazo(record)).filter(Boolean))
  }), [records]);
  const hojas = (avisos ? total : 0) + (fichas ? total : 0);

  // Foco: entra en la opción marcada (Enter no cierra por accidente), la página de
  // fondo queda inerte mientras el diálogo está abierto y al cerrar vuelve a donde estaba.
  useEffect(() => {
    const previous = document.body.style.overflow;
    const opener = document.activeElement;
    const root = document.getElementById("root");
    document.body.style.overflow = "hidden";
    if (root) root.inert = true;
    dialogRef.current?.querySelector('[role="radio"][aria-checked="true"]')?.focus();
    return () => {
      document.body.style.overflow = previous;
      if (root) root.inert = false;
      if (opener?.isConnected) opener.focus();
      else document.querySelector(".cl-bulk-actions .cl-primary")?.focus();
    };
  }, []);
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape" && !ocupado) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ocupado, onClose]);

  const preparar = async () => {
    if (!listo || ocupado) return;
    setError("");
    const ids = records.map((record) => record.id);
    try {
      setFase("guardando");
      const respuesta = avisos
        ? await api.avisoLote({ ids, fecha_aviso: fechaAviso, plazo, firmante_aviso: firmante, cargo_firmante: cargo, aviso_instrucciones: instrucciones })
        : await api.fichasPorIds(ids);
      const frescas = respuesta.items || [];
      if (!frescas.length) throw new Error("Ninguna de las fichas está activa.");
      setFase(fichas ? "preparando" : "imprimiendo");
      setAvance({ done: 0, total: frescas.length });
      const resultado = await onPrint(frescas, {
        avisos,
        fichas,
        onProgress: (next) => {
          setAvance(next);
          if (next.done === next.total) setFase("imprimiendo");
        }
      });
      onDone(frescas, { ...resultado, avisos, fichas, skipped: respuesta.skipped || [] });
    } catch (reason) {
      setError(reason.message || "No fue posible preparar el lote.");
      setFase("form");
    }
  };

  const estado = {
    guardando: avisos ? "Guardando fecha y plazo en las fichas…" : "Actualizando las fichas…",
    preparando: `Preparando fichas técnicas ${avance.done} de ${avance.total}…`,
    imprimiendo: "Vista previa abierta: revisa y pulsa «Imprimir ahora»."
  }[fase];

  return createPortal(
    <div className="cl-notice-backdrop cl-lote-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !ocupado && onClose()}>
      <section ref={dialogRef} className="cl-notice-editor cl-lote" role="dialog" aria-modal="true" aria-labelledby="cl-lote-title" aria-busy={ocupado}>
        <header>
          <div>
            <h2 id="cl-lote-title">Avisos y fichas técnicas</h2>
            <p>{plural(total, "ficha seleccionada", "fichas seleccionadas")} · una sola vista previa para todas.</p>
          </div>
          <button type="button" className="cl-icon-button" onClick={onClose} disabled={ocupado} aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </header>

        <div className="cl-notice-editor-body">
          {excede ? (
            <p className="cl-lote-alerta is-error" role="alert"><Icon name="warning" />Un lote admite hasta {LOTE_IMPRESION_MAX} fichas. Quita {total - LOTE_IMPRESION_MAX} de la selección o filtra por barrio.</p>
          ) : null}

          <section>
            <h3><Icon name="print" />Qué imprimir</h3>
            <div className="cl-lote-docs" role="radiogroup" aria-label="Documentos">
              {DOCUMENTOS.map((item, _index, lista) => (
                <button
                  key={item.key}
                  type="button"
                  role="radio"
                  aria-checked={documentos === item.key}
                  tabIndex={radioTabIndex(lista.map((doc) => doc.key), documentos, item.key)}
                  className={documentos === item.key ? "is-active" : ""}
                  onClick={() => setDocumentos(item.key)}
                  onKeyDown={(event) => radioKeys(event, lista.map((doc) => doc.key), documentos, setDocumentos)}
                  disabled={ocupado}
                >
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </button>
              ))}
            </div>
          </section>

          {avisos ? (
            <section>
              <h3><Icon name="history" />Plazo para el abonado</h3>
              <div className="cl-lote-plazo">
                <PlazoAvisoFields fechaAviso={fechaAviso} plazo={plazo} onChange={setPlazo} idPrefix="cl-lote" disabled={ocupado} announce={false} />
                {datos.conPlazo ? (
                  <p className="cl-lote-nota"><Icon name="warning" />{plural(datos.conPlazo, "ficha ya tenía", "fichas ya tenían")} un plazo{datos.plazos.size === 1 ? ` (${[...datos.plazos][0]})` : ""}; se reemplaza por este.</p>
                ) : null}
              </div>
            </section>
          ) : null}

          {avisos ? (
            <section>
              <h3><Icon name="records" />Fecha y firma del aviso</h3>
              <div className="cl-notice-fields">
                <label className="is-wide cl-lote-fecha" htmlFor="cl-lote-fecha-aviso">
                  <span>Fecha del aviso</span>
                  <input id="cl-lote-fecha-aviso" type="date" value={fechaAviso} onChange={(event) => setFechaAviso(event.target.value)} disabled={ocupado} />
                </label>
                <label><span>Firmante</span><input value={firmante} onChange={(event) => setFirmante(event.target.value)} maxLength={180} disabled={ocupado} /></label>
                <label><span>Cargo</span><input value={cargo} onChange={(event) => setCargo(event.target.value)} maxLength={180} disabled={ocupado} /></label>
                <details className="cl-lote-extra is-wide">
                  <summary>Agregar una indicación al aviso</summary>
                  <textarea aria-label="Indicación adicional" value={instrucciones} onChange={(event) => setInstrucciones(event.target.value)} rows="3" maxLength={1000} placeholder="Ej. Presentarse con documentación original." disabled={ocupado} />
                </details>
              </div>
            </section>
          ) : null}

          {datos.sinClave || (avisos && datos.avisoImpreso) || (fichas && datos.fichaImpresa) ? (
            <ul className="cl-lote-avisos">
              {datos.sinClave ? <li><Icon name="warning" />{plural(datos.sinClave, "ficha no tiene", "fichas no tienen")} clave catastral: saldrá con la línea en blanco.</li> : null}
              {avisos && datos.avisoImpreso ? <li><Icon name="history" />{plural(datos.avisoImpreso, "aviso ya se imprimió", "avisos ya se imprimieron")} antes; se vuelve a imprimir con la fecha nueva.</li> : null}
              {fichas && datos.fichaImpresa ? <li><Icon name="history" />{plural(datos.fichaImpresa, "ficha técnica ya estaba impresa", "fichas técnicas ya estaban impresas")}.</li> : null}
            </ul>
          ) : null}

          {error ? <p className="cl-lote-alerta is-error" role="alert"><Icon name="warning" />{error}</p> : null}
        </div>

        <footer>
          <div className="cl-lote-resumen" aria-live="polite">
            {ocupado ? (
              <span className="cl-lote-progreso">
                <span>{estado}</span>
                {fase === "preparando" ? <progress max={avance.total || 1} value={avance.done} aria-label="Fichas preparadas" /> : null}
              </span>
            ) : (
              <span><strong>{plural(hojas, "hoja", "hojas")}</strong>{avisos && fechaLimite ? ` · el aviso vence el ${fechaLarga(fechaLimite)}` : ""}</span>
            )}
          </div>
          <div>
            <button type="button" className="cl-secondary" onClick={onClose} disabled={ocupado}>Cancelar</button>
            <button type="button" className="cl-primary" onClick={preparar} disabled={!listo || ocupado}>
              <Icon name="print" />{ocupado ? "Preparando…" : avisos ? "Guardar plazo e imprimir" : "Preparar impresión"}
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body
  );
}
