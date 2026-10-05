import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../../../components/Icon";
import { getRecordDeadlineMeta } from "../../../utils/records";
import LiveNumber from "../../../components/micro/LiveNumber";
import { StackedBars } from "./ClCharts";
import { ETAPA_TONOS } from "../etapas";

// Etapas de la ficha en el orden del proceso, con su tono en la franja del proceso (ver etapas.js).
const ETAPAS = [["draft", "Borradores"], ["pending", "Por visitar"], ["visit", "En visita"], ["confirmed", "Aviso pendiente"], ["regularization", "En seguimiento"], ["regularized", "Cerradas"]].map(([key, label]) => [key, label, ETAPA_TONOS[key]]);
const ETAPA_LABEL = Object.fromEntries([...ETAPAS, ["discarded", "Descartada"]].map(([key, label]) => [key, label]));
const BANCO_TONO = ETAPA_TONOS.banco;
// Reportes que todavía piden algo de la oficina, en el orden en que se atienden.
const REPORTES_POR_ATENDER = [["new", "Nuevos"], ["review", "En revisión"], ["info_requested", "Falta información"]];
const PLAZO_ORDEN = { overdue: 0, due: 1, warning: 2 };
const ATENDER_VISIBLES = 8;
const LIMITE_FICHAS = 500;
const DIA_MS = 86400000;
// Cada minuto se revisa el backend en silencio mientras la pestaña está a la vista.
const REFRESCO_MS = 60000;

const hora = (date) => date.toLocaleTimeString("es-HN", { hour: "2-digit", minute: "2-digit" });
const porcentaje = (value, total) => (total ? Math.round((value / total) * 100) : 0);
// "4 dias habiles vencidos" -> 4, para ordenar lo más atrasado primero.
const diasDe = (meta) => Number(String(meta?.helper || "").match(/\d+/)?.[0] || 0);
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const diasDesde = (fecha, ahora) => (fecha ? Math.max(0, Math.floor((ahora - new Date(fecha).getTime()) / DIA_MS)) : null);

function Esqueleto() {
  return <div className="cl-rs-skeleton" role="status" aria-label="Cargando resumen">
    <div className="is-kpis">{Array.from({ length: 4 }, (_, index) => <span key={index} />)}</div>
    <div className="is-steps">{Array.from({ length: 7 }, (_, index) => <span key={index} />)}</div>
    <div className="is-split"><span /><span /></div>
  </div>;
}

/**
 * Resumen del módulo: el proceso completo de un vistazo, lo que hay que atender
 * hoy y cómo va cada técnico. Todo lleva a su registro con el filtro puesto.
 */
