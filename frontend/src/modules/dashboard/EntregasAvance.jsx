import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import LiveNumber from "../../components/micro/LiveNumber";
import { plural, resumenEntregas } from "./avanceEntregasResumen.js";

const CADA_MS = 60_000;
const fechaCorta = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("es-HN", { day: "numeric", month: "short" }).replace(".", "") : "");
const entero = (valor) => Math.round(Number(valor) || 0).toLocaleString("es-HN");
const unDecimal = (valor) => `${(Number(valor) || 0).toFixed(1)}%`;

// Contador de facturas entregadas en el ciclo. Se consulta al entrar, cada
// minuto con la pestaña a la vista y al volver a ella; con la pestaña oculta no
// consulta. Si la primera consulta falla (por ejemplo, un rol sin acceso), el
// panel no aparece.
export default function EntregasAvance({ fetchAvance, onAbrir }) {
  const [mes, setMes] = useState(null);
  const [fallo, setFallo] = useState(false);
  // La función llega nueva en cada redibujo del tablero: va por ref para que el
  // intervalo no se reinicie.
  const fetchRef = useRef(fetchAvance);
  fetchRef.current = fetchAvance;

  useEffect(() => {
    let vivo = true;
    let enCurso = false;
    const cargar = async () => {
      if (enCurso || document.hidden) return;
      enCurso = true;
      try {
        const datos = await fetchRef.current();
        if (vivo) { setMes(datos); setFallo(false); }
      } catch {
        if (vivo) setFallo(true);
      } finally {
        enCurso = false;
      }
    };
    cargar();
    const reloj = window.setInterval(cargar, CADA_MS);
    const alVolver = () => { if (!document.hidden) cargar(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      vivo = false;
      window.clearInterval(reloj);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  const resumen = useMemo(() => resumenEntregas(mes), [mes]);
  if (!resumen) {
    if (fallo) return null;
    return (
      <article className="dw-panel dw-entregas is-cargando" aria-busy="true">
        <header className="dw-panel-head"><div><h2>Entrega de facturas</h2></div></header>
        <p className="dw-empty">Consultando el avance…</p>
      </article>
    );
  }

  const { tecnicos, hoy } = resumen;
  const lecturaHoy = hoy.lotes
    ? [
        hoy.abiertos ? plural(hoy.abiertos, "lote abierto", "lotes abiertos") : "",
        hoy.entregadas ? plural(hoy.entregadas, "entregada", "entregadas") : ""
      ].filter(Boolean).join(" · ") || plural(hoy.lotes, "lote", "lotes")
    : "sin lotes todavía";

  return (
    <article className="dw-panel dw-entregas">
      <header className="dw-panel-head">
        <div>
          <h2>Entrega de facturas</h2>
          <small>{resumen.cicloDeclarado ? "Ciclo" : "Mes"} desde el {fechaCorta(resumen.desde)}</small>
        </div>
        <span className={`dw-entregas-estado${resumen.enVivo ? " is-vivo" : ""}`}>
          <i aria-hidden="true" />{fallo ? "Sin actualizar" : resumen.enVivo ? "En reparto" : "Sin reparto ahora"}
        </span>
      </header>

      <p className="dw-entregas-cifra">
        <LiveNumber as="strong" className="dw-figure" value={resumen.facturas} flash=".dw-entregas" duration={700} />
        <span>facturas entregadas<small>Hoy: {lecturaHoy}</small></span>
      </p>

      <div className="dw-entregas-avance">
        <div
          className="dw-entregas-barra"
          role="img"
          aria-label={`${resumen.entregados} de ${resumen.total} barrios entregados, ${resumen.enCurso} en reparto y ${resumen.pendientes} pendientes`}
        >
          <i className="is-entregado" style={{ width: `${resumen.parteEntregada}%` }} />
          <i className="is-en-curso" style={{ width: `${resumen.parteEnCurso}%` }} />
        </div>
        <LiveNumber as="b" className="dw-figure" value={resumen.porcentaje} format={unDecimal} />
      </div>
      <ul className="dw-entregas-leyenda">
        <li className="is-entregado"><i aria-hidden="true" /><b className="dw-figure">{entero(resumen.entregados)}</b> de {entero(resumen.total)} barrios</li>
        <li className="is-en-curso"><i aria-hidden="true" /><b className="dw-figure">{entero(resumen.enCurso)}</b> en reparto</li>
        <li className="is-pendiente"><i aria-hidden="true" /><b className="dw-figure">{entero(resumen.pendientes)}</b> pendientes</li>
      </ul>

      {tecnicos.length ? (
        <ul className="dw-entregas-tecnicos" aria-label="Avance por técnico">
          {tecnicos.map((tecnico) => (
            <li key={tecnico.id} title={`${tecnico.nombre}: ${plural(tecnico.facturas, "factura entregada", "facturas entregadas")}`}>
              <span>{tecnico.nombre}</span>
              <span className="dw-entregas-mini" aria-hidden="true">
                <i className="is-entregado" style={{ width: `${tecnico.parteEntregada}%` }} />
                <i className="is-en-curso" style={{ width: `${tecnico.parteEnCurso}%` }} />
              </span>
              <b className="dw-figure" aria-label={`${tecnico.entregados} de ${tecnico.total} barrios`}>{tecnico.entregados}/{tecnico.total}</b>
            </li>
          ))}
        </ul>
      ) : <p className="dw-empty">Todavía no hay barrios repartidos entre técnicos.</p>}

      {onAbrir ? (
        <button type="button" className="dw-link dw-entregas-abrir" onClick={onAbrir}>
          Abrir Control de entregas <Icon name="arrowRight" />
        </button>
      ) : null}
    </article>
  );
}
