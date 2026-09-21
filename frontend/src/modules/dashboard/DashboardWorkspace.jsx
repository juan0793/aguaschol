import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { formatCurrency } from "../../utils/currency.js";
import { formatSpanishDate } from "../../utils/datesAndBusiness";
import { escapeHtml } from "../../utils/html";
import { printDocument } from "../../utils/printDocument";
import { debtRankingAll, filterBarriosByQuery, selectedRankedRows, sumSelectedDebt, sumSelectedServices } from "./dashboardSelectors";
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

const PANELES_KEY = "aguas.dashboard.paneles-plegados";

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

// La cifra es el material tipografico de este tablero: el signo de lempira va
// mas pequeno y liviano para que los digitos, en cifras tabulares, carguen el peso.
function Amount({ value, className = "" }) {
  const text = formatCurrency(Number(value || 0));
  const match = text.match(/^(\D+)\s*(.+)$/);
  const mark = match ? match[1].trim() : "";
  const digits = match ? match[2] : text;
  return (
    <span className={`dw-amount ${className}`.trim()}>
      {mark ? <i aria-hidden="true">{mark}</i> : null}
      {digits}
    </span>
  );
}

export default function DashboardWorkspace({ model }) {
  const gridRef = useRef(null);
  const [splitPercent, setSplitPercent] = useState(42);
  const [isResizing, setIsResizing] = useState(false);
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
  const [barrioQuery, setBarrioQuery] = useState("");
  const [selectedBarrios, setSelectedBarrios] = useState([]);
  const [selectedDetailsOpen, setSelectedDetailsOpen] = useState(false);
  const [barrioAbierto, setBarrioAbierto] = useState("");
  const [attentionLevel, setAttentionLevel] = useState("");

  useEffect(() => {
    if (!isResizing) return undefined;

    const move = (event) => {
      const bounds = gridRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const nextPercent = ((event.clientX - bounds.left) / bounds.width) * 100;
      setSplitPercent(Math.min(62, Math.max(30, nextPercent)));
    };
    const stop = () => setIsResizing(false);

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
  }, [isResizing]);

  const adjustSplit = (direction) => {
    setSplitPercent((current) => Math.min(62, Math.max(30, current + direction)));
  };

  // El padron entero ordenado por la metrica activa. El top 5 sale de aca, pero
  // la busqueda necesita la lista completa para encontrar barrios que no entran
  // al ranking visible.
  const rankingAll = useMemo(() => debtRankingAll(model.debtBarrios, debtMetric), [model.debtBarrios, debtMetric]);
  const ranking = useMemo(() => rankingAll.slice(0, 5), [rankingAll]);
  const searchHits = useMemo(() => filterBarriosByQuery(rankingAll, barrioQuery, 25), [rankingAll, barrioQuery]);
  const buscando = Boolean(barrioQuery.trim());
  // Con busqueda activa la lista muestra las coincidencias; sin ella, el top 5.
  const listaBarrios = buscando ? searchHits : ranking;
  // La posicion real en el padron, para que al buscar no se renumere desde 1.
  const posiciones = useMemo(() => new Map(rankingAll.map((item, index) => [item.name, index + 1])), [rankingAll]);
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
  const maxDebt = Math.max(1, ...listaBarrios.map((item) => item.value));

  const debt = model.debtSummary || {};
  const debtTotal = Number(debt.total || 0);
  const capitalShare = percent(debt.capital, debtTotal);
  const interesShare = percent(debt.intereses, debtTotal);
  const criticalShare = percent(debt.criticos, Number(debt.deudores || 0));
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
        <div className="dw-status-source">
          <span className="dw-eyebrow">Padrón maestro</span>
          <p>
            <strong className="dw-figure">{whole(model.padronTotals.records)}</strong> cuentas
            <span className="dw-sep" aria-hidden="true" />
            <strong className="dw-figure">{whole(model.padronTotals.barrios)}</strong> barrios
            <span className="dw-sep" aria-hidden="true" />
            <span className="dw-status-date">{formatSpanishDate(new Date())}</span>
          </p>
        </div>
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

      <nav className="dw-actions" aria-label="Acciones rápidas">
        {QUICK_ACTIONS.map(([view, icon, label]) => (
          <button type="button" key={view} onClick={() => model.navigate(view)}>
            <Icon name={icon} />
            {label}
          </button>
        ))}
      </nav>

      <section className="dw-kpis" aria-label="Indicadores principales">
        {model.metrics.map((item) => (
          <button
            type="button"
            className={`dw-kpi ${item.tone || ""}`.trim()}
            key={item.key}
            // El ícono late solo cuando hay algo que atender: un pulso
            // permanente en las cuatro tarjetas sería ruido, no aviso.
            data-alerta={["is-critical", "is-warning"].includes(item.tone) && Number(item.value) > 0 ? "" : undefined}
            onClick={() =>
              navigate(
                item.key === "gps" ? "map" : item.key === "records" || item.key === "alerts" ? "records" : "users",
                item.key === "alerts" ? "alerts" : ""
              )
            }
          >
            <span className="dw-kpi-icon"><Icon name={item.icon} /></span>
            <span className="dw-eyebrow">{item.label}</span>
            <strong className="dw-figure" key={item.value}>{whole(item.value)}</strong>
            <small>{item.helper}</small>
          </button>
        ))}
      </section>

      <div
        ref={gridRef}
        className={`dw-grid ${isResizing ? "is-resizing" : ""}`.trim()}
        style={{ "--dw-split": `${splitPercent}%` }}
      >
        {/* Columna izquierda: primero lo accionable, despues la cifra. */}
        <div className="dw-col">
          <article className="dw-panel dw-attention">
                    <header className="dw-panel-head">
                      <div>
                        <span className="dw-eyebrow">Prioridades</span>
                        <h2>Atención requerida</h2>
                      </div>
                    </header>
                    <div className="dw-filters" role="group" aria-label="Filtrar prioridades">
                      {[["", "Todas"], ["Crítico", "Críticas"], ["Atención", "Pendientes"]].map(([value, label]) => (
                        <button type="button" key={value} aria-pressed={attentionLevel === value} onClick={() => setAttentionLevel(value)}>{label}</button>
                      ))}
                    </div>
                    <ul className="dw-list">
                      {model.attention.filter((item) => !attentionLevel || item.level === attentionLevel).map((item) => (
                        <li key={item.title}>
                          <button type="button" className={item.tone || ""} onClick={() => navigate(item.actionView, item.filter || "")}>
                            <Icon name={item.icon} />
                            <span>
                              <strong>{item.title}</strong>
                              <small>{item.detail}</small>
                            </span>
                            <Icon name="arrowRight" />
                          </button>
                        </li>
                      ))}
                    </ul>
                    {!model.attention.some((item) => !attentionLevel || item.level === attentionLevel) ? <p className="dw-empty">No hay prioridades en esta categoría.</p> : null}
                  </article>
          <article className="dw-panel dw-cartera" data-plegado={plegados.has("cartera")}>
                    <header className="dw-panel-head">
                      <div>
                        <span className="dw-eyebrow">Situación financiera</span>
                        <h2>Cartera en mora</h2>
                      </div>
                      <BotonPlegar plegado={plegados.has("cartera")} titulo="la cartera en mora" onToggle={() => alternarPanel("cartera")} />
                    </header>
                    <div className="dw-panel-body"><div className="dw-panel-body-inner">

                    <p className="dw-cartera-total">
                      <Amount value={debtTotal} className="is-hero" />
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
                          <Amount value={debt.capital} />
                          <b className="dw-figure">{oneDecimal(capitalShare)}</b>
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <i className="is-interes" aria-hidden="true" />
                          Intereses
                        </dt>
                        <dd>
                          <Amount value={debt.intereses} />
                          <b className="dw-figure">{oneDecimal(interesShare)}</b>
                        </dd>
                      </div>
                    </dl>

                    <div className="dw-cartera-foot">
                      <p>
                        <strong className="dw-figure">{whole(debt.criticos)}</strong> de{" "}
                        <strong className="dw-figure">{whole(debt.deudores)}</strong> cuentas con mora son críticas
                      </p>
                      <div className="dw-meter" role="img" aria-label={`${oneDecimal(criticalShare)} de las cuentas con mora son críticas`}>
                        <i style={{ width: `${criticalShare}%` }} />
                      </div>
                      <small className="dw-note">Crítica: mora igual o mayor a L 1,000.</small>
                    </div>

                    {serviceDebt.length ? (
                      <section className="dw-service-debt">
                        <span className="dw-eyebrow">Mora asociada por servicio</span>
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
                                  <Amount value={service.debt} />
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
                    ) : null}
                    <footer className="dw-panel-foot">
                      <button type="button" className="dw-button-secondary" onClick={printDebtSummary}>
                        <Icon name="print" />
                        Ver / imprimir resumen PDF
                      </button>
                    </footer>
                    </div></div>
          </article>
        </div>
        <div
          className="dw-resize-handle"
          role="separator"
          tabIndex="0"
          aria-label="Ajustar ancho de los paneles"
          aria-orientation="vertical"
          aria-valuemin="30"
          aria-valuemax="62"
          aria-valuenow={Math.round(splitPercent)}
          onPointerDown={(event) => {
            event.preventDefault();
            setIsResizing(true);
          }}
          onDoubleClick={() => setSplitPercent(42)}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            if (event.key === "ArrowLeft") adjustSplit(-2);
            if (event.key === "ArrowRight") adjustSplit(2);
            if (event.key === "Home") setSplitPercent(30);
            if (event.key === "End") setSplitPercent(62);
          }}
        >
          <span aria-hidden="true" />
        </div>
        <div className="dw-col">
          <article className="dw-panel dw-mora" data-metric={debtMetric} data-plegado={plegados.has("mora")}>
                    <header className="dw-panel-head">
                      <div>
                        <span className="dw-eyebrow">Datos reales del padrón</span>
                        <h2>Barrios con mayor mora</h2>
                      </div>
                      {ranking.length ? <span className="dw-ranking-count">Top {ranking.length}</span> : null}
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
                    {ranking.length ? <div className="dw-ranking-summary" role="status">
                      <span><strong className="dw-figure">{oneDecimal(percent(rankingTotal, metricTotal))}</strong><span>{metricDescription} se concentra en estos {ranking.length} barrios.</span></span>
                      <div><small>{debtMetric === "total" ? "Mora acumulada" : debtMetric === "accounts" ? "Abonados con mora" : "Casos críticos"}</small>
                        {debtMetric === "total" ? <Amount value={rankingTotal} /> : <strong className="dw-figure">{whole(rankingTotal)}</strong>}
                      </div>
                    </div> : null}
                    <div className="dw-barrio-search">
                      <Icon name="search" />
                      <input
                        id="dw-barrio-search"
                        type="search"
                        value={barrioQuery}
                        placeholder={`Buscar entre ${whole(rankingAll.length)} barrios con mora`}
                        aria-label="Buscar barrios para sumar"
                        autoComplete="off"
                        onChange={(event) => setBarrioQuery(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== "Escape" || !barrioQuery) return;
                          event.preventDefault();
                          setBarrioQuery("");
                        }}
                      />
                      {buscando ? (
                        <button type="button" className="dw-link" onClick={() => setBarrioQuery("")}>Limpiar</button>
                      ) : null}
                    </div>

                    {listaBarrios.length ? (
                      <p className="dw-chart-caption">
                        {buscando
                          ? `${whole(searchHits.length)} ${searchHits.length === 1 ? "coincidencia" : "coincidencias"} · Tocá un barrio para sumarlo.`
                          : "De mayor a menor · Barras comparadas con el primer lugar."}
                      </p>
                    ) : null}

                    {listaBarrios.length ? (
                      <ol className="dw-ranking">
                        {listaBarrios.map((item) => (
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
                                    <Amount value={item.value} />
                                  ) : (
                                    <span className="dw-amount dw-figure">{whole(item.value)}</span>
                                  )}
                                  <small className="dw-figure">{oneDecimal(percent(item.value, metricTotal))} {metricDescription}</small>
                                </span>
                                <i className="dw-ranking-track" aria-hidden="true">
                                  <em style={{ transform: `scaleX(${item.value / maxDebt})` }} />
                                </i>
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
                        {buscando ? `Ningún barrio coincide con “${barrioQuery.trim()}”.` : "No hay desglose de mora por barrio disponible."}
                      </p>
                    )}

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
                            Limpiar
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
                    ) : (
                      ranking.length ? <p className="dw-hint">Seleccioná barrios para sumar su mora. Abrí la flecha para ver el desglose.</p> : null
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
        </div>
      </div>
    </main>
  );
}
