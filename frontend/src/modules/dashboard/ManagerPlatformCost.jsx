import { useEffect, useState } from "react";
import { Icon } from "../../components/Icon";
import { readCycle } from "./platformCost.js";

const TZ = "America/Tegucigalpa";
const money = new Intl.NumberFormat("es-HN", { style: "currency", currency: "USD" });
const percent = new Intl.NumberFormat("es-HN", { style: "percent", maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("es-HN", { timeZone: TZ, day: "numeric", month: "short" });

export default function ManagerPlatformCost({ apiFetch }) {
  const [state, setState] = useState({ loading: true, summary: null, error: "" });
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await apiFetch("/railway/summary");
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "No se pudo consultar Railway.");
        if (active) setState({ loading: false, summary: body, error: "" });
      } catch (error) {
        if (active) setState({ loading: false, summary: null, error: error.message || "No se pudo consultar Railway." });
      }
    })();
    return () => { active = false; };
  }, [apiFetch]);

  const { loading, summary, error } = state;
  const cycle = summary ? readCycle(summary) : null;
  return <section className="manager-cost" aria-labelledby="manager-cost-title" aria-busy={loading}>
    <header>
      <h2 id="manager-cost-title">Consumo de la app</h2>
      {cycle ? <p>Railway · Ciclo <b>{date.format(new Date(summary.period.start))} – {date.format(new Date(summary.period.end))}</b> · día {cycle.cycleDay} de {cycle.cycleDays}</p> : null}
    </header>
    {loading ? <p className="manager-cost-note">Consultando el consumo del ciclo…</p> : null}
    {error ? <p className="manager-cost-note">No se pudo consultar el consumo en Railway. {error}</p> : null}
    {cycle ? <div className="manager-cost-grid">
      <div>
        <span><Icon name="trendUp" />Consumido en el ciclo</span>
        <strong>{money.format(summary.currentUsage)}</strong>
        <small>{money.format(cycle.dailyAverage)} por día en promedio</small>
      </div>
      <div>
        <span><Icon name="calendar" />Estimado al cierre</span>
        <strong>{money.format(summary.estimatedUsage)}</strong>
        {summary.estimatedUsage > 0 ? <>
          <div className="manager-cost-pace" role="img" aria-label={`Se ha consumido el ${percent.format(cycle.spentShare)} del estimado con el ${percent.format(cycle.elapsedShare)} del ciclo transcurrido.`}>
            <b style={{ width: `${cycle.spentShare * 100}%` }} />
            <i style={{ left: `${cycle.elapsedShare * 100}%` }} />
          </div>
          <small>{percent.format(cycle.spentShare)} del estimado · {percent.format(cycle.elapsedShare)} del ciclo transcurrido</small>
        </> : <small>Railway aún no calcula la proyección.</small>}
      </div>
    </div> : null}
  </section>;
}
