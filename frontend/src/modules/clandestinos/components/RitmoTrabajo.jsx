import { useState } from "react";
import { GRANULARIDADES, UNIDAD, etiquetaPeriodo, rotuloEje } from "../periodos";

// Cómo se lee cada etapa detrás de un número: [una, varias].
const ETAPA_NOMBRE = { draft: ["borrador", "borradores"], pending: ["por visitar", "por visitar"], visit: ["en visita", "en visita"], confirmed: ["con aviso pendiente", "con aviso pendiente"], regularization: ["en seguimiento", "en seguimiento"], regularized: ["cerrada", "cerradas"], discarded: ["descartada", "descartadas"] };
// Cada cuántas barras va un rótulo en el eje, para que no se encimen.
const PASO_ROTULO = { dia: 5, semana: 3, mes: 1, anio: 1 };
// Techo del eje redondeado a un número fácil de leer (1, 2, 5, 10, 20, 50…).
const techo = (max) => {
  if (max <= 4) return Math.max(max, 1);
  const base = 10 ** Math.floor(Math.log10(max));
  return [1, 2, 5, 10].map((paso) => paso * base).find((valor) => valor >= max);
};

/**
 * Ritmo de trabajo: fichas levantadas por día, semana, mes o año (barras en un solo
 * azul; el periodo actual en azul profundo) junto a los totales del momento y los
 * barrios con más fichas. Los barrios filtran el listado.
 */
export default function RitmoTrabajo({ ritmo, granularidad, onGranularidad, barrioActivo, onBarrio }) {
  const [foco, setFoco] = useState(null);
  const serie = ritmo?.serie || [];
  const max = techo(Math.max(0, ...serie.map((punto) => punto.total)));
  const vacio = !serie.some((punto) => punto.total);
  const actual = serie.at(-1);
  const leido = foco != null ? serie[foco] : actual;
  const totales = ritmo?.totales || {};
  const maxBarrio = Math.max(1, ...(ritmo?.barrios || []).map((item) => item.total));
  const detalle = (punto) => {
    const etapas = Object.entries(punto.etapas || {}).sort((a, b) => b[1] - a[1]).map(([key, value]) => `${value} ${ETAPA_NOMBRE[key]?.[value === 1 ? 0 : 1] || key}`).join(", ");
    return `${etiquetaPeriodo(punto.periodo, granularidad, ritmo?.hoy)}: ${punto.total} ${punto.total === 1 ? "ficha" : "fichas"}${etapas ? ` (${etapas})` : ""}`;
  };

  return <section className="cl-ritmo" aria-labelledby="cl-ritmo-title" aria-busy={!ritmo}>
    <div className="cl-ritmo-main">
      <header className="cl-ritmo-head">
        <div>
          <h3 id="cl-ritmo-title">Ritmo de trabajo</h3>
          <p>Fichas levantadas por {UNIDAD[granularidad]}{ritmo?.promedio ? ` · promedio ${ritmo.promedio} por ${UNIDAD[granularidad]} con trabajo` : ""}</p>
        </div>
        <div className="cl-ritmo-seg" role="group" aria-label="Agrupar por">
          {GRANULARIDADES.map(([key, label]) => <button type="button" key={key} aria-pressed={granularidad === key} className={granularidad === key ? "is-active" : ""} onClick={() => onGranularidad(key)}>{label}</button>)}
        </div>
      </header>
      {/* Lectura del periodo bajo el cursor (o del actual): fija arriba del gráfico, nunca tapa las barras. */}
      <p className="cl-ritmo-read" aria-live="polite">{ritmo && leido ? detalle(leido) : " "}</p>
      <div className={`cl-ritmo-chart ${vacio ? "is-empty" : ""}`.trim()} style={{ "--cols": Math.max(serie.length, 1) }} onPointerLeave={() => setFoco(null)}>
        <div className="cl-ritmo-grid" aria-hidden="true"><span>{max}</span><span>{Math.round(max / 2)}</span><span>0</span></div>
        {ritmo?.promedio && !vacio ? <i className="cl-ritmo-avg" style={{ bottom: `${(ritmo.promedio / max) * 100}%` }} aria-hidden="true" /> : null}
        <ol className="cl-ritmo-bars" aria-label={`Fichas por ${UNIDAD[granularidad]}`}>
          {serie.map((punto, index) => <li key={punto.periodo}>
            <button type="button" className={`${index === serie.length - 1 ? "is-current" : ""} ${foco === index ? "is-focus" : ""}`.trim() || undefined} aria-label={detalle(punto)} onPointerEnter={() => setFoco(index)} onFocus={() => setFoco(index)} onBlur={() => setFoco(null)}>
              <span style={{ height: `${(punto.total / max) * 100}%` }} />
            </button>
            <small aria-hidden="true">{index % PASO_ROTULO[granularidad] === (serie.length - 1) % PASO_ROTULO[granularidad] ? rotuloEje(punto.periodo, granularidad) : ""}</small>
          </li>)}
        </ol>
        {vacio && ritmo ? <p className="cl-ritmo-empty">Sin fichas levantadas en este periodo con los filtros actuales.</p> : null}
      </div>
    </div>
    <aside className="cl-ritmo-side" aria-label="Totales y barrios">
      <dl className="cl-ritmo-totals">
        {[["hoy", "Hoy"], ["semana", "Esta semana"], ["mes", "Este mes"], ["anio", "Este año"]].map(([key, label]) => <div key={key} className={key === "hoy" && granularidad === "dia" || key === granularidad ? "is-current" : ""}><dt>{label}</dt><dd>{ritmo ? totales[key] || 0 : "—"}</dd></div>)}
      </dl>
      <h4>Barrios con más fichas</h4>
      {ritmo?.barrios?.length ? <ul className="cl-ritmo-barrios">
        {ritmo.barrios.slice(0, 5).map((item) => <li key={item.barrio}><button type="button" aria-pressed={barrioActivo === item.barrio} className={barrioActivo === item.barrio ? "is-active" : ""} title={barrioActivo === item.barrio ? "Quitar el filtro de barrio" : `Ver solo ${item.barrio}`} onClick={() => onBarrio(barrioActivo === item.barrio ? "" : item.barrio)}>
          <span>{item.barrio}</span><i aria-hidden="true"><b style={{ width: `${(item.total / maxBarrio) * 100}%` }} /></i><strong>{item.total}</strong>
        </button></li>)}
      </ul> : <p className="cl-ritmo-note">{ritmo ? "Sin fichas con estos filtros." : "Cargando…"}</p>}
    </aside>
  </section>;
}
