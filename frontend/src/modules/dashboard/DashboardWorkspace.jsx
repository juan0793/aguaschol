import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import LiveNumber from "../../components/micro/LiveNumber";
import { formatCurrency } from "../../utils/currency.js";
import { formatSpanishDate } from "../../utils/datesAndBusiness";
import { escapeHtml } from "../../utils/html";
import { printDocument } from "../../utils/printDocument";
import { claveAviso, clampSplit, debtRankingAll, diasDesde, escalaRedonda, severidadAviso, filterBarriosByQuery, formatCompactCurrency, interestPerCapital, ofEachTen, SPLIT_DEFAULT, selectedRankedRows, sumSelectedDebt, sumSelectedServices } from "./dashboardSelectors";
import { buildDebtRankingPrintMarkup } from "./debtRankingPrint";
import ServiceDotPlot from "./ServiceDotPlot";
import EntregasAvance from "./EntregasAvance";
import { CambiosDelLote, deltaCuentas, deltaMonto, fechaCorta, imprimirComparacionLotes, nivelesPrevios, useLotesComparacion } from "./LotesCambios";
import logoAguasCholuteca from "../../assets/logo-aguas-choluteca.png";
import "@fontsource-variable/archivo/wdth.css";
import "./dashboard.css";
import "./dashboardSala.css";

const QUICK_ACTIONS = [
  ["records", "plus", "Nueva ficha"],
  ["lookup", "search", "Buscar clave"],
  ["map", "map", "Registrar punto"],
  ["mapReports", "records", "Ver reportes"],
  ["importacion", "download", "Importar padrón"]
];

// Cada indicador de campo abre el módulo donde se trabaja esa cifra.
const FIELD_VIEWS = { records: "records", gps: "map", online: "users", users: "users" };

// Lo crítico primero: el orden de la lista es el orden en que conviene atender.
const LEVEL_ORDER = { Crítico: 0, critical: 0, Atención: 1, pending: 1, Informativo: 2 };

const PANELES_KEY = "aguas.dashboard.paneles-plegados";
const VISTOS_KEY = "aguas.dashboard.avisos-vistos";
const SEVERIDAD_ETIQUETA = { 1: "Crítico", 2: "Atención", 3: "Aviso" };
// Marcas de la escala del medidor: "50", "100"… y la última con unidad ("250 M").
const etiquetaEscala = (valor, conUnidad) => {
  const [divisor, unidad] = valor >= 1e6 ? [1e6, "M"] : valor >= 1e3 ? [1e3, "mil"] : [1, ""];
  const numero = Number((valor / divisor).toFixed(1)).toLocaleString("es-HN");
  return conUnidad && unidad ? `L ${numero} ${unidad}` : numero;
};
const hoyLocal = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Tegucigalpa" });

const leerVistos = () => {
  try {
    const guardado = JSON.parse(window.localStorage.getItem(VISTOS_KEY) || "null");
    return new Set(guardado?.fecha === hoyLocal() ? guardado.claves || [] : []);
  } catch {
    return new Set();
  }
};

const guardarVistos = (claves) => {
  try {
    window.localStorage.setItem(VISTOS_KEY, JSON.stringify({ fecha: hoyLocal(), claves: [...claves] }));
  } catch {
    // Sin almacenamiento, "Visto" vale solo mientras la página esté abierta.
  }
};
const ANCHO_KEY = "aguas.dashboard.ancho-principal";
// Ancho del separador: es a la vez el espacio entre columnas y la zona de agarre.
const HANDLE_PX = 20;

const leerAncho = () => {
  try {
    const guardado = Number(window.localStorage.getItem(ANCHO_KEY));
    return Number.isFinite(guardado) && guardado > 0 ? guardado : SPLIT_DEFAULT;
  } catch {
    return SPLIT_DEFAULT;
  }
};

const guardarAncho = (valor) => {
  try {
    if (valor === SPLIT_DEFAULT) window.localStorage.removeItem(ANCHO_KEY);
    else window.localStorage.setItem(ANCHO_KEY, String(valor));
  } catch {
    // Sin almacenamiento el ajuste vale solo para esta visita.
  }
};

// En una pantalla larga, poder reducir un gráfico que hoy no se mira vale más
// que cualquier animación. La elección se recuerda entre visitas.
const leerPlegados = () => {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(PANELES_KEY) || "[]"));
  } catch {
    return new Set();
  }
};

// El gráfico de mora por servicio respondía "cuánto" pero no "dónde". Cada
// servicio se abre y lista los barrios que lo tienen activo, de mayor a menor
// mora, con las cuentas que lo reciben.
const barriosDeServicio = (barrios = [], field = "") =>
  barrios
    .map((barrio) => {
      const servicio = (barrio.servicios || []).find((item) => item.field === field);
      return servicio && Number(servicio.active) > 0
        ? {
            barrio: barrio.barrio_colonia || "Sin barrio",
            cuentas: Number(servicio.active || 0),
            criticos: Number(servicio.deuda?.criticos || 0),
            deuda: Number(servicio.deuda?.total || 0)
          }
        : null;
    })
    .filter(Boolean)
    .sort((left, right) => right.deuda - left.deuda || left.barrio.localeCompare(right.barrio, "es"));

// Quién tiene el servicio. En desechos peligrosos son comercios e industrias,
// que es justo lo que no se podía ver desde el agregado por barrio.
function CuentasDelServicio({ estado, onLoadAll }) {
  if (!estado) return null;
  if (estado.cargando) return <p className="dw-empty">Cargando cuentas…</p>;
  if (estado.error) return <p className="dw-empty">{estado.error}</p>;

  const { cuentas = [], total_cuentas: total = 0 } = estado.datos || {};
  if (!cuentas.length) return <p className="dw-empty">Ninguna cuenta tiene este servicio activo.</p>;

  return (
    <div className="dw-drill-cuentas">
      <p className="dw-service-drill-head">
        <strong className="dw-figure">{whole(total)}</strong> cuentas con el servicio
        {total > cuentas.length ? <span> · se muestran las {cuentas.length} de mayor mora</span> : null}
      </p>
      <ul className="dw-drill-list">
        {cuentas.map((cuenta) => (
          <li key={`${cuenta.clave_catastral}-${cuenta.abonado}`}>
            <span className="dw-drill-name">{cuenta.nombre}</span>
            <span className="dw-drill-meta">{cuenta.barrio_colonia} · {cuenta.clave_catastral || cuenta.abonado}</span>
            <Amount value={cuenta.deuda} />
          </li>
        ))}
      </ul>
      {total > cuentas.length && onLoadAll ? (
        <button type="button" className="dw-link" onClick={onLoadAll}>
          Ver todas las cuentas
        </button>
      ) : null}
    </div>
  );
}

function BotonPlegar({ plegado, titulo, onToggle }) {
  return (
    <button
      type="button"
      className="dw-collapse"
      aria-expanded={!plegado}
      onClick={onToggle}
      title={plegado ? `Expandir ${titulo}` : `Reducir ${titulo}`}
      aria-label={plegado ? `Expandir ${titulo}` : `Reducir ${titulo}`}
    >
      <Icon name="chevronDown" />
    </button>
  );
}

const SERVICE_ICONS = { agua: "water", alcantarillado: "sewer", barrido: "broom", recoleccion: "waste", desechos_peligrosos: "warning" };

const whole = (value) => Number(value || 0).toLocaleString("es-HN");
// Para el conteo: los cuadros intermedios se redondean a entero.
const wholeRounded = (value) => whole(Math.round(Number(value) || 0));

// Cifra entera que cuenta al cambiar y hace destellar su tarjeta (flash).
function LiveWhole({ value, flash = "", as = "strong", className = "dw-figure" }) {
  return <LiveNumber as={as} className={className} value={value} format={wholeRounded} flash={flash} />;
}
const percent = (part, total) => (total ? (Number(part || 0) / total) * 100 : 0);
const oneDecimal = (value) => `${value.toFixed(1)}%`;

const reportIcon = (name = "file") => {
  const paths = {
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
    water: '<path d="M12 2.69 5.5 10a4.5 4.5 0 1 0 13 0L12 2.69Z"/><path d="M8 16.5c.7.7 1.4 1 2.3 1"/>',
    chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'
  };
  return `<svg class="print-report-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.file}</svg>`;
};

