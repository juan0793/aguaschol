import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import ExclusionesEntrega from "../components/ExclusionesEntrega";
import PersonalCampoTable from "../components/PersonalCampoTable";
import RepartoBarrios from "../components/RepartoBarrios";
import ReportesSemanales from "../components/ReportesSemanales";
import PrioridadBarrios, { PrioridadResumen } from "../components/PrioridadBarrios";
import AvanceMes from "../components/AvanceMes";
import { EquipoHoy, MenuImprimir } from "../components/ResumenOficina";
import { PlanBarriosDialog, PlanMananaTarjeta } from "../components/PlanBarrios";
import { equipoHoy, sinPlanParaManana, textoComparacion } from "../utils/resumenEntregas.js";
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
  { key: "pendientes", label: "No entregadas", corto: "Pendientes", cortoMovil: "Pend.", hint: "Seguimiento", icon: "warning" },
  { key: "descartes", label: "Descartes", corto: "Descartes", hint: "Sin entregar y repetidos", icon: "inbox" },
  { key: "reparto", label: "Reparto por barrio", corto: "Reparto", hint: "Zonas", icon: "map" },
  { key: "prioridad", label: "Barrios por prioridad", corto: "Prioridad", hint: "Lo que falta, por urgencia", icon: "barChart" },
  { key: "personal", label: "Personal de campo", corto: "Personal", hint: "Técnicos", icon: "users" },
  { key: "reportes", label: "Reportes semanales", corto: "Reportes", hint: "Informes", icon: "archive" },
  { key: "exclusiones", label: "Exclusiones", corto: "Exclusiones", hint: "Otro departamento entrega", icon: "flag" }
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

