import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import { createEntregasApi } from "../services/entregasApi";
import { useLotes } from "../hooks/useLotes";
import { useNoEntregadas } from "../hooks/useNoEntregadas";
import { useAvanceJornada } from "../hooks/useAvanceJornada";
import { useReparto } from "../hooks/useReparto";
import EntregasStats from "../components/EntregasStats";
import AvanceJornada from "../components/AvanceJornada";
import LoteForm from "../components/LoteForm";
import ActaSobrantesConsolidada from "../components/ActaSobrantesConsolidada";
import LotesTable from "../components/LotesTable";
import CierreLoteDialog from "../components/CierreLoteDialog";
import LoteCerradoAviso from "../components/LoteCerradoAviso";
import MisLotesPorCerrar from "../components/MisLotesPorCerrar";
import LoteDetalle from "../components/LoteDetalle";
import { NO_ENTREGADAS_FILTROS_INICIALES } from "../hooks/useNoEntregadas";
import NoEntregadasTable from "../components/NoEntregadasTable";
import NoEntregadaDetalle from "../components/NoEntregadaDetalle";
import ControlDescartes from "../components/ControlDescartes";
import PersonalCampoTable from "../components/PersonalCampoTable";
import RepartoBarrios from "../components/RepartoBarrios";
import ReportesSemanales from "../components/ReportesSemanales";
import { GraficoBarriosSobrantes, GraficoPorDia } from "../components/ReporteCharts";
import { formatDate, formatNumber } from "../utils/entregasFormatters";
import { addDaysIso, toLocalIsoDate } from "../utils/entregasDate";
import LatticeLoader from "../../../components/micro/LatticeLoader";
import "../styles/entregas.css";

// "Nuevo lote" no vive aqui: es una accion, no una vista a la que se vuelve, asi
// que su unica entrada es el boton primario del header (ver mas abajo).
const SUBVISTAS = [
  { key: "resumen", label: "Resumen", corto: "Resumen", hint: "Efectividad", icon: "dashboard" },
  { key: "lotes", label: "Lotes diarios", corto: "Hoy", hint: "Reparto y cierre", icon: "records" },
  { key: "historial", label: "Lotes anteriores", corto: "Anteriores", hint: "Historial", icon: "history" },
  { key: "pendientes", label: "No entregadas", corto: "Pendientes", hint: "Seguimiento", icon: "warning" },
  { key: "descartes", label: "Control de descartes", corto: "Descartes", hint: "Repetidos", icon: "inbox" },
  { key: "reparto", label: "Reparto por barrio", corto: "Reparto", hint: "Zonas", icon: "map" },
  { key: "personal", label: "Personal de campo", corto: "Personal", hint: "Técnicos", icon: "users" },
  { key: "reportes", label: "Reportes semanales", corto: "Reportes", hint: "Informes", icon: "archive" }
];

