import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import FichasInbox from "../components/FichasInbox";
import FichaDrawer from "../components/FichaDrawer";
import { useFichas } from "../hooks/useFichas";
import { createClandestinosApi } from "../services/clandestinosApi";
import ReportesTecnicosPage from "./ReportesTecnicosPage";
import ImpresionesPage from "./ImpresionesPage";
import "../styles/clandestinos.css";

const tabs = [["resumen","Resumen","dashboard"],["fichas","Fichas","records"],["reportes","Reportes técnicos","activity"],["impresiones","Impresiones","print"],["configuracion","Configuración","more"]];
const tabFromHash = () => location.hash.match(/^#clandestinos\/(\w+)/)?.[1] || "fichas";

export default function ClandestinosPage({ apiFetch, session, showAlert, navigate, onPrintFicha, onPrintAviso }) {
  const api = useMemo(() => createClandestinosApi(apiFetch), [apiFetch]); const [tab, setTab] = useState(tabFromHash); const [config, setConfig] = useState(null); const [drawer, setDrawer] = useState(undefined); const [selected, setSelected] = useState(new Map()); const [comparison, setComparison] = useState(null); const [bulkLoading, setBulkLoading] = useState(false);
  const fichas = useFichas(api, Boolean(config));
  useEffect(() => { api.config().then(setConfig).catch((error) => showAlert(error.message)); }, [api]);
  useEffect(() => { const change = () => setTab(tabFromHash()); addEventListener("hashchange", change); return () => removeEventListener("hashchange", change); }, []);
  const go = (key) => { if (key === "resumen") { navigate("dashboard"); return; } history.replaceState(null, "", `#clandestinos/${key}`); setTab(key); };
  const toggle = (record) => setSelected((current) => { const next = new Map(current); const key = String(record.id); next.has(key) ? next.delete(key) : next.set(key, record); return next; });
  const selectAll = async () => { if (selected.size === fichas.total && fichas.total) { setSelected(new Map()); return; } setBulkLoading(true); try { const data = await api.fichas({ q: fichas.filters.query, state: fichas.filters.state, barrio: fichas.filters.barrio, page: 1, limit: 500 }); setSelected(new Map(data.items.map((item) => [String(item.id), item]))); showAlert(`${data.items.length} fichas seleccionadas.`); } catch (error) { showAlert(error.message); } finally { setBulkLoading(false); } };
  const compareSelected = async () => { if (!selected.size) return; setBulkLoading(true); try { const data = await api.compareFichas([...selected.keys()]); setComparison(data); showAlert(`Comparacion lista: ${data.summary.alcaldia_only} posibles clandestinas aparecen en Alcaldia y no en Aguas.`); } catch (error) { showAlert(error.message); } finally { setBulkLoading(false); } };
  if (!config) return <main className="cl-module"><div className="cl-module-loading"><Icon name="refresh" />Cargando módulo Clandestinos…</div></main>;
  return <main className="cl-module"><header className="cl-module-header"><div><span className="cl-kicker">Control Aguas</span><h1>Inmuebles clandestinos</h1><p>Expedientes, campo e impresión en un flujo controlado.</p></div><nav aria-label="Secciones de Clandestinos">{tabs.filter(([key]) => key !== "configuracion" || config.permissions.can_manage_configuration).map(([key,label,icon]) => <button type="button" key={key} className={tab === key ? "is-active" : ""} onClick={() => go(key)}><Icon name={icon} />{label}</button>)}</nav><div className="cl-role"><Icon name="users" /><span>{session?.user?.full_name || session?.user?.username}<small>{session?.user?.role}</small></span></div></header>
    {tab === "fichas" ? <FichasInbox model={fichas} selectedIds={new Set(selected.keys())} onToggle={toggle} onSelectAll={selectAll} onCompare={compareSelected} onPrintSummary={() => { sessionStorage.setItem("aguas.clandestinos.printTemplate", "batch_list"); go("impresiones"); }} comparison={comparison} bulkLoading={bulkLoading} onOpen={setDrawer} onNew={() => setDrawer(null)} canCreate={config.permissions.can_manage_ficha_state} /> : null}
    {tab === "reportes" ? <ReportesTecnicosPage api={api} config={config} notify={showAlert} /> : null}
    {tab === "impresiones" ? <ImpresionesPage records={[...selected.values()]} /> : null}
    {tab === "configuracion" ? <section className="cl-config"><header className="cl-page-head"><div><span className="cl-kicker">Administración</span><h2>Configuración del módulo</h2><p>Catálogos visibles para controlar los flujos sin valores ambiguos.</p></div></header><div className="cl-config-grid"><article><Icon name="records" /><h3>Estados de ficha</h3><p>{config.ficha_states.join(" · ")}</p></article><article><Icon name="activity" /><h3>Estados de reportes</h3><p>{config.report_states.join(" · ")}</p></article><article><Icon name="print" /><h3>Plantillas</h3><p>{config.print_templates.join(" · ")}</p></article><article><Icon name="users" /><h3>Permisos efectivos</h3><p>{Object.entries(config.permissions).filter(([,value]) => value).map(([key]) => key).join(" · ")}</p></article></div></section> : null}
    {drawer !== undefined ? <FichaDrawer record={drawer} api={api} config={config} notify={showAlert} onClose={() => setDrawer(undefined)} onPrintFicha={onPrintFicha} onPrintAviso={onPrintAviso} onSaved={async (saved, close = true) => { setSelected((current) => { const key = String(saved.id); if (!current.has(key)) return current; const next = new Map(current); next.set(key, saved); return next; }); await fichas.reload(); if (close) setDrawer(undefined); else setDrawer(saved); }} /> : null}
  </main>;
}
