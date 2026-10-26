import { Icon } from "../../../components/Icon";
import { formatCurrency } from "../../../utils/formatting";
import { imprimirResumenServicios } from "../padronInformes";

const count = (value) => Number(value || 0).toLocaleString("es-HN");
const money = (value) => formatCurrency(Number(value) || 0);
const pct = (value) => `${Number(value || 0).toLocaleString("es-HN", { maximumFractionDigits: 1 })}%`;

// Consulta resumida: una fila por servicio con sus totales y la cartera asociada, y las
// combinaciones de servicios que más se preguntan. Sin desglose por barrio.
export default function ResumenTab({ model }) {
  const { serviceData, serviceReport } = model;
  const servicios = serviceData.serviceRows || [];
  const total = serviceData.totalRecords;
  const perfiles = serviceData.profiles || {};
  const deuda = serviceData.deuda || {};
  const maximo = Math.max(1, ...servicios.map((servicio) => Number(servicio.active || 0)));

  if (!serviceData.hasData) {
    return <div className="pq-panel"><div className="pq-empty"><Icon name="barChart" /><strong>{model.loadingServices ? "Leyendo el padrón maestro…" : "Sin datos de servicios"}</strong><span>Actualiza los datos para ver el resumen.</span></div></div>;
  }

  const imprimir = () => imprimirResumenServicios({
    servicios,
    totalUsuarios: total,
    totalBarrios: serviceReport?.summary?.total_barrios,
    deuda,
    perfiles,
    padronActualizado: serviceReport?.source?.updated_at
  });
  const combinaciones = [
    ["Con agua, alcantarillado, barrido y recolección", perfiles.all_core_services],
    ["Con agua y sin alcantarillado", perfiles.water_without_sewer],
    ["Con alcantarillado y sin agua", perfiles.sewer_without_water],
    ["Sin ninguno de los cuatro servicios básicos", perfiles.no_core_services]
  ];

  return <div className="pq-panel is-table">
    <div className="pq-toolbar">
      <p className="pq-focus-summary">Totales de los cinco servicios sobre <b>{count(total)}</b> usuarios del padrón. La cartera de cada servicio es la de las cuentas que lo tienen activo.</p>
      <div className="pq-toolbar-actions">
        <button type="button" className="pq-btn" onClick={imprimir} title="Imprimir o guardar como PDF"><Icon name="print" />Imprimir / PDF</button>
      </div>
    </div>
    <div className="pq-table-wrap">
      <table className="pq-table is-resumen">
        <thead>
          <tr>
            <th className="pq-col-name">Servicio</th>
            <th>Con el servicio</th>
            <th>Sin el servicio</th>
            <th>Sin dato</th>
            <th>Cuentas con deuda</th>
            <th>Capital</th>
            <th>Intereses</th>
            <th className="pq-col-total">Deuda asociada</th>
          </tr>
        </thead>
        <tbody>
          {servicios.map((servicio) => <tr key={servicio.field}>
            <th scope="row" className="pq-col-name">{servicio.label}</th>
            <td><span className="pq-cell-service"><b>{count(servicio.active)}</b><small>{pct(servicio.percentage)}</small><i aria-hidden="true"><em style={{ width: `${(Number(servicio.active || 0) / maximo) * 100}%` }} /></i></span></td>
            <td>{count(servicio.inactive)}</td>
            <td className={servicio.unknown ? "" : "is-zero"}>{count(servicio.unknown)}</td>
            <td>{count(servicio.deuda?.deudores)}</td>
            <td>{money(servicio.deuda?.capital)}</td>
            <td>{money(servicio.deuda?.intereses)}</td>
            <td className="pq-col-total"><b>{money(servicio.deuda?.total)}</b></td>
          </tr>)}
        </tbody>
        <tfoot>
          <tr className="pq-foot">
            <th scope="row" className="pq-col-name">Padrón<span className="pq-count">{count(total)} usuarios</span></th>
            <td colSpan={3} />
            <td>{count(deuda.deudores)}</td>
            <td>{money(deuda.capital)}</td>
            <td>{money(deuda.intereses)}</td>
            <td className="pq-col-total"><b>{money(deuda.total)}</b></td>
          </tr>
        </tfoot>
      </table>
    </div>
    <div className="pq-table-wrap">
      <table className="pq-table is-resumen">
        <thead><tr><th className="pq-col-name">Combinación de servicios</th><th>Usuarios</th><th>% del padrón</th></tr></thead>
        <tbody>
          {combinaciones.map(([texto, valor]) => <tr key={texto}>
            <th scope="row" className="pq-col-name">{texto}</th>
            <td><b>{count(valor)}</b></td>
            <td>{pct(total ? (Number(valor || 0) / total) * 100 : 0)}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
    <p className="pq-note"><Icon name="notes" />Una misma cuenta suma en cada servicio que tiene activo; por eso la suma de las deudas por servicio es mayor que la deuda del padrón.</p>
  </div>;
}
