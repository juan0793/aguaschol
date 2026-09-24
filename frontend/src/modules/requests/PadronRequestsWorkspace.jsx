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
  // Cifras del padrón como una línea de libro contable, no como tarjetas: la
  // tabla de abajo es la que manda.
  const figures = [
    { key: "usuarios", label: "usuarios en el padrón", value: serviceData.totalRecords },
    { key: "barrios", label: "barrios con usuarios", value: serviceReport?.summary?.total_barrios ?? 0 },
    { key: "deuda", label: `de deuda en ${Number(serviceData.deuda.deudores || 0).toLocaleString("es-HN")} cuentas`, value: serviceData.deuda.total || 0, format: money },
    { key: "sin-alc", label: "con agua y sin alcantarillado", value: serviceData.profiles.water_without_sewer ?? 0 },
    { key: "sin-agua", label: "con alcantarillado y sin agua", value: serviceData.profiles.sewer_without_water ?? 0 }
  ];

  return <section className="pq-workspace">
    <div className="pq-sheet">
      <header className="pq-header">
        <h1>Consultas del padrón</h1>
        <button type="button" className="pq-btn pq-refresh" onClick={model.onRefresh} disabled={loading} aria-label={loading ? "Actualizando…" : "Actualizar datos"}><Icon name="refresh" className={loading ? "ds-icon-spin" : ""} /><span className="pq-btn-label">{loading ? "Actualizando…" : "Actualizar datos"}</span></button>
        <p className="pq-source">
          <span className={`pq-status ${loading ? "is-loading" : model.loadError ? "is-error" : ""}`.trim()} role="status"><i aria-hidden="true" />{loading ? "Leyendo el padrón…" : model.loadError ? "Sin datos del padrón" : "Datos al día"}</span>
          <span>Fuente <b>{serviceReport?.source?.file_name || "Padrón maestro"}</b></span>
          {serviceReport?.source?.updated_at ? <span>Actualizado <b>{formatDateTime(serviceReport.source.updated_at)}</b></span> : null}
        </p>
        <dl className="pq-ledger" aria-label="Resumen del padrón">
          {figures.map((figure) => <div key={figure.key} className="pq-figure">
            <dt>{figure.label}</dt>
            <LiveNumber as="dd" value={figure.value} format={figure.format} flash=".pq-figure" />
          </div>)}
        </dl>
      </header>

      {model.loadError ? <div className="pq-alert" role="alert">
        <Icon name="warning" />
        <div><strong>No se pudo leer el padrón maestro</strong><p>{model.loadError.replace(/\.?$/, ".")} Los totales no reflejan la base de datos.</p></div>
        <button type="button" className="pq-btn" onClick={model.onRefresh} disabled={loading}><Icon name="refresh" />Reintentar</button>
      </div> : null}

      <nav className="pq-tabs" role="tablist" aria-label="Consultas del padrón">
        {TABS.map(([key, label, icon]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "is-active" : ""} onClick={() => setTab(key)}><Icon name={icon} />{label}</button>)}
      </nav>
      {tab === "servicios" ? <ServicesTab model={model} /> : null}
      {tab === "listado" ? <ListadoTab model={model} /> : null}
      {tab === "comparativo" ? <ComparativoTab model={model} /> : null}
    </div>
  </section>;
}
