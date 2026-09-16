import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import { createInspeccionesApi } from "../services/inspeccionesApi";
import { useInspecciones } from "../hooks/useInspecciones";
import InspeccionesTable from "../components/InspeccionesTable";
import NuevaInspeccionModal from "../components/NuevaInspeccionModal";
import InspeccionDetallePanel from "../components/InspeccionDetallePanel";
import InspeccionesStatsPage from "./InspeccionesStatsPage";
import InspeccionesResumen from "../components/InspeccionesResumen";
import { useResumenInspecciones } from "../hooks/useResumenInspecciones";
import { BANDEJA_FILTROS, lastMonths, monthLabel } from "../utils/inspeccionesFormatters";
import "../styles/inspecciones.css";

// La ruta vive en el hash: #inspecciones/resumen?estado=proceso&mes=2026-08
const parseHash = () => {
  const match = location.hash.match(/^#inspecciones\/(\w+)(?:\?(.*))?/);
  const params = new URLSearchParams(match?.[2] || "");
  const estado = params.get("estado") || "";
  const mes = params.get("mes") || "";
  return {
    tab: match?.[1] || "resumen",
    filtro: BANDEJA_FILTROS.some((f) => f.key === estado) ? estado : "",
    mes: /^\d{4}-\d{2}$/.test(mes) ? mes : ""
  };
};
const tabFromHash = () => parseHash().tab;

const TABS = [
  { key: "resumen", label: "Resumen", icon: "dashboard" },
  { key: "ver", label: "Ver inspecciones", icon: "records" },
  { key: "estadisticas", label: "Estadísticas", icon: "activity", adminOnly: true }
];

export default function InspeccionesPage({ apiFetch, session, showAlert, focusRequest, onFocusConsumed }) {
  const api = useMemo(() => createInspeccionesApi(apiFetch), [apiFetch]);
  const [tab, setTab] = useState(tabFromHash);
  const [config, setConfig] = useState(null);
  const [tecnicos, setTecnicos] = useState([]);
  const [showNueva, setShowNueva] = useState(false);
  const [initialNueva, setInitialNueva] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [statsRefreshToken, setStatsRefreshToken] = useState(0);
  const [filtro, setFiltro] = useState(() => parseHash().filtro);
  const [mes, setMes] = useState(() => parseHash().mes);

  const model = useInspecciones(api, Boolean(config));
  const isAdmin = session?.user?.role === "admin";
  const resumen = useResumenInspecciones(api, { mes, active: Boolean(config) && tab === "resumen" });

  useEffect(() => {
    api.config().then(setConfig).catch((error) => showAlert(error.message));
    api.tecnicos().then(setTecnicos).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  useEffect(() => {
    const change = () => {
      const route = parseHash();
      setTab(route.tab);
      if (route.tab === "resumen") {
        setFiltro(route.filtro);
        setMes(route.mes);
      }
    };
    addEventListener("hashchange", change);
    return () => removeEventListener("hashchange", change);
  }, []);

  useEffect(() => {
    if (!focusRequest || !config) return;
    if (!config.permissions?.can_create) {
      showAlert("Tu rol no puede crear inspecciones.");
      onFocusConsumed?.();
      return;
    }
    history.replaceState(null, "", "#inspecciones/ver");
    setTab("ver");
    setInitialNueva(focusRequest);
    setShowNueva(true);
    onFocusConsumed?.();
  }, [config, focusRequest, onFocusConsumed, showAlert]);

  const go = (key) => {
    history.replaceState(null, "", `#inspecciones/${key}`);
    setTab(key);
  };

  // Filtro y mes se guardan en la URL (sin crear entradas de historial) para que se
  // conserven al volver atrás desde otra pestaña o desde el detalle.
  const syncResumenUrl = (next) => {
    const params = new URLSearchParams();
    if (next.filtro) params.set("estado", next.filtro);
    if (next.mes) params.set("mes", next.mes);
    const query = params.toString();
    history.replaceState(null, "", `#inspecciones/resumen${query ? `?${query}` : ""}`);
  };
  const changeFiltro = (value) => {
    setFiltro(value);
    syncResumenUrl({ filtro: value, mes });
  };
  const changeMes = (value) => {
    const next = value === resumen.data?.mes_actual ? "" : value;
    setMes(next);
    syncResumenUrl({ filtro, mes: next });
  };

  const refreshAll = () => {
    model.reload();
    resumen.reload();
    api.tecnicos().then(setTecnicos).catch(() => {});
    setStatsRefreshToken((value) => value + 1);
  };

  if (!config) return <main className="cl-module"><div className="cl-module-loading"><Icon name="refresh" />Cargando módulo Inspecciones…</div></main>;

  const openNueva = () => { setInitialNueva(null); setShowNueva(true); };
  const mesActual = resumen.data?.mes_actual || "";
  const mesSeleccionado = mes || mesActual;

  return (
    <main className={`cl-module ins-module ${config.permissions.can_create ? "has-cta" : ""}`}>
      <header className="ins-header">
        <div className="ins-header-title">
          <span className="ins-eyebrow">Control Aguas</span>
          <h1>Inspecciones</h1>
          <p>Asignación, seguimiento en campo e impresión en un mismo flujo.</p>
        </div>
        <div className="ins-header-actions">
          {tab === "resumen" && mesActual ? (
            <label className="ins-month">
              <Icon name="calendar" />
              <span className="is-long">{monthLabel(mesSeleccionado)}</span>
              <span className="is-short">{monthLabel(mesSeleccionado, { short: true })}</span>
              <Icon name="chevronDown" />
              <select aria-label="Mes del resumen" value={mesSeleccionado} onChange={(event) => changeMes(event.target.value)}>
                {lastMonths(mesActual).map((value) => <option key={value} value={value}>{monthLabel(value)}</option>)}
              </select>
            </label>
          ) : null}
          {config.permissions.can_create ? (
            <button type="button" className="ins-primary ins-header-cta" onClick={openNueva}><Icon name="plus" />Nueva inspección</button>
          ) : null}
        </div>
        <nav className="ins-tabs" aria-label="Secciones de Inspecciones">
          {TABS.filter((item) => !item.adminOnly || config.permissions.can_view_stats).map((item) => (
            <a key={item.key} href={`#inspecciones/${item.key}`} aria-current={tab === item.key ? "page" : undefined}>
              <Icon name={item.icon} />{item.label}
            </a>
          ))}
        </nav>
      </header>

      {tab === "resumen" ? (
        <InspeccionesResumen
          data={resumen.data}
          loading={resumen.loading}
          error={resumen.error}
          filtro={filtro}
          onFiltro={changeFiltro}
          onOpen={(item) => setSelectedId(item.id)}
          onVerTodas={() => {
            // go() reemplaza la entrada actual; se empuja una nueva para que "atrás" regrese al Resumen filtrado.
            history.pushState(null, "", "#inspecciones/ver");
            setTab("ver");
          }}
          isAdmin={isAdmin}
        />
      ) : null}

      {tab === "ver" ? <InspeccionesTable model={model} tecnicos={tecnicos} isAdmin={isAdmin} onOpen={(item) => setSelectedId(item.id)} /> : null}

      {tab === "estadisticas" && config.permissions.can_view_stats ? (
        <InspeccionesStatsPage
          api={api}
          notify={showAlert}
          refreshToken={statsRefreshToken}
          onDrill={(filters) => {
            go("ver");
            model.setFilters(filters);
          }}
        />
      ) : null}

      {showNueva ? (
        <NuevaInspeccionModal
          api={api}
          tecnicos={tecnicos}
          initialData={initialNueva}
          notify={showAlert}
          onClose={() => { setShowNueva(false); setInitialNueva(null); }}
          onCreated={(created) => {
            // Si la inspeccion nacio de un apunte, queda la trazabilidad en el apunte. La nota
            // original no se archiva ni se borra.
            if (initialNueva?.from_note_id) {
              apiFetch(`/admin/notes/${initialNueva.from_note_id}/links`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ target_type: "inspeccion", target_id: String(created.id) })
              }).then((response) => {
                if (!response.ok) showAlert("La inspección se creó, pero no se pudo registrar el vínculo con el apunte.");
              }).catch(() => showAlert("La inspección se creó, pero no se pudo registrar el vínculo con el apunte."));
            }
            setShowNueva(false);
            setInitialNueva(null);
            refreshAll();
            setSelectedId(created.id);
          }}
        />
      ) : null}

      {selectedId ? (
        <InspeccionDetallePanel
          api={api}
          session={session}
          id={selectedId}
          tecnicosElegibles={tecnicos}
          notify={showAlert}
          onClose={() => { setSelectedId(null); refreshAll(); }}
          onChanged={refreshAll}
        />
      ) : null}
      {config.permissions.can_create && !showNueva && !selectedId ? (
        <div className="ins-cta-bar">
          <button type="button" className="ins-primary" onClick={openNueva}><Icon name="plus" />Nueva inspección</button>
        </div>
      ) : null}
    </main>
  );
}
