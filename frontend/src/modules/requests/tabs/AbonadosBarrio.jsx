import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../../components/Icon";
import { formatCurrency } from "../../../utils/formatting";
import { imprimirAbonadosBarrios } from "../padronInformes";
import { SERVICE_COLUMNS, serviceLabel } from "../utils/serviceTable";
import SalidaBotones from "./SalidaBotones";

const count = (value) => Number(value || 0).toLocaleString("es-HN");
const money = (value) => formatCurrency(Number(value) || 0);
const sinAcentos = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Propiedades de una fila de barrio que abre sus abonados con doble clic o Enter.
// La casilla de selección no cuenta: marcarla dos veces seguidas no abre el panel.
export const filaAbreAbonados = (name, abrir) => {
  const abre = (event) => {
    if (event.target.closest("input, button")) return;
    window.getSelection?.()?.removeAllRanges();
    abrir(name);
  };
  return {
    tabIndex: 0,
    title: "Doble clic para ver los abonados",
    onDoubleClick: abre,
    onKeyDown: (event) => { if (event.key === "Enter" && event.target === event.currentTarget) abre(event); }
  };
};

// Doble clic en un barrio de las tablas de servicios: sus abonados del padrón en un
// panel lateral. Se filtran por nombre (también abonado o clave) y, si se abrió desde
// "Por servicio", por quienes tienen ese servicio. Lo filtrado es lo que se imprime.
export default function AbonadosBarrio({ barrio, field = "", model, onClose }) {
  const [estado, setEstado] = useState({ cargando: true, error: "", rows: [] });
  const [query, setQuery] = useState("");
  const [soloServicio, setSoloServicio] = useState(false);
  const buscador = useRef(null);
  const origen = useRef(document.activeElement);
  const servicio = field ? serviceLabel(field).toLowerCase() : "";

  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const response = await model.apiFetch(`/claves/services/barrio-accounts?${new URLSearchParams({ barrios: barrio })}`);
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message || "No se pudo leer el padrón.");
        if (vigente) setEstado({ cargando: false, error: "", rows: body.barrios?.[0]?.rows || [] });
      } catch (error) {
        if (vigente) setEstado({ cargando: false, error: error.message || "No se pudo leer el padrón.", rows: [] });
      }
    })();
    return () => { vigente = false; };
  }, [barrio, model]);

  useEffect(() => {
    buscador.current?.focus();
    const alTeclear = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", alTeclear);
    const anterior = origen.current;
    return () => { document.removeEventListener("keydown", alTeclear); anterior?.focus?.(); };
  }, [onClose]);

  const conServicio = useMemo(() => (field ? estado.rows.filter((row) => row.servicios?.[field]).length : 0), [estado.rows, field]);
  const visibles = useMemo(() => {
    const texto = sinAcentos(query.trim());
    return estado.rows.filter((row) => (!soloServicio || row.servicios?.[field])
      && (!texto || [row.nombre, row.abonado, row.clave_catastral].some((valor) => sinAcentos(valor).includes(texto))));
  }, [estado.rows, query, soloServicio, field]);
  const saldo = visibles.reduce((suma, row) => suma + Number(row.total || 0), 0);

  const salida = (modo) => imprimirAbonadosBarrios({
    barrios: [{ barrio_colonia: barrio, rows: visibles }],
    formatClave: model.formatClave,
    padronActualizado: model.serviceReport?.source?.updated_at
  }, modo);

  return createPortal(<div className="pq-workspace pq-abo-capa" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="pq-abo" role="dialog" aria-modal="true" aria-labelledby="pq-abo-titulo">
      <header className="pq-abo-head">
        <div>
          <span className="pq-kicker">Abonados del barrio</span>
          <h2 id="pq-abo-titulo">{barrio}</h2>
          <p>{estado.cargando ? "Leyendo el padrón…" : <>{count(estado.rows.length)} {estado.rows.length === 1 ? "abonado" : "abonados"}{field ? <> · {count(conServicio)} con {servicio}</> : null}</>}</p>
        </div>
        <button type="button" className="pq-abo-cerrar" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
      </header>

      <div className="pq-abo-tools">
        <label className="pq-search"><Icon name="search" /><input ref={buscador} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, abonado o clave" aria-label="Buscar abonado" /></label>
        {field ? <div className="pq-segmented" role="group" aria-label="Qué abonados mostrar">
          <button type="button" aria-pressed={!soloServicio} className={soloServicio ? "" : "is-active"} onClick={() => setSoloServicio(false)}>Todos</button>
          <button type="button" aria-pressed={soloServicio} className={soloServicio ? "is-active" : ""} onClick={() => setSoloServicio(true)}>Con {servicio}</button>
        </div> : null}
      </div>

      <div className="pq-abo-cuerpo" aria-live="polite">
        {estado.cargando ? <p className="pq-abo-vacio"><Icon name="refresh" className="ds-icon-spin" />Leyendo el padrón…</p>
          : estado.error ? <p className="pq-abo-vacio is-error">{estado.error}</p>
            : !visibles.length ? <p className="pq-abo-vacio">{estado.rows.length ? `Ningún abonado coincide${query.trim() ? ` con “${query.trim()}”` : ""}.` : "El barrio no tiene abonados en el padrón."}</p>
              : <ol className="pq-abo-lista">
                {visibles.map((row) => <li key={`${row.clave_catastral}-${row.abonado}`}>
                  <div className="pq-abo-quien">
                    <strong>{row.nombre || "Sin nombre"}</strong>
                    <span>Abonado {row.abonado || "--"} · {model.formatClave?.({ ...row, barrio_colonia: barrio }) || row.clave_catastral || "--"}</span>
                  </div>
                  <b className={Number(row.total) ? "pq-abo-saldo" : "pq-abo-saldo is-zero"}>{money(row.total)}</b>
                  <ul className="pq-abo-servicios" aria-label="Servicios">
                    {SERVICE_COLUMNS.map(([campo, etiqueta]) => <li key={campo} className={`${row.servicios?.[campo] ? "is-on" : ""} ${campo === field ? "is-focus" : ""}`.trim()}>
                      {etiqueta}<span className="sr-only">{row.servicios?.[campo] ? ": sí" : ": no"}</span>
                    </li>)}
                  </ul>
                </li>)}
              </ol>}
      </div>

      <footer className="pq-abo-pie">
        <span className="pq-count">{count(visibles.length)} {visibles.length === 1 ? "abonado" : "abonados"} · saldo {money(saldo)}</span>
        <div className="pq-toolbar-actions">
          <SalidaBotones onSalida={salida} disabled={estado.cargando || !visibles.length} notify={model.notify} />
        </div>
      </footer>
    </aside>
  </div>, document.body);
}
