import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import { createInspeccionesApi } from "../services/inspeccionesApi";
import { useInspecciones } from "../hooks/useInspecciones";
import InspeccionesTable from "../components/InspeccionesTable";
import NuevaInspeccionModal from "../components/NuevaInspeccionModal";
import InspeccionDetallePanel from "../components/InspeccionDetallePanel";
import InspeccionesStatsPage from "./InspeccionesStatsPage";
import { estadoClass, estadoLabel, formatDate } from "../utils/inspeccionesFormatters";
import "../styles/inspecciones.css";

const tabFromHash = () => location.hash.match(/^#inspecciones\/(\w+)/)?.[1] || "resumen";

export default function InspeccionesPage({ apiFetch, session, showAlert }) {
  const api = useMemo(() => createInspeccionesApi(apiFetch), [apiFetch]);
  const [tab, setTab] = useState(tabFromHash);
  const [config, setConfig] = useState(null);
  const [tecnicos, setTecnicos] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [showNueva, setShowNueva] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const model = useInspecciones(api, Boolean(config));
  const isAdmin = session?.user?.role === "admin";

  useEffect(() => {
    api.config().then(setConfig).catch((error) => showAlert(error.message));
    api.tecnicos().then(setTecnicos).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  useEffect(() => {
    if (tab !== "resumen") return;
    api.resumen().then(setResumen).catch(() => {});
  }, [api, tab]);

  useEffect(() => {
    const change = () => setTab(tabFromHash());
    addEventListener("hashchange", change);
    return () => removeEventListener("hashchange", change);
  }, []);

  const go = (key) => {
    history.replaceState(null, "", `#inspecciones/${key}`);
    setTab(key);
  };

  const refreshAll = () => {
    model.reload();
    api.resumen().then(setResumen).catch(() => {});
    api.tecnicos().then(setTecnicos).catch(() => {});
  };

  if (!config) return <main className="cl-module"><div className="cl-module-loading"><Icon name="refresh" />Cargando módulo Inspecciones…</div></main>;

  return (
    <main className="cl-module">
      <header className="cl-module-header">
        <div>
          <span className="cl-kicker">Control Aguas</span>
          <h1>Inspecciones</h1>
          <p>Asignación, seguimiento en campo e impresión en un mismo flujo.</p>
        </div>
        <nav aria-label="Secciones de Inspecciones">
          <button type="button" className={tab === "resumen" ? "is-active" : ""} onClick={() => go("resumen")}><Icon name="dashboard" />Resumen</button>
          <button type="button" className={tab === "ver" ? "is-active" : ""} onClick={() => go("ver")}><Icon name="records" />Ver inspecciones</button>
          {config.permissions.can_view_stats ? (
            <button type="button" className={tab === "estadisticas" ? "is-active" : ""} onClick={() => go("estadisticas")}><Icon name="activity" />Estadísticas</button>
          ) : null}
        </nav>
        <div className="cl-drawer-main-actions" style={{ justifyContent: "flex-end" }}>
          {config.permissions.can_create ? (
            <button type="button" className="cl-primary" onClick={() => setShowNueva(true)}><Icon name="plus" />Nueva inspección</button>
          ) : null}
        </div>
      </header>

      {tab === "resumen" ? (
        <section className="cl-inbox">
          <div className="cl-indicators" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
            <button type="button" onClick={() => { go("ver"); model.setFilters({ estado: "ASIGNADA" }); }}>Asignadas<strong>{resumen?.asignadas ?? "—"}</strong></button>
            <button type="button" onClick={() => { go("ver"); model.setFilters({ estado: "EN_PROCESO" }); }}>En proceso<strong>{resumen?.en_proceso ?? "—"}</strong></button>
            <button type="button" onClick={() => { go("ver"); model.setFilters({ estado: "SEGUIMIENTO" }); }}>Seguimiento<strong>{resumen?.seguimiento ?? "—"}</strong></button>
            <button type="button" onClick={() => go("ver")}>Finalizadas este mes<strong>{resumen?.finalizadas_mes ?? "—"}</strong></button>
          </div>
          <h3>Inspecciones que requieren acción</h3>
          <ul className="cl-history">
            {!model.items.filter((item) => item.estado !== "FINALIZADA").length ? (
              <li className="is-empty">No hay inspecciones pendientes por ahora.</li>
            ) : (
              model.items.filter((item) => item.estado !== "FINALIZADA").slice(0, 5).map((item) => (
                <li key={item.id}>
                  <i />
                  <div>
                    <button type="button" className="cl-link" onClick={() => setSelectedId(item.id)}>
                      <strong>{item.numero_inspeccion} · {item.abonado_nombre_snapshot || "General"}</strong>
                    </button>
                    <span className={`cl-status ${estadoClass(item.estado)}`}><i />{estadoLabel(item.estado)}</span>
                    <span> · {item.tecnico_responsable_nombre || "—"} · {formatDate(item.fecha_asignacion)}</span>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}

      {tab === "ver" ? <InspeccionesTable model={model} tecnicos={tecnicos} isAdmin={isAdmin} onOpen={(item) => setSelectedId(item.id)} /> : null}

      {tab === "estadisticas" && config.permissions.can_view_stats ? <InspeccionesStatsPage api={api} notify={showAlert} /> : null}

      {showNueva ? (
        <NuevaInspeccionModal
          api={api}
          tecnicos={tecnicos}
          notify={showAlert}
          onClose={() => setShowNueva(false)}
          onCreated={(created) => {
            setShowNueva(false);
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
    </main>
  );
}
