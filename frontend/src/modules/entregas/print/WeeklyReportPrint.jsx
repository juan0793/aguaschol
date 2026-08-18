import logoAguasCholuteca from "../../../assets/logo-aguas-choluteca.png";
import { GraficoEfectividadResponsable, GraficoMotivos, GraficoPorDia } from "../components/ReporteCharts";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  tipoDocumentoLabel
} from "../utils/entregasFormatters";
import "./weeklyReportStyles.css";

const Hoja = ({ snapshot, numero, total, children }) => (
  <article className="ent-hoja">
    <header className="ent-hoja-head">
      <img src={logoAguasCholuteca} alt="Aguas de Choluteca" />
      <div>
        <span>AGUAS DE CHOLUTECA</span>
        <h1>REPORTE SEMANAL DE CONTROL DE ENTREGAS</h1>
        <p>{snapshot.periodo.etiqueta}</p>
      </div>
    </header>
    {children}
    <footer className="ent-hoja-pie">
      <span>
        {formatDate(snapshot.periodo.fecha_inicio)} al {formatDate(snapshot.periodo.fecha_fin)}
      </span>
      <span>Generado: {formatDateTime(snapshot.generacion?.generado_en)}</span>
      <span>
        Página {numero} de {total}
      </span>
    </footer>
  </article>
);

