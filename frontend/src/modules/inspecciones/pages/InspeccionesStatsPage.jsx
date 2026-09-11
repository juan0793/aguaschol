import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import { ESTADO_LABELS, estadoClass, estadoLabel } from "../utils/inspeccionesFormatters";

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MESES_LARGOS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// Alto maximo de barra. El plot mide 160px (.ins-chart-bars) y sobre cada barra
// va su valor; con esto la grafica y la fila de KPI caben sobre el pliegue de un
// 1366x768 real, que es el equipo de oficina tipico.
const ALTO_PLOT = 132;

// Rango del mes en formato ISO, para que el atajo al listado devuelva exactamente
// las inspecciones que el usuario acaba de ver en la barra.
const rangoDelMes = (anio, mes) => ({
  fecha_desde: `${anio}-${String(mes).padStart(2, "0")}-01`,
  fecha_hasta: `${anio}-${String(mes).padStart(2, "0")}-${String(new Date(Number(anio), mes, 0).getDate()).padStart(2, "0")}`
});

const FILTROS_LIMPIOS = { q: "", estado: "", barrio: "", tecnico_id: "" };

// La tabla cruzada que existía antes sigue disponible: agrupar por barrio o por
// motivo no lo cubre el tablero anual y perderlo sería una regresión.
function TablaCruzada({ api, notify }) {
  const AGRUPAR_OPCIONES = [["tecnico", "Técnico"], ["barrio", "Barrio"], ["motivo", "Motivo"], ["estado", "Estado"], ["periodo", "Periodo"]];
  const PERIODO_OPCIONES = [["todo", "Todo"], ["mes", "Último mes"], ["trimestre", "Último trimestre"], ["anio", "Último año"]];

  const [agrupar, setAgrupar] = useState("barrio");
  const [periodo, setPeriodo] = useState("todo");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let vigente = true;
    setLoading(true);
    api
      .stats({ agrupar, periodo })
      .then((resultado) => vigente && setData(resultado))
      .catch((error) => notify(error.message))
      .finally(() => vigente && setLoading(false));
    return () => {
      vigente = false;
    };
  }, [api, agrupar, periodo, notify]);

  return (
    <>
      <div className="cl-toolbar ins-cruzada-toolbar">
        <label>
          <span>Agrupar por</span>
          <select value={agrupar} onChange={(event) => setAgrupar(event.target.value)}>
            {AGRUPAR_OPCIONES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Periodo</span>
          <select value={periodo} onChange={(event) => setPeriodo(event.target.value)}>
            {PERIODO_OPCIONES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
      </div>
      <div className="cl-table-wrap">
        <table className="cl-table">
          <thead>
            <tr>
              <th>{AGRUPAR_OPCIONES.find(([key]) => key === agrupar)?.[1]}</th>
              {Object.entries(ESTADO_LABELS).map(([key, label]) => <th key={key}>{label}</th>)}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {loading || !data ? (
              <tr><td colSpan={6} className="cl-empty">Calculando…</td></tr>
            ) : !data.rows.length ? (
              <tr><td colSpan={6} className="cl-empty">Sin datos para los filtros seleccionados.</td></tr>
            ) : (
              data.rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.key}</td>
                  {Object.keys(ESTADO_LABELS).map((key) => <td key={key}>{row[key] || 0}</td>)}
                  <td><strong>{row.total}</strong></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function InspeccionesStatsPage({ api, notify, onDrill, refreshToken = 0 }) {
  const [data, setData] = useState(null);
  const [anio, setAnio] = useState("");
  const [mesSel, setMesSel] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    setLoading(true);
    setError("");
    api
      .tablero(anio ? { anio } : {})
      .then((resultado) => {
        if (!vigente) return;
        setData(resultado);
        // Al cargar (o al cambiar de año) se enfoca el mes en curso; en un año
        // pasado, el último mes que tenga inspecciones.
        const conDatos = resultado.meses.filter((mes) => mes.total > 0);
        setMesSel(resultado.mes_en_curso || (conDatos.length ? conDatos[conDatos.length - 1].mes : 1));
      })
      .catch((reason) => vigente && setError(reason.message))
      .finally(() => vigente && setLoading(false));
    return () => {
      vigente = false;
    };
  }, [api, anio, refreshToken]);

  const maxTotal = useMemo(() => Math.max(1, ...(data?.meses || []).map((mes) => mes.total)), [data]);
  const mes = data?.meses.find((item) => item.mes === mesSel) || null;
  const totalAnio = useMemo(() => (data?.meses || []).reduce((suma, item) => suma + item.total, 0), [data]);

  const drill = (extra = {}) => {
    if (!onDrill || !mes) return;
    onDrill({ ...FILTROS_LIMPIOS, ...rangoDelMes(data.anio, mes.mes), ...extra });
  };

  if (loading && !data) {
    return (
      <section className="cl-inbox">
        <div className="cl-module-loading"><Icon name="refresh" />Calculando estadísticas…</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="cl-inbox">
        <p className="cl-alert">{error}</p>
      </section>
    );
  }

  const maxTecnico = Math.max(1, ...(mes?.tecnicos || []).map((tecnico) => tecnico.total));

  return (
    <section className="cl-inbox ins-tablero">
      <header className="ins-tablero-head">
        <div>
          <h3>Inspecciones asignadas por mes</h3>
          <p>
            Eje: fecha de asignación · Año {data.anio} · Los colores de estado reflejan la situación actual de cada inspección.
          </p>
        </div>
        <label>
          <span>Año</span>
          <select value={data.anio} onChange={(event) => setAnio(event.target.value)}>
            {data.anios_disponibles.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
          </select>
        </label>
      </header>

      {!totalAnio ? (
        <p className="cl-empty">No hay inspecciones asignadas en {data.anio}.</p>
      ) : (
        <>
          <div className="ins-chart">
            <div className="ins-chart-bars">
              {data.meses.map((item) => (
                <div key={item.mes} className="ins-chart-col">
                  <span className={`ins-chart-valor${item.mes === mesSel ? " is-sel" : ""}`}>
                    {item.futuro ? "—" : item.total}
                  </span>
                  <button
                    type="button"
                    className={`ins-chart-bar${item.mes === mesSel ? " is-sel" : ""}${item.futuro ? " is-futuro" : ""}`}
                    style={{ height: item.futuro ? "10px" : `${Math.max(3, Math.round((item.total / maxTotal) * ALTO_PLOT))}px` }}
                    disabled={item.futuro}
                    aria-pressed={item.mes === mesSel}
                    aria-label={`${MESES_LARGOS[item.mes - 1]}: ${item.futuro ? "sin datos aún" : `${item.total} inspecciones`}`}
                    onClick={() => setMesSel(item.mes)}
                  />
                </div>
              ))}
            </div>
            <div className="ins-chart-labels">
              {data.meses.map((item) => (
                <small key={item.mes} className={item.mes === mesSel ? "is-sel" : ""}>{MESES_CORTOS[item.mes - 1]}</small>
              ))}
            </div>
          </div>

          <div className="ins-tablero-mes">
            <h3>{MESES_LARGOS[mes.mes - 1]} {data.anio} · {mes.total} {mes.total === 1 ? "inspección asignada" : "inspecciones asignadas"}</h3>
            <span>{mes.en_curso ? "Mes en curso · cifras parciales" : "Clic en un mes para cambiar el período"}</span>
          </div>

          <div className="cl-indicators">
            {mes.estados.map((item) => (
              <button key={item.estado} type="button" onClick={() => drill({ estado: item.estado })}>
                <span className={`cl-status ${estadoClass(item.estado)}`}><i />{estadoLabel(item.estado)}</span>
                <strong>{item.total}</strong>
              </button>
            ))}
          </div>

          <div className="ins-composicion">
            <div className="ins-composicion-head">
              <strong>Estado actual de {mes.total === 1 ? "la inspección" : `las ${mes.total} inspecciones`} de {MESES_LARGOS[mes.mes - 1]}</strong>
              <span>{mes.en_curso ? "Mes en curso" : "Mes cerrado"}</span>
            </div>
            {mes.total ? (
              <>
                <div className="ins-composicion-bar">
                  {mes.estados
                    .filter((item) => item.total > 0)
                    .map((item) => (
                      <span
                        key={item.estado}
                        className={estadoClass(item.estado)}
                        style={{ width: `${item.porcentaje}%` }}
                        title={`${estadoLabel(item.estado)}: ${item.total}`}
                      />
                    ))}
                </div>
                <ul className="ins-composicion-legend">
                  {mes.estados.map((item) => (
                    <li key={item.estado}>
                      <i className={estadoClass(item.estado)} />
                      {estadoLabel(item.estado)} <strong>{item.total}</strong> · {item.porcentaje}%
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="cl-empty">Sin inspecciones asignadas en este mes.</p>
            )}
          </div>

          <div className="ins-tablero-grid">
            <section className="ins-atencion">
              <h4><Icon name="warning" />Requiere atención</h4>
              <ul>
                <li>
                  <button type="button" className="cl-link ins-atencion-row" onClick={() => drill({ estado: "SEGUIMIENTO" })}>
                    <span>En seguimiento sin cerrar</span>
                    <strong>
                      {mes.estados.find((item) => item.estado === "SEGUIMIENTO")?.total || 0}
                      {mes.seguimiento_dias_mas_antiguo ? ` · la más antigua, ${mes.seguimiento_dias_mas_antiguo} días` : ""}
                    </strong>
                  </button>
                </li>
                <li className="ins-atencion-row">
                  <span>Claves con inspección repetida</span>
                  <strong>{mes.claves_repetidas} {mes.claves_repetidas === 1 ? "clave" : "claves"}</strong>
                </li>
                <li className="ins-atencion-row">
                  <span>Tiempo promedio asignación → cierre</span>
                  <strong>{mes.tiempo_promedio_horas ? `${mes.tiempo_promedio_horas} h` : "—"}</strong>
                </li>
              </ul>
            </section>

            <section className="ins-tecnicos">
              <h4>Técnicos con más inspecciones</h4>
              {!mes.tecnicos.length ? (
                <p className="cl-empty">Sin inspecciones en este mes.</p>
              ) : (
                <ul>
                  {mes.tecnicos.map((tecnico) => (
                    <li key={tecnico.nombre}>
                      <span>{tecnico.nombre}</span>
                      <strong>{tecnico.total}</strong>
                      <i><em style={{ width: `${Math.round((tecnico.total / maxTecnico) * 100)}%` }} /></i>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <footer className="ins-tablero-footer">
            <span>El listado completo, con clave catastral, estado de impresión y paginación, vive en «Ver inspecciones».</span>
            <button type="button" className="cl-secondary" onClick={() => drill()} disabled={!mes.total}>
              <Icon name="records" />
              Ver {mes.total === 1 ? "la inspección" : `las ${mes.total}`} de {MESES_LARGOS[mes.mes - 1]}
            </button>
          </footer>
        </>
      )}

      <details className="ins-cruzada">
        <summary>Tabla cruzada por barrio, motivo o técnico</summary>
        <TablaCruzada api={api} notify={notify} />
      </details>
    </section>
  );
}