const reportSectionTitle = (icon, title) => `<h3>${reportIcon(icon)}<span>${escapeHtml(title)}</span></h3>`;
const dashboardReportHeader = (title, subtitle, serviceBadge = "") => `<header class="print-header"><div class="print-report-brand"><img src="${escapeHtml(logoAguasCholuteca)}" alt="Logo Aguas de Choluteca" class="print-report-logo" /><div><h1>${escapeHtml(title)}</h1><span class="print-report-kicker">Aguas de Choluteca · Reporte de control</span>${serviceBadge}${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}</div></div><div class="print-report-meta"><span>${escapeHtml(formatSpanishDate(new Date()))}</span><strong>REPORTE OPERATIVO</strong></div></header>`;
const serviceReportBadge = (service) => {
  const isHazardous = service.field === "desechos_peligrosos";
  return `<div class="print-report-service-flag${isHazardous ? " is-hazardous" : ""}">${reportIcon(isHazardous ? "alert" : "water")}<span><small>${isHazardous ? "Servicio prioritario" : "Servicio reportado"}</small><strong>${escapeHtml(service.label)}</strong></span></div>`;
};

// Últimos días de un indicador de campo: una columna por día con su inicial
// debajo y el máximo como escala. Hoy en azul.
function SerieDias({ series = [], unidad = "" }) {
  if (series.length < 2) return null;
  const max = Math.max(1, ...series.map((dia) => Number(dia.total || 0)));
  const dia = (key) => new Intl.DateTimeFormat("es-HN", { weekday: "short", timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`)).replace(".", "").slice(0, 2);
  return (
    <span className="dws-serie" role="img" aria-label={`Últimos ${series.length} días: ${series.map((d) => `${d.total} ${unidad}`).join(", ")}`}>
      <span className="dws-serie-max">máx. {max.toLocaleString("es-HN")} {unidad} por día</span>
      <span className="dws-serie-cols">
        {series.map((d, index) => (
          <span key={d.key} className={index === series.length - 1 ? "is-hoy" : ""} style={{ height: `${(Number(d.total || 0) / max) * 100}%` }} title={`${d.key}: ${Number(d.total || 0).toLocaleString("es-HN")} ${unidad}`} />
        ))}
      </span>
      <span className="dws-serie-x" aria-hidden="true">
        {series.map((d, index) => <span key={d.key}>{index === series.length - 1 ? "hoy" : dia(d.key)}</span>)}
      </span>
    </span>
  );
}

// La cifra es el material tipografico de este tablero: el signo de lempira va
// mas pequeno y liviano para que los digitos, en cifras tabulares, carguen el peso.
// Con `compact` se lee "L 231.9 M"; el monto exacto queda en el title para
// quien necesite el centavo.
const splitAmount = (text) => {
  const match = text.match(/^(\D+?)\s*([-\d].*)$/);
  return match ? [match[1].trim(), match[2]] : ["", text];
};

function Amount({ value, className = "", compact = false, flash = "" }) {
  const exact = formatCurrency(Number(value || 0));
  const [mark] = splitAmount(compact ? formatCompactCurrency(value) : exact);
  const digits = (current) => splitAmount(compact ? formatCompactCurrency(current) : formatCurrency(current))[1];
  return (
    <span className={`dw-amount ${className}`.trim()} title={compact ? exact : undefined}>
      {mark ? <i aria-hidden="true">{mark}</i> : null}
      <LiveNumber value={Number(value || 0)} format={digits} flash={flash} duration={700} />
    </span>
  );
}

export default function DashboardWorkspace({ model }) {
  const buscadorRef = useRef(null);
  const gridRef = useRef(null);
  const frameRef = useRef(0);
  // El ultimo valor calculado durante el arrastre: se guarda al soltar sin
  // depender de que el estado ya se haya actualizado.
  const ultimoSplitRef = useRef(0);
  const [split, setSplit] = useState(leerAncho);
  const [arrastrando, setArrastrando] = useState(false);
  const [servicioAbierto, setServicioAbierto] = useState("");
  const [barriosVisibles, setBarriosVisibles] = useState(6);
  // Las cuentas de un servicio se piden al abrirlo y se guardan por servicio,
  // para no repetir la consulta si el usuario vuelve a abrirlo.
  const [cuentasPorServicio, setCuentasPorServicio] = useState({});
  const [plegados, setPlegados] = useState(leerPlegados);
  const alternarPanel = (clave) =>
    setPlegados((actuales) => {
      const siguiente = new Set(actuales);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      try {
        window.localStorage.setItem(PANELES_KEY, JSON.stringify([...siguiente]));
      } catch {
        // Sin almacenamiento el panel igual se pliega, solo no se recuerda.
      }
      return siguiente;
    });

  const [debtMetric, setDebtMetric] = useState("total");
  const [topN, setTopN] = useState(10);
  const [barrioQuery, setBarrioQuery] = useState("");
  const [resaltada, setResaltada] = useState(0);
  const [selectedBarrios, setSelectedBarrios] = useState([]);
  const [selectedDetailsOpen, setSelectedDetailsOpen] = useState(false);
  const [barrioAbierto, setBarrioAbierto] = useState("");
  // Diferencias con el lote FoxPro anterior; se vuelven a pedir con cada corte nuevo.
  const lotes = useLotesComparacion(model.fetchLotesComparacion, model.padronTotals?.updatedAt || "");

  // El padron entero ordenado por la metrica activa. El top 5 sale de aca, pero
  // la busqueda necesita la lista completa para encontrar barrios que no entran
  // al ranking visible.
  const rankingAll = useMemo(() => debtRankingAll(model.debtBarrios, debtMetric), [model.debtBarrios, debtMetric]);
  const ranking = useMemo(() => rankingAll.slice(0, topN), [rankingAll, topN]);
  const searchHits = useMemo(() => filterBarriosByQuery(rankingAll, barrioQuery, 40), [rankingAll, barrioQuery]);
  const buscando = Boolean(barrioQuery.trim());
  // La posicion real en el padron, para que la sugerencia diga de que puesto
  // viene el barrio y no solo su nombre.
  const posiciones = useMemo(() => new Map(rankingAll.map((item, index) => [item.name, index + 1])), [rankingAll]);
  // Lo ya elegido sale de las sugerencias: el chip de abajo lo muestra y el
  // campo queda libre para escribir el siguiente barrio.
  const sugerencias = useMemo(
    () => searchHits.filter((item) => !selectedBarrios.includes(item.name)).slice(0, 8),
    [searchHits, selectedBarrios]
  );
  // Padron completo, independiente de la metrica: el ranking visible es solo el
  // top 5, pero la seleccion sobrevive al cambio de metrica y tiene que seguir
  // sumando aunque un barrio elegido ya no aparezca en pantalla.
  const barriosCompletos = useMemo(() => debtRankingAll(model.debtBarrios, "total"), [model.debtBarrios]);
  // Mora consolidada por servicio en todo el padron: la otra descomposicion
  // legitima del mismo total que ya muestra la barra de capital/intereses.
  const serviceDebt = useMemo(
    () => sumSelectedServices(barriosCompletos, barriosCompletos.map((row) => row.name))
      .filter((service) => service.debt > 0)
      .sort((left, right) => right.debt - left.debt),
    [barriosCompletos]
  );
  const maxServiceDebt = Math.max(1, ...serviceDebt.map((service) => service.debt));
  const selectedDebt = useMemo(() => sumSelectedDebt(barriosCompletos, selectedBarrios), [barriosCompletos, selectedBarrios]);
  const selectedServices = useMemo(() => sumSelectedServices(barriosCompletos, selectedBarrios), [barriosCompletos, selectedBarrios]);
  // Filas de la seleccion, ordenadas por la metrica activa: alimentan el grafico
  // que se rearma cada vez que se agrega o se quita un barrio.
  const selectedRows = useMemo(
    () => selectedRankedRows(barriosCompletos, selectedBarrios, debtMetric),
    [barriosCompletos, selectedBarrios, debtMetric]
  );
  const maxSelected = Math.max(1, ...selectedRows.map((item) => item.value));
  const selectedTotal = selectedRows.reduce((sum, item) => sum + item.value, 0);
  const maxDebt = Math.max(1, ...ranking.map((item) => item.value));

  const debt = model.debtSummary || {};
  const debtTotal = Number(debt.total || 0);
  const capitalShare = percent(debt.capital, debtTotal);
  const interesShare = percent(debt.intereses, debtTotal);
  const criticalShare = percent(debt.criticos, Number(debt.deudores || 0));
  const debtorShare = percent(debt.deudores, model.padronTotals.records);
  const padronDate = model.padronTotals.updatedAt ? formatSpanishDate(model.padronTotals.updatedAt) : "";

  const metricByKey = Object.fromEntries((model.metrics || []).map((item) => [item.key, item]));
  const alertMetric = metricByKey.alerts || { value: 0 };
  const alertCount = Number(alertMetric.value || 0);
  // Tramos del plazo; si el modelo no trae desglose, todo cuenta como alerta.
  const plazos = [
    { key: "overdue", label: "Vencidas", value: Number(alertMetric.breakdown?.overdue || 0) },
    { key: "due", label: "Vencen hoy", value: Number(alertMetric.breakdown?.due || 0) },
    { key: "upcoming", label: "Por vencer", value: Number(alertMetric.breakdown?.upcoming ?? (alertMetric.breakdown ? 0 : alertCount)) }
  ];
  const plazosTotal = Math.max(1, plazos.reduce((sum, item) => sum + item.value, 0));

  // Niveles de la regla: todos a la escala del padron, para que se lea cuanto
  // baja cada uno y no solo su cifra.
  const padronRecords = Number(model.padronTotals.records || 0);
  // Cada nivel trae, si hay lote anterior, cuánto era antes y cuánto cambió.
  const previos = nivelesPrevios(lotes);
  const niveles = [
    { key: "padron", label: "cuentas", value: padronRecords, share: padronRecords ? 100 : 0, note: `en el padrón · ${whole(model.padronTotals.barrios)} barrios` },
    { key: "mora", label: "con mora", value: Number(debt.deudores || 0), share: debtorShare, note: `${oneDecimal(debtorShare)} del padrón` },
    { key: "critica", label: "con mora alta", value: Number(debt.criticos || 0), share: percent(debt.criticos, padronRecords), note: `${oneDecimal(criticalShare)} de las con mora` }
  ].map((nivel) => ({ ...nivel, previo: previos?.[nivel.key] || null }));
  const cuentasAlDia = Math.max(0, padronRecords - Number(debt.deudores || 0));
  const promedioPorCuenta = Number(debt.deudores || 0) ? debtTotal / Number(debt.deudores) : 0;
  const interesPorLempira = interestPerCapital(debt.intereses, debt.capital);
  const fieldMetrics = ["records", "gps", "online", "users"].map((key) => metricByKey[key]).filter(Boolean);
  const attentionItems = [...(model.attention || [])].sort(
    (left, right) => (LEVEL_ORDER[left.level] ?? 3) - (LEVEL_ORDER[right.level] ?? 3)
  );
  // El peso relativo se mide contra el total del padron de la MISMA magnitud que
  // se esta ordenando: dinero contra dinero, cuentas contra cuentas.
  const metricTotal = debtMetric === "accounts"
    ? Number(debt.deudores || 0)
    : debtMetric === "critical" ? Number(debt.criticos || 0) : debtTotal;
  const metricDescription = debtMetric === "accounts" ? "de los abonados con mora" : debtMetric === "critical" ? "de las cuentas con mora alta" : "de la mora total";
  const rankingTotal = ranking.reduce((sum, item) => sum + item.value, 0);
  const selectedShare = percent(
    debtMetric === "accounts" ? selectedDebt.deudores : debtMetric === "critical" ? selectedDebt.criticos : selectedDebt.total,
    metricTotal
  );

  const toggleBarrio = (name) =>
    setSelectedBarrios((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));

  // Agregar deja el campo vacio y el foco adentro: asi se encadena un barrio
  // tras otro sin tocar el mouse.
  const agregarBarrio = (name) => {
    setSelectedBarrios((current) => (current.includes(name) ? current : [...current, name]));
    setBarrioQuery("");
    setResaltada(0);
    buscadorRef.current?.focus();
  };
  const limpiarBusqueda = () => {
    setBarrioQuery("");
    setResaltada(0);
    buscadorRef.current?.focus();
  };
  const manejarTeclas = (event) => {
    if (event.key === "Escape" && barrioQuery) {
      event.preventDefault();
      limpiarBusqueda();
      return;
    }
    if (!sugerencias.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const paso = event.key === "ArrowDown" ? 1 : -1;
      setResaltada((actual) => (actual + paso + sugerencias.length) % sugerencias.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      agregarBarrio((sugerencias[resaltada] || sugerencias[0]).name);
    }
  };
  // --- Separador de columnas ---
  // El porcentaje es de la columna principal sobre el ancho util (sin el
  // separador). Se acota en pixeles para que ninguna columna se rompa.
  const anchoUtil = () => Math.max(0, (gridRef.current?.getBoundingClientRect().width || 0) - HANDLE_PX);
  const acotar = (valor) => clampSplit(valor, anchoUtil());
  const fijarSplit = (valor, persistir = false) => {
    const siguiente = acotar(valor);
    setSplit(siguiente);
    if (persistir) guardarAncho(siguiente);
  };

  // Si la ventana se achica, el valor guardado puede dejar una columna bajo su
  // minimo: se vuelve a acotar al cargar y en cada cambio de tamaño.
  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => setSplit((actual) => clampSplit(actual, Math.max(0, grid.getBoundingClientRect().width - HANDLE_PX))));
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  // Mientras se arrastra, el cursor y la seleccion de texto se fijan en toda la
  // pagina: si el puntero sale del separador no debe seleccionar el ranking.
  useEffect(() => {
    if (!arrastrando) return undefined;
    document.body.classList.add("dw-resizing");
    return () => document.body.classList.remove("dw-resizing");
  }, [arrastrando]);

  const moverSeparador = (clientX) => {
    const bounds = gridRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const util = Math.max(1, bounds.width - HANDLE_PX);
    const valor = ((clientX - bounds.left - HANDLE_PX / 2) / util) * 100;
    ultimoSplitRef.current = clampSplit(valor, util);
    // Un cambio por cuadro: el puntero dispara mas eventos de los que se pintan.
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => setSplit(ultimoSplitRef.current));
  };

  // Soltar y perder la captura llegan los dos; solo el primero cierra.
  const terminarArrastre = (event) => {
    if (!ultimoSplitRef.current) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    cancelAnimationFrame(frameRef.current);
    const final = ultimoSplitRef.current;
    ultimoSplitRef.current = 0;
    setSplit(final);
    guardarAncho(final);
    setArrastrando(false);
  };

  const tecladoSeparador = (event) => {
    const paso = event.shiftKey ? 10 : 2;
    const acciones = {
      ArrowLeft: () => fijarSplit(split - paso, true),
      ArrowRight: () => fijarSplit(split + paso, true),
      Home: () => fijarSplit(0, true),
      End: () => fijarSplit(100, true),
      Enter: () => fijarSplit(SPLIT_DEFAULT, true)
    };
    if (!acciones[event.key]) return;
    event.preventDefault();
    acciones[event.key]();
  };

  const navigate = (view, focus = "") => {
    if (focus) sessionStorage.setItem("aguas.clandestinos.focus", focus);
    model.navigate(view);
  };

  const printSelection = () => model.canExport !== false &&
    printDocument(
      "Sumatoria de barrios",
      `${dashboardReportHeader("Sumatoria de barrios seleccionados", selectedBarrios.join(" · "))}<section class="print-section">${reportSectionTitle("chart", "Resumen de mora")}<div class="print-grid print-grid-five"><div class="print-field"><strong>Abonados</strong><span>${whole(selectedDebt.records)}</span></div>${[["Capital", selectedDebt.capital], ["Intereses", selectedDebt.intereses], ["Mora total", selectedDebt.total]].map(([label, value]) => `<div class="print-field"><strong>${label}</strong><span>${escapeHtml(formatCurrency(value))}</span></div>`).join("")}<div class="print-field"><strong>Cuentas con mora</strong><span>${whole(selectedDebt.deudores)}</span></div><div class="print-field"><strong>Cuentas con mora alta</strong><span>${whole(selectedDebt.criticos)}</span></div></div></section><section class="print-section">${reportSectionTitle("records", "Detalle por barrio")}<table class="field-report-table data-report-table"><thead><tr><th>Barrio</th><th>Abonados</th><th>Cuentas con mora</th><th>Mora alta</th><th>Capital</th><th>Intereses</th><th>Mora total</th></tr></thead><tbody>${selectedRows.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${whole(row.records)}</td><td>${whole(row.debt?.deudores)}</td><td>${whole(row.debt?.criticos)}</td><td>${escapeHtml(formatCurrency(row.debt?.capital))}</td><td>${escapeHtml(formatCurrency(row.debt?.intereses))}</td><td>${escapeHtml(formatCurrency(row.debt?.total))}</td></tr>`).join("")}</tbody><tfoot><tr><th>Total</th><th>${whole(selectedDebt.records)}</th><th>${whole(selectedDebt.deudores)}</th><th>${whole(selectedDebt.criticos)}</th><th>${escapeHtml(formatCurrency(selectedDebt.capital))}</th><th>${escapeHtml(formatCurrency(selectedDebt.intereses))}</th><th>${escapeHtml(formatCurrency(selectedDebt.total))}</th></tr></tfoot></table></section><section class="print-section">${reportSectionTitle("water", "Servicios consolidados")}<table class="field-report-table data-report-table"><thead><tr><th>Servicio</th><th>Activos</th><th>Inactivos</th><th>Sin dato</th><th>Mora asociada</th></tr></thead><tbody>${selectedServices.map((service) => `<tr><td>${escapeHtml(service.label)}</td><td>${whole(service.active)}</td><td>${whole(service.inactive)}</td><td>${whole(service.unknown)}</td><td>${escapeHtml(formatCurrency(service.debt))}</td></tr>`).join("")}</tbody><tfoot><tr><th>Total</th><th>${whole(selectedServices.reduce((sum, item) => sum + item.active, 0))}</th><th>${whole(selectedServices.reduce((sum, item) => sum + item.inactive, 0))}</th><th>${whole(selectedServices.reduce((sum, item) => sum + item.unknown, 0))}</th><th>${escapeHtml(formatCurrency(selectedDebt.total))}</th></tr></tfoot></table></section>`,
      { pageSize: "Letter portrait", bodyClassName: "dashboard-report-body", showPageFooter: true }
    );

  const printDebtRanking = () => {
    if (model.canExport === false) return;
    const rows = debtRankingAll(model.debtBarrios, debtMetric);
    if (!rows.length) return;
    printDocument(
      "Mora por barrio",
      buildDebtRankingPrintMarkup({
        rows,
        metric: debtMetric,
        selectedBarrios,
        logoSrc: logoAguasCholuteca,
        generatedAt: formatSpanishDate(new Date())
      }),
      { pageSize: "Letter portrait", pageMargin: "10mm", bodyClassName: "field-report-body dashboard-report-body", showPageFooter: true }
    );
  };

  const cargarCuentasServicio = (field, limit = 25) => {
    if (!model.fetchServiceAccounts) return;
    setCuentasPorServicio((actuales) => ({ ...actuales, [field]: { cargando: true } }));
    model
      .fetchServiceAccounts(field, limit)
      .then((datos) => setCuentasPorServicio((actuales) => ({ ...actuales, [field]: { datos } })))
      .catch((error) => setCuentasPorServicio((actuales) => ({ ...actuales, [field]: { error: error.message } })));
  };

  const printDebtSummary = () =>
    printDocument(
      "Resumen de mora",
      `${dashboardReportHeader("Resumen de mora", "Situación financiera y mora asociada por servicio")}<section class="print-section">${reportSectionTitle("chart", "Situación financiera")}<div class="print-grid print-grid-five"><div class="print-field"><strong>Mora total</strong><span>${escapeHtml(formatCurrency(debtTotal))}</span></div><div class="print-field"><strong>Capital</strong><span>${escapeHtml(formatCurrency(debt.capital))}</span></div><div class="print-field"><strong>Intereses</strong><span>${escapeHtml(formatCurrency(debt.intereses))}</span></div><div class="print-field"><strong>Cuentas con mora</strong><span>${whole(debt.deudores)}</span></div><div class="print-field"><strong>Cuentas con mora alta</strong><span>${whole(debt.criticos)}</span></div></div></section><section class="print-section">${reportSectionTitle("water", "Mora asociada por servicio")}<table class="field-report-table data-report-table"><thead><tr><th>Servicio</th><th>Activos</th><th>Inactivos</th><th>Sin dato</th><th>Mora asociada</th></tr></thead><tbody>${serviceDebt.map((service) => `<tr><td>${escapeHtml(service.label)}</td><td>${whole(service.active)}</td><td>${whole(service.inactive)}</td><td>${whole(service.unknown)}</td><td>${escapeHtml(formatCurrency(service.debt))}</td></tr>`).join("")}</tbody></table></section>`,
      { pageSize: "Letter portrait", pageMargin: "10mm", bodyClassName: "field-report-body dashboard-report-body", showPageFooter: true }
    );

  const printServiceDebt = async (service) => {
    if (model.canExport === false) return;
    const rows = barriosDeServicio(model.debtBarrios, service.field);
    const accountRows = cuentasPorServicio[service.field]?.datos?.cuentas || [];
    let detailedAccounts = accountRows;
    if (model.fetchServiceAccounts) {
      try {
        const result = await model.fetchServiceAccounts(service.field, "all");
        detailedAccounts = result?.cuentas || accountRows;
      } catch {
        // La vista previa todavía puede abrirse con las cuentas ya cargadas.
      }
    }
    detailedAccounts = detailedAccounts.filter((account) => Number(account.deuda || 0) > 0);
    printDocument(
      `Mora asociada por servicio: ${service.label}`,
      `${dashboardReportHeader("Mora asociada por servicio", "", serviceReportBadge(service))}<section class="print-section">${reportSectionTitle("water", "Resumen")}<div class="print-grid print-grid-four"><div class="print-field"><strong>Mora asociada</strong><span>${escapeHtml(formatCurrency(service.debt))}</span></div><div class="print-field"><strong>Activos</strong><span>${whole(service.active)}</span></div><div class="print-field"><strong>Inactivos</strong><span>${whole(service.inactive)}</span></div><div class="print-field"><strong>Sin dato</strong><span>${whole(service.unknown)}</span></div></div></section><section class="print-section">${reportSectionTitle("chart", "Mora por barrio")}<table class="field-report-table data-report-table"><thead><tr><th>Barrio</th><th>Cuentas</th><th>Mora alta</th><th>Mora</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.barrio)}</td><td>${whole(row.cuentas)}</td><td>${whole(row.criticos)}</td><td>${escapeHtml(formatCurrency(row.deuda))}</td></tr>`).join("")}</tbody></table></section>${detailedAccounts.length ? `<section class="print-section print-account-section">${reportSectionTitle("users", `Cuentas con mora (${whole(detailedAccounts.length)})`)}<table class="field-report-table data-report-table"><thead><tr><th>Nombre</th><th>Barrio</th><th>Clave / abonado</th><th>Mora</th></tr></thead><tbody>${detailedAccounts.map((account) => `<tr><td>${escapeHtml(account.nombre)}</td><td>${escapeHtml(account.barrio_colonia)}</td><td>${escapeHtml(account.clave_catastral || account.abonado)}</td><td>${escapeHtml(formatCurrency(account.deuda))}</td></tr>`).join("")}</tbody></table></section>` : ""}`,
      { pageSize: "Letter portrait", pageMargin: "10mm", bodyClassName: "field-report-body dashboard-report-body", showPageFooter: true }
    );
  };

  // Avisos marcados como vistos hoy (se olvidan al día siguiente).
  const [vistos, setVistos] = useState(leerVistos);
  const alternarVisto = (clave) =>
    setVistos((actuales) => {
      const siguiente = new Set(actuales);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      guardarVistos(siguiente);
      return siguiente;
    });
  // El barrio que se señala en la tabla (cursor o foco) o el último elegido:
  // se enciende en la barra de concentración y en el gráfico por servicio.
  const [barrioHover, setBarrioHover] = useState("");
  const barrioSenalado = barrioHover || selectedBarrios[selectedBarrios.length - 1] || "";

  // ── Sala de control (2026-11-15) ──
  // Lo que se sale de lo normal arriba y en color; el resto, en gris sereno.
  const embebido = Boolean(model.hideSync);
  const lotePendiente = (() => {
    const data = lotes.data;
    if (!data?.pendiente) return null;
    const recibido = new Date(data.pendiente.fecha_recepcion);
    const vigente = data.actual?.fecha_recepcion ? new Date(data.actual.fecha_recepcion) : null;
    return !vigente || recibido > vigente ? data.pendiente : null;
  })();
  const avisos = [
    ...attentionItems.map((item) => ({ ...item, severidad: severidadAviso(item) })),
    ...(lotePendiente && model.canImport !== false
      ? [{
          key: "lote-pendiente",
          severidad: 2,
          title: `Lote ${lotePendiente.codigo} recibido sin aplicar`,
          detail: `${whole(lotePendiente.nuevos)} cuentas nuevas · ${whole(lotePendiente.modificados)} con cambios`,
          actionView: "importacion",
          actionLabel: "Revisar lote"
        }]
      : [])
  ].sort((left, right) => left.severidad - right.severidad);
  const sinVer = avisos.filter((item) => !vistos.has(claveAviso(item))).length;
  const porGravedad = [1, 2, 3].map((nivel) => avisos.filter((item) => item.severidad === nivel).length);

  const diasCorte = diasDesde(model.padronTotals.updatedAt);
  const horaCifras = model.lastUpdatedAt
    ? new Date(model.lastUpdatedAt).toLocaleTimeString("es-HN", { hour: "2-digit", minute: "2-digit", timeZone: "America/Tegucigalpa" })
    : "";
  const acciones = (model.quickActions || QUICK_ACTIONS).filter(([view]) => view !== "lookup");
  const accionPrincipal = acciones.find(([view]) => view === "records");
  const accionesSecundarias = acciones.filter(([view]) => view !== "records");

  // Medidor de la cartera: escala redonda que cubre este lote y el anterior.
  const moraAntes = previos?.total?.antes ?? null;
  const escalaCartera = escalaRedonda(Math.max(debtTotal, moraAntes || 0));
  const marcasCartera = [0, 0.2, 0.4, 0.6, 0.8, 1].map((parte) => parte * escalaCartera);

  // Cambio de mora por barrio contra el lote anterior (solo los que el servidor
  // lista como los que más cambiaron; los demás no se inventan).
  const cambioBarrio = useMemo(() => {
    const barrios = lotes.data?.comparacion?.barrios;
    return new Map([...(barrios?.subieron || []), ...(barrios?.bajaron || [])].map((fila) => [fila.barrio, Number(fila.diferencia || 0)]));
  }, [lotes.data]);

  const fichasActivas = Number(metricByKey.records?.value || 0);
  const basePlazos = Math.max(alertCount, fichasActivas, 1);

  return (
    <main className="dashboard-workspace dws">
      {!embebido ? (
        <header className="dws-pagehead">
          <div className="dws-pagehead-copy">
            <h1>{model.title || "Tablero"}</h1>
            <p className="dws-source">
              <span>Padrón maestro</span>
              {padronDate ? <strong>Corte del {padronDate}</strong> : <strong className="is-missing">Sin padrón cargado</strong>}
              {lotes.data?.actual?.codigo ? <span>· lote {lotes.data.actual.codigo}</span> : null}
              {diasCorte != null && diasCorte > 7 ? (
                <span className="dws-stale"><i className="dws-shape is-2" aria-hidden="true" />Hace {diasCorte} días</span>
              ) : null}
              {model.connectionStatus === "retrying" ? (
                <span className="dws-stale" role="status"><i className="dws-shape is-2" aria-hidden="true" />No se pudo actualizar · reintentando</span>
              ) : horaCifras ? <span>· cifras de las {horaCifras}</span> : null}
              {!padronDate && model.canImport !== false ? (
                <button type="button" className="dws-link" onClick={() => model.navigate("importacion")}>Importar padrón</button>
              ) : null}
            </p>
          </div>
          <nav className="dws-pageactions" aria-label="Acciones del tablero">
            {accionesSecundarias.map(([view, icon, label]) => (
              <button type="button" key={view} className="dws-btn is-quiet" onClick={() => model.navigate(view)}>
                <Icon name={icon} />
                <span>{label}</span>
              </button>
            ))}
            <button type="button" className="dws-btn is-quiet" onClick={model.refresh} disabled={model.manualRefreshing} aria-label="Actualizar las cifras del tablero">
              <Icon name="refresh" className={model.manualRefreshing ? "ds-icon-spin" : ""} />
              <span>Actualizar</span>
            </button>
            {accionPrincipal ? (
              <button type="button" className="dws-btn is-primary" onClick={() => model.navigate(accionPrincipal[0])}>
                <Icon name="plus" />
                <span>{accionPrincipal[2]}</span>
              </button>
            ) : null}
          </nav>
        </header>
      ) : null}

      {/* Banda de alarmas: lo que pide atención hoy, por gravedad. «Visto» deja
          el símbolo en contorno; la fila sigue hasta que el problema se resuelve,
          y vuelve a encenderse si cambia su cifra. */}
      <section className="dws-mod dws-alarms" aria-labelledby="dws-alarmas-titulo">
        <header className="dws-mod-head">
          <h2 id="dws-alarmas-titulo">Requiere atención</h2>
          {avisos.length ? (
            <span className="dws-aside" aria-live="polite">
              {[["crítica", "críticas"], ["de atención", "de atención"], ["aviso", "avisos"]]
                .map(([uno, varios], index) => (porGravedad[index] ? `${porGravedad[index]} ${porGravedad[index] === 1 ? uno : varios}` : ""))
                .filter(Boolean)
                .join(" · ")}
              {` · ${sinVer ? `${sinVer} sin ver` : "todas vistas"}`}
            </span>
          ) : null}
        </header>
        {avisos.length ? (
          <ul className="dws-alarm-list">
            {avisos.map((item) => {
              const clave = claveAviso(item);
              const visto = vistos.has(clave);
              return (
                <li key={item.key || item.title} className={`dws-alarm is-${item.severidad} ${visto ? "is-seen" : ""}`.trim()}>
                  <span className="dws-sev">
                    <i className={`dws-shape is-${item.severidad}`} aria-hidden="true" />
                    {SEVERIDAD_ETIQUETA[item.severidad]}
                  </span>
                  <span className="dws-alarm-what">{item.title}</span>
                  <span className="dws-alarm-detail">{item.detail}</span>
                  <span className="dws-alarm-count">{Number.isFinite(item.count) ? <LiveWhole as="b" className="dw-figure" value={item.count} /> : null}</span>
                  <span className="dws-alarm-act">
                    <button type="button" className="dws-btn" aria-pressed={visto} onClick={() => alternarVisto(clave)}>
                      <Icon name="success" />
                      {visto ? "Visto" : "Marcar visto"}
                    </button>
                    {item.actionView ? (
                      <button type="button" className="dws-btn" onClick={() => navigate(item.actionView, item.filter || "")}>
                        {item.actionLabel || "Atender"}
                        <Icon name="arrowRight" />
                      </button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="dws-empty">No hay prioridades pendientes.</p>
        )}
      </section>

      <section className={`dws-gauges ${model.hideDeadlines ? "is-two" : ""}`.trim()} aria-label="Resumen de cartera">
        {/* Cartera: la cifra es la lectura del medidor, no un KPI suelto. */}
        <article className="dws-mod dws-cartera" aria-labelledby="dws-cartera-titulo">
          <header className="dws-mod-head">
            <h2 id="dws-cartera-titulo">Cartera en mora</h2>
            <button type="button" className="dws-icon-btn" onClick={printDebtSummary} hidden={model.canExport === false} title="Ver / imprimir resumen PDF" aria-label="Ver o imprimir el resumen de mora en PDF">
              <Icon name="print" />
            </button>
          </header>
          <div className="dws-mod-body">
            <div className="dws-readout">
              <Amount value={debtTotal} className="dws-big" compact flash=".dws-cartera" />
              {previos?.total?.cambio ? (
                <span className="dws-delta" title={`Lote anterior: ${formatCurrency(previos.total.antes)}`}>
                  <i className={`dws-tri ${previos.total.cambio > 0 ? "is-up" : "is-down"}`} aria-hidden="true" />
                  <b className="dw-figure">{deltaMonto(previos.total.cambio)}</b>
                  <span>desde el lote anterior</span>
                </span>
              ) : null}
            </div>
            <p className="dws-exact dw-figure">{formatCurrency(debtTotal)}</p>
            <div
              className="dws-gauge"
              role="img"
              aria-label={`Capital ${formatCompactCurrency(debt.capital)} e intereses ${formatCompactCurrency(debt.intereses)} sobre una escala de 0 a ${formatCompactCurrency(escalaCartera)}${moraAntes ? `; lote anterior ${formatCompactCurrency(moraAntes)}` : ""}`}
            >
              <span className="is-capital" style={{ width: `${percent(debt.capital, escalaCartera)}%` }} />
              <span className="is-interes" style={{ left: `${percent(debt.capital, escalaCartera)}%`, width: `${percent(debt.intereses, escalaCartera)}%` }} />
              {moraAntes ? <em style={{ left: `${Math.min(100, percent(moraAntes, escalaCartera))}%` }} title={`Lote anterior: ${formatCurrency(moraAntes)}`} /> : null}
            </div>
            <div className="dws-scale" aria-hidden="true">
              {marcasCartera.map((marca, index) => (
                <span key={marca} style={{ left: `${index * 20}%` }}>{etiquetaEscala(marca, index === marcasCartera.length - 1)}</span>
              ))}
            </div>
            <dl className="dws-legend">
              <div>
                <dt><i className="is-capital" aria-hidden="true" />Capital</dt>
                <dd><Amount value={debt.capital} compact /><span className="dw-figure">{oneDecimal(capitalShare)}</span></dd>
              </div>
              <div>
                <dt><i className="is-interes" aria-hidden="true" />Intereses</dt>
                <dd><Amount value={debt.intereses} compact /><span className="dw-figure">{oneDecimal(interesShare)}</span></dd>
              </div>
            </dl>
            {interesPorLempira ? (
              <p className="dws-reading">
                Por cada <b>L 1</b> de capital se deben{" "}
                <b className="dw-figure">L {interesPorLempira.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> de intereses.
                Promedio por cuenta con mora: <b><Amount value={promedioPorCuenta} compact /></b>.
              </p>
            ) : null}
          </div>
        </article>

        <article className="dws-mod dws-cuentas" aria-labelledby="dws-cuentas-titulo">
          <header className="dws-mod-head">
            <h2 id="dws-cuentas-titulo">Cuentas del padrón</h2>
            {previos ? (
              <span className="dws-keymark" title={previos.lote?.codigo ? `Lote ${previos.lote.codigo}` : undefined}>
                <i aria-hidden="true" />lote anterior{previos.lote?.codigo ? ` (${fechaCorta(previos.lote.fecha_extraccion || previos.lote.fecha_aplicacion) || previos.lote.codigo})` : ""}
              </span>
            ) : null}
          </header>
          <div className="dws-mod-body">
            <ol className="dws-levels">
              {niveles.map((nivel) => {
                const cambio = nivel.previo?.cambio ?? null;
                const antes = nivel.previo ? percent(nivel.previo.antes, padronRecords) : null;
                return (
                  <li key={nivel.key} className={`is-${nivel.key}`}>
                    <div className="dws-level-top">
                      <span>
                        <LiveWhole value={nivel.value} className="dw-figure dws-mid" flash=".dws-levels li" />
                        <span className="dws-level-label">{nivel.label}</span>
                      </span>
                      {previos ? (
                        <span className="dws-delta" title={cambio ? `${deltaCuentas(cambio)} desde el lote anterior` : "Igual que en el lote anterior"}>
                          {cambio ? <i className={`dws-tri ${cambio > 0 ? "is-up" : "is-down"}`} aria-hidden="true" /> : null}
                          <b className="dw-figure">{cambio ? deltaCuentas(cambio) : "igual"}</b>
                        </span>
                      ) : null}
                    </div>
                    <p className="dws-level-sub">{nivel.note}</p>
                    <span
                      className={`dws-meter ${nivel.key === "padron" ? "is-neutral" : ""}`.trim()}
                      role="img"
                      aria-label={`${whole(nivel.value)} ${nivel.label}, ${oneDecimal(nivel.share)} del padrón${nivel.previo ? `; en el lote anterior eran ${whole(nivel.previo.antes)}` : ""}`}
                    >
                      <span style={{ width: `${Math.min(100, nivel.share)}%` }} />
                      {antes != null && nivel.key !== "padron" ? <em style={{ left: `${Math.min(100, antes)}%` }} /> : null}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="dws-scale is-percent" aria-hidden="true">
              {[0, 25, 50, 75, 100].map((mark) => <span key={mark} style={{ left: `${mark}%` }}>{mark === 100 ? "100 %" : mark}</span>)}
            </div>
            <p className="dws-reading is-foot">
              {ofEachTen(debt.criticos, debt.deudores) ? (
                <><b>{ofEachTen(debt.criticos, debt.deudores)}</b> cuentas con mora deben {"L 1,000"} o más. </>
              ) : null}
              <LiveWhole as="b" value={cuentasAlDia} /> cuentas están al día.
            </p>
          </div>
        </article>

        {!model.hideDeadlines ? (
          <article className="dws-mod dws-plazos" aria-labelledby="dws-plazos-titulo">
            <header className="dws-mod-head">
              <h2 id="dws-plazos-titulo">Plazos de fichas</h2>
              {fichasActivas ? <span className="dws-aside dw-figure">{whole(fichasActivas)} activas</span> : null}
            </header>
            <div className="dws-mod-body">
              <div className="dws-level-top">
                <span>
                  <LiveWhole value={alertCount} className="dw-figure dws-mid" flash=".dws-plazos" />
                  <span className="dws-level-label">en plazo crítico</span>
                </span>
              </div>
              <p className="dws-level-sub">
                {fichasActivas ? `de ${whole(fichasActivas)} fichas activas · ${whole(Math.max(0, fichasActivas - alertCount))} en plazo` : "Regla de 7 días hábiles desde el registro"}
              </p>
              <span className="dws-seg" role="img" aria-label={`${plazos.map((item) => `${item.value} ${item.label.toLowerCase()}`).join(", ")}${fichasActivas ? ` de ${fichasActivas} fichas activas` : ""}`}>
                {plazos.map((item) => (item.value ? <span key={item.key} className={`is-${item.key}`} style={{ width: `${(item.value / basePlazos) * 100}%` }} /> : null))}
              </span>
              <ul className="dws-plazos-list">
                {plazos.map((item, index) => (
                  <li key={item.key} data-vacio={item.value ? undefined : ""}>
                    <i className={`dws-shape is-${index + 1} ${index === 2 ? "is-outline" : ""}`.trim()} aria-hidden="true" />
                    <LiveWhole as="b" value={item.value} />
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
              <p className="dws-reading">Regla de 7 días hábiles desde el registro.</p>
              <button type="button" className="dws-link" onClick={() => navigate("records", "alerts")}>
                {alertCount ? "Revisar fichas" : "Ver fichas"}
              </button>
            </div>
          </article>
        ) : null}
      </section>

      {/* Lo que cambió entre el lote FoxPro activo y el anterior. El lote nuevo
          sin aplicar ya está arriba, en «Requiere atención». */}
      <CambiosDelLote lotes={lotes} ocultarPendiente navigate={model.canImport === false ? null : model.navigate} onPrint={model.canExport === false ? null : (data) => imprimirComparacionLotes(data)} />

      {/* Columna ancha para el análisis de la mora; la angosta para el campo y la
          bitácora. El separador reparte el ancho: se arrastra, se mueve con las
          flechas y doble clic (o Enter) lo restablece. */}
      <div
        ref={gridRef}
        className={`dw-grid ${arrastrando ? "is-resizing" : ""}`.trim()}
        style={{ "--dw-columns": `minmax(0, ${split}fr) ${HANDLE_PX}px minmax(0, ${100 - split}fr)` }}
      >
        <div className="dw-col dw-col-main" id="dw-col-main">
          <article className="dws-mod dws-board-mod" data-plegado={plegados.has("mora")}>
            <header className="dws-mod-head">
              <h2>Barrios con mayor mora</h2>
              <div className="dws-controls">
                <div className="dws-switch" role="group" aria-label="Ordenar barrios por">
                  {[["total", "Mora total"], ["accounts", "Abonados con mora"], ["critical", "Mora alta"]].map(([metric, label]) => (
                    <button type="button" key={metric} aria-pressed={debtMetric === metric} onClick={() => setDebtMetric(metric)}>{label}</button>
                  ))}
                </div>
                {rankingAll.length > 10 ? (
                  <div className="dws-switch" role="group" aria-label="Cantidad de barrios">
                    {[10, 20].map((size) => (
                      <button type="button" key={size} aria-pressed={topN === size} onClick={() => setTopN(size)}>{size}</button>
                    ))}
                  </div>
                ) : null}
                <button type="button" className="dws-icon-btn" onClick={printDebtRanking} hidden={model.canExport === false} disabled={!ranking.length} title="Imprimir mora por barrio" aria-label="Imprimir mora por barrio">
                  <Icon name="print" />
                </button>
                <BotonPlegar plegado={plegados.has("mora")} titulo="los barrios con mayor mora" onToggle={() => alternarPanel("mora")} />
              </div>
            </header>
            {!plegados.has("mora") ? (
              <>
                {ranking.length ? (
                  <div className="dws-concentration" role="status">
                    <p>
                      <b className="dw-figure">{oneDecimal(percent(rankingTotal, metricTotal))}</b>
                      {metricDescription} está en estos {ranking.length} barrios
                      {debtMetric === "total" ? <> (<Amount value={rankingTotal} compact />)</> : null}.
                    </p>
                    <span className="dws-conc-bar" aria-hidden="true">
                      {ranking.map((item) => (
                        <span
                          key={item.name}
                          className={item.name === barrioSenalado ? "is-on" : ""}
                          style={{ width: `${percent(item.value, metricTotal)}%` }}
                          title={`${item.name}: ${oneDecimal(percent(item.value, metricTotal))}`}
                        />
                      ))}
                    </span>
                  </div>
                ) : null}

                <div className="dws-picker">
                  <div className="dw-barrio-search">
                    <Icon name="search" />
                    <input
                      id="dw-barrio-search"
                      ref={buscadorRef}
                      type="text"
                      role="combobox"
                      value={barrioQuery}
                      placeholder={`Agregar barrio a la selección · ${whole(rankingAll.length)} con mora`}
                      aria-label="Buscar barrios para agregar a la selección"
                      aria-expanded={sugerencias.length > 0}
                      aria-controls="dw-barrio-sugerencias"
                      aria-autocomplete="list"
                      aria-activedescendant={sugerencias[resaltada] ? `dw-sug-${resaltada}` : undefined}
                      autoComplete="off"
                      onChange={(event) => { setBarrioQuery(event.target.value); setResaltada(0); }}
                      onKeyDown={manejarTeclas}
                    />
                    {buscando ? <button type="button" className="dws-link" onClick={limpiarBusqueda}>Limpiar</button> : null}
                  </div>
                  {buscando ? (
                    sugerencias.length ? (
                      <ul className="dw-suggestions" role="listbox" id="dw-barrio-sugerencias" aria-label="Barrios que coinciden">
                        {sugerencias.map((item, index) => (
                          <li key={item.name}>
                            <button
                              type="button"
                              id={`dw-sug-${index}`}
                              role="option"
                              aria-selected={index === resaltada}
                              className={index === resaltada ? "is-active" : ""}
                              onMouseEnter={() => setResaltada(index)}
                              onClick={() => agregarBarrio(item.name)}
                            >
                              <span className="dw-sug-rank dw-figure">#{posiciones.get(item.name) || "—"}</span>
                              <span className="dw-sug-name">{item.name}</span>
                              <span className="dw-sug-value">
                                {debtMetric === "total" ? <Amount value={item.value} /> : <span className="dw-amount dw-figure">{whole(item.value)}</span>}
                              </span>
                              <Icon name="plus" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="dws-empty">
                        {searchHits.length ? "Ya agregaste todos los barrios que coinciden." : `Ningún barrio coincide con “${barrioQuery.trim()}”.`}
                      </p>
                    )
                  ) : null}
                </div>

                {ranking.length ? (
                  <div className="dws-table-wrap">
                    <table className="dws-board" aria-describedby="dws-board-hint">
                      <thead>
                        <tr>
                          <th scope="col" className="is-rank">N.º</th>
                          <th scope="col">Barrio</th>
                          <th scope="col" className="is-bar">{debtMetric === "total" ? "Mora total" : debtMetric === "accounts" ? "Abonados con mora" : "Cuentas con mora alta"}</th>
                          <th scope="col" className="is-num is-opt">% del total</th>
                          <th scope="col" className="is-num is-opt">Con mora</th>
                          <th scope="col" className="is-num is-opt">Mora alta</th>
                          <th scope="col" className="is-num">Cambio</th>
                          <th scope="col" className="is-more"><span className="dw-sr">Desglose</span></th>
                        </tr>
                      </thead>
                      {ranking.map((item) => {
                        const elegido = selectedBarrios.includes(item.name);
                        const abierto = barrioAbierto === item.name;
                        const cambio = cambioBarrio.get(item.name);
                        return (
                          <tbody key={item.name} className={abierto ? "is-open" : ""}>
                            <tr
                              tabIndex={0}
                              aria-selected={elegido}
                              className={item.name === barrioSenalado ? "is-hl" : ""}
                              onClick={() => toggleBarrio(item.name)}
                              onKeyDown={(event) => {
                                if (event.target !== event.currentTarget) return;
                                if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleBarrio(item.name); }
                                if (event.key === "ArrowDown") { event.preventDefault(); event.currentTarget.closest("tbody")?.nextElementSibling?.querySelector("tr")?.focus(); }
                                if (event.key === "ArrowUp") { event.preventDefault(); event.currentTarget.closest("tbody")?.previousElementSibling?.querySelector("tr")?.focus(); }
                              }}
                              onPointerEnter={() => setBarrioHover(item.name)}
                              onPointerLeave={() => setBarrioHover("")}
                              onFocus={() => setBarrioHover(item.name)}
                              onBlur={() => setBarrioHover("")}
                            >
                              <td className="is-rank dw-figure">{String(posiciones.get(item.name) || 0).padStart(2, "0")}</td>
                              <td className="is-name">{item.name}</td>
                              <td className="is-bar">
                                <span className="dws-bar-cell">
                                  <i aria-hidden="true"><span style={{ transform: `scaleX(${item.value / maxDebt})` }} /></i>
                                  {debtMetric === "total" ? <Amount value={item.value} compact /> : <b className="dw-amount dw-figure">{whole(item.value)}</b>}
                                </span>
                              </td>
                              <td className="is-num is-opt dw-figure">{oneDecimal(percent(item.debt?.total, debtTotal))}</td>
                              <td className="is-num is-opt dw-figure">{whole(item.debt?.deudores)}</td>
                              <td className="is-num is-opt dw-figure">{whole(item.debt?.criticos)}</td>
                              <td className="is-num">
                                {cambio ? (
                                  <span className={`dws-chg dw-figure ${cambio > 0 ? "is-up" : "is-down"}`}>{deltaMonto(cambio)}</span>
                                ) : (
                                  <span className="dws-chg is-none" title="No está entre los barrios que más cambiaron">—</span>
                                )}
                              </td>
                              <td className="is-more">
                                <button
                                  type="button"
                                  className="dws-icon-btn"
                                  aria-expanded={abierto}
                                  aria-label={`Ver desglose de ${item.name}`}
                                  onClick={(event) => { event.stopPropagation(); setBarrioAbierto((actual) => (actual === item.name ? "" : item.name)); }}
                                >
                                  <Icon name="chevronDown" />
                                </button>
                              </td>
                            </tr>
                            {abierto ? (
                              <tr className="dws-detail-row">
                                <td colSpan={8}>
                                  <dl className="dws-detail">
                                    <div><dt>Capital</dt><dd><Amount value={item.debt.capital} /></dd></div>
                                    <div><dt>Intereses</dt><dd><Amount value={item.debt.intereses} /></dd></div>
                                    <div><dt>Mora total</dt><dd><Amount value={item.debt.total} /></dd></div>
                                    <div><dt>Promedio por cuenta</dt><dd><Amount value={Number(item.debt.deudores || 0) ? Number(item.debt.total || 0) / Number(item.debt.deudores) : 0} /></dd></div>
                                  </dl>
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        );
                      })}
                    </table>
                  </div>
                ) : (
                  <p className="dws-empty">No hay desglose de mora por barrio disponible.</p>
                )}
                {/* La selección va debajo de la tabla: al elegir un barrio la fila
                    no se corre de bajo el cursor. */}
                {selectedBarrios.length ? (
                  <div className={`dw-selection ${selectedDetailsOpen ? "is-open" : ""}`.trim()}>
                    <header>
                      <button type="button" className="dw-disclosure" aria-expanded={selectedDetailsOpen} onClick={() => setSelectedDetailsOpen((value) => !value)}>
                        <Icon name="arrowRight" />
                        {selectedBarrios.length} {selectedBarrios.length === 1 ? "barrio seleccionado" : "barrios seleccionados"}
                      </button>
                      <button type="button" className="dws-link" onClick={() => { setSelectedBarrios([]); setSelectedDetailsOpen(false); }}>Quitar todos</button>
                    </header>
                    <ul className="dw-selection-chips">
                      {selectedBarrios.map((name) => (
                        <li key={name}>
                          <button type="button" onClick={() => toggleBarrio(name)} aria-label={`Quitar ${name} de la selección`}>
                            {name}
                            <Icon name="close" />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="dw-selection-share">
                      Concentran el <strong className="dw-figure">{oneDecimal(selectedShare)}</strong>
                      {debtMetric === "accounts" ? " de los abonados con mora del padrón." : debtMetric === "critical" ? " de las cuentas con mora alta del padrón." : " de la mora del padrón."}
                    </p>
                    <dl className="dw-selection-figures">
                      <div><dt>Abonados</dt><dd className="dw-amount dw-figure">{whole(selectedDebt.records)}</dd></div>
                      <div><dt>Capital</dt><dd><Amount value={selectedDebt.capital} /></dd></div>
                      <div><dt>Intereses</dt><dd><Amount value={selectedDebt.intereses} /></dd></div>
                      <div><dt>Mora total</dt><dd><Amount value={selectedDebt.total} /></dd></div>
                      <div><dt>Cuentas</dt><dd className="dw-amount dw-figure">{whole(selectedDebt.deudores)}</dd></div>
                      <div><dt>Mora alta</dt><dd className="dw-amount dw-figure">{whole(selectedDebt.criticos)}</dd></div>
                    </dl>
                    {selectedRows.length > 1 ? (
                      <section className="dw-selection-chart">
                        <header>
                          <strong>{debtMetric === "total" ? "Mora" : debtMetric === "accounts" ? "Abonados con mora" : "Cuentas con mora alta"} de los barrios elegidos</strong>
                        </header>
                        <ol>
                          {selectedRows.map((item) => (
                            <li key={item.name}>
                              <span className="dw-sel-name" title={item.name}>{item.name}</span>
                              <span className="dw-sel-value">
                                {debtMetric === "total" ? <Amount value={item.value} /> : <span className="dw-amount dw-figure">{whole(item.value)}</span>}
                                <small className="dw-figure">{oneDecimal(percent(item.value, selectedTotal))} de la selección</small>
                              </span>
                              <i className="dw-sel-track" aria-hidden="true"><em style={{ transform: `scaleX(${item.value / maxSelected})` }} /></i>
                            </li>
                          ))}
                        </ol>
                      </section>
                    ) : null}
                    {selectedDetailsOpen ? (
                      <section className="dw-services">
                        <header>
                          <strong>Servicios consolidados</strong>
                          <button type="button" className="dws-btn" onClick={printSelection} hidden={model.canExport === false}>
                            <Icon name="print" />
                            Imprimir sumatoria
                          </button>
                        </header>
                        <ul>
                          {selectedServices.map((service) => (
                            <li key={service.field}>
                              <Icon name={SERVICE_ICONS[service.field] || "records"} />
                              <span className="dw-service-copy">
                                <strong>{service.label}</strong>
                                <small>{whole(service.active)} activos · {whole(service.inactive)} inactivos</small>
                              </span>
                              <Amount value={service.debt} />
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                  </div>
                ) : null}

                <footer className="dws-mod-foot">
                  <span className="dws-hint" id="dws-board-hint">
                    Clic en un barrio para sumarlo a la selección; la flecha abre su desglose.{lotes.data?.anterior?.codigo ? ` «Cambio» compara con el lote ${lotes.data.anterior.codigo}.` : ""}
                  </span>
                  <button type="button" className="dws-link" onClick={() => model.navigate(model.hideDeadlines ? "fieldValidation" : "mapReports")}>Ver informe completo</button>
                </footer>
              </>
            ) : null}
          </article>

          {serviceDebt.length ? (
            <article className="dws-mod dws-servicios" data-plegado={plegados.has("servicios")}>
              <header className="dws-mod-head">
                <h2>Mora por servicio</h2>
                <div className="dws-controls">
                  <button type="button" className="dws-icon-btn" onClick={printDebtSummary} hidden={model.canExport === false} title="Ver / imprimir resumen PDF" aria-label="Ver o imprimir el resumen de mora por servicio">
                    <Icon name="print" />
                  </button>
                  <BotonPlegar plegado={plegados.has("servicios")} titulo="la mora por servicio" onToggle={() => alternarPanel("servicios")} />
                </div>
              </header>
              {!plegados.has("servicios") ? (
                <div className="dws-mod-body">
                  <ServiceDotPlot debtBarrios={model.debtBarrios} resaltado={barrioSenalado} />
                  <ul className="dws-services">
                    {serviceDebt.map((service) => {
                      const abierto = servicioAbierto === service.field;
                      const filas = abierto ? barriosDeServicio(model.debtBarrios, service.field) : [];
                      const mayor = Math.max(1, ...filas.map((fila) => fila.deuda));
                      const cuentas = filas.reduce((suma, fila) => suma + fila.cuentas, 0);
                      return (
                        <li key={service.field} data-service={service.field} data-abierto={abierto ? "" : undefined}>
                          <button
                            type="button"
                            className="dws-service-row"
                            aria-expanded={abierto}
                            onClick={() => {
                              setBarriosVisibles(6);
                              setServicioAbierto(abierto ? "" : service.field);
                              if (!abierto && model.fetchServiceAccounts && !cuentasPorServicio[service.field]) cargarCuentasServicio(service.field);
                            }}
                          >
                            <span className="dws-service-name"><Icon name={SERVICE_ICONS[service.field] || "records"} />{service.label}</span>
                            <i className="dws-service-track" aria-hidden="true"><span style={{ transform: `scaleX(${service.debt / maxServiceDebt})` }} /></i>
                            <Amount value={service.debt} compact />
                            <Icon name="chevronDown" className="dws-chevron" />
                          </button>
                          {abierto ? (
                            <div className="dw-service-drill">
                              <p className="dw-service-drill-head">
                                <strong className="dw-figure">{whole(filas.length)}</strong> barrios con el servicio activo
                                <span className="dw-sep" aria-hidden="true" />
                                <strong className="dw-figure">{whole(cuentas)}</strong> cuentas
                              </p>
                              {filas.length ? (
                                <ul className="dw-drill-list">
                                  {filas.slice(0, barriosVisibles).map((fila) => (
                                    <li key={fila.barrio}>
                                      <span className="dw-drill-name">{fila.barrio}</span>
                                      <span className="dw-drill-meta">{whole(fila.cuentas)} cuentas · {whole(fila.criticos)} con mora alta</span>
                                      <Amount value={fila.deuda} />
                                      <i className="dw-service-track" aria-hidden="true"><em style={{ transform: `scaleX(${fila.deuda / mayor})` }} /></i>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="dws-empty">Ningún barrio tiene este servicio activo.</p>
                              )}
                              {filas.length > barriosVisibles ? (
                                <button type="button" className="dws-link" onClick={() => setBarriosVisibles(filas.length)}>Ver los {whole(filas.length)} barrios</button>
                              ) : null}
                              <div className="dw-service-drill-actions">
                                <button type="button" className="dws-btn" onClick={() => printServiceDebt(service)} hidden={model.canExport === false}>
                                  <Icon name="print" />
                                  Ver / imprimir PDF
                                </button>
                              </div>
                              <CuentasDelServicio estado={cuentasPorServicio[service.field]} onLoadAll={() => cargarCuentasServicio(service.field, "all")} />
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="dws-reading">Una misma cuenta puede tener varios servicios activos, por eso la suma de servicios supera la mora total.</p>
                </div>
              ) : null}
            </article>
          ) : null}
        </div>

        <div
          className="dw-resize-handle"
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label="Ajustar el ancho de las columnas"
          aria-controls="dw-col-main"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(split)}
          aria-valuetext={`Columna principal al ${Math.round(split)} %`}
          title="Arrastrá para ajustar el ancho · doble clic para restablecer"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            ultimoSplitRef.current = split;
            setArrastrando(true);
          }}
          onPointerMove={(event) => {
            if (arrastrando) moverSeparador(event.clientX);
          }}
          onPointerUp={terminarArrastre}
          onPointerCancel={terminarArrastre}
          onLostPointerCapture={terminarArrastre}
          onDoubleClick={() => fijarSplit(SPLIT_DEFAULT, true)}
          onKeyDown={tecladoSeparador}
        >
          <span className="dw-resize-grip" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>

        <aside className="dw-col dw-col-side" aria-label="Campo y bitácora">
          {model.fetchAvanceEntregas ? (
            <EntregasAvance fetchAvance={model.fetchAvanceEntregas} onAbrir={() => model.navigate("entregas")} />
          ) : null}

          {fieldMetrics.length ? (
            <article className="dws-mod dws-campo" aria-labelledby="dws-campo-titulo">
              <header className="dws-mod-head"><h2 id="dws-campo-titulo">Campo</h2></header>
              <ul className="dws-rows">
                {fieldMetrics.map((item) => (
                  <li key={item.key}>
                    <button type="button" className={item.series?.length > 1 ? "has-serie" : ""} onClick={() => navigate(item.targetView || FIELD_VIEWS[item.key] || "users")}>
                      <span className="dws-row-copy">
                        <strong>{item.label}</strong>
                        <small>{item.helper}</small>
                        <SerieDias series={item.series} unidad={item.key === "gps" ? "puntos" : "movimientos"} />
                      </span>
                      <LiveWhole as="b" className="dw-figure dws-mid" value={item.value} flash="li" />
                    </button>
                  </li>
                ))}
              </ul>
            </article>
          ) : null}

          {model.aside ? model.aside : (
            <article className="dws-mod dws-feed" aria-labelledby="dws-feed-titulo">
              <header className="dws-mod-head"><h2 id="dws-feed-titulo">Bitácora</h2></header>
              {model.feed.length ? (
                <ol className="dws-rows is-log">
                  {model.feed.slice(0, 6).map((item) => (
                    <li key={item.key}>
                      <button type="button" onClick={() => model.navigate(item.targetView)}>
                        <span className="dws-row-copy">
                          <strong>{item.title}</strong>
                          <small>{item.detail}</small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : <p className="dws-empty">Aún no hay actividad hoy.</p>}
            </article>
          )}
        </aside>
      </div>
    </main>
  );

}