// Hoja Letter vertical, encabezado repetido y tablas con cabecera propia por página.
export default function WeeklyReportPrint({ snapshot, incluirAnexo = false }) {
  if (!snapshot) return null;
  const anexo = incluirAnexo && snapshot.anexo_pendientes?.length ? snapshot.anexo_pendientes : [];
  const totalPaginas = 3 + (anexo.length ? 1 : 0);
  const totales = snapshot.totales;

  return (
    <div className="ent-hojas">
      <Hoja snapshot={snapshot} numero={1} total={totalPaginas}>
        <section className="ent-hoja-kpis">
          <div>
            <span>Asignadas</span>
            <strong>{formatNumber(totales.asignadas)}</strong>
          </div>
          <div>
            <span>Entregadas</span>
            <strong>{formatNumber(totales.entregadas)}</strong>
          </div>
          <div>
            <span>Pendientes</span>
            <strong>{formatNumber(totales.pendientes)}</strong>
          </div>
          <div>
            <span>Reentregadas</span>
            <strong>{formatNumber(totales.reentregadas)}</strong>
          </div>
          <div className="is-destacado">
            <span>Efectividad</span>
            <strong>{formatPercent(totales.efectividad)}</strong>
          </div>
        </section>

        <GraficoPorDia rows={snapshot.por_dia} />

        <section className="ent-hoja-bloque">
          <h2>Indicadores de atención</h2>
          <table className="ent-hoja-tabla">
            <thead>
              <tr>
                <th>Indicador</th>
                <th className="is-num">Casos</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.indicadores_atencion.map((indicador) => (
                <tr key={indicador.codigo}>
                  <td>{indicador.etiqueta}</td>
                  <td className="is-num">{formatNumber(indicador.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {snapshot.periodo.tipo_documento && snapshot.periodo.tipo_documento !== "TODOS" ? (
            <p className="ent-hoja-nota">
              Informe filtrado por tipo de documento: {tipoDocumentoLabel(snapshot.periodo.tipo_documento)}.
            </p>
          ) : null}
        </section>
      </Hoja>

      <Hoja snapshot={snapshot} numero={2} total={totalPaginas}>
        <section className="ent-hoja-bloque">
          <h2>Rendimiento por responsable</h2>
          <table className="ent-hoja-tabla">
            <thead>
              <tr>
                <th>Responsable</th>
                <th>Tipo predominante</th>
                <th className="is-num">Lotes</th>
                <th className="is-num">Asignadas</th>
                <th className="is-num">Entregadas</th>
                <th className="is-num">Pendientes</th>
                <th className="is-num">Efectividad</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.por_responsable.map((fila) => (
                <tr key={fila.responsable_id}>
                  <td>{fila.responsable_nombre}</td>
                  <td>{tipoDocumentoLabel(fila.tipo_predominante)}</td>
                  <td className="is-num">{formatNumber(fila.lotes)}</td>
                  <td className="is-num">{formatNumber(fila.asignadas)}</td>
                  <td className="is-num">{formatNumber(fila.entregadas)}</td>
                  <td className="is-num">{formatNumber(fila.pendientes)}</td>
                  <td className="is-num">{formatPercent(fila.efectividad)}</td>
                </tr>
              ))}
              {!snapshot.por_responsable.length ? (
                <tr>
                  <td colSpan={7}>Sin lotes registrados en la semana.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="ent-hoja-bloque">
          <h2>Resultado por barrio</h2>
          <table className="ent-hoja-tabla">
            <thead>
              <tr>
                <th>Barrio</th>
                <th className="is-num">Asignadas</th>
                <th className="is-num">Entregadas</th>
                <th className="is-num">No entregadas</th>
                <th className="is-num">Reentregadas</th>
                <th className="is-num">Pendientes</th>
                <th className="is-num">Efectividad</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.por_barrio.map((fila) => (
                <tr key={fila.barrio_codigo || fila.barrio_nombre}>
                  <td>{fila.barrio_nombre}</td>
                  <td className="is-num">{formatNumber(fila.asignadas)}</td>
                  <td className="is-num">{formatNumber(fila.entregadas)}</td>
                  <td className="is-num">{formatNumber(fila.no_entregadas)}</td>
                  <td className="is-num">{formatNumber(fila.reentregadas)}</td>
                  <td className="is-num">{formatNumber(fila.pendientes)}</td>
                  <td className="is-num">{formatPercent(fila.efectividad)}</td>
                </tr>
              ))}
              {!snapshot.por_barrio.length ? (
                <tr>
                  <td colSpan={7}>Sin lotes registrados en la semana.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <GraficoEfectividadResponsable rows={snapshot.por_responsable} />
      </Hoja>

      <Hoja snapshot={snapshot} numero={3} total={totalPaginas}>
        <GraficoMotivos rows={snapshot.por_motivo} />

        <section className="ent-hoja-bloque">
          <h2>Observaciones reportadas por personal de campo</h2>
          {snapshot.observaciones.length ? (
            <ul className="ent-hoja-observaciones">
              {snapshot.observaciones.map((observacion) => (
                <li key={observacion.lote_id}>
                  <strong>
                    {observacion.responsable_nombre} — {observacion.barrio_nombre} — {formatDate(observacion.fecha)}
                  </strong>
                  <p>&laquo;{observacion.texto}&raquo;</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ent-hoja-nota">No se registraron observaciones de campo en esta semana.</p>
          )}
        </section>

        <section className="ent-hoja-bloque">
          <h2>Pendientes prioritarios</h2>
          <table className="ent-hoja-tabla">
            <thead>
              <tr>
                <th>Abonado</th>
                <th>Clave</th>
                <th>Barrio</th>
                <th>Responsable</th>
                <th>Motivo</th>
                <th className="is-num">Días</th>
                <th className="is-num">Intentos</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.pendientes_prioritarios.map((fila) => (
                <tr key={fila.id}>
                  <td>{fila.numero_abonado || "—"}</td>
                  <td>{fila.clave_catastral || "—"}</td>
                  <td>{fila.barrio_nombre}</td>
                  <td>{fila.responsable_nombre}</td>
                  <td>{fila.motivo_etiqueta}</td>
                  <td className="is-num">{formatNumber(fila.dias_pendiente)}</td>
                  <td className="is-num">{formatNumber(fila.intentos)}</td>
                </tr>
              ))}
              {!snapshot.pendientes_prioritarios.length ? (
                <tr>
                  <td colSpan={7}>No hay pendientes que ameriten atención especial.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          {snapshot.pendientes_prioritarios_omitidos > 0 ? (
            <p className="ent-hoja-nota">
              Se omitieron {formatNumber(snapshot.pendientes_prioritarios_omitidos)} caso(s) adicionales. Solicita el anexo
              completo para verlos todos.
            </p>
          ) : null}
        </section>
      </Hoja>

      {anexo.length ? (
        <Hoja snapshot={snapshot} numero={4} total={totalPaginas}>
          <section className="ent-hoja-bloque">
            <h2>Anexo — pendientes completos</h2>
            <table className="ent-hoja-tabla">
              <thead>
                <tr>
                  <th>Abonado</th>
                  <th>Clave</th>
                  <th>Barrio</th>
                  <th>Responsable</th>
                  <th>Motivo</th>
                  <th className="is-num">Días</th>
                  <th className="is-num">Intentos</th>
                </tr>
              </thead>
              <tbody>
                {anexo.map((fila) => (
                  <tr key={`anexo-${fila.id}`}>
                    <td>{fila.numero_abonado || "—"}</td>
                    <td>{fila.clave_catastral || "—"}</td>
                    <td>{fila.barrio_nombre}</td>
                    <td>{fila.responsable_nombre}</td>
                    <td>{fila.motivo_etiqueta}</td>
                    <td className="is-num">{formatNumber(fila.dias_pendiente)}</td>
                    <td className="is-num">{formatNumber(fila.intentos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </Hoja>
      ) : null}
    </div>
  );
}
