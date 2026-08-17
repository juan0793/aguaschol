import { useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { formatCurrency } from "../../utils/currency.js";
import { formatSpanishDate } from "../../utils/datesAndBusiness";
import { escapeHtml } from "../../utils/html";
import { printDocument } from "../../utils/printDocument";
import { debtRanking, debtRankingAll, sumSelectedDebt, sumSelectedServices } from "./dashboardSelectors";
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

const SERVICE_ICONS = { agua: "water", alcantarillado: "sewer", barrido: "broom", recoleccion: "waste", desechos_peligrosos: "warning" };

const whole = (value) => Number(value || 0).toLocaleString("es-HN");
const percent = (part, total) => (total ? (Number(part || 0) / total) * 100 : 0);
const oneDecimal = (value) => `${value.toFixed(1)}%`;

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
  const [debtMetric, setDebtMetric] = useState("total");
  const [selectedBarrios, setSelectedBarrios] = useState([]);
  const [selectedDetailsOpen, setSelectedDetailsOpen] = useState(false);

  const ranking = useMemo(() => debtRanking(model.debtBarrios, debtMetric), [model.debtBarrios, debtMetric]);
  // Mora consolidada por servicio en todo el padron: la otra descomposicion
  // legitima del mismo total que ya muestra la barra de capital/intereses.
  const serviceDebt = useMemo(() => {
    const rows = debtRankingAll(model.debtBarrios, "total");
    return sumSelectedServices(rows, rows.map((row) => row.name))
      .filter((service) => service.debt > 0)
      .sort((left, right) => right.debt - left.debt);
  }, [model.debtBarrios]);
  const maxServiceDebt = Math.max(1, ...serviceDebt.map((service) => service.debt));
  const selectedDebt = useMemo(() => sumSelectedDebt(ranking, selectedBarrios), [ranking, selectedBarrios]);
  const selectedServices = useMemo(() => sumSelectedServices(ranking, selectedBarrios), [ranking, selectedBarrios]);
  const maxDebt = Math.max(1, ...ranking.map((item) => item.value));

  const debt = model.debtSummary || {};
  const debtTotal = Number(debt.total || 0);
  const capitalShare = percent(debt.capital, debtTotal);
  const interesShare = percent(debt.intereses, debtTotal);
  const criticalShare = percent(debt.criticos, Number(debt.deudores || 0));

  const toggleBarrio = (name) =>
    setSelectedBarrios((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));
  const navigate = (view, focus = "") => {
    if (focus) sessionStorage.setItem("aguas.clandestinos.focus", focus);
    model.navigate(view);
  };

  const printSelection = () =>
    printDocument(
      "Sumatoria de barrios",
      `<section class="print-header"><h1>Sumatoria de barrios seleccionados</h1><p>${selectedBarrios.map(escapeHtml).join(" · ")}</p></section><section class="print-section"><h3>Resumen de mora</h3><div class="print-grid">${[["Capital", selectedDebt.capital], ["Intereses", selectedDebt.intereses], ["Mora total", selectedDebt.total]].map(([label, value]) => `<div class="print-field"><strong>${label}</strong><span>${escapeHtml(formatCurrency(value))}</span></div>`).join("")}<div class="print-field"><strong>Cuentas con mora</strong><span>${whole(selectedDebt.deudores)}</span></div><div class="print-field"><strong>Casos criticos</strong><span>${whole(selectedDebt.criticos)}</span></div></div></section><section class="print-section"><h3>Servicios consolidados</h3><table class="field-report-table data-report-table"><thead><tr><th>Servicio</th><th>Activos</th><th>Inactivos</th><th>Sin dato</th><th>Mora asociada</th></tr></thead><tbody>${selectedServices.map((service) => `<tr><td>${escapeHtml(service.label)}</td><td>${whole(service.active)}</td><td>${whole(service.inactive)}</td><td>${whole(service.unknown)}</td><td>${escapeHtml(formatCurrency(service.debt))}</td></tr>`).join("")}</tbody><tfoot><tr><th>Total</th><th>${whole(selectedServices.reduce((sum, item) => sum + item.active, 0))}</th><th>${whole(selectedServices.reduce((sum, item) => sum + item.inactive, 0))}</th><th>${whole(selectedServices.reduce((sum, item) => sum + item.unknown, 0))}</th><th>${escapeHtml(formatCurrency(selectedDebt.total))}</th></tr></tfoot></table></section>`,
      { pageSize: "Letter portrait", showPageFooter: true }
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
      { pageSize: "Letter portrait", pageMargin: "10mm", bodyClassName: "field-report-body", showPageFooter: true }
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
          <span className="dw-sync">
            <i className="dw-sync-dot" aria-hidden="true" />
            {model.syncLabel}
          </span>
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
            onClick={() =>
              navigate(
                item.key === "gps" ? "map" : item.key === "records" || item.key === "alerts" ? "records" : "users",
                item.key === "alerts" ? "alerts" : ""
              )
            }
          >
            <span className="dw-eyebrow">{item.label}</span>
            <strong className="dw-figure">{whole(item.value)}</strong>
            <small>{item.helper}</small>
          </button>
        ))}
      </section>

      <div className="dw-grid">
        {/* Columna izquierda: primero lo accionable, despues la cifra. */}
        <div className="dw-col">
          <article className="dw-panel dw-attention">
                    <header className="dw-panel-head">
                      <div>
                        <span className="dw-eyebrow">Prioridades</span>
                        <h2>Atención requerida</h2>
                      </div>
                    </header>
                    <ul className="dw-list">
                      {model.attention.slice(0, 4).map((item) => (
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
                  </article>
          <article className="dw-panel dw-cartera">
                    <header className="dw-panel-head">
                      <div>
                        <span className="dw-eyebrow">Situación financiera</span>
                        <h2>Cartera en mora</h2>
                      </div>
                    </header>

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
                          {serviceDebt.map((service) => (
                            <li key={service.field}>
                              <span className="dw-service-name">{service.label}</span>
                              <Amount value={service.debt} />
                              <i className="dw-service-track" aria-hidden="true">
                                <em style={{ width: `${Math.max(2, (service.debt / maxServiceDebt) * 100)}%` }} />
                              </i>
                            </li>
                          ))}
                        </ul>
                        <small className="dw-note">Una misma cuenta puede tener varios servicios activos, por eso la suma supera la mora total.</small>
                      </section>
                    ) : null}
                  </article>
        </div>
        <div className="dw-col">
          <article className="dw-panel dw-mora">
                    <header className="dw-panel-head">
                      <div>
                        <span className="dw-eyebrow">Datos reales del padrón</span>
                        <h2>Barrios con mayor mora</h2>
                      </div>
                      <label className="dw-select">
                        <span className="dw-sr">Ordenar por</span>
                        <select value={debtMetric} onChange={(event) => setDebtMetric(event.target.value)}>
                          <option value="total">Mora total</option>
                          <option value="accounts">Abonados</option>
                          <option value="critical">Casos críticos</option>
                        </select>
                      </label>
                    </header>

                    {ranking.length ? (
                      <ol className="dw-ranking">
                        {ranking.map((item, index) => (
                          <li key={item.name}>
                            <button
                              type="button"
                              aria-pressed={selectedBarrios.includes(item.name)}
                              className={selectedBarrios.includes(item.name) ? "is-selected" : ""}
                              onClick={() => toggleBarrio(item.name)}
                            >
                              <b className="dw-figure">{index + 1}</b>
                              <span className="dw-ranking-copy">
                                <strong>{item.name}</strong>
                                <i className="dw-ranking-track">
                                  <em style={{ width: `${Math.max(2, (item.value / maxDebt) * 100)}%` }} />
                                </i>
                              </span>
                              {debtMetric === "total" ? (
                                <Amount value={item.value} />
                              ) : (
                                <span className="dw-amount dw-figure">{whole(item.value)}</span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="dw-empty">No hay desglose de mora por barrio disponible.</p>
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
                        <dl className="dw-selection-figures">
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
                      <p className="dw-hint">Seleccioná uno o varios barrios para ver el desglose y la sumatoria.</p>
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
                  </article>
          <article className="dw-panel dw-feed">
                    <header className="dw-panel-head">
                      <div>
                        <span className="dw-eyebrow">Aplicación viva</span>
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
                  </article>
        </div>
      </div>
    </main>
  );
}
