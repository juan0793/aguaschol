import logoAguasCholuteca from "../../../assets/logo-aguas-choluteca.png";
import { Seccion } from "./WeeklyReportBlocks";
import { formatDate, formatDateTime, formatNumber } from "../utils/entregasFormatters";
import { gruposPorTecnico } from "../utils/avanceMes.js";
import "./loteSobrantesStyles.css";
import "./barriosEntregaPrint.css";

const ESTADOS = { entregado: "Entregado", en_curso: "Lote abierto", pendiente: "Pendiente" };

// Lista impresa de los barrios a los que se entrega factura en el ciclo, cada uno
// con el técnico que le toca. Va agrupada por técnico (el orden que manda el
// servidor), con un resumen por técnico arriba. Si en pantalla hay un técnico
// elegido, la hoja lleva solo sus barrios.
export default function BarriosEntregaPrint({ hoja }) {
  if (!hoja) return null;
  const { mes, tecnicoId, generadoEn } = hoja;
  const barrios = tecnicoId == null ? mes.barrios : mes.barrios.filter((barrio) => barrio.responsable_id === tecnicoId);
  const grupos = gruposPorTecnico(barrios);
  const contar = (estado) => barrios.filter((barrio) => barrio.estado === estado).length;
  const claves = barrios.reduce((suma, barrio) => suma + (Number(barrio.claves) || 0), 0);
  const entregadas = barrios.reduce((suma, barrio) => suma + (Number(barrio.entregadas) || 0), 0);
  const unTecnico = tecnicoId != null && grupos.length === 1;
  const periodo = `${mes.ciclo_declarado ? "Ciclo" : "Mes"} desde el ${formatDate(mes.desde)}`;

  return (
    <div className="ent-hojas">
      <article className="ent-hoja ent-barrios-hoja">
        <header className="ent-hoja-head">
          <img src={logoAguasCholuteca} alt="Aguas de Choluteca" />
          <div className="ent-hoja-head-texto">
            <span>Aguas de Choluteca · Control de entregas</span>
            <h1>Barrios de entrega de facturas</h1>
            <p>{unTecnico ? `${grupos[0].nombre} · ` : ""}{periodo}</p>
          </div>
        </header>

        <dl className="ent-hoja-kpis ent-barrios-kpis">
          <div className="is-destacado"><dt>Barrios</dt><dd>{formatNumber(barrios.length)}</dd></div>
          <div><dt>Entregados</dt><dd>{formatNumber(contar("entregado"))}</dd></div>
          <div><dt>Lote abierto</dt><dd>{formatNumber(contar("en_curso"))}</dd></div>
          <div><dt>Pendientes</dt><dd>{formatNumber(contar("pendiente"))}</dd></div>
          <div><dt>{unTecnico ? "Claves" : "Técnicos"}</dt><dd>{formatNumber(unTecnico ? claves : grupos.length)}</dd></div>
        </dl>

        {!unTecnico ? (
          <Seccion titulo="Resumen por técnico" descripcion="Barrios asignados en el reparto y cuántos ya se entregaron en el ciclo.">
            <table className="ent-hoja-tabla ent-barrios-resumen">
              <thead>
                <tr>
                  <th>Técnico</th>
                  <th className="is-num">Barrios</th>
                  <th className="is-num">Entregados</th>
                  <th className="is-num">Faltan</th>
                  <th className="is-num">Claves</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((grupo) => (
                  <tr key={grupo.id}>
                    <td><strong>{grupo.nombre}</strong></td>
                    <td className="is-num">{formatNumber(grupo.barrios.length)}</td>
                    <td className="is-num">{formatNumber(grupo.entregados)}</td>
                    <td className="is-num">{formatNumber(grupo.barrios.length - grupo.entregados)}</td>
                    <td className="is-num">{formatNumber(grupo.barrios.reduce((suma, barrio) => suma + (Number(barrio.claves) || 0), 0))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total</th>
                  <th className="is-num">{formatNumber(barrios.length)}</th>
                  <th className="is-num">{formatNumber(contar("entregado"))}</th>
                  <th className="is-num">{formatNumber(barrios.length - contar("entregado"))}</th>
                  <th className="is-num">{formatNumber(claves)}</th>
                </tr>
              </tfoot>
            </table>
          </Seccion>
        ) : null}

        <Seccion
          ancha
          titulo="Barrios y técnico responsable"
          descripcion="En orden de ruta dentro de cada técnico. La casilla queda para marcar en campo."
          aside={`${formatNumber(barrios.length)} barrios`}
        >
          <table className="ent-hoja-tabla ent-barrios-tabla">
            <thead>
              <tr>
                <th className="is-num">N.º</th>
                <th>Código</th>
                <th>Barrio</th>
                <th>Técnico</th>
                <th className="is-num">Claves</th>
                <th>Estado</th>
                <th className="is-num">Entregadas</th>
                <th className="ent-barrios-casilla-th">✓</th>
              </tr>
            </thead>
            {grupos.map((grupo) => (
              <tbody key={grupo.id} className="ent-barrios-grupo">
                {grupo.barrios.map((barrio, indice) => (
                  <tr key={barrio.codigo} className={indice === 0 ? "is-primero" : undefined}>
                    <td className="is-num">{barrio.orden_ruta || indice + 1}</td>
                    <td className="is-clave">{barrio.codigo}</td>
                    <td className="ent-barrios-nombre">{barrio.nombre}</td>
                    <td className="ent-barrios-tecnico">{barrio.responsable_nombre}</td>
                    <td className="is-num">{formatNumber(barrio.claves)}</td>
                    <td><span className={`ent-barrios-estado is-${barrio.estado}`}>{ESTADOS[barrio.estado] || barrio.estado}</span></td>
                    <td className="is-num">{barrio.estado === "entregado" ? formatNumber(barrio.entregadas) : "—"}</td>
                    <td className="ent-barrios-casilla" aria-label="Casilla para marcar" />
                  </tr>
                ))}
              </tbody>
            ))}
            <tbody className="ent-barrios-total">
              <tr>
                <td colSpan={4}>Total · {formatNumber(barrios.length)} barrios</td>
                <td className="is-num">{formatNumber(claves)}</td>
                <td />
                <td className="is-num">{formatNumber(entregadas)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </Seccion>

        <footer className="ent-hoja-pie">
          <span>Barrios de entrega · {periodo}</span>
          <span>{formatNumber(barrios.length)} barrios · {formatNumber(grupos.length)} {grupos.length === 1 ? "técnico" : "técnicos"}</span>
          <span>Generado: {formatDateTime(generadoEn)}</span>
        </footer>
      </article>
    </div>
  );
}
