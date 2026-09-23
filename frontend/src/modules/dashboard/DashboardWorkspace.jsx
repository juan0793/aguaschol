import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import LiveNumber from "../../components/micro/LiveNumber";
import { formatCurrency } from "../../utils/currency.js";
import { formatSpanishDate } from "../../utils/datesAndBusiness";
import { escapeHtml } from "../../utils/html";
import { printDocument } from "../../utils/printDocument";
import { clampSplit, debtRankingAll, filterBarriosByQuery, formatCompactCurrency, interestPerCapital, ofEachTen, SPLIT_DEFAULT, selectedRankedRows, sumSelectedDebt, sumSelectedServices } from "./dashboardSelectors";
import { buildDebtRankingPrintMarkup } from "./debtRankingPrint";
import logoAguasCholuteca from "../../assets/logo-aguas-choluteca.png";
import "./dashboard.css";

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
const dashboardReportHeader = (title, subtitle, serviceBadge = "") => `<header class="print-header"><div class="print-report-brand"><img src="${escapeHtml(logoAguasCholuteca)}" alt="Logo Aguas de Choluteca" class="print-report-logo" /><div><span class="print-report-kicker">Aguas de Choluteca · Reporte de control</span><h1>${escapeHtml(title)}</h1>${serviceBadge}${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}</div></div><div class="print-report-meta"><span>${escapeHtml(formatSpanishDate(new Date()))}</span><strong>REPORTE OPERATIVO</strong></div></header>`;
const serviceReportBadge = (service) => {
  const isHazardous = service.field === "desechos_peligrosos";
  return `<div class="print-report-service-flag${isHazardous ? " is-hazardous" : ""}">${reportIcon(isHazardous ? "alert" : "water")}<span><small>${isHazardous ? "Servicio prioritario" : "Servicio reportado"}</small><strong>${escapeHtml(service.label)}</strong></span></div>`;
};