// Sin sección en el enlace, quien ve todo entra al Resumen y el técnico directo a
// "Hoy", donde están sus lotes por cerrar.
const vistaDelHash = () => window.location.hash.match(/^#entregas\/([\w-]+)/)?.[1] || "";
const vistaInicial = (config) => (config?.permissions?.can_view_all === false ? "lotes" : "resumen");

// Cifra sobre el icono de una pestaña; el nombre completo va para lectores de pantalla.
function Contador({ valor }) {
  if (!valor) return null;
  return <span className={`ent-tab-contador ${valor.tono ? `is-${valor.tono}` : ""}`.trim()}>
    <span aria-hidden="true">{valor.n > 99 ? "99+" : valor.n}</span>
    <span className="sr-only">{`${formatNumber(valor.n)} ${valor.etiqueta}`}</span>
  </span>;
}

export default function EntregasPage({ apiFetch, showAlert }) {
  const api = useMemo(() => createEntregasApi(apiFetch), [apiFetch]);
  const notify = useCallback((mensaje) => showAlert?.(mensaje), [showAlert]);

  const [vistaPedida, setVista] = useState(vistaDelHash);
  const [masMovilAbierto, setMasMovilAbierto] = useState(false);
  useEffect(() => {
    if (!masMovilAbierto) return undefined;
    const cerrar = (event) => {
      if (event.type === "keydown" ? event.key === "Escape" : !event.target.closest?.(".ent-mobile-tabs")) setMasMovilAbierto(false);
    };
    window.addEventListener("pointerdown", cerrar);
    window.addEventListener("keydown", cerrar);
    return () => {
      window.removeEventListener("pointerdown", cerrar);
      window.removeEventListener("keydown", cerrar);
    };
  }, [masMovilAbierto]);
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
  // Contadores de las pestañas: lotes de hoy por cerrar y documentos pendientes.
  const [contadores, setContadores] = useState({ hoyAbiertos: 0, pendientes: 0 });
  const [loteCerrado, setLoteCerrado] = useState(null);
  const vista = vistaPedida || vistaInicial(config);

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
  const reparto = useReparto(api, Boolean(config?.permissions?.can_manage_reparto) && vista === "reparto", personal);

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
      const hoy = toLocalIsoDate();
      const ayer = addDaysIso(hoy, -1);
      const [previos, abiertosHoy, pendientesDocs] = await Promise.all([
        api.lotes({ estado: "ABIERTO", fecha_hasta: ayer, limit: 6 }),
        api.lotes({ estado: "ABIERTO", fecha_desde: hoy, fecha_hasta: hoy, limit: 1 }),
        api.noEntregadas({ estado: "PENDIENTE", limit: 1 })
      ]);
      setLotesAbiertosPrevios(previos);
      setContadores({ hoyAbiertos: Number(abiertosHoy.total) || 0, pendientes: Number(pendientesDocs.total) || 0 });
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
    const cambio = () => setVista(vistaDelHash());
    window.addEventListener("hashchange", cambio);
    return () => window.removeEventListener("hashchange", cambio);
  }, []);

  const ir = (key) => {
    window.history.replaceState(null, "", `#entregas/${key}`);
    setVista(key);
    setMasMovilAbierto(false);
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

  const cerrarAviso = useCallback(() => setLoteCerrado(null), []);

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
          {configError ? (
            <>
              <Icon name="refresh" />
              {configError}
              <button type="button" onClick={() => { setConfigError(""); api.config().then(setConfig).catch((error) => setConfigError(error.message)); }}>Reintentar</button>
            </>
          ) : (
            <LatticeLoader label="Cargando Control de entregas…" showTimer />
          )}
        </div>
      </main>
    );
  }

  const subvistas = SUBVISTAS.filter((item) => {
    if (item.key === "reportes") return config.permissions.can_generate_report;
    if (item.key === "reparto") return config.permissions.can_manage_reparto;
    if (item.key === "descartes") return config.permissions.can_view_descartes;
    return true;
  });
  // En la barra inferior del celular caben 5 pestañas con su nombre completo; si hay
  // más, van 4 y "Más" abre el resto.
  const movilPrincipales = subvistas.length > 5 ? subvistas.slice(0, 4) : subvistas;
  const movilExtra = subvistas.length > 5 ? subvistas.slice(4) : [];
  const movilExtraActiva = movilExtra.some((item) => item.key === vista);
  // Cifra de cada pestaña: lo que espera acción en esa sección. Anteriores en rojo,
  // porque un lote de otro día abierto ya está atrasado.
  const contadorDe = (key) => ({
    lotes: contadores.hoyAbiertos ? { n: contadores.hoyAbiertos, etiqueta: contadores.hoyAbiertos === 1 ? "lote de hoy por cerrar" : "lotes de hoy por cerrar" } : null,
    historial: lotesAbiertosPrevios.total ? { n: lotesAbiertosPrevios.total, etiqueta: lotesAbiertosPrevios.total === 1 ? "lote anterior sin cerrar" : "lotes anteriores sin cerrar", tono: "critico" } : null,
    pendientes: contadores.pendientes ? { n: contadores.pendientes, etiqueta: contadores.pendientes === 1 ? "documento pendiente" : "documentos pendientes" } : null
  })[key] || null;
  // Lotes de hoy por cerrar a cargo de quien mira: los suyos y, si es técnico, también
  // los de personal sin usuario en la app (los guarda y cierra cualquier técnico).
  const propioId = config.personal_vinculado?.id;
  const misLotesAbiertos = propioId ? avance.lotesHoy.filter((lote) => lote.estado === "ABIERTO" && (Number(lote.responsable_id) === Number(propioId) || (!config.permissions.can_view_all && lote.responsable_user_id == null))) : [];

  return (
    <main className="cl-module ent-module">
      {/* El nombre del módulo ya está marcado en el menú lateral: aquí solo queda
          para lectores de pantalla, y las pestañas suben al lugar del título. */}
      <header className="cl-module-header ent-head">
        <h1 className="sr-only">Control de entregas</h1>
        <nav className="ent-menu" aria-label="Secciones de Control de entregas">
          {subvistas.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`ent-menu-card ${vista === item.key ? "is-active" : ""}`}
              aria-current={vista === item.key ? "page" : undefined}
              data-group={["reparto", "personal", "reportes"].includes(item.key) ? "gestion" : "operacion"}
              onClick={() => ir(item.key)}
            >
              <Icon name={item.icon} />
              <span>
                {item.corto}
              </span>
              <Contador valor={contadorDe(item.key)} />
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
        {movilPrincipales.map((item) => (
          <button key={item.key} type="button" className={vista === item.key ? "is-active" : ""} aria-current={vista === item.key ? "page" : undefined} onClick={() => ir(item.key)}>
            <span className="ent-tab-icono"><Icon name={item.icon} /><Contador valor={contadorDe(item.key)} /></span>
            <span>{item.corto}</span>
          </button>
        ))}
        {movilExtra.length ? (
          <button
            type="button"
            className={movilExtraActiva || masMovilAbierto ? "is-active" : ""}
            aria-expanded={masMovilAbierto}
            aria-controls="ent-mobile-mas"
            onClick={() => setMasMovilAbierto((abierto) => !abierto)}
          >
            <Icon name={movilExtraActiva ? movilExtra.find((item) => item.key === vista).icon : "more"} />
            <span>{movilExtraActiva ? movilExtra.find((item) => item.key === vista).corto : "Más"}</span>
          </button>
        ) : null}
        {masMovilAbierto ? (
          <div id="ent-mobile-mas" className="ent-mobile-mas">
            {movilExtra.map((item) => (
              <button key={item.key} type="button" className={vista === item.key ? "is-active" : ""} aria-current={vista === item.key ? "page" : undefined} onClick={() => ir(item.key)}>
                <Icon name={item.icon} />
                <span><strong>{item.label}</strong><small>{item.hint}</small></span>
              </button>
            ))}
          </div>
        ) : null}
      </nav>

      {lotesAbiertosPrevios.total > 0 ? <div className="ent-critical-banner" role="status"><Icon name="warning" /><div><strong>{formatNumber(lotesAbiertosPrevios.total)} lotes de jornadas anteriores siguen abiertos</strong><span>Prioridad de cierre · la justificación no elimina el pendiente.</span></div><button type="button" className="cl-secondary" onClick={verAbiertosPrevios}>Resolver cierres →</button></div> : null}

      {vista === "resumen" ? (
        <section className="cl-inbox">
          <div className="cl-inbox-head ent-head-compacta">
            <div>
              <h3>Semana del {resumen ? `${formatDate(resumen.periodo.fecha_inicio)} al ${formatDate(resumen.periodo.fecha_fin)}` : "…"}</h3>
              {resumen?.lotes_abiertos ? <p>La efectividad es parcial: {formatNumber(resumen.lotes_abiertos)} {resumen.lotes_abiertos === 1 ? "lote sigue abierto" : "lotes siguen abiertos"}.</p> : null}
            </div>
            <button type="button" className="cl-quiet ent-icon-only" onClick={cargarResumen} disabled={cargandoResumen} aria-label={cargandoResumen ? "Actualizando…" : "Actualizar el resumen"} title="Actualizar">
              <Icon name="refresh" className={cargandoResumen ? "ent-refresh-icon is-spinning" : "ent-refresh-icon"} />
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
              </ul>
              <button type="button" className="cl-secondary" onClick={() => irAPendientes({ dias_minimos: "" })}>
                Ver documentos pendientes
              </button>
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

      {vista === "lotes" ? <MisLotesPorCerrar lotes={misLotesAbiertos} propioId={propioId} onCerrar={abrirCierre} onAbrir={abrirDetalle} /> : null}

      {vista === "lotes" && config.permissions.can_view_all ? (
        <AvanceJornada model={avance} fecha={config.jornada?.fecha || toLocalIsoDate()} onVerAnteriores={() => ir("historial")} onAbrirLote={abrirDetalle} />
      ) : null}

      {vista === "lotes" ? (
        <LotesTable
          model={lotes}
          config={config}
          personal={personal}
          permissions={config.permissions}
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

      {vista === "descartes" && config.permissions.can_view_descartes ? (
        <ControlDescartes api={api} config={config} onOpen={(documento) => setDocumentoAbierto(documento.id)} />
      ) : null}

      {vista === "historial" ? (
        <div className="ent-historial-acciones">
          <ActaSobrantesConsolidada api={api} filtros={historial.filters} motivos={config.motivos} notify={notify} />
        </div>
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

      {vista === "reparto" && config.permissions.can_manage_reparto ? (
        <RepartoBarrios model={reparto} personal={personal} permissions={config.permissions} notify={notify} />
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
          onSaved={(actualizado) => {
            setLoteEnCierre(null);
            refrescar();
            setLoteCerrado(actualizado || loteEnCierre);
          }}
        />
      ) : null}

      {loteCerrado ? (
        <LoteCerradoAviso
          lote={loteCerrado}
          onListo={cerrarAviso}
          onVerLote={() => { const lote = loteCerrado; setLoteCerrado(null); abrirDetalle(lote); }}
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
