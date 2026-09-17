import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import { createEntregasApi } from "../services/entregasApi";
import { useLotes } from "../hooks/useLotes";
import { useNoEntregadas } from "../hooks/useNoEntregadas";
import { useAvanceJornada } from "../hooks/useAvanceJornada";
import EntregasStats from "../components/EntregasStats";
import AvanceJornada from "../components/AvanceJornada";
import LoteForm from "../components/LoteForm";
import LotesTable from "../components/LotesTable";
import CierreLoteDialog from "../components/CierreLoteDialog";
import LoteDetalle from "../components/LoteDetalle";
import { NO_ENTREGADAS_FILTROS_INICIALES } from "../hooks/useNoEntregadas";
import NoEntregadasTable from "../components/NoEntregadasTable";
import NoEntregadaDetalle from "../components/NoEntregadaDetalle";
import PersonalCampoTable from "../components/PersonalCampoTable";
import ReportesSemanales from "../components/ReportesSemanales";
import { GraficoBarriosSobrantes, GraficoPorDia } from "../components/ReporteCharts";
import { formatDate, formatNumber } from "../utils/entregasFormatters";
import { addDaysIso, toLocalIsoDate } from "../utils/entregasDate";
import "../styles/entregas.css";

// "Nuevo lote" no vive aqui: es una accion, no una vista a la que se vuelve, asi
// que su unica entrada es el boton primario del header (ver mas abajo).
const SUBVISTAS = [
  { key: "resumen", label: "Resumen", corto: "Resumen", hint: "Efectividad", icon: "dashboard" },
  { key: "lotes", label: "Lotes diarios", corto: "Hoy", hint: "Reparto y cierre", icon: "records" },
  { key: "historial", label: "Lotes anteriores", corto: "Anteriores", hint: "Historial", icon: "history" },
  { key: "pendientes", label: "No entregadas", corto: "Pendientes", hint: "Seguimiento", icon: "warning" },
  { key: "personal", label: "Personal de campo", corto: "Personal", hint: "Técnicos", icon: "users" },
  { key: "reportes", label: "Reportes semanales", corto: "Reportes", hint: "Informes", icon: "archive" }
];

