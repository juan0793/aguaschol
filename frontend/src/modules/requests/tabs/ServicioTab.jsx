import { useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import { ATAJOS_COMBINACION, ESTADOS_SERVICIO, SERVICE_COLUMNS, buildServiceRows, combinacionDe, mismaCombinacion, sumServiceRows } from "../utils/serviceTable";
import ServiceFocus from "./ServiceFocus";

const count = (value) => Number(value || 0).toLocaleString("es-HN");
const INICIAL = combinacionDe({ agua: "con" });

// Consulta por servicio: cada servicio se pide con, sin o da igual, y la tabla, el
// resumen y el informe impreso son de esa combinación. Por defecto, "con agua".
export default function ServicioTab({ model }) {
  const { serviceData } = model;
  const [combinacion, setCombinacion] = useState(INICIAL);
  const rows = useMemo(() => buildServiceRows(serviceData.barrios), [serviceData.barrios]);
  const padron = useMemo(() => sumServiceRows(rows), [rows]);
  const fijar = (campo, estado) => setCombinacion((actual) => ({ ...actual, [campo]: estado }));
  const atajo = ATAJOS_COMBINACION.find((item) => mismaCombinacion(item.combinacion, combinacion));

  if (!serviceData.hasData) {
    return <div className="pq-panel"><div className="pq-empty"><Icon name="water" /><strong>{model.loadingServices ? "Leyendo el padrón maestro…" : "Sin datos de servicios"}</strong><span>Actualiza los datos para consultar un servicio.</span></div></div>;
  }

  return <div className="pq-panel is-table">
    <fieldset className="pq-combo">
      <legend className="pq-sr-only">Servicios a consultar</legend>
      <div className="pq-combo-grid">
        {SERVICE_COLUMNS.map(([field, label, icon]) => {
          const estado = combinacion[field];
          return <div key={field} className={`pq-combo-item is-${estado}`} role="radiogroup" aria-label={label}>
            <span className="pq-combo-name"><Icon name={icon} />{label}<small>{count(padron.services[field].active)} · {padron.services[field].percentage}%</small></span>
            <span className="pq-combo-seg">
              {ESTADOS_SERVICIO.map(([valor, texto]) => <button key={valor} type="button" role="radio" aria-checked={estado === valor} className={`is-${valor} ${estado === valor ? "is-active" : ""}`.trim()} onClick={() => fijar(field, valor)}>{texto}</button>)}
            </span>
          </div>;
        })}
      </div>
      <div className="pq-combo-atajos">
        <span>Atajos</span>
        {ATAJOS_COMBINACION.map((item) => <button key={item.key} type="button" aria-pressed={atajo?.key === item.key} className={atajo?.key === item.key ? "is-active" : ""} onClick={() => setCombinacion(item.combinacion)}>{item.label}</button>)}
        {!mismaCombinacion(combinacion, INICIAL) ? <button type="button" className="is-reset" onClick={() => setCombinacion(INICIAL)}><Icon name="refresh" />Volver a “con agua”</button> : null}
      </div>
    </fieldset>
    <ServiceFocus model={model} rows={rows} combinacion={combinacion} />
  </div>;
}
