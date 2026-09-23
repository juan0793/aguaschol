import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../../components/Icon";
import FichasInbox from "../components/FichasInbox";
import FichaDrawer from "../components/FichaDrawer";
import BancoClandestinos from "../components/BancoClandestinos";
import ResumenClandestinos from "../components/ResumenClandestinos";
import { useFichas } from "../hooks/useFichas";
import { useBanco } from "../hooks/useBanco";
import { useReportes } from "../hooks/useReportes";
import { createClandestinosApi } from "../services/clandestinosApi";
import ReportesTecnicosPage from "./ReportesTecnicosPage";
import ImpresionesPage from "./ImpresionesPage";
import LatticeLoader from "../../../components/micro/LatticeLoader";
import "../styles/clandestinos.css";

const tabs = [["resumen","Resumen","dashboard"],["fichas","Fichas","records"],["banco","Banco","inbox"],["reportes","Reportes técnicos","activity"],["impresiones","Impresiones","print"],["configuracion","Configuración","more"]];
const tabFromHash = () => location.hash.match(/^#clandestinos\/(\w+)/)?.[1] || "fichas";
// Secciones que trabajan fuera del flujo normal de fichas: al entrar se marca
// el borde de toda la app con su color para que no se confundan.
const MODOS = { banco: "Banco de campo · revisión de candidatos", impresiones: "Centro de impresión · documentos oficiales" };
const plural = (value, singular, pluralText) => `${Number(value || 0).toLocaleString("es-HN")} ${Number(value) === 1 ? singular : pluralText}`;

export default function ClandestinosPage({ apiFetch, session, showAlert, navigate, focusRequest, onFocusConsumed, onPrintFicha, onPrintAviso, command, onStatusChange }) {
  const api = useMemo(() => createClandestinosApi(apiFetch), [apiFetch]); const [tab, setTab] = useState(tabFromHash); const [config, setConfig] = useState(null); const [drawer, setDrawer] = useState(undefined); const [selected, setSelected] = useState(new Map()); const [comparison, setComparison] = useState(null); const [bulkLoading, setBulkLoading] = useState(false);
  const fichas = useFichas(api, true);
  // La validadora de campo entra directo a lo que le asignaron.
  const banco = useBanco(api, tab === "banco", { defaultAsignado: session?.user?.role === "validadora_campo" ? "mine" : "" });
  const reportes = useReportes(api, tab === "reportes");
  useEffect(() => { api.config().then(setConfig).catch((error) => showAlert(error.message)); }, [api]);
  useEffect(() => { const change = () => setTab(tabFromHash()); addEventListener("hashchange", change); return () => removeEventListener("hashchange", change); }, []);
  useEffect(() => {
    if (!focusRequest || !config) return;
    history.replaceState(null, "", "#clandestinos/fichas");
    setTab("fichas");
    api.fichas({ q: focusRequest.clave_catastral || "", limit: 8 }).then((data) => {
      const found = data.items.find((item) => String(item.id) === String(focusRequest.fichaId)) || data.items[0];
      if (found) setDrawer(found);
      else showAlert("Sin ficha relacionada.");
    }).catch((error) => showAlert(error.message)).finally(() => onFocusConsumed?.());
  }, [api, config, focusRequest, onFocusConsumed, showAlert]);
  const go = (key) => { history.replaceState(null, "", `#clandestinos/${key}`); setTab(key); };
  // Desde el Resumen: abrir cada pestaña con el filtro de lo que se tocó.
  const abrirFichas = (state = "", { alertas = false } = {}) => {
    if (alertas) sessionStorage.setItem("aguas.clandestinos.focus", "alerts");
    fichas.filters.setQuery(""); fichas.filters.setBarrio(""); fichas.filters.setState(state);
    go("fichas");
  };
  const abrirBanco = ({ dictamen = "", asignado = "" } = {}) => {
    banco.filters.setQuery(""); banco.filters.setBarrio(""); banco.filters.setEstado("pendiente"); banco.filters.setDictamen(dictamen); banco.filters.setAsignado(asignado);
    go("banco");
  };
  const abrirReportes = (state = "") => { reportes.setState(state); go("reportes"); };

  // Órdenes que llegan desde la barra superior de la app (buscar clave, actualizar).
  const handledCommand = useRef(null);
  useEffect(() => {
    if (!command || handledCommand.current === command.id) return;
    handledCommand.current = command.id;
    if (command.type === "search") { go("fichas"); fichas.filters.setQuery(command.q || ""); }
    if (command.type === "refresh") { fichas.reload(); if (tab === "banco") banco.reload(); }
  }, [command]); // eslint-disable-line react-hooks/exhaustive-deps

  // La barra superior muestra si el módulo está trabajando y qué hay cargado.
  const totalExpedientes = Object.values(fichas.counts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const busy = !config || fichas.loading || fichas.refreshing || bulkLoading || (tab === "banco" && (banco.loading || banco.refreshing));
  const busyLabel = !config ? "Cargando módulo" : bulkLoading ? "Procesando selección" : tab === "banco" && (banco.loading || banco.refreshing) ? "Actualizando banco" : "Actualizando fichas";
  const statusSummary = [plural(totalExpedientes, "expediente", "expedientes"), tab === "banco" && banco.estados?.pendiente != null ? `${banco.estados.pendiente} en banco por revisar` : null, selected.size ? `${selected.size} para imprimir` : null].filter(Boolean).join(" · ");
  useEffect(() => { onStatusChange?.({ busy, label: busyLabel, summary: statusSummary }); }, [busy, busyLabel, statusSummary, onStatusChange]);
  useEffect(() => () => onStatusChange?.(null), [onStatusChange]);

  const toggle = (record) => setSelected((current) => { const next = new Map(current); const key = String(record.id); next.has(key) ? next.delete(key) : next.set(key, record); return next; });
  const toggleVisible = (records) => setSelected((current) => { const next = new Map(current); const remove = records.every((record) => next.has(String(record.id))); records.forEach((record) => remove ? next.delete(String(record.id)) : next.set(String(record.id), record)); return next; });
  const selectAll = async () => { setBulkLoading(true); try { const data = await api.fichas({ q: fichas.filters.query, state: fichas.filters.state, barrio: fichas.filters.barrio, page: 1, limit: 500 }); setSelected(new Map(data.items.map((item) => [String(item.id), item]))); showAlert(`${data.items.length} fichas seleccionadas.`); } catch (error) { showAlert(error.message); } finally { setBulkLoading(false); } };
  const compareSelected = async () => { if (!selected.size) return; setBulkLoading(true); try { const data = await api.compareFichas([...selected.keys()]); setComparison(data); showAlert(`Comparacion lista: ${data.summary.alcaldia_only} posibles clandestinas aparecen en Alcaldia y no en Aguas.`); } catch (error) { showAlert(error.message); } finally { setBulkLoading(false); } };
  const openBancoFicha = async (candidato) => { try { const data = await api.fichas({ q: candidato.clave_catastral, limit: 8 }); const found = data.items.find((item) => Number(item.id) === Number(candidato.inmueble_id)); if (found) setDrawer(found); else showAlert("La ficha ya no está activa; revisa archivados."); } catch (error) { showAlert(error.message); } };
  if (!config) return <main className="cl-module"><div className="cl-module-loading"><LatticeLoader label="Cargando módulo Clandestinos…" showTimer /></div></main>;

  // El encabezado dice en qué sección se está y qué contiene, no un rótulo fijo.
  const reportesPorAtender = ["new", "review", "info_requested"].reduce((sum, key) => sum + Number(reportes.counts[key] || 0), 0);
  const secciones = {
    resumen: { icon: "dashboard", title: "Resumen de clandestinos", detail: "Cómo va el proceso: fichas, banco de campo, técnicos y reportes" },
    fichas: { icon: "records", title: "Fichas clandestinas", detail: `${plural(totalExpedientes, "expediente", "expedientes")} en seguimiento${fichas.counts?.confirmed ? ` · ${fichas.counts.confirmed} con aviso pendiente` : ""}` },
    banco: { icon: "inbox", title: "Banco de clandestinos", detail: banco.estados?.pendiente != null ? `${plural(banco.estados.pendiente, "punto de campo", "puntos de campo")} por revisar · ${banco.estados.enviado || 0} enviados a ficha` : "Puntos de campo verificados contra Aguas y Alcaldía" },
    reportes: { icon: "activity", title: "Reportes técnicos", detail: reportes.total ? `${plural(reportesPorAtender, "hallazgo de campo", "hallazgos de campo")} por atender · ${reportes.total} en total` : "Hallazgos que registran los técnicos en campo, para revisar y vincular a una ficha" },
    impresiones: { icon: "print", title: "Centro de impresión", detail: selected.size ? `${plural(selected.size, "ficha lista", "fichas listas")} para imprimir` : "Marca fichas en la bandeja para prepararlas" },
    configuracion: { icon: "settings", title: "Configuración del módulo", detail: "Catálogos, plantillas y permisos" }
  };
  const seccion = secciones[tab] || secciones.fichas;
  const modo = MODOS[tab];

  return <main className={`cl-module ${modo ? `is-mode is-mode-${tab}` : ""}`.trim()}>
    {modo ? createPortal(<div className={`cl-mode-frame is-${tab}`} aria-hidden="true"><span><Icon name={seccion.icon} />{modo}</span></div>, document.body) : null}
    <header className="cl-module-header"><div className="cl-module-heading"><span className="cl-module-emblem" key={tab} aria-hidden="true"><Icon name={seccion.icon} /></span><div><span className="cl-kicker">Clandestinos{modo ? <em className="cl-mode-chip">Módulo especial</em> : null}</span><h1>{seccion.title}</h1><p aria-live="polite">{seccion.detail}</p></div></div><nav aria-label="Secciones de Clandestinos">{tabs.filter(([key]) => key !== "configuracion" || config.permissions.can_manage_configuration).map(([key,label,icon]) => <button type="button" key={key} className={`${tab === key ? "is-active" : ""} ${MODOS[key] ? `is-special is-${key}` : ""}`.trim()} onClick={() => go(key)}><Icon name={icon} />{label}</button>)}</nav><div className="cl-role"><Icon name="users" /><span>{session?.user?.full_name || session?.user?.username}<small>{session?.user?.role}</small></span></div></header>
    {tab === "fichas" ? <FichasInbox model={fichas} selectedIds={new Set(selected.keys())} onToggle={toggle} onToggleVisible={toggleVisible} onSelectAll={selectAll} onClearSelection={() => setSelected(new Map())} onCompare={compareSelected} onPrintSummary={() => { sessionStorage.setItem("aguas.clandestinos.printTemplate", "batch_list"); go("impresiones"); }} comparison={comparison} bulkLoading={bulkLoading} onOpen={setDrawer} onNew={() => setDrawer(null)} canCreate={config.permissions.can_manage_ficha_state} /> : null}
    {tab === "banco" ? <BancoClandestinos api={api} model={banco} permissions={config.permissions} session={session} notify={showAlert} onOpenFicha={openBancoFicha} onFichaCreated={(ficha) => { fichas.reload(); setDrawer(ficha); }} /> : null}
    {tab === "resumen" ? <ResumenClandestinos api={api} onOpenFichas={abrirFichas} onOpenBanco={abrirBanco} onOpenReportes={abrirReportes} /> : null}
    {tab === "reportes" ? <ReportesTecnicosPage api={api} config={config} notify={showAlert} model={reportes} /> : null}
    {tab === "impresiones" ? <ImpresionesPage records={[...selected.values()]} onGoFichas={() => go("fichas")} onClearSelection={() => setSelected(new Map())} /> : null}
    {tab === "configuracion" ? <section className="cl-config"><header className="cl-page-head"><div><span className="cl-kicker">Administración</span><h2>Configuración del módulo</h2><p>Catálogos visibles para controlar los flujos sin valores ambiguos.</p></div></header><div className="cl-config-grid"><article><Icon name="records" /><h3>Estados de ficha</h3><p>{config.ficha_states.join(" · ")}</p></article><article><Icon name="activity" /><h3>Estados de reportes</h3><p>{config.report_states.join(" · ")}</p></article><article><Icon name="print" /><h3>Plantillas</h3><p>{config.print_templates.join(" · ")}</p></article><article><Icon name="users" /><h3>Permisos efectivos</h3><p>{Object.entries(config.permissions).filter(([,value]) => value).map(([key]) => key).join(" · ")}</p></article></div></section> : null}
    {drawer !== undefined ? <FichaDrawer record={drawer} api={api} config={config} notify={showAlert} onClose={() => setDrawer(undefined)} onPrintFicha={onPrintFicha} onPrintAviso={onPrintAviso} onSaved={async (saved, close = true) => { setSelected((current) => { const key = String(saved.id); if (!current.has(key)) return current; const next = new Map(current); next.set(key, saved); return next; }); await fichas.reload(); if (close) setDrawer(undefined); else setDrawer(saved); }} /> : null}
  </main>;
}