// Siete barras, una por dia, de la mas antigua a hoy. Un solo tono: la altura
// es la magnitud; hoy va en el tono oscuro para ubicarse sin leer fechas.
function MiniBars({ series = [], unit = "" }) {
  // Sin historial se deja el hueco para que las cifras sigan alineadas.
  if (series.length < 2) return <i className="dw-minibars" aria-hidden="true" />;
  const max = Math.max(1, ...series.map((day) => day.total));
  const width = 64;
  const height = 24;
  const gap = 2;
  const barWidth = (width - gap * (series.length - 1)) / series.length;
  const dayLabel = (key) => new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`));
  return (
    <svg
      className="dw-minibars"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={`Últimos ${series.length} días: ${series.map((day) => `${dayLabel(day.key)} ${day.total}`).join(", ")}`}
    >
      {series.map((day, index) => {
        const barHeight = day.total ? Math.max(2, (day.total / max) * height) : 1;
        return (
          <rect
            key={day.key}
            x={index * (barWidth + gap)}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            rx="1.5"
            className={index === series.length - 1 ? "is-today" : day.total ? "" : "is-empty"}
          >
            <title>{`${dayLabel(day.key)}: ${day.total.toLocaleString("es-HN")} ${unit}`.trim()}</title>
          </rect>
        );
      })}
    </svg>
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
  const [topN, setTopN] = useState(5);
  const [barrioQuery, setBarrioQuery] = useState("");
  const [resaltada, setResaltada] = useState(0);
  const [selectedBarrios, setSelectedBarrios] = useState([]);
  const [selectedDetailsOpen, setSelectedDetailsOpen] = useState(false);
  const [barrioAbierto, setBarrioAbierto] = useState("");

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
  const niveles = [
    { key: "padron", label: "cuentas", value: padronRecords, share: padronRecords ? 100 : 0, note: `en el padrón · ${whole(model.padronTotals.barrios)} barrios` },
    { key: "mora", label: "con mora", value: Number(debt.deudores || 0), share: debtorShare, note: `${oneDecimal(debtorShare)} del padrón` },
    { key: "critica", label: "críticas", value: Number(debt.criticos || 0), share: percent(debt.criticos, padronRecords), note: `${oneDecimal(criticalShare)} de las con mora` }
  ];
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
  const metricDescription = debtMetric === "accounts" ? "de los abonados con mora" : debtMetric === "critical" ? "de los casos críticos" : "de la mora total";
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

  const printSelection = () =>
    printDocument(
      "Sumatoria de barrios",
      `${dashboardReportHeader("Sumatoria de barrios seleccionados", selectedBarrios.join(" · "))}<section class="print-section">${reportSectionTitle("chart", "Resumen de mora")}<div class="print-grid print-grid-five"><div class="print-field"><strong>Abonados</strong><span>${whole(selectedDebt.records)}</span></div>${[["Capital", selectedDebt.capital], ["Intereses", selectedDebt.intereses], ["Mora total", selectedDebt.total]].map(([label, value]) => `<div class="print-field"><strong>${label}</strong><span>${escapeHtml(formatCurrency(value))}</span></div>`).join("")}<div class="print-field"><strong>Cuentas con mora</strong><span>${whole(selectedDebt.deudores)}</span></div><div class="print-field"><strong>Casos criticos</strong><span>${whole(selectedDebt.criticos)}</span></div></div></section><section class="print-section">${reportSectionTitle("records", "Detalle por barrio")}<table class="field-report-table data-report-table"><thead><tr><th>Barrio</th><th>Abonados</th><th>Cuentas con mora</th><th>Casos criticos</th><th>Capital</th><th>Intereses</th><th>Mora total</th></tr></thead><tbody>${selectedRows.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${whole(row.records)}</td><td>${whole(row.debt?.deudores)}</td><td>${whole(row.debt?.criticos)}</td><td>${escapeHtml(formatCurrency(row.debt?.capital))}</td><td>${escapeHtml(formatCurrency(row.debt?.intereses))}</td><td>${escapeHtml(formatCurrency(row.debt?.total))}</td></tr>`).join("")}</tbody><tfoot><tr><th>Total</th><th>${whole(selectedDebt.records)}</th><th>${whole(selectedDebt.deudores)}</th><th>${whole(selectedDebt.criticos)}</th><th>${escapeHtml(formatCurrency(selectedDebt.capital))}</th><th>${escapeHtml(formatCurrency(selectedDebt.intereses))}</th><th>${escapeHtml(formatCurrency(selectedDebt.total))}</th></tr></tfoot></table></section><section class="print-section">${reportSectionTitle("water", "Servicios consolidados")}<table class="field-report-table data-report-table"><thead><tr><th>Servicio</th><th>Activos</th><th>Inactivos</th><th>Sin dato</th><th>Mora asociada</th></tr></thead><tbody>${selectedServices.map((service) => `<tr><td>${escapeHtml(service.label)}</td><td>${whole(service.active)}</td><td>${whole(service.inactive)}</td><td>${whole(service.unknown)}</td><td>${escapeHtml(formatCurrency(service.debt))}</td></tr>`).join("")}</tbody><tfoot><tr><th>Total</th><th>${whole(selectedServices.reduce((sum, item) => sum + item.active, 0))}</th><th>${whole(selectedServices.reduce((sum, item) => sum + item.inactive, 0))}</th><th>${whole(selectedServices.reduce((sum, item) => sum + item.unknown, 0))}</th><th>${escapeHtml(formatCurrency(selectedDebt.total))}</th></tr></tfoot></table></section>`,
      { pageSize: "Letter portrait", bodyClassName: "dashboard-report-body", showPageFooter: true }
    );

  const printDebtRanking = () => {
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
      `${dashboardReportHeader("Resumen de mora", "Situación financiera y mora asociada por servicio")}<section class="print-section">${reportSectionTitle("chart", "Situación financiera")}<div class="print-grid print-grid-five"><div class="print-field"><strong>Mora total</strong><span>${escapeHtml(formatCurrency(debtTotal))}</span></div><div class="print-field"><strong>Capital</strong><span>${escapeHtml(formatCurrency(debt.capital))}</span></div><div class="print-field"><strong>Intereses</strong><span>${escapeHtml(formatCurrency(debt.intereses))}</span></div><div class="print-field"><strong>Cuentas con mora</strong><span>${whole(debt.deudores)}</span></div><div class="print-field"><strong>Casos críticos</strong><span>${whole(debt.criticos)}</span></div></div></section><section class="print-section">${reportSectionTitle("water", "Mora asociada por servicio")}<table class="field-report-table data-report-table"><thead><tr><th>Servicio</th><th>Activos</th><th>Inactivos</th><th>Sin dato</th><th>Mora asociada</th></tr></thead><tbody>${serviceDebt.map((service) => `<tr><td>${escapeHtml(service.label)}</td><td>${whole(service.active)}</td><td>${whole(service.inactive)}</td><td>${whole(service.unknown)}</td><td>${escapeHtml(formatCurrency(service.debt))}</td></tr>`).join("")}</tbody></table></section>`,
      { pageSize: "Letter portrait", pageMargin: "10mm", bodyClassName: "field-report-body dashboard-report-body", showPageFooter: true }
    );

  const printServiceDebt = async (service) => {
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
      `${dashboardReportHeader("Mora asociada por servicio", "", serviceReportBadge(service))}<section class="print-section">${reportSectionTitle("water", "Resumen")}<div class="print-grid print-grid-four"><div class="print-field"><strong>Mora asociada</strong><span>${escapeHtml(formatCurrency(service.debt))}</span></div><div class="print-field"><strong>Activos</strong><span>${whole(service.active)}</span></div><div class="print-field"><strong>Inactivos</strong><span>${whole(service.inactive)}</span></div><div class="print-field"><strong>Sin dato</strong><span>${whole(service.unknown)}</span></div></div></section><section class="print-section">${reportSectionTitle("chart", "Mora por barrio")}<table class="field-report-table data-report-table"><thead><tr><th>Barrio</th><th>Cuentas</th><th>Críticas</th><th>Mora</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.barrio)}</td><td>${whole(row.cuentas)}</td><td>${whole(row.criticos)}</td><td>${escapeHtml(formatCurrency(row.deuda))}</td></tr>`).join("")}</tbody></table></section>${detailedAccounts.length ? `<section class="print-section print-account-section">${reportSectionTitle("users", `Cuentas con mora (${whole(detailedAccounts.length)})`)}<table class="field-report-table data-report-table"><thead><tr><th>Nombre</th><th>Barrio</th><th>Clave / abonado</th><th>Mora</th></tr></thead><tbody>${detailedAccounts.map((account) => `<tr><td>${escapeHtml(account.nombre)}</td><td>${escapeHtml(account.barrio_colonia)}</td><td>${escapeHtml(account.clave_catastral || account.abonado)}</td><td>${escapeHtml(formatCurrency(account.deuda))}</td></tr>`).join("")}</tbody></table></section>` : ""}`,
      { pageSize: "Letter portrait", pageMargin: "10mm", bodyClassName: "field-report-body dashboard-report-body", showPageFooter: true }
    );
  };

  return (
    <main className="dashboard-workspace">
      {/* Banda de estado: de que corte del padron provienen las cifras de abajo. */}
      <header className="dw-status">
        <p className="dw-status-source">
          <span className="dw-eyebrow">Padrón maestro</span>
          <span>
            <LiveWhole value={model.padronTotals.records} /> cuentas
            <span className="dw-sep" aria-hidden="true" />
            <LiveWhole value={model.padronTotals.barrios} /> barrios
            {padronDate ? (
              <>
                <span className="dw-sep" aria-hidden="true" />
                <span className="dw-status-date">Corte del {padronDate}</span>
              </>
            ) : null}
          </span>
        </p>
        <div className="dw-status-side">
          {model.onlineUsers.length ? (
            <div
              className="dw-team"
              title={model.onlineUsers.map((user) => `${user.full_name || user.username} · ${user.roleLabel}`).join("\n")}
            >
              <span className="dw-team-avatars" aria-hidden="true">
                {model.onlineUsers.slice(0, 4).map((user) => (
                  <i key={user.id}>{(user.full_name || user.username || "U").trim().charAt(0).toUpperCase()}</i>
                ))}
              </span>
              <span>{model.onlineUsers.length} en línea</span>
            </div>
          ) : null}
          <span className={`dw-sync is-${model.connectionStatus || "idle"}`} role="status">
            <i className="dw-sync-dot" aria-hidden="true" />
            {model.syncLabel}
          </span>
          <button type="button" className="dw-button-secondary" onClick={model.refresh} disabled={model.refreshing}>
            <Icon name="refresh" />{model.refreshing ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </header>

      {/* La cartera es la cifra que define el dia: va primero y con mas peso.
          Las tres tarjetas de al lado la explican o piden accion. */}
      {/* Resumen de cartera: el monto y de donde sale (capital e intereses) a la
          izquierda; a la derecha, las cuentas como niveles sobre una regla
          graduada, a la escala del padron. Los plazos de fichas van aparte
          porque son trabajo operativo, no cartera. */}
      <section className="dw-overview" aria-label="Resumen de cartera">
        <article className="dw-resumen">
          <div className="dw-resumen-monto">
            <header>
              <span className="dw-eyebrow">Cartera en mora</span>
              <button type="button" className="dw-icon-button" onClick={printDebtSummary} title="Ver / imprimir resumen PDF" aria-label="Ver o imprimir el resumen de mora en PDF">
                <Icon name="print" />
              </button>
            </header>
            <p className="dw-cartera-total">
              <Amount value={debtTotal} className="is-hero" compact flash=".dw-resumen-monto" />
              <small className="dw-cartera-exact dw-figure">{formatCurrency(debtTotal)}</small>
            </p>
            <div
              className="dw-cartera-bar"
              role="img"
              aria-label={`Capital ${oneDecimal(capitalShare)}, intereses ${oneDecimal(interesShare)} de la mora total`}
            >
              <span className="dw-seg is-capital" style={{ width: `${capitalShare}%` }} />
              <span className="dw-seg is-interes" style={{ width: `${interesShare}%` }} />
            </div>
            <dl className="dw-cartera-legend">
              <div>
                <dt>
                  <i className="is-capital" aria-hidden="true" />
                  Capital
                </dt>
                <dd>
                  <Amount value={debt.capital} compact />
                  <b className="dw-figure">{oneDecimal(capitalShare)}</b>
                </dd>
              </div>
              <div>
                <dt>
                  <i className="is-interes" aria-hidden="true" />
                  Intereses
                </dt>
                <dd>
                  <Amount value={debt.intereses} compact />
                  <b className="dw-figure">{oneDecimal(interesShare)}</b>
                </dd>
              </div>
            </dl>
            {interesPorLempira ? (
              <p className="dw-lectura">
                Por cada <strong>L 1</strong> de capital se deben{" "}
                <strong className="dw-figure">L {interesPorLempira.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> de intereses.
              </p>
            ) : null}
          </div>

          <div className="dw-niveles">
            <header>
              <span className="dw-eyebrow">Cuentas del padrón</span>
              <span className="dw-niveles-promedio">
                Promedio por cuenta con mora <Amount value={promedioPorCuenta} compact />
              </span>
            </header>
            {/* Regla graduada: marcas cada 25 % del padron, como una regla de nivel. */}
            <div className="dw-regla" aria-hidden="true">
              {[0, 25, 50, 75, 100].map((mark) => (
                <span key={mark} style={{ left: `${mark}%` }}>{mark}%</span>
              ))}
            </div>
            <ol className="dw-niveles-lista">
              {niveles.map((nivel) => (
                <li key={nivel.key} className={`is-${nivel.key}`}>
                  <span className="dw-nivel-texto">
                    <LiveWhole value={nivel.value} flash=".dw-niveles-lista li" />
                    <span>{nivel.label}</span>
                    <small className="dw-figure">{nivel.note}</small>
                  </span>
                  <i
                    className="dw-nivel-barra"
                    role="img"
                    aria-label={`${whole(nivel.value)} ${nivel.label}, ${oneDecimal(nivel.share)} del padrón`}
                  >
                    <b style={{ width: `${Math.min(100, nivel.share)}%` }} />
                  </i>
                </li>
              ))}
            </ol>
            <p className="dw-lectura">
              {ofEachTen(debt.criticos, debt.deudores) ? (
                <>
                  <strong>{ofEachTen(debt.criticos, debt.deudores)}</strong> cuentas con mora son críticas (mora de {"L\u00a01,000"} o más).{" "}
                </>
              ) : null}
              <LiveWhole value={cuentasAlDia} /> cuentas están al día.
            </p>
          </div>
        </article>

        <button
          type="button"
          className={`dw-plazos ${alertCount ? "has-alerts" : ""}`.trim()}
          data-alerta={alertCount ? "" : undefined}
          onClick={() => navigate("records", "alerts")}
        >
          <span className="dw-plazos-head">
            <span className="dw-eyebrow">Plazos de fichas</span>
            {/* Late solo cuando hay algo que atender, tres veces al aparecer o
                al cambiar la cifra; un pulso permanente seria ruido. */}
            <span key={alertCount ? `alerta-${alertCount}` : "ok"} className={alertCount ? "live-attention dw-plazos-icon" : "dw-plazos-icon"}><Icon name={alertCount ? "warning" : "checkCircle"} /></span>
          </span>
          <span className="dw-plazos-cifra">
            <LiveWhole value={alertCount} flash=".dw-plazos" />
            <span>{alertCount === 1 ? "ficha con plazo crítico" : "fichas con plazo crítico"}</span>
          </span>
          {alertCount ? (
            <>
              <span className="dw-plazos-barra" role="img" aria-label={plazos.map((item) => `${item.value} ${item.label.toLowerCase()}`).join(", ")}>
                {plazos.filter((item) => item.value).map((item) => (
                  <i key={item.key} className={`is-${item.key}`} style={{ width: `${(item.value / plazosTotal) * 100}%` }} />
                ))}
              </span>
              <span className="dw-plazos-leyenda">
                {plazos.map((item) => (
                  <span key={item.key} className={`is-${item.key}`} data-vacio={item.value ? undefined : ""}>
                    <i aria-hidden="true" />
                    <LiveWhole as="b" value={item.value} />
                    {item.label}
                  </span>
                ))}
              </span>
            </>
          ) : (
            <span className="dw-plazos-ok">Ninguna ficha vencida ni por vencer. Regla de 7 días hábiles.</span>
          )}
          <span className="dw-stat-link">
            {alertCount ? "Revisar fichas" : "Ver fichas"}
            <Icon name="arrowRight" />
          </span>
        </button>
      </section>

      <nav className="dw-actions" aria-label="Acciones rápidas">
        {QUICK_ACTIONS.map(([view, icon, label]) => (
          <button type="button" key={view} onClick={() => model.navigate(view)}>
            <Icon name={icon} />
            {label}
          </button>
        ))}
      </nav>

      {/* Columna ancha para el analisis de la mora; la angosta para lo que se
          atiende hoy. El separador reparte el ancho entre ambas: se arrastra,
          se mueve con las flechas y doble clic (o Enter) lo restablece. */}
      <div
        ref={gridRef}
        className={`dw-grid ${arrastrando ? "is-resizing" : ""}`.trim()}
        style={{ "--dw-columns": `minmax(0, ${split}fr) ${HANDLE_PX}px minmax(0, ${100 - split}fr)` }}
      >
        <div className="dw-col dw-col-main" id="dw-col-main">
          <article className="dw-panel dw-mora" data-metric={debtMetric} data-plegado={plegados.has("mora")}>
                    <header className="dw-panel-head">
                      <div>
                        <span className="dw-eyebrow">Datos reales del padrón</span>
                        <h2>Barrios con mayor mora</h2>
                      </div>
                      {rankingAll.length > 5 ? (
                        <div className="dw-top-switch" role="group" aria-label="Cantidad de barrios">
                          {[5, 10].map((size) => (
                            <button type="button" key={size} aria-pressed={topN === size} onClick={() => setTopN(size)}>
                              Top {size}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <BotonPlegar plegado={plegados.has("mora")} titulo="los barrios con mayor mora" onToggle={() => alternarPanel("mora")} />
                    </header>
                    <div className="dw-panel-body"><div className="dw-panel-body-inner">
                    <div className="dw-metric-switch" role="group" aria-label="Ordenar barrios por">
                      {[["total", "Mora total", "records"], ["accounts", "Abonados", "users"], ["critical", "Casos críticos", "warning"]].map(([metric, label, icon]) => (
                        <button type="button" key={metric} aria-pressed={debtMetric === metric} onClick={() => setDebtMetric(metric)}>
                          <Icon name={icon} />{label}
                        </button>
                      ))}
                    </div>
                    {ranking.length ? (
                      <div className="dw-ranking-summary" role="status">
                        <span><strong className="dw-figure">{oneDecimal(percent(rankingTotal, metricTotal))}</strong><span>{metricDescription} se concentra en estos {ranking.length} barrios.</span></span>
                        <div><small>{debtMetric === "total" ? "Mora acumulada" : debtMetric === "accounts" ? "Abonados con mora" : "Casos críticos"}</small>
                          {debtMetric === "total" ? <Amount value={rankingTotal} compact /> : <strong className="dw-figure">{whole(rankingTotal)}</strong>}
                        </div>
                        {/* Cada tramo es un barrio sobre el total del padron: la barra
                            muestra la concentracion real, no solo el orden. */}
                        <div className="dw-concentration" aria-hidden="true">
                          {ranking.map((item) => (
                            <i
                              key={item.name}
                              style={{ width: `${percent(item.value, metricTotal)}%` }}
                              title={`${item.name}: ${oneDecimal(percent(item.value, metricTotal))}`}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="dw-barrio-picker">
                      <div className="dw-barrio-search">
                        <Icon name="search" />
                        <input
                          id="dw-barrio-search"
                          ref={buscadorRef}
                          type="text"
                          role="combobox"
                          value={barrioQuery}
                          placeholder={`Agregar barrio · ${whole(rankingAll.length)} con mora`}
                          aria-label="Buscar barrios para agregar a la selección"
                          aria-expanded={sugerencias.length > 0}
                          aria-controls="dw-barrio-sugerencias"
                          aria-autocomplete="list"
                          aria-activedescendant={sugerencias[resaltada] ? `dw-sug-${resaltada}` : undefined}
                          autoComplete="off"
                          onChange={(event) => { setBarrioQuery(event.target.value); setResaltada(0); }}
                          onKeyDown={manejarTeclas}
                        />
                        {buscando ? (
                          <button type="button" className="dw-link" onClick={limpiarBusqueda}>Limpiar</button>
                        ) : null}
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
                          <p className="dw-empty">
                            {searchHits.length ? "Ya agregaste todos los barrios que coinciden." : `Ningún barrio coincide con “${barrioQuery.trim()}”.`}
                          </p>
                        )
                      ) : null}
                    </div>

                    {selectedBarrios.length ? (
                      <div className={`dw-selection ${selectedDetailsOpen ? "is-open" : ""}`.trim()}>
                        <header>
                          <button
                            type="button"
                            className="dw-disclosure"
                            aria-expanded={selectedDetailsOpen}
                            onClick={() => setSelectedDetailsOpen((value) => !value)}
                          >
                            <Icon name="arrowRight" />
                            {selectedBarrios.length} {selectedBarrios.length === 1 ? "barrio seleccionado" : "barrios seleccionados"}
                          </button>
                          <button
                            type="button"
                            className="dw-link"
                            onClick={() => {
                              setSelectedBarrios([]);
                              setSelectedDetailsOpen(false);
                            }}
                          >
                            Quitar todos
                          </button>
                        </header>
                        <ul className="dw-selection-chips">
                          {selectedBarrios.map((name) => (
                            <li key={name}>
                              <button type="button" onClick={() => toggleBarrio(name)} aria-label={`Quitar ${name} de la selección`}>
                                {name}
                                <span aria-hidden="true">✕</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                        <p className="dw-selection-share">
                          Concentran el <strong className="dw-figure">{oneDecimal(selectedShare)}</strong>
                          {debtMetric === "accounts" ? " de los abonados con mora del padrón." : debtMetric === "critical" ? " de los casos críticos del padrón." : " de la mora del padrón."}
                        </p>
                        <dl className="dw-selection-figures">
                          <div>
                            <dt>Abonados</dt>
                            <dd className="dw-amount dw-figure">{whole(selectedDebt.records)}</dd>
                          </div>
                          <div>
                            <dt>Capital</dt>
                            <dd>
                              <Amount value={selectedDebt.capital} />
                            </dd>
                          </div>
                          <div>
                            <dt>Intereses</dt>
                            <dd>
                              <Amount value={selectedDebt.intereses} />
                            </dd>
                          </div>
                          <div>
                            <dt>Mora total</dt>
                            <dd>
                              <Amount value={selectedDebt.total} />
                            </dd>
                          </div>
                          <div>
                            <dt>Cuentas</dt>
                            <dd className="dw-amount dw-figure">{whole(selectedDebt.deudores)}</dd>
                          </div>
                          <div>
                            <dt>Críticas</dt>
                            <dd className="dw-amount dw-figure">{whole(selectedDebt.criticos)}</dd>
                          </div>
                        </dl>
                        {selectedRows.length > 1 ? (
                          <section className="dw-selection-chart">
                            <header>
                              <strong>{debtMetric === "total" ? "Mora" : debtMetric === "accounts" ? "Abonados con mora" : "Casos críticos"} de los barrios elegidos</strong>
                              <small>Se rearma al agregar o quitar un barrio.</small>
                            </header>
                            <ol>
                              {selectedRows.map((item) => (
                                <li key={item.name}>
                                  <span className="dw-sel-name" title={item.name}>{item.name}</span>
                                  <span className="dw-sel-value">
                                    {debtMetric === "total" ? <Amount value={item.value} /> : <span className="dw-amount dw-figure">{whole(item.value)}</span>}
                                    <small className="dw-figure">{oneDecimal(percent(item.value, selectedTotal))} de la selección</small>
                                  </span>
                                  <i className="dw-sel-track" aria-hidden="true">
                                    <em style={{ transform: `scaleX(${item.value / maxSelected})` }} />
                                  </i>
                                </li>
                              ))}
                            </ol>
                          </section>
                        ) : null}
                        {selectedDetailsOpen ? (
                          <section className="dw-services">
                            <header>
                              <strong>Servicios consolidados</strong>
                              <button type="button" className="dw-button-secondary" onClick={printSelection}>
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
                                    <small>
                                      {whole(service.active)} activos · {whole(service.inactive)} inactivos
                                    </small>
                                  </span>
                                  <Amount value={service.debt} />
                                </li>
                              ))}
                            </ul>
                          </section>
                        ) : null}
                      </div>
                    ) : null}

                    {ranking.length ? (
                      <p className="dw-chart-caption">
                        Tocá un barrio para sumarlo a la selección · la flecha abre su desglose · la barra se compara con el primero.
                      </p>
                    ) : null}

                    {ranking.length ? (
                      <ol className="dw-ranking">
                        {ranking.map((item) => (
                          <li key={item.name} className={barrioAbierto === item.name ? "is-expanded" : ""}>
                            <div className="dw-ranking-row">
                              <button
                                type="button"
                                aria-pressed={selectedBarrios.includes(item.name)}
                                className={selectedBarrios.includes(item.name) ? "is-selected" : ""}
                                onClick={() => toggleBarrio(item.name)}
                              >
                                <b className="dw-rank-number dw-figure" aria-hidden="true">{selectedBarrios.includes(item.name) ? <Icon name="success" /> : String(posiciones.get(item.name) || 0).padStart(2, "0")}</b>
                                <strong className="dw-ranking-name">{item.name}</strong>
                                <span className="dw-ranking-value">
                                  {debtMetric === "total" ? (
                                    <Amount value={item.value} compact />
                                  ) : (
                                    <span className="dw-amount dw-figure">{whole(item.value)}</span>
                                  )}
                                </span>
                                <i className="dw-ranking-track" aria-hidden="true">
                                  <em style={{ transform: `scaleX(${item.value / maxDebt})` }} />
                                </i>
                                <small className="dw-ranking-share dw-figure" title={`${oneDecimal(percent(item.value, metricTotal))} ${metricDescription}`}>
                                  {oneDecimal(percent(item.value, metricTotal))}
                                </small>
                              </button>
                              <button
                                type="button"
                                className="dw-ranking-more"
                                aria-expanded={barrioAbierto === item.name}
                                aria-label={`Ver desglose de ${item.name}`}
                                onClick={() => setBarrioAbierto((actual) => (actual === item.name ? "" : item.name))}
                              >
                                <Icon name="chevronDown" />
                              </button>
                            </div>
                            {barrioAbierto === item.name ? (
                              <dl className="dw-ranking-detail">
                                <div><dt>Capital</dt><dd><Amount value={item.debt.capital} /></dd></div>
                                <div><dt>Intereses</dt><dd><Amount value={item.debt.intereses} /></dd></div>
                                <div><dt>Cuentas con mora</dt><dd className="dw-amount dw-figure">{whole(item.debt.deudores)}</dd></div>
                                <div><dt>Casos críticos</dt><dd className="dw-amount dw-figure">{whole(item.debt.criticos)}</dd></div>
                                <div><dt>Promedio por cuenta</dt><dd><Amount value={Number(item.debt.deudores || 0) ? Number(item.debt.total || 0) / Number(item.debt.deudores) : 0} /></dd></div>
                              </dl>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="dw-empty">
                        No hay desglose de mora por barrio disponible.
                      </p>
                    )}


                    <footer className="dw-panel-foot">
                      <button type="button" className="dw-button-secondary" onClick={printDebtRanking} disabled={!ranking.length}>
                        <Icon name="print" />
                        Imprimir mora por barrio
                      </button>
                      <button type="button" className="dw-link" onClick={() => model.navigate("mapReports")}>
                        Ver informe
                      </button>
                    </footer>
                    </div></div>
                  </article>
          {serviceDebt.length ? (
            <article className="dw-panel dw-servicios" data-plegado={plegados.has("servicios")}>
              <header className="dw-panel-head">
                <div>
                  <span className="dw-eyebrow">Composición de la mora</span>
                  <h2>Mora por servicio</h2>
                </div>
                <BotonPlegar plegado={plegados.has("servicios")} titulo="la mora por servicio" onToggle={() => alternarPanel("servicios")} />
              </header>
              <div className="dw-panel-body"><div className="dw-panel-body-inner">
                <section className="dw-service-debt">
                        <ul>
                          {serviceDebt.map((service) => {
                            const abierto = servicioAbierto === service.field;
                            const filas = abierto ? barriosDeServicio(model.debtBarrios, service.field) : [];
                            const mayor = Math.max(1, ...filas.map((fila) => fila.deuda));
                            const cuentas = filas.reduce((suma, fila) => suma + fila.cuentas, 0);
                            return (
                              <li key={service.field} data-service={service.field} data-abierto={abierto ? "" : undefined}>
                                <button
                                  type="button"
                                  className="dw-service-row"
                                  aria-expanded={abierto}
                                  onClick={() => {
                                    setBarriosVisibles(6);
                                    setServicioAbierto(abierto ? "" : service.field);
                                    if (!abierto && model.fetchServiceAccounts && !cuentasPorServicio[service.field]) {
                                      cargarCuentasServicio(service.field);
                                    }
                                  }}
                                >
                                  <span className="dw-service-name"><Icon name={SERVICE_ICONS[service.field] || "records"} />{service.label}</span>
                                  <Amount value={service.debt} compact />
                                  <Icon name="chevronDown" className="dw-service-chevron" />
                                  <i className="dw-service-track" aria-hidden="true">
                                    <em style={{ transform: `scaleX(${service.debt / maxServiceDebt})` }} />
                                  </i>
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
                                            <span className="dw-drill-meta">{whole(fila.cuentas)} cuentas · {whole(fila.criticos)} críticas</span>
                                            <Amount value={fila.deuda} />
                                            <i className="dw-service-track" aria-hidden="true">
                                              <em style={{ transform: `scaleX(${fila.deuda / mayor})` }} />
                                            </i>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="dw-empty">Ningún barrio tiene este servicio activo.</p>
                                    )}
                                    {filas.length > barriosVisibles ? (
                                      <button type="button" className="dw-link" onClick={() => setBarriosVisibles(filas.length)}>
                                        Ver los {whole(filas.length)} barrios
                                      </button>
                                    ) : null}
                                    <div className="dw-service-drill-actions">
                                      <button type="button" className="dw-button-secondary" onClick={() => printServiceDebt(service)}>
                                        <Icon name="print" />
                                        Ver / imprimir PDF
                                      </button>
                                    </div>
                                    <CuentasDelServicio
                                      estado={cuentasPorServicio[service.field]}
                                      onLoadAll={() => cargarCuentasServicio(service.field, "all")}
                                    />
                                  </div>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                  <small className="dw-note">Una misma cuenta puede tener varios servicios activos, por eso la suma supera la mora total.</small>
                </section>
                <footer className="dw-panel-foot">
                  <button type="button" className="dw-button-secondary" onClick={printDebtSummary}>
                    <Icon name="print" />
                    Ver / imprimir resumen PDF
                  </button>
                </footer>
              </div></div>
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

        <aside className="dw-col dw-col-side" aria-label="Pendientes y actividad">
          <article className="dw-panel dw-attention">
            <header className="dw-panel-head">
              <div>
                <span className="dw-eyebrow">Prioridades</span>
                <h2>Atención requerida</h2>
              </div>
            </header>
            <ul className="dw-list">
              {attentionItems.map((item) => {
                const tone = LEVEL_ORDER[item.level] === 0 ? "is-critical" : item.tone || "";
                return (
                  <li key={item.key || item.title}>
                    <button type="button" className={tone} onClick={() => navigate(item.actionView, item.filter || "")}>
                      <Icon name={item.icon} />
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.detail}</small>
                      </span>
                      {Number.isFinite(item.count) ? <b className="dw-count dw-figure">{whole(item.count)}</b> : <i aria-hidden="true" />}
                      <Icon name="arrowRight" />
                    </button>
                  </li>
                );
              })}
            </ul>
            {!attentionItems.length ? <p className="dw-empty">No hay prioridades pendientes.</p> : null}
          </article>

          {fieldMetrics.length ? (
            <article className="dw-panel dw-campo">
              <header className="dw-panel-head">
                <div>
                  <span className="dw-eyebrow">Operación de campo</span>
                  <h2>Actividad del equipo</h2>
                </div>
              </header>
              <ul className="dw-list">
                {fieldMetrics.map((item) => (
                  <li key={item.key}>
                    <button type="button" className={item.tone || ""} onClick={() => navigate(FIELD_VIEWS[item.key] || "users")}>
                      <Icon name={item.icon} />
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.helper}</small>
                      </span>
                      <MiniBars series={item.series} unit={item.key === "gps" ? "puntos" : "fichas"} />
                      <b className="dw-count is-neutral dw-figure">{whole(item.value)}</b>
                      <Icon name="arrowRight" />
                    </button>
                  </li>
                ))}
              </ul>
            </article>
          ) : null}

          <article className="dw-panel dw-feed">
                    <header className="dw-panel-head">
                      <div>
                        <span className="dw-eyebrow">Últimos movimientos</span>
                        <h2>Actividad reciente</h2>
                      </div>
                    </header>
                    <ul className="dw-list is-quiet">
                      {model.feed.slice(0, 5).map((item) => (
                        <li key={item.key}>
                          <button type="button" onClick={() => model.navigate(item.targetView)}>
                            <Icon name={item.icon} />
                            <span>
                              <strong>{item.title}</strong>
                              <small>{item.detail}</small>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    {!model.feed.length ? <p className="dw-empty">Aún no hay actividad reciente.</p> : null}
                  </article>
        </aside>
      </div>
    </main>
  );
}
