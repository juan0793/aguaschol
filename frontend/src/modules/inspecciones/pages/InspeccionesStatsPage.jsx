import { useEffect, useState } from "react";
import { Icon } from "../../../components/Icon";

const AGRUPAR_OPCIONES = [
  ["tecnico", "Técnico"],
  ["barrio", "Barrio"],
  ["motivo", "Motivo"],
  ["estado", "Estado"],
  ["periodo", "Periodo"]
];
const PERIODO_OPCIONES = [["todo", "Todo"], ["mes", "Último mes"], ["trimestre", "Último trimestre"], ["anio", "Último año"]];
const ESTADO_COLUMNAS = [["ASIGNADA", "Asignadas"], ["EN_PROCESO", "En proceso"], ["SEGUIMIENTO", "Seguimiento"], ["FINALIZADA", "Finalizadas"]];

export default function InspeccionesStatsPage({ api, notify }) {
  const [agrupar, setAgrupar] = useState("tecnico");
  const [periodo, setPeriodo] = useState("todo");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      setData(await api.stats({ agrupar, periodo }));
    } catch (error) {
      notify(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agrupar, periodo]);

  return (
    <section className="cl-inbox">
      <div className="cl-toolbar">
        <label>
          <span>Agrupar por</span>
          <select value={agrupar} onChange={(event) => setAgrupar(event.target.value)}>
            {AGRUPAR_OPCIONES.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Periodo</span>
          <select value={periodo} onChange={(event) => setPeriodo(event.target.value)}>
            {PERIODO_OPCIONES.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
        <button type="button" className="cl-quiet" onClick={cargar}><Icon name="refresh" />Actualizar</button>
      </div>

      {loading || !data ? (
        <div className="cl-module-loading"><Icon name="refresh" />Calculando estadísticas…</div>
      ) : (
        <>
          <div className="cl-comparison-summary">
            <span>Total: <strong>{data.resumen.total_inspecciones}</strong></span>
            <span>En seguimiento: <strong>{data.resumen.en_seguimiento}</strong></span>
            <span>Tiempo promedio asignación → finalización: <strong>{data.resumen.tiempo_promedio_asignacion_finalizacion_horas} h</strong></span>
          </div>
          <div className="cl-table-wrap">
            <table className="cl-table">
              <thead>
                <tr>
                  <th>{AGRUPAR_OPCIONES.find(([key]) => key === agrupar)?.[1]}</th>
                  {ESTADO_COLUMNAS.map(([key, label]) => <th key={key}>{label}</th>)}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {!data.rows.length ? (
                  <tr><td colSpan={6} className="cl-empty">Sin datos para los filtros seleccionados.</td></tr>
                ) : (
                  data.rows.map((row) => (
                    <tr key={row.key}>
                      <td>{row.key}</td>
                      {ESTADO_COLUMNAS.map(([key]) => <td key={key}>{row[key] || 0}</td>)}
                      <td><strong>{row.total}</strong></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {data.resumen.reincidencias_por_clave.length ? (
            <section className="ins-form-section">
              <h3>Reincidencias por clave</h3>
              <ul className="cl-history">
                {data.resumen.reincidencias_por_clave.map((item) => (
                  <li key={item.clave_catastral}><i /><div><strong>{item.clave_catastral}</strong><span>{item.total} inspecciones</span></div></li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}