export default function ResumenClandestinos({ api, onOpenFichas, onOpenBanco, onOpenReportes, onOpenFicha }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const firma = useRef("");
  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [fichas, banco, reportes] = await Promise.all([
        api.fichas({ page: 1, limit: LIMITE_FICHAS }),
        api.banco({ estado: "pendiente", limit: 5 }),
        api.reports({})
      ]);
      const ahora = Date.now();
      const items = fichas.items || [];
      // Plazo de cada ficha: lo crítico va a "Atender hoy" y se cuenta por etapa.
      const criticas = items
        .map((item) => ({ item, meta: getRecordDeadlineMeta(item) }))
        .filter(({ meta }) => meta && meta.statusKey in PLAZO_ORDEN)
        .sort((a, b) => PLAZO_ORDEN[a.meta.statusKey] - PLAZO_ORDEN[b.meta.statusKey] || (a.meta.statusKey === "overdue" ? diasDe(b.meta) - diasDe(a.meta) : diasDe(a.meta) - diasDe(b.meta)))
        .map(({ item, meta }) => ({ item, plazo: { key: meta.statusKey, label: meta.label, dias: diasDe(meta) } }));
      const vencidasPorEtapa = criticas.reduce((acc, { item, plazo }) => {
        const etapa = item.estado_operativo || "pending";
        if (plazo.key === "overdue") acc[etapa] = (acc[etapa] || 0) + 1;
        return acc;
      }, {});
      // Reportes por estado, con lo que lleva esperando el más antiguo de los que faltan.
      const porEstado = reportes.reduce((acc, item) => {
        const entry = acc[item.estado] || { total: 0, espera: null };
        const dias = diasDesde(item.created_at, ahora);
        acc[item.estado] = { total: entry.total + 1, espera: dias == null ? entry.espera : Math.max(entry.espera ?? 0, dias) };
        return acc;
      }, {});
      // Solo lo que el resumen muestra; si llega igual, no se toca nada (sin
      // re-render ni animaciones). Si cambió, solo se mueve lo que cambió.
      const siguiente = {
        counts: fichas.counts || {},
        parcial: Number(fichas.total || 0) > items.length,
        nuevas: items.filter((item) => { const dias = diasDesde(item.created_at, ahora); return dias != null && dias < 7; }).length,
        banco: { counts: banco.counts || {}, estados: banco.estados || {}, sin_asignar: banco.sin_asignar || 0, asignaciones: banco.asignaciones || [], barrios: (banco.barrio_counts || []).slice(0, 8) },
        reportes: porEstado,
        criticas,
        vencidasPorEtapa
      };
      const nueva = JSON.stringify(siguiente);
      if (nueva !== firma.current) {
        firma.current = nueva;
        setData({ ...siguiente, actualizado: new Date() });
      }
    } catch (reason) { if (!silent) setError(reason.message); } finally { if (!silent) setLoading(false); }
  }, [api]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const revisar = () => { if (document.visibilityState === "visible") load({ silent: true }); };
    const timer = setInterval(revisar, REFRESCO_MS);
    document.addEventListener("visibilitychange", revisar);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", revisar); };
  }, [load]);

  const fallo = error ? <div className="cl-alert cl-rs-error" role="alert"><span>No se pudo cargar el resumen: {error}</span><button type="button" className="cl-secondary" disabled={loading} onClick={() => load()}><Icon name="refresh" />{loading ? "Reintentando…" : "Reintentar"}</button></div> : null;
  if (!data) return <section className="cl-resumen" aria-busy={loading}>{fallo || <Esqueleto />}</section>;

  const counts = data.counts || {};
  const banco = data.banco;
  // Lo que de verdad queda por revisar: los pendientes que no están en Aguas
  // (esos salen del banco con "Verificar").
  const bancoPendiente = Number(banco.counts?.clandestino || 0) + Number(banco.counts?.sin_determinar || 0);
  const enAguas = Number(banco.counts?.registrado || 0);
  const vencidas = data.criticas.filter(({ plazo }) => plazo.key === "overdue").length;
  const porVencer = data.criticas.length - vencidas;
  const activas = ["draft", "pending", "visit", "confirmed", "regularization"].reduce((sum, key) => sum + Number(counts[key] || 0), 0);
  // Equipo: todo lo asignado a técnicos y cuánto ya se trabajó.
  const tecnicos = banco.asignaciones || [];
  const equipo = tecnicos.reduce((acc, item) => ({ total: acc.total + item.total, trabajados: acc.trabajados + item.trabajados }), { total: 0, trabajados: 0 });
  // Del banco ya trabajado (a ficha o descartado), cuánto terminó en ficha.
  const aFicha = Number(banco.estados?.enviado || 0);
  const descartados = Number(banco.estados?.descartado || 0);

  // Cifras que no aparecen en otra parte de la pantalla.
  const kpis = [
    { key: "vencidas", label: "Fichas vencidas", value: vencidas, hint: porVencer ? `${porVencer} más por vencer` : "Ninguna por vencer", tone: vencidas ? "is-danger" : porVencer ? "is-warning" : "", onClick: () => onOpenFichas("", { alertas: true }) },
    { key: "nuevas", label: "Fichas nuevas en 7 días", value: data.nuevas, hint: `${activas} expedientes activos`, onClick: () => onOpenFichas("") },
    { key: "equipo", label: "Avance del equipo", value: porcentaje(equipo.trabajados, equipo.total), suffix: "%", hint: equipo.total ? `${equipo.trabajados} de ${equipo.total} asignados trabajados` : "Nada asignado todavía", onClick: () => onOpenBanco({ estado: "" }) },
    { key: "conversion", label: "Banco que terminó en ficha", value: porcentaje(aFicha, aFicha + descartados), suffix: "%", hint: `${aFicha} a ficha · ${descartados} descartados`, onClick: () => onOpenBanco({ estado: "enviado" }) }
  ];

  // El proceso: del punto levantado en campo (banco) a la ficha cerrada.
  const pasos = [
    { key: "banco", label: "Banco de campo", value: bancoPendiente, color: BANCO_TONO, hint: enAguas ? `${enAguas} ya en Aguas: Verificar` : `${banco.sin_asignar} sin asignar`, aviso: enAguas > 0, onClick: () => onOpenBanco({}) },
    ...ETAPAS.map(([key, label, color]) => {
      const vencidasEtapa = data.vencidasPorEtapa[key] || 0;
      return { key, label, value: Number(counts[key] || 0), color, hint: vencidasEtapa ? plural(vencidasEtapa, "vencida", "vencidas") : key === "regularized" && counts.discarded ? `${counts.discarded} descartadas aparte` : "", critico: vencidasEtapa > 0, onClick: () => onOpenFichas(key) };
    })
  ];
  const totalProceso = pasos.reduce((sum, paso) => sum + paso.value, 0);
  const atender = data.criticas.slice(0, ATENDER_VISIBLES);
  const reportesPendientes = REPORTES_POR_ATENDER.filter(([key]) => data.reportes[key]?.total);
  const reportesCerrados = ["approved", "linked"].reduce((sum, key) => sum + Number(data.reportes[key]?.total || 0), 0);

  return <section className="cl-resumen" aria-label="Resumen del módulo" aria-busy={loading}>
    <header className="cl-resumen-head">
      <div><h2>Estado de la operación</h2><p>Toca cualquier cifra para abrir sus registros.</p></div>
      <button type="button" className="cl-quiet" disabled={loading} onClick={() => load()}><Icon name="refresh" />{loading ? "Actualizando…" : `Actualizado ${hora(data.actualizado)}`}</button>
    </header>
    {fallo}

    <div className="cl-resumen-kpis">
      {kpis.map((kpi) => <button type="button" key={kpi.key} className={`cl-resumen-kpi ${kpi.tone || ""}`.trim()} onClick={kpi.onClick}>
        <span className="cl-resumen-kpi-label">{kpi.label}</span>
        <span className="cl-rs-kpi-value"><LiveNumber as="strong" value={kpi.value} flash=".cl-resumen-kpi" />{kpi.suffix ? <em>{kpi.suffix}</em> : null}</span>
        <small>{kpi.hint}</small>
      </button>)}
    </div>

    <section className="cl-rs-flow" aria-labelledby="cl-rs-flow-title">
      <header className="cl-rs-head">
        <h3 id="cl-rs-flow-title">El proceso</h3>
        <p>Del punto levantado en campo a la ficha cerrada.</p>
      </header>
      <ol className="cl-rs-steps">
        {pasos.map((paso) => <li key={paso.key}>
          <button type="button" className={`${paso.critico ? "is-critical" : ""} ${paso.aviso ? "is-warning" : ""}`.trim() || undefined} onClick={paso.onClick} aria-label={`${paso.label}: ${paso.value}${paso.hint ? `, ${paso.hint}` : ""}`}>
            <span className="cl-rs-step-label"><i style={{ background: paso.color }} aria-hidden="true" />{paso.label}</span>
            <LiveNumber as="strong" value={paso.value} flash=".cl-rs-steps button" />
            <small>{paso.hint || " "}</small>
          </button>
        </li>)}
      </ol>
      <div className="cl-rs-band" role="img" aria-label={`Reparto del proceso: ${pasos.map((paso) => `${paso.label} ${paso.value}`).join(", ")}`}>
        {pasos.map((paso) => paso.value ? <span key={paso.key} title={`${paso.label}: ${paso.value} (${porcentaje(paso.value, totalProceso)}%)`} style={{ flexGrow: paso.value, background: paso.color }} /> : null)}
      </div>
      <p className="cl-rs-band-note">{totalProceso ? <><strong>{porcentaje(bancoPendiente, totalProceso)}%</strong> sigue en el banco sin ficha · <strong>{porcentaje(Number(counts.regularized || 0), totalProceso)}%</strong> ya está cerrado</> : "Todavía no hay puntos ni fichas en el proceso."}</p>
    </section>

    <div className="cl-rs-split">
      <section className="cl-rs-atender" aria-labelledby="cl-rs-atender-title">
        <header className="cl-rs-head">
          <h3 id="cl-rs-atender-title">Atender hoy</h3>
          <p>Fichas con plazo vencido o por vencer, lo más atrasado primero.{data.parcial ? ` Calculado sobre las ${LIMITE_FICHAS} fichas más recientes.` : ""}</p>
        </header>
        {atender.length ? <table className="cl-rs-table">
          <thead><tr><th scope="col">Clave</th><th scope="col">Inmueble</th><th scope="col">Etapa</th><th scope="col" className="is-num">Plazo</th></tr></thead>
          <tbody>
            {atender.map(({ item, plazo }) => <tr key={item.id} className={`is-${plazo.key}`}>
              <td><button type="button" className="cl-rs-clave" onClick={() => onOpenFicha?.(item)} title="Abrir la ficha">{item.clave_catastral || "Sin clave"}</button></td>
              <td><span className="cl-rs-name">{item.inquilino || item.nombre_catastral || item.abonado || "Sin nombre"}</span><small>{item.barrio_colonia || "Sin barrio"}</small></td>
              <td>{ETAPA_LABEL[item.estado_operativo || "pending"] || item.estado_operativo}</td>
              <td className="is-num"><strong>{plazo.key === "overdue" ? `Vencida hace ${plural(plazo.dias, "día", "días")}` : plazo.key === "due" ? "Vence hoy" : `Vence en ${plural(plazo.dias, "día", "días")}`}</strong></td>
            </tr>)}
          </tbody>
        </table> : <p className="cl-rs-empty"><Icon name="checkCircle" />Nada vencido ni por vencer. Todo está en plazo.</p>}
        {data.criticas.length > ATENDER_VISIBLES ? <button type="button" className="cl-rs-more" onClick={() => onOpenFichas("", { alertas: true })}>Ver las {data.criticas.length} con plazo crítico<Icon name="arrowRight" /></button> : null}
      </section>

      <section className="cl-rs-team" aria-labelledby="cl-rs-team-title">
        <header className="cl-rs-head is-row">
          <div><h3 id="cl-rs-team-title">Avance por técnico</h3><p>Lo que se les asignó del banco y cuánto ya trabajaron.</p></div>
          <p className="cl-rs-legend" aria-hidden="true"><span><i className="is-ficha" />A ficha</span><span><i className="is-desc" />Descartado</span><span><i className="is-pend" />Pendiente</span></p>
        </header>
        <ul className="cl-rs-tech">
          <li><button type="button" className="is-unassigned" onClick={() => onOpenBanco({ asignado: "none" })}>
            <span className="cl-rs-tech-name">Sin asignar</span>
            <span className="cl-rs-tech-note">{banco.sin_asignar ? "Candidatos por repartir" : "Todo está repartido"}</span>
            <span className="cl-rs-tech-num"><strong>{banco.sin_asignar}</strong></span>
          </button></li>
          {tecnicos.map((tecnico) => <li key={tecnico.id}><button type="button" onClick={() => onOpenBanco({ asignado: String(tecnico.id), estado: "" })} title={`${tecnico.nombre}: ${tecnico.trabajados} de ${tecnico.total} trabajados (${tecnico.enviados} a ficha, ${tecnico.descartados} descartados) · ${tecnico.pendientes} pendientes`}>
            <span className="cl-rs-tech-name">{tecnico.nombre}</span>
            <span className="cl-rs-tech-bar" aria-hidden="true">
              <i className="is-ficha" style={{ flexGrow: tecnico.enviados }} />
              <i className="is-desc" style={{ flexGrow: tecnico.descartados }} />
              <i className="is-pend" style={{ flexGrow: tecnico.pendientes }} />
            </span>
            <span className="cl-rs-tech-num"><strong>{tecnico.total ? `${tecnico.avance}%` : "—"}</strong><small>{tecnico.pendientes ? `${tecnico.pendientes} pend.` : tecnico.total ? "Terminado" : "Sin asignar"}</small></span>
          </button></li>)}
        </ul>
        {!tecnicos.length ? <p className="cl-rs-empty">Nadie tiene candidatos asignados todavía. Repártelos desde el Banco.</p> : null}
      </section>
    </div>

    <div className="cl-rs-split is-even">
      <section className="cl-banco-chart" aria-labelledby="cl-rs-barrios-title">
        <header className="cl-rs-head"><h3 id="cl-rs-barrios-title">Barrios con más candidatos</h3><p>Pendientes del banco por barrio.</p></header>
        <StackedBars label="Candidatos del banco por barrio" onSelect={(key) => key && onOpenBanco({ barrio: key })} emptyText="El banco no tiene pendientes." rows={banco.barrios.map((row) => ({ key: row.barrio, label: row.barrio, total: row.total, parts: [{ key: "t", label: "Pendientes", value: row.total, color: "#1465d9" }] }))} />
      </section>
      <section className="cl-rs-reportes" aria-labelledby="cl-rs-reportes-title">
        <header className="cl-rs-head"><h3 id="cl-rs-reportes-title">Reportes técnicos por atender</h3><p>Hallazgos de campo que esperan a la oficina.</p></header>
        {reportesPendientes.length ? <table className="cl-rs-table is-compact">
          <thead><tr><th scope="col">Estado</th><th scope="col" className="is-num">Reportes</th><th scope="col" className="is-num">El más antiguo</th></tr></thead>
          <tbody>
            {reportesPendientes.map(([key, label]) => { const fila = data.reportes[key]; return <tr key={key} className={fila.espera >= 7 ? "is-overdue" : ""}>
              <td><button type="button" className="cl-rs-clave" onClick={() => onOpenReportes(key)}>{label}</button></td>
              <td className="is-num"><strong>{fila.total}</strong></td>
              <td className="is-num">{fila.espera == null ? "—" : fila.espera === 0 ? "Hoy" : <strong>Hace {plural(fila.espera, "día", "días")}</strong>}</td>
            </tr>; })}
          </tbody>
        </table> : <p className="cl-rs-empty"><Icon name="checkCircle" />No hay reportes esperando a la oficina.</p>}
        <p className="cl-rs-band-note">{reportesCerrados ? <><strong>{reportesCerrados}</strong> ya aprobados o vinculados a una ficha · </> : null}<button type="button" className="cl-rs-more is-inline" onClick={() => onOpenReportes("")}>Ver todos los reportes<Icon name="arrowRight" /></button></p>
      </section>
    </div>
  </section>;
}
