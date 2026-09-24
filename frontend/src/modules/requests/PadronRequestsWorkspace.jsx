import { useState } from "react";
import { Icon } from "../../components/Icon";
import LiveNumber from "../../components/micro/LiveNumber";
import { formatCurrency } from "../../utils/formatting";
import { formatDateTime } from "../../utils/datesAndBusiness";
import ServicesTab from "./tabs/ServicesTab";
import ListadoTab from "./tabs/ListadoTab";
import ComparativoTab from "./tabs/ComparativoTab";
import "../../components/ds/design-system.css";
import "./requests.css";

// Consultas del padrón maestro: servicios y deuda por barrio, listados de
// abonados y el comparativo con Alcaldía. Antes cada cosa vivía en una ventana
// modal detrás de una tarjeta; ahora son pestañas con los datos a la vista.
const TABS = [
  ["servicios", "Servicios por barrio", "water"],
  ["listado", "Listado de abonados", "users"],
  ["comparativo", "Alcaldía vs Aguas", "barChart"]
];

const money = (value) => formatCurrency(Number(value) || 0);

export default function PadronRequestsWorkspace({ model }) {
  const [tab, setTab] = useState("servicios");
  const { serviceData, serviceReport } = model;
  const loading = model.loadingServices || model.loadingComparison;
  const metrics = [
    { key: "usuarios", icon: "users", label: "Usuarios", value: serviceData.totalRecords, hint: "en el padrón activo" },
    { key: "barrios", icon: "map", label: "Barrios", value: serviceReport?.summary?.total_barrios ?? 0, hint: "con usuarios registrados" },
    { key: "deuda", icon: "activity", label: "Deuda total", value: serviceData.deuda.total || 0, format: money, hint: `${Number(serviceData.deuda.deudores || 0).toLocaleString("es-HN")} cuentas con deuda`, tone: "is-debt" },
    { key: "sin-alc", icon: "water", label: "Agua sin alcantarillado", value: serviceData.profiles.water_without_sewer ?? 0, hint: "tienen agua, no alcantarillado" },
    { key: "sin-agua", icon: "sewer", label: "Alcantarillado sin agua", value: serviceData.profiles.sewer_without_water ?? 0, hint: "tienen alcantarillado, no agua" }
  ];

  return <section className="pq-workspace">
    <header className="pq-header">
      <div className="pq-header-top">
        <div className="pq-title">
          <span className="pq-kicker">Padrón maestro</span>
          <h1>Consultas del padrón</h1>
          <p>Servicios, deuda y abonados de cada barrio, y el comparativo con Alcaldía. Todo sale del padrón activo.</p>
        </div>
        <div className="pq-actions">
          <button type="button" className="pq-btn" onClick={model.onRefresh} disabled={loading}><Icon name="refresh" className={loading ? "ds-icon-spin" : ""} />{loading ? "Actualizando…" : "Actualizar datos"}</button>
        </div>
      </div>
      <div className="pq-source">
        <span className={`pq-status ${loading ? "is-loading" : model.loadError ? "is-error" : ""}`.trim()} role="status"><i aria-hidden="true" />{loading ? "Leyendo el padrón…" : model.loadError ? "Sin datos del padrón" : "Datos al día"}</span>
        <span><Icon name="records" />Fuente <b>{serviceReport?.source?.file_name || "Padrón maestro"}</b></span>
        {serviceReport?.source?.updated_at ? <span><Icon name="calendar" />Actualizado <b>{formatDateTime(serviceReport.source.updated_at)}</b></span> : null}
      </div>
    </header>

    {model.loadError ? <div className="pq-alert" role="alert">
      <Icon name="warning" />
      <div><strong>No se pudo leer el padrón maestro</strong><p>{model.loadError.replace(/\.?$/, ".")} Los totales no reflejan la base de datos.</p></div>
      <button type="button" className="pq-btn" onClick={model.onRefresh} disabled={loading}><Icon name="refresh" />Reintentar</button>
    </div> : null}

    <section className="pq-metrics" aria-label="Resumen del padrón">
      {metrics.map((metric) => <div key={metric.key} className={`pq-metric ${metric.tone || ""}`.trim()}>
        <span className="pq-metric-icon"><Icon name={metric.icon} /></span>
        <span className="pq-metric-label">{metric.label}</span>
        <LiveNumber as="strong" value={metric.value} format={metric.format} flash=".pq-metric" />
        <small>{metric.hint}</small>
      </div>)}
    </section>

    <div className="pq-content">
      <nav className="pq-tabs" role="tablist" aria-label="Consultas del padrón">
        {TABS.map(([key, label, icon]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "is-active" : ""} onClick={() => setTab(key)}><Icon name={icon} />{label}</button>)}
      </nav>
      {tab === "servicios" ? <ServicesTab model={model} /> : null}
      {tab === "listado" ? <ListadoTab model={model} /> : null}
      {tab === "comparativo" ? <ComparativoTab model={model} /> : null}
    </div>
  </section>;
}
