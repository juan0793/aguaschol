import { useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import { SERVICE_COLUMNS, buildServiceRows, sumServiceRows } from "../utils/serviceTable";
import ServiceFocus from "./ServiceFocus";

const count = (value) => Number(value || 0).toLocaleString("es-HN");

// Consulta individual por servicio: se elige uno de los cinco y la tabla, el resumen y
// el informe impreso son solo de ese servicio.
export default function ServicioTab({ model }) {
  const { serviceData } = model;
  const [campo, setCampo] = useState(SERVICE_COLUMNS[0][0]);
  const rows = useMemo(() => buildServiceRows(serviceData.barrios), [serviceData.barrios]);
  const padron = useMemo(() => sumServiceRows(rows), [rows]);

  if (!serviceData.hasData) {
    return <div className="pq-panel"><div className="pq-empty"><Icon name="water" /><strong>{model.loadingServices ? "Leyendo el padrón maestro…" : "Sin datos de servicios"}</strong><span>Actualiza los datos para consultar un servicio.</span></div></div>;
  }

  return <div className="pq-panel is-table">
    <div className="pq-service-pick is-five" role="group" aria-label="Servicio a consultar">
      {SERVICE_COLUMNS.map(([field, label, icon]) => <button type="button" key={field} aria-pressed={campo === field} className={campo === field ? "is-active" : ""} onClick={() => setCampo(field)}>
        <span><Icon name={icon} />{label}</span><small>{count(padron.services[field].active)} · {padron.services[field].percentage}%</small>
      </button>)}
    </div>
    <ServiceFocus key={campo} model={model} rows={rows} field={campo} />
  </div>;
}