const vistaDesdeHash = () => window.location.hash.match(/^#entregas\/([\w-]+)/)?.[1] || "resumen";

export default function EntregasPage({ apiFetch, showAlert }) {
  const api = useMemo(() => createEntregasApi(apiFetch), [apiFetch]);
  const notify = useCallback((mensaje) => showAlert?.(mensaje), [showAlert]);

  const [vista, setVista] = useState(vistaDesdeHash);
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState("");
  const [loteDetalle, setLoteDetalle] = useState(null);
  const [personal, setPersonal] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [lotesAbiertosPrevios, setLotesAbiertosPrevios] = useState({ items: [], total: 0 });
  const [loteEnCierre, setLoteEnCierre] = useState(null);
  const [loteEnEdicion, setLoteEnEdicion] = useState(null);
  const [documentoAbierto, setDocumentoAbierto] = useState(null);
  const [cargandoResumen, setCargandoResumen] = useState(false);

  const lotes = useLotes(api, Boolean(config) && ["lotes", "resumen"].includes(vista));
  // La barra de avance no sigue los filtros de la tabla: siempre mira la jornada
  // de hoy y, de lo anterior, solo el acumulado del ciclo vigente.
  const avance = useAvanceJornada(api, {
    activo: Boolean(config) && vista === "lotes",
    fecha: config?.jornada?.fecha || toLocalIsoDate(),
    desdeAnterior: config?.ciclo?.fecha_inicio || ""
  });
  const historial = useLotes(api, Boolean(config) && vista === "historial", { historial: true });
  const pendientes = useNoEntregadas(api, Boolean(config) && vista === "pendientes");

  const cargarPersonal = useCallback(async () => {
    try {
      setPersonal(await api.personal());
    } catch (error) {
      notify(error.message);
    }
  }, [api, notify]);

  const cargarResumen = useCallback(async () => {
    setCargandoResumen(true);
    try {
      setResumen(await api.resumen());
    } catch (error) {
      notify(error.message);
    } finally {
      setCargandoResumen(false);
    }
  }, [api, notify]);

  const cargarLotesAbiertosPrevios = useCallback(async () => {
    try {
      const ayer = addDaysIso(toLocalIsoDate(), -1);
      setLotesAbiertosPrevios(await api.lotes({ estado: "ABIERTO", fecha_hasta: ayer, limit: 6 }));
    } catch (error) {
      notify(error.message);
    }
  }, [api, notify]);

  useEffect(() => {
    api.config().then(setConfig).catch((error) => setConfigError(error.message));
  }, [api, notify]);

  useEffect(() => {
    if (!config) return;
    cargarPersonal();
    cargarResumen();
    cargarLotesAbiertosPrevios();
  }, [cargarLotesAbiertosPrevios, cargarPersonal, cargarResumen, config]);

  useEffect(() => {
    if (!config) return;
    const actualizar = () => {
      if (document.visibilityState !== "visible") return;
      cargarLotesAbiertosPrevios();
      // La barra de avance se mueve mientras los tecnicos cierran: entra al
      // mismo pulso (no hace nada si la vista Hoy no esta abierta).
      avance.reload();
      api.config().then(setConfig).catch(() => {});
    };
    const timer = setInterval(actualizar, 60_000);
    window.addEventListener("focus", actualizar);
    return () => { clearInterval(timer); window.removeEventListener("focus", actualizar); };
  }, [api, avance.reload, Boolean(config), cargarLotesAbiertosPrevios]);

  const abrirDetalle = useCallback(async (lote) => {
    try { setLoteDetalle(await api.lote(lote.id)); }
    catch (error) { notify(error.message); }
  }, [api, notify]);

  useEffect(() => {
    const abrirEnlace = () => {
      const id = new URLSearchParams(window.location.hash.split("?")[1]).get("lote");
      if (config && /^\d+$/.test(id || "")) abrirDetalle({ id });
    };
    abrirEnlace();
    window.addEventListener("hashchange", abrirEnlace);
    return () => window.removeEventListener("hashchange", abrirEnlace);
  }, [abrirDetalle, Boolean(config)]);

  const cerrarDetalle = () => {
    setLoteDetalle(null);
    if (window.location.hash.includes("?lote=")) window.history.replaceState(null, "", "#entregas/lotes");
  };

  // Los usuarios solo se piden cuando el administrador entra a Personal de campo.
  useEffect(() => {
    if (vista !== "personal" || !config?.permissions.can_manage_personal || usuarios.length) return;
    apiFetch("/users")
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setUsuarios(Array.isArray(data) ? data : data?.items || []))
      .catch(() => setUsuarios([]));
  }, [apiFetch, config, usuarios.length, vista]);

  useEffect(() => {
    const cambio = () => setVista(vistaDesdeHash());
    window.addEventListener("hashchange", cambio);
    return () => window.removeEventListener("hashchange", cambio);
  }, []);

  const ir = (key) => {
    window.history.replaceState(null, "", `#entregas/${key}`);
    setVista(key);
  };

  const refrescar = () => {
    cargarResumen();
    cargarPersonal();
    cargarLotesAbiertosPrevios();
    lotes.reload();
    avance.reload();
  };

  const crearLote = async (payload) => {
    const creado = await api.crearLote(payload);
    notify(`Lote #${creado.id} creado.`);
    refrescar();
    ir("lotes");
    return creado;
  };

  const editarLote = async (payload) => {
    const actualizado = await api.actualizarLote(loteEnEdicion.id, payload);
    notify(`Lote #${actualizado.id} actualizado.`);
    setLoteEnEdicion(null);
    refrescar();
    ir("lotes");
    return actualizado;
  };

  const abrirEdicion = async (lote) => {
    try {
      cerrarDetalle();
      setLoteEnEdicion(await api.lote(lote.id));
      ir("editar");
    } catch (error) {
      notify(error.message);
    }
  };

  const verHoy = () => {
    const hoy = config.jornada?.fecha || toLocalIsoDate();
    lotes.setFilters({ q: "", responsable_id: "", barrio_codigo: "", tipo_documento: "", estado: "", fecha_desde: hoy, fecha_hasta: hoy });
    ir("lotes");
  };

  const verAbiertosPrevios = () => {
    historial.setFilters({ q: "", responsable_id: "", barrio_codigo: "", tipo_documento: "", estado: "ABIERTO", fecha_desde: "", fecha_hasta: addDaysIso(config.jornada?.fecha || toLocalIsoDate(), -1) });
    ir("historial");
  };

  // Cada renglon de "Requiere atencion" salta directo a Pendientes con su propio filtro
  // (dias_minimos, estado), en vez de solo mostrar el numero.
  const irAPendientes = (filtros) => {
    pendientes.setFilters({ ...NO_ENTREGADAS_FILTROS_INICIALES, ...filtros });
    ir("pendientes");
  };

  const abrirCierre = async (lote) => {
    try {
      const actual = await api.lote(lote.id);
      if (actual.estado !== "ABIERTO") { setLoteDetalle(actual); return; }
      cerrarDetalle();
      setLoteEnCierre(actual);
    } catch (error) {
      notify(error.message);
    }
  };

  const guardarPersonal = async (id, payload) => {
    if (id) await api.actualizarPersonal(id, payload);
    else await api.crearPersonal(payload);
    await cargarPersonal();
    notify(id ? "Persona actualizada." : "Persona registrada.");
  };

  if (!config) {
    return (
      <main className="cl-module ent-module">
        <div className="cl-module-loading">
          <Icon name="refresh" />
          {configError || "Cargando Control de entregas…"}
          {configError ? <button type="button" onClick={() => { setConfigError(""); api.config().then(setConfig).catch((error) => setConfigError(error.message)); }}>Reintentar</button> : null}
        </div>
      </main>
    );
  }

  const subvistas = SUBVISTAS.filter((item) => {
    if (item.key === "reportes") return config.permissions.can_generate_report;
    return true;
  });

  return (
    <main className="cl-module ent-module">
      <header className="cl-module-header">
        <div>
          <span className="cl-kicker">Control Aguas</span>
          <h1>Control de entregas</h1>
          <p>Seguimiento diario de facturas y notas de cobro.</p>
        </div>
        <nav className="ent-menu" aria-label="Secciones de Control de entregas">
          {subvistas.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`ent-menu-card ${vista === item.key ? "is-active" : ""}`}
              aria-current={vista === item.key ? "page" : undefined}
              data-group={["personal", "reportes"].includes(item.key) ? "gestion" : "operacion"}
              onClick={() => ir(item.key)}
            >
              <Icon name={item.icon} />
              <span>
                {item.corto}
              </span>
            </button>
          ))}
        </nav>
        <div className="cl-drawer-main-actions ent-header-action">
          {config.permissions.can_create_lote ? (
            <button type="button" className="cl-primary" onClick={() => ir("nuevo")}>
              <Icon name="plus" />
              Nuevo lote
            </button>
          ) : null}
        </div>
      </header>

      <nav className="ent-mobile-tabs" aria-label="Navegación móvil de Control de entregas">
        {subvistas.map((item) => (
          <button key={item.key} type="button" className={vista === item.key ? "is-active" : ""} onClick={() => ir(item.key)}>
            <Icon name={item.icon} />
            <span>{item.corto}</span>
          </button>
        ))}
      </nav>

      {lotesAbiertosPrevios.total > 0 ? <div className="ent-critical-banner" role="status"><Icon name="warning" /><div><strong>{formatNumber(lotesAbiertosPrevios.total)} lotes de jornadas anteriores siguen abiertos</strong><span>Prioridad de cierre · la justificación no elimina el pendiente.</span></div><button type="button" className="cl-secondary" onClick={verAbiertosPrevios}>Resolver cierres →</button></div> : null}

      {vista === "resumen" ? (
        <section className="cl-inbox">
          <div className="cl-inbox-head">
            <div>
              <span className="cl-kicker">
                {resumen ? `${formatDate(resumen.periodo.fecha_inicio)} — ${formatDate(resumen.periodo.fecha_fin)}` : "Semana en curso"}
              </span>
              <h3>Resultado de la semana</h3>
              <p>Entregas confirmadas al cerrar. La efectividad sobre lo asignado es parcial mientras existan lotes abiertos.</p>
            </div>
            <button type="button" className="cl-quiet" onClick={cargarResumen} disabled={cargandoResumen}>
              <Icon name="refresh" className={cargandoResumen ? "ent-refresh-icon is-spinning" : "ent-refresh-icon"} />
              {cargandoResumen ? "Actualizando…" : "Actualizar"}
            </button>
          </div>

          <EntregasStats
            resumen={resumen}
            onSelect={(clave) => {
              if (["pendientes", "reentregadas", "no_localizadas"].includes(clave)) {
                irAPendientes({ estado: { pendientes: "PENDIENTE", reentregadas: "REENTREGADA", no_localizadas: "NO_LOCALIZADA" }[clave], fecha_desde: resumen?.periodo.fecha_inicio || "", fecha_hasta: resumen?.periodo.fecha_fin || "" });
                return;
              }
              lotes.setFilters({ q: "", responsable_id: "", barrio_codigo: "", tipo_documento: "", estado: "", fecha_desde: resumen?.periodo.fecha_inicio || "", fecha_hasta: resumen?.periodo.fecha_fin || "" });
              ir("lotes");
            }}
          />

          <div className="ent-resumen-grid">
            <GraficoPorDia rows={resumen?.por_dia || []} />
            <div className="ent-card">
              <h3>Requiere atención</h3>
              <ul className="ent-lista-plana" onKeyDown={(event) => { if (["Enter", " "].includes(event.key) && event.target.getAttribute("role") === "button") { event.preventDefault(); event.target.click(); } }}>
                <li className="is-clickable" role="button" tabIndex={0} onClick={() => { lotes.setFilters({ q: "", responsable_id: "", barrio_codigo: "", tipo_documento: "", estado: "ABIERTO", fecha_desde: resumen?.periodo.fecha_inicio || "", fecha_hasta: resumen?.periodo.fecha_fin || "" }); ir("lotes"); }}>
                  <span className="ent-fila-etiqueta">
                    <i />
                    Lotes abiertos
                  </span>
                  <strong>{formatNumber(resumen?.lotes_abiertos)}</strong>
                </li>
                {lotesAbiertosPrevios.total ? (
                  <li className="is-atencion is-clickable" role="button" tabIndex={0} onClick={verAbiertosPrevios}>
                    <span className="ent-fila-etiqueta">
                      <i />
                      Abiertos anteriores
                    </span>
                    <strong>{formatNumber(lotesAbiertosPrevios.total)}</strong>
                  </li>
                ) : null}
                <li className="is-atencion is-clickable" role="button" tabIndex={0} onClick={() => irAPendientes({ dias_minimos: "3", fecha_desde: resumen?.periodo.fecha_inicio || "", fecha_hasta: resumen?.periodo.fecha_fin || "" })}>
                  <span className="ent-fila-etiqueta">
                    <i />
                    Pendientes con más de 3 días
                  </span>
                  <strong>{formatNumber(resumen?.pendientes_mas_3_dias)}</strong>
                </li>
                <li className="is-critico is-clickable" role="button" tabIndex={0} onClick={() => irAPendientes({ dias_minimos: "7", fecha_desde: resumen?.periodo.fecha_inicio || "", fecha_hasta: resumen?.periodo.fecha_fin || "" })}>
                  <span className="ent-fila-etiqueta">
                    <i />
                    Pendientes con más de 7 días
                  </span>
                  <strong>{formatNumber(resumen?.pendientes_mas_7_dias)}</strong>
                </li>
                <li className="is-clickable" role="button" tabIndex={0} onClick={() => irAPendientes({ estado: "NO_LOCALIZADA", fecha_desde: resumen?.periodo.fecha_inicio || "", fecha_hasta: resumen?.periodo.fecha_fin || "" })}>
                  <span className="ent-fila-etiqueta">
                    <i />
                    No localizadas
                  </span>
                  <strong>{formatNumber(resumen?.no_localizadas)}</strong>
                </li>
              </ul>
              <button type="button" className="cl-secondary" onClick={() => irAPendientes({ dias_minimos: "" })}>
                Ver documentos pendientes
              </button>
              {lotesAbiertosPrevios.total ? (
                <button type="button" className="cl-secondary" onClick={verAbiertosPrevios}>
                  <Icon name="history" />
                  Volver a jornadas anteriores
                </button>
              ) : null}
            </div>
            <div className="ent-resumen-wide">
              <GraficoBarriosSobrantes
                rows={resumen?.por_barrio || []}
                onSelect={(fila) => {
                  lotes.setFilters({ q: "", responsable_id: "", tipo_documento: "", estado: "", barrio_codigo: fila.barrio_codigo, fecha_desde: resumen?.periodo.fecha_inicio || "", fecha_hasta: resumen?.periodo.fecha_fin || "" });
                  ir("lotes");
                }}
              />
            </div>
          </div>
        </section>
      ) : null}

      {vista === "nuevo" && config.permissions.can_create_lote ? (
        <LoteForm
          config={config}
          personal={personal}
          notify={notify}
          onSaved={crearLote}
          onCancel={() => ir("lotes")}
        />
      ) : null}

      {vista === "editar" && loteEnEdicion && config.permissions.can_edit_lote ? (
        <LoteForm
          config={config}
          personal={personal}
          notify={notify}
          lote={loteEnEdicion}
          onSaved={editarLote}
          onCancel={() => {
            setLoteEnEdicion(null);
            ir("lotes");
          }}
        />
      ) : null}

      {vista === "lotes" ? (
        <AvanceJornada model={avance} fecha={config.jornada?.fecha || toLocalIsoDate()} onVerAnteriores={() => ir("historial")} />
      ) : null}

      {vista === "lotes" ? (
        <LotesTable
          model={lotes}
          config={config}
          personal={personal}
          permissions={config.permissions}
          onToday={verHoy}
          onOpen={abrirDetalle}
          onCerrar={abrirCierre}
        />
      ) : null}

      {vista === "pendientes" ? (
        <NoEntregadasTable
          model={pendientes}
          config={config}
          personal={personal}
          api={api}
          notify={notify}
          onOpen={(documento) => setDocumentoAbierto(documento.id)}
          onCicloCerrado={() => { api.config().then(setConfig).catch(() => {}); pendientes.reload(); refrescar(); }}
        />
      ) : null}

      {vista === "historial" ? (
        <LotesTable
          historial
          model={historial}
          config={config}
          personal={personal}
          permissions={config.permissions}
          onOpen={abrirDetalle}
          onCerrar={abrirCierre}
        />
      ) : null}

      {vista === "personal" ? (
        <PersonalCampoTable
          config={config}
          personal={personal}
          permissions={config.permissions}
          usuarios={usuarios}
          notify={notify}
          onSubmit={guardarPersonal}
          onToggle={(persona) => guardarPersonal(persona.id, { activo: !persona.activo })}
        />
      ) : null}

      {vista === "reportes" && config.permissions.can_generate_report ? (
        <ReportesSemanales api={api} config={config} permissions={config.permissions} notify={notify} />
      ) : null}

      {loteEnCierre ? (
        <CierreLoteDialog
          api={api}
          config={config}
          lote={loteEnCierre}
          notify={notify}
          onClose={() => setLoteEnCierre(null)}
          onSaved={() => {
            setLoteEnCierre(null);
            refrescar();
            notify("Lote cerrado correctamente.");
          }}
        />
      ) : null}

      {loteDetalle ? <LoteDetalle key={loteDetalle.id} lote={loteDetalle} permissions={config.permissions} motivos={config.motivos} api={api} notify={notify} onClose={cerrarDetalle} onEdit={abrirEdicion} onCerrar={abrirCierre} onChanged={() => { abrirDetalle(loteDetalle); refrescar(); }} onDeleted={() => { cerrarDetalle(); refrescar(); }} /> : null}

      {documentoAbierto ? (
        <NoEntregadaDetalle
          api={api}
          config={config}
          id={documentoAbierto}
          personal={personal}
          permissions={config.permissions}
          notify={notify}
          onClose={() => setDocumentoAbierto(null)}
          onChanged={() => {
            pendientes.reload();
            cargarResumen();
          }}
        />
      ) : null}
    </main>
  );
}

export { SUBVISTAS as ENTREGAS_SUBVISTAS };
