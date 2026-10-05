import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { getRecordDeadlineMeta } from "../../utils/records";
import { createClandestinosApi } from "../clandestinos/services/clandestinosApi";
import { armarMapa } from "./flujoOperaciones";
import "./operaciones.css";

// Mapa de operaciones: los tres procesos de campo (clandestinos, inspecciones y
// entregas) como cadenas de pasos con lo que hay hoy en cada uno. Arriba va lo
// que traba el trabajo, lo más grave primero; cada paso abre su módulo filtrado.
const LIMITE_FICHAS = 500;
const REFRESCO_MS = 60000;
const FICHAS_KEY = "aguas.clandestinos.inbox.v1";
const BANCO_KEY = "aguas.clandestinos.banco.v1";
const NOMBRES = { fichas: "Fichas", banco: "Banco", inspecciones: "Inspecciones", entregas: "Entregas" };

const leer = (key) => { try { return JSON.parse(sessionStorage.getItem(key)) || {}; } catch { return {}; } };
const guardar = (key, value) => { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento */ } };
const hora = (date) => date.toLocaleTimeString("es-HN", { hour: "2-digit", minute: "2-digit" });
// "4 dias habiles vencidos" -> 4
const diasDe = (meta) => Number(String(meta?.helper || "").match(/\d+/)?.[0] || 0);

const json = async (response) => {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "No respondió.");
  return body;
};

