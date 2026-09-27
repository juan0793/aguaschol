import { ArrowUpRight, Clock3, Cpu, Database, HardDrive, MemoryStick, Network } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import PageHeader from "./ds/PageHeader";
import "./railway-usage.css";

const projectUrl = import.meta.env.VITE_RAILWAY_PROJECT_URL?.trim() || "https://railway.com/project/953aa9b8-7664-4b8f-8bc5-2b1ea03fa5d4/observability?environmentId=421e4168-8901-4055-a0d9-f94a849570f8";
const metricsUrl = "https://docs.railway.com/observability/metrics";
const usageUrl = "https://docs.railway.com/projects/project-usage";

const resources = [
  { icon: Cpu, label: "CPU", key: "CPU_USAGE" },
  { icon: MemoryStick, label: "Memoria", key: "MEMORY_USAGE" },
  { icon: Network, label: "Red", key: "NETWORK_USAGE" },
  { icon: HardDrive, label: "Disco", key: "DISK_USAGE" },
  { icon: Database, label: "Respaldo", key: "BACKUP_USAGE" }
];

const money = new Intl.NumberFormat("es-HN", { style: "currency", currency: "USD" });
const dateHour = new Intl.DateTimeFormat("es-HN", { timeZone: "America/Tegucigalpa", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

export default function RailwayUsageWorkspace({ apiFetch }) {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadUsage = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/admin/railway/usage");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "No se pudieron consultar las métricas de Railway.");
      setUsage(payload);
    } catch (requestError) {
      setError(requestError.message || "No se pudo conectar con Railway.");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { loadUsage(); }, [loadUsage]);

  return (
    <div className="railway-usage">
      <PageHeader
        kicker="Sistema · Railway"
        title="Uso en Railway"
        description="Consulta el costo estimado del proyecto y encuentra las horas de mayor consumo de recursos."
        primaryAction={(
          <a className="railway-usage-link" href={projectUrl} target="_blank" rel="noreferrer">
            Abrir proyecto en Railway <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        )}
      />

      <div className="railway-usage-source" role="note">
        <span className="railway-usage-source-mark" aria-hidden="true"><Clock3 size={19} /></span>
        <p>{loading ? "Consultando consumo y métricas de Railway…" : error ? error : `Datos de Railway · periodo de 30 días · actualizado ${dateHour.format(new Date(usage.period.end))}`}</p>
      </div>

      <section className="railway-usage-grid" aria-label="Vistas de consumo de Railway">
        <article className="railway-usage-panel">
          <div className="railway-usage-panel-heading">
            <div>
              <span className="railway-usage-eyebrow">Costo del proyecto</span>
              <h2>Consumo y estimado</h2>
            </div>
            <span className="railway-usage-icon"><Database size={19} aria-hidden="true" /></span>
          </div>
          <p>Revisa cuánto se ha consumido en el ciclo actual y la proyección de cierre, con el desglose por servicio y recurso.</p>
          <dl className="railway-usage-facts">
            <div><dt>Consumo actual</dt><dd>{loading ? "Cargando…" : usage ? money.format(usage.currentUsage) : "—"}</dd></div>
            <div><dt>Estimado del ciclo</dt><dd>{loading ? "Cargando…" : usage ? money.format(usage.estimatedUsage) : "—"}</dd></div>
          </dl>
          {error ? <button className="railway-usage-retry" type="button" onClick={loadUsage}>Reintentar consulta</button> : null}
          <a className="railway-usage-text-link" href={usageUrl} target="_blank" rel="noreferrer">
            Cómo leer el consumo del proyecto <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </article>

        <article className="railway-usage-panel">
          <div className="railway-usage-panel-heading">
            <div>
              <span className="railway-usage-eyebrow">Actividad por servicio</span>
              <h2>Horas pico</h2>
            </div>
            <span className="railway-usage-icon is-blue"><Cpu size={19} aria-hidden="true" /></span>
          </div>
          <p>Máximos horarios encontrados por servicio durante los últimos 30 días.</p>
          {usage ? <div className="railway-usage-peaks">
            {[
              { key: "CPU_USAGE", label: "CPU", unit: " vCPU", icon: Cpu },
              { key: "MEMORY_USAGE_GB", label: "Memoria", unit: " GB", icon: MemoryStick }
            ].map(({ key, label, unit, icon: Icon }) => <div key={key} className="railway-usage-peak-group">
              <h3><Icon size={15} aria-hidden="true" />{label}</h3>
              {usage.peaks[key]?.length ? usage.peaks[key].slice(0, 3).map((peak) => <div className="railway-usage-peak-row" key={`${peak.serviceId}-${peak.timestamp}`}>
                <span><strong>{peak.service}</strong><small>{dateHour.format(new Date(peak.timestamp))}</small></span>
                <b>{peak.value.toFixed(2)}{unit}</b>
              </div>) : <small className="railway-usage-no-data">Sin datos horarios para este servicio.</small>}
            </div>)}
          </div> : <div className="railway-usage-peak-placeholder">{loading ? "Cargando picos horarios…" : "Configura la conexión del backend para mostrar los picos."}</div>}
          <a className="railway-usage-text-link" href={metricsUrl} target="_blank" rel="noreferrer">
            Ver métricas en Railway <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </article>
      </section>

      <section className="railway-usage-resources" aria-labelledby="railway-resources-title">
        <div className="railway-usage-section-heading">
          <div>
            <span className="railway-usage-eyebrow">Qué revisar</span>
            <h2 id="railway-resources-title">Recursos facturados y medidos</h2>
          </div>
          <span>Desglose mensual en USD</span>
        </div>
        <ul>
          {resources.map(({ icon: Icon, label, key }) => (
            <li key={label}>
              <Icon size={18} aria-hidden="true" />
              <span><strong>{label}</strong><small>{loading ? "Cargando…" : usage ? money.format(usage.resourceUsage[key]) : "Sin datos"}</small></span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