export default function EntregasPage({ apiFetch, session, showAlert }) {
  const api = useMemo(() => createEntregasApi(apiFetch), [apiFetch]);
  const notify = useCallback((mensaje) => showAlert?.(mensaje), [showAlert]);

  const [vistaPedida, setVista] = useState(vistaDelHash);
  // Pestañas del encabezado: si no caben junto a "Nuevo lote" se compactan (sin
  // icono y con menos relleno) y, solo si aun así no caben, se desvanece el borde
  // para que se note que la barra se desliza. Se mide con clases sobre el nodo
  // (no con estado) para no redibujar la página.
  const menuRef = useRef(null);
  const observadorMenu = useRef(null);
  const medirMenu = useCallback(() => {
    const nav = menuRef.current;
    if (!nav) return;
    nav.classList.remove("is-compacto", "is-desbordado");
    if (nav.scrollWidth <= nav.clientWidth + 1) return;
    nav.classList.add("is-compacto");
    if (nav.scrollWidth > nav.clientWidth + 1) nav.classList.add("is-desbordado");
  }, []);
  const refMenu = useCallback((nodo) => {
    observadorMenu.current?.disconnect();
    menuRef.current = nodo;
    if (!nodo || typeof ResizeObserver === "undefined") return;
    observadorMenu.current = new ResizeObserver(medirMenu);
    observadorMenu.current.observe(nodo);
  }, [medirMenu]);
  // Los contadores de las pestañas cambian el ancho sin cambiar el tamaño de la barra.
  useLayoutEffect(() => { medirMenu(); });
  // Respaldo por si el navegador no avisa del cambio de tamaño de la barra.
  useEffect(() => {
    window.addEventListener("resize", medirMenu);
    return () => window.removeEventListener("resize", medirMenu);
  }, [medirMenu]);
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
  // La oficina anota el plan de un técnico desde "El equipo hoy".
  const [planDe, setPlanDe] = useState(null);
  // Sube al guardar un plan: la tarjeta de Hoy se vuelve a leer.
  const [planVersion, setPlanVersion] = useState(0);
  const vista = vistaPedida || vistaInicial(config);

  const lotes = useLotes(api, Boolean(config) && ["lotes", "resumen"].includes(vista));
  // La barra de avance no sigue los filtros de la tabla: siempre mira la jornada
  // de hoy y, de lo anterior, solo el acumulado del ciclo vigente.
  const avance = useAvanceJornada(api, {
    activo: Boolean(config) && (vista === "lotes" || (vista === "resumen" && config.permissions.can_view_all)),
    fecha: config?.jornada?.fecha || toLocalIsoDate(),
    desdeAnterior: config?.ciclo?.fecha_inicio || ""
  });
  const historial = useLotes(api, Boolean(config) && vista === "historial", { historial: true });
  const pendientes = useNoEntregadas(api, Boolean(config) && vista === "pendientes");
  const reparto = useReparto(api, Boolean(config?.permissions?.can_manage_reparto) && vista === "reparto", personal);
  // Los primeros barrios por prioridad, para el Resumen de la oficina.
  const [prioridadTop, setPrioridadTop] = useState({ datos: null, error: "" });
  const resumenOficina = Boolean(config?.permissions?.can_view_all) && vista === "resumen";
  const cargarPrioridadTop = useCallback(() => {
    api.prioridad()
      .then((datos) => setPrioridadTop({ datos, error: "" }))
      .catch((error) => setPrioridadTop((actual) => ({ datos: actual.datos, error: error.message })));
  }, [api]);
  useEffect(() => { if (resumenOficina) cargarPrioridadTop(); }, [resumenOficina, cargarPrioridadTop]);

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

  // Solo la primera configuración dispara estas cargas: el refresco de cada minuto
  // y el de volver a la ventana traen otro objeto y no deben recargarlo todo.
  const configLista = Boolean(config);
  useEffect(() => {
    if (!configLista) return;
    cargarPersonal();
    cargarResumen();
    cargarLotesAbiertosPrevios();
  }, [cargarLotesAbiertosPrevios, cargarPersonal, cargarResumen, configLista]);

  useEffect(() => {
    if (!config) return;
    const actualizar = () => {
      if (document.visibilityState !== "visible") return;
      cargarLotesAbiertosPrevios();
      // La barra de avance se mueve mientras los tecnicos cierran: entra al
      // mismo pulso (no hace nada si la vista Hoy no esta abierta).
      avance.reload();
      // Si nada cambió se conserva el mismo objeto y la pantalla no se redibuja.
      api.config()
        .then((nueva) => setConfig((actual) => (JSON.stringify(actual) === JSON.stringify(nueva) ? actual : nueva)))
        .catch(() => {});
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
      const parametros = new URLSearchParams(window.location.hash.split("?")[1]);
      const id = parametros.get("lote");
      if (config && /^\d+$/.test(id || "")) abrirDetalle({ id });
      // Aviso de la oficina en la campana del técnico: abre el documento.
      const documento = parametros.get("documento");
      if (config && /^\d+$/.test(documento || "")) setDocumentoAbierto(Number(documento));
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
  const cerrarPlanDe = useCallback(() => setPlanDe(null), []);
  const planGuardado = useCallback(() => {
    setPlanVersion((valor) => valor + 1);
    avance.reload();
    if (config?.permissions?.can_view_all) cargarPrioridadTop();
  }, [avance.reload, cargarPrioridadTop, config?.permissions?.can_view_all]);

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
    if (item.key === "prioridad") return Boolean(config.permissions.can_view_prioridad);
    if (item.key === "descartes" || item.key === "exclusiones") return config.permissions.can_view_descartes;
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
        <nav ref={refMenu} className="ent-menu" aria-label="Secciones de Control de entregas">
          {subvistas.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`ent-menu-card ${vista === item.key ? "is-active" : ""}`}
              aria-current={vista === item.key ? "page" : undefined}
              data-group={["reparto", "prioridad", "personal", "reportes", "exclusiones"].includes(item.key) ? "gestion" : "operacion"}
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
          <button key={item.key} type="button" className={vista === item.key ? "is-active" : ""} aria-label={item.label} aria-current={vista === item.key ? "page" : undefined} onClick={() => ir(item.key)}>
            <span className="ent-tab-icono"><Icon name={item.icon} /><Contador valor={contadorDe(item.key)} /></span>
            <span>{item.cortoMovil || item.corto}</span>
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

      {vista === "resumen" ? (() => {
        const oficina = Boolean(config.permissions.can_view_all);
        const filtrosSemana = { fecha_desde: resumen?.periodo.fecha_inicio || "", fecha_hasta: resumen?.periodo.fecha_fin || "" };
        const sinPlan = oficina ? sinPlanParaManana(avance.mes) : [];
        const equipo = oficina && avance.mes ? equipoHoy({ barrios: avance.mes.barrios, lotesHoy: avance.lotesHoy, proxima: avance.mes.proxima_jornada }) : [];
        const comparacion = textoComparacion(resumen?.periodo_anterior);
        const actualizar = () => {
          cargarResumen();
          if (oficina) { avance.reload(); cargarPrioridadTop(); }
        };
        const atencion = (
          <div className="ent-card ent-atencion">
            <h3>Requiere atención</h3>
            <ul className="ent-lista-plana" onKeyDown={(event) => { if (["Enter", " "].includes(event.key) && event.target.getAttribute("role") === "button") { event.preventDefault(); event.target.click(); } }}>
              {oficina && sinPlan.length ? (
                <li className="is-atencion is-clickable" role="button" tabIndex={0} onClick={() => { const tarjeta = document.getElementById("ent-equipo-hoy"); tarjeta?.scrollIntoView({ behavior: "smooth", block: "center" }); tarjeta?.querySelector(".ent-equipo-manana-boton.is-sin-plan")?.focus({ preventScroll: true }); }} title="Cada técnico lo anota al cerrar su lote o desde Hoy; la oficina, en El equipo hoy.">
                  <div>
                    <span className="ent-fila-etiqueta"><i />Sin plan para la próxima jornada</span>
                    <small>{sinPlan.map((fila) => fila.nombre).join(" · ")}</small>
                  </div>
                  <strong>{formatNumber(sinPlan.length)}</strong>
                </li>
              ) : null}
              <li className="is-clickable" role="button" tabIndex={0} onClick={() => { lotes.setFilters({ q: "", responsable_id: "", barrio_codigo: "", tipo_documento: "", estado: "ABIERTO", ...filtrosSemana }); ir("lotes"); }}>
                <span className="ent-fila-etiqueta">
                  <i />
                  Lotes abiertos
                </span>
                <strong>{formatNumber(resumen?.lotes_abiertos)}</strong>
              </li>
              <li className="is-atencion is-clickable" role="button" tabIndex={0} onClick={() => irAPendientes({ dias_minimos: "3", ...filtrosSemana })}>
                <span className="ent-fila-etiqueta">
                  <i />
                  Pendientes con más de 3 días
                </span>
                <strong>{formatNumber(resumen?.pendientes_mas_3_dias)}</strong>
              </li>
              <li className="is-critico is-clickable" role="button" tabIndex={0} onClick={() => irAPendientes({ dias_minimos: "7", ...filtrosSemana })}>
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
        );
        const sobrantes = (
          <GraficoBarriosSobrantes
            rows={resumen?.por_barrio || []}
            onSelect={(fila) => {
              lotes.setFilters({ q: "", responsable_id: "", tipo_documento: "", estado: "", barrio_codigo: fila.barrio_codigo, ...filtrosSemana });
              ir("lotes");
            }}
          />
        );
        return (
          <section className="cl-inbox ent-resumen">
            <div className="cl-inbox-head ent-head-compacta">
              <div>
                <h3>Semana del {resumen ? `${formatDate(resumen.periodo.fecha_inicio)} al ${formatDate(resumen.periodo.fecha_fin)}` : "…"}</h3>
                {resumen ? (
                  <p>
                    {comparacion ? `Las flechas comparan ${comparacion}.` : ""}
                    {resumen.lotes_abiertos ? ` La efectividad es parcial: ${formatNumber(resumen.lotes_abiertos)} ${resumen.lotes_abiertos === 1 ? "lote sigue abierto" : "lotes siguen abiertos"}.` : ""}
                  </p>
                ) : null}
              </div>
              <div className="ent-resumen-acciones">
                <button type="button" className="cl-quiet ent-icon-only" onClick={actualizar} disabled={cargandoResumen} aria-label={cargandoResumen ? "Actualizando…" : "Actualizar el resumen"} title="Actualizar">
                  <Icon name="refresh" className={cargandoResumen ? "ent-refresh-icon is-spinning" : "ent-refresh-icon"} />
                </button>
                {oficina ? (
                  <MenuImprimir
                    mes={avance.mes}
                    onPrioridad={() => ir("prioridad")}
                    onReportes={config.permissions.can_generate_report ? () => ir("reportes") : null}
                  />
                ) : null}
              </div>
            </div>

            <EntregasStats
              resumen={resumen}
              onSelect={(clave) => {
                if (["pendientes", "reentregadas", "no_localizadas"].includes(clave)) {
                  irAPendientes({ estado: { pendientes: "PENDIENTE", reentregadas: "REENTREGADA", no_localizadas: "NO_LOCALIZADA" }[clave], ...filtrosSemana });
                  return;
                }
                lotes.setFilters({ q: "", responsable_id: "", barrio_codigo: "", tipo_documento: "", estado: "", ...filtrosSemana });
                ir("lotes");
              }}
            />

            {oficina ? (
              <div className="ent-resumen-oficina">
                <div className="ent-resumen-col">
                  {avance.mes?.total ? (
                    <div className="ent-card ent-resumen-avance">
                      <AvanceMes mes={avance.mes} onAbrirLote={abrirDetalle} />
                    </div>
                  ) : null}
                  {config.permissions.can_view_prioridad ? (
                    <PrioridadResumen datos={prioridadTop.datos} error={prioridadTop.error} onVerTodo={() => ir("prioridad")} />
                  ) : null}
                  <div className="ent-resumen-pareja">
                    <GraficoPorDia rows={resumen?.por_dia || []} />
                    {sobrantes}
                  </div>
                </div>
                <div className="ent-resumen-col">
                  {atencion}
                  <EquipoHoy filas={equipo} proxima={avance.mes?.proxima_jornada} hoy={avance.mes?.hasta} onAnotar={config.permissions.can_manage_reparto ? setPlanDe : null} />
                </div>
              </div>
            ) : (
              <div className="ent-resumen-grid">
                <GraficoPorDia rows={resumen?.por_dia || []} />
                {atencion}
                <div className="ent-resumen-wide">{sobrantes}</div>
              </div>
            )}
          </section>
        );
      })() : null}

      {vista === "nuevo" && config.permissions.can_create_lote ? (
        <LoteForm
          key={`lote-${session?.user?.id}-nuevo`}
          config={config}
          personal={personal}
          sessionUserId={session?.user?.id}
          notify={notify}
          onSaved={crearLote}
          onCancel={() => ir("lotes")}
        />
      ) : null}

      {vista === "editar" && loteEnEdicion && config.permissions.can_edit_lote ? (
        <LoteForm
          key={`lote-${session?.user?.id}-${loteEnEdicion.id}`}
          config={config}
          personal={personal}
          sessionUserId={session?.user?.id}
          notify={notify}
          lote={loteEnEdicion}
          onSaved={editarLote}
          onCancel={() => {
            setLoteEnEdicion(null);
            ir("lotes");
          }}
        />
      ) : null}

      {vista === "lotes" && config.permissions.can_close_own_lote && config.personal_vinculado?.id ? (
        <PlanMananaTarjeta key={`plan-${config.personal_vinculado.id}-${planVersion}`} api={api} responsableId={config.personal_vinculado.id} notify={notify} onGuardado={avance.reload} />
      ) : null}
      {vista === "lotes" && config.permissions.can_close_own_lote ? <MisLotesPorCerrar lotes={misLotesAbiertos} propioId={propioId} onCerrar={abrirCierre} onAbrir={abrirDetalle} /> : null}

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

      {vista === "exclusiones" && config.permissions.can_view_descartes ? (
        <ExclusionesEntrega
          api={api}
          config={config}
          notify={notify}
          onCambio={(lista) => setConfig((actual) => ({ ...actual, exclusiones: lista.map(({ id, tipo, valor, llave, nota }) => ({ id, tipo, valor, llave, nota })) }))}
        />
      ) : null}

      {vista === "descartes" && config.permissions.can_view_descartes ? (
        <ControlDescartes api={api} config={config} notify={notify} onOpen={(documento) => setDocumentoAbierto(documento.id)} />
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

      {vista === "prioridad" && config.permissions.can_view_prioridad ? (
        <PrioridadBarrios api={api} config={config} notify={notify} />
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
          key={`cierre-${session?.user?.id}-${loteEnCierre.id}`}
          api={api}
          config={config}
          lote={loteEnCierre}
          sessionUserId={session?.user?.id}
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
          api={api}
          notify={notify}
          onListo={cerrarAviso}
          onVerLote={() => { const lote = loteCerrado; setLoteCerrado(null); abrirDetalle(lote); }}
          onPlanGuardado={planGuardado}
        />
      ) : null}
      {planDe ? (
        <PlanBarriosDialog api={api} responsableId={planDe.id} notify={notify} onCerrar={cerrarPlanDe} onGuardado={planGuardado} />
      ) : null}

      {loteDetalle ? <LoteDetalle key={loteDetalle.id} lote={loteDetalle} permissions={config.permissions} motivos={config.motivos} plantillas={config.plantillas_aviso} api={api} notify={notify} onClose={cerrarDetalle} onEdit={abrirEdicion} onCerrar={abrirCierre} onChanged={() => { abrirDetalle(loteDetalle); refrescar(); }} onDeleted={() => { cerrarDetalle(); refrescar(); }} /> : null}

      {documentoAbierto ? (
        <NoEntregadaDetalle
          api={api}
          config={config}
          id={documentoAbierto}
          personal={personal}
          permissions={config.permissions}
          notify={notify}
          onClose={() => {
            setDocumentoAbierto(null);
            if (window.location.hash.includes("?documento=")) window.history.replaceState(null, "", "#entregas/pendientes");
          }}
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