export default function MapaOperaciones({ apiFetch, onGo, onDownloadMemoria }) {
  const api = useMemo(() => createClandestinosApi(apiFetch), [apiFetch]);
  const [fuentes, setFuentes] = useState(null);
  const [fallas, setFallas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actualizado, setActualizado] = useState(null);
  const firma = useRef("");

  const cargar = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const [fichas, banco, inspecciones, entregas] = await Promise.allSettled([
      api.fichas({ page: 1, limit: LIMITE_FICHAS }),
      api.banco({ estado: "pendiente", limit: 1 }),
      apiFetch("/inspecciones/resumen").then(json),
      apiFetch("/entregas/resumen").then(json)
    ]);
    // De las fichas solo se guarda lo que el mapa usa: conteos y vencidas por etapa.
    let resumenFichas = null;
    if (fichas.status === "fulfilled") {
      const vencidasPorEtapa = {};
      let maxDiasVencida = 0;
      for (const item of fichas.value.items || []) {
        // Lo cerrado o descartado ya no tiene plazo que cumplir.
        if (["regularized", "discarded"].includes(item.estado_operativo)) continue;
        const meta = getRecordDeadlineMeta(item);
        if (meta?.statusKey !== "overdue") continue;
        const etapa = item.estado_operativo || "pending";
        vencidasPorEtapa[etapa] = (vencidasPorEtapa[etapa] || 0) + 1;
        maxDiasVencida = Math.max(maxDiasVencida, diasDe(meta));
      }
      resumenFichas = { counts: fichas.value.counts || {}, vencidasPorEtapa, maxDiasVencida };
    }
    const valor = (resultado) => (resultado.status === "fulfilled" ? resultado.value : null);
    const siguiente = { fichas: resumenFichas, banco: valor(banco), inspecciones: valor(inspecciones), entregas: valor(entregas) };
    setFallas(Object.entries({ fichas, banco, inspecciones, entregas }).filter(([, resultado]) => resultado.status === "rejected").map(([key]) => NOMBRES[key]));
    setActualizado(new Date());
    // Si nada cambió no se vuelve a pintar el mapa.
    const nueva = JSON.stringify(siguiente);
    if (nueva !== firma.current) {
      firma.current = nueva;
      setFuentes(siguiente);
    }
    if (!silent) setLoading(false);
  }, [api, apiFetch]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const revisar = () => { if (document.visibilityState === "visible") cargar({ silent: true }); };
    const timer = setInterval(revisar, REFRESCO_MS);
    document.addEventListener("visibilitychange", revisar);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", revisar); };
  }, [cargar]);

  const mapa = useMemo(() => armarMapa(fuentes || {}), [fuentes]);

  // Cada paso abre su módulo con el filtro puesto: fichas y banco guardan su filtro
  // en la sesión del navegador; inspecciones y entregas lo leen del hash.
  const ir = (destino) => {
    if (!destino) return;
    if (destino.fichas !== undefined) {
      guardar(FICHAS_KEY, { ...leer(FICHAS_KEY), query: "", barrio: "", state: destino.fichas, page: 1 });
      window.location.hash = "clandestinos/fichas";
    } else if (destino.banco !== undefined) {
      guardar(BANCO_KEY, { ...leer(BANCO_KEY), query: "", barrio: "", dictamen: "", estado: "pendiente", asignado: destino.banco, page: 1 });
      window.location.hash = "clandestinos/banco";
    } else if (destino.hash) {
      window.location.hash = destino.hash;
    }
    onGo?.(destino.view);
  };

  return <section className="op" aria-label="Mapa de operaciones" aria-busy={loading}>
    <header className="op-head">
      <div>
        <h1>Mapa de operaciones</h1>
        <p>Dónde está el trabajo hoy y dónde se traba. Toca un paso para abrirlo.</p>
      </div>
      <div className="op-head-actions">
        {actualizado ? <span className="op-updated">Actualizado a las {hora(actualizado)}</span> : null}
        <button type="button" className="op-btn" onClick={() => cargar()} disabled={loading}><Icon name="refresh" />{loading ? "Actualizando…" : "Actualizar"}</button>
        {onDownloadMemoria ? <button type="button" className="op-btn is-quiet" onClick={onDownloadMemoria} title="Informe de todo lo trabajado desde el primer registro, para presentar"><Icon name="download" />Memoria en PDF</button> : null}
      </div>
    </header>

    {!fuentes ? <div className="op-skeleton" role="status" aria-label="Cargando el mapa"><span /><span /><span /></div> : <>
      <section className="op-cuellos" aria-labelledby="op-cuellos-title">
        <h2 id="op-cuellos-title">Dónde se traba hoy</h2>
        {mapa.cuellos.length ? <ol>
          {mapa.cuellos.map((cuello) => <li key={cuello.key} className={cuello.grado >= 3 ? "is-critico" : "is-atencion"}>
            <i aria-hidden="true" />
            <p>{cuello.texto}</p>
            <button type="button" onClick={() => ir(cuello.destino)}>{cuello.accion}<Icon name="arrowRight" /></button>
          </li>)}
        </ol> : <p className="op-ok"><Icon name="checkCircle" />Nada trabado: ningún paso tiene atrasos.</p>}
      </section>

      <section className="op-mapa" aria-labelledby="op-mapa-title">
        <h2 id="op-mapa-title">Cómo avanza cada proceso</h2>
        {mapa.carriles.map((carril) => <div className="op-carril" key={carril.key}>
          <header><h3>{carril.label}</h3><p>{carril.detalle}</p></header>
          <ol className="op-pasos" style={{ "--pasos": carril.pasos.length }} aria-label={`Pasos de ${carril.label.toLowerCase()}`}>
            {carril.pasos.map((paso) => {
              // El verde de lo cerrado solo cuando hay algo cerrado.
              const tono = paso.tono === "hecho" && !paso.value ? "" : paso.tono;
              return <li key={paso.key} className={`op-paso ${tono ? `is-${tono}` : ""}`.trim()}>
              <button type="button" onClick={() => ir(paso.destino)}>
                <span className="op-paso-label">{paso.label}</span>
                <strong>{paso.value.toLocaleString("es-HN")}</strong>
                <small>{paso.nota || " "}</small>
              </button>
              {paso.flecha ? <span className="op-flecha" aria-hidden="true">
                <em>{paso.flecha}</em>
                <svg viewBox="0 0 40 10" focusable="false"><line x1="0" y1="5" x2="36" y2="5" /><polyline points="31,1 37,5 31,9" /></svg>
              </span> : null}
            </li>;
            })}
          </ol>
        </div>)}
        {fallas.length ? <p className="op-falla" role="alert"><Icon name="warning" />No se pudo leer {fallas.join(", ")}. <button type="button" onClick={() => cargar()}>Reintentar</button></p> : null}
      </section>
    </>}
  </section>;
}
