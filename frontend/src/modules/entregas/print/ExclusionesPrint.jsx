import logoAguasCholuteca from "../../../assets/logo-aguas-choluteca.png";
import { Seccion } from "./WeeklyReportBlocks";
import { cuentaTexto, entregaTexto } from "../utils/exclusiones";
import { formatDate, formatDateTime, formatLempiras, formatNumber } from "../utils/entregasFormatters";
import "./loteSobrantesStyles.css";
import "./descartesPrint.css";

const plural = (n, uno, varios) => `${formatNumber(n)} ${n === 1 ? uno : varios}`;

// Lista impresa de Exclusiones con lo que se ve en pantalla (búsqueda y estado): las
// cifras, cada cuenta con su saldo y qué pasó con su entrega en el ciclo, y la fila de
// totales. Usa la hoja de Descartes; el PDF (exclusionesPdf.js) arma lo mismo.
export default function ExclusionesPrint({ hoja }) {
  if (!hoja) return null;
  const { ciclo, filtros, totales, lista, verSaldo } = hoja;

  return (
    <div className="ent-hojas">
      <article className="ent-hoja ent-desc-hoja">
        <header className="ent-hoja-head">
          <img src={logoAguasCholuteca} alt="Aguas de Choluteca" />
          <div className="ent-hoja-head-texto">
            <span>Aguas de Choluteca · Control de entregas</span>
            <h1>Exclusiones de entrega</h1>
            <p>Cuentas que entrega otro departamento · ciclo del {formatDate(ciclo.desde)} al {formatDate(ciclo.hasta)}</p>
          </div>
        </header>

        {filtros.length ? <section className="ent-hoja-ficha ent-desc-hoja-filtros" aria-label="Filtros aplicados">
          {filtros.map((filtro) => <div key={filtro.rotulo}><span>{filtro.rotulo}</span><strong>{filtro.valor}</strong></div>)}
        </section> : null}

        <dl className="ent-hoja-kpis ent-desc-hoja-kpis">
          <div className="is-destacado"><dt>Excluidas</dt><dd>{formatNumber(totales.total)}</dd></div>
          <div><dt>Entregadas por técnico</dt><dd>{formatNumber(totales.por_estado.ENTREGADA + totales.por_estado.REENTREGADA)}</dd></div>
          <div><dt>Sin entregar</dt><dd>{formatNumber(totales.por_estado.SOBRANTE)}</dd></div>
          <div><dt>Sin lote</dt><dd>{formatNumber(totales.por_estado.SIN_LOTE + totales.por_estado.LOTE_ABIERTO + totales.por_estado.SIN_BARRIO)}</dd></div>
          {verSaldo ? <div><dt>Saldo</dt><dd>{formatLempiras(totales.saldo)}</dd></div> : <div><dt>Sin padrón</dt><dd>{formatNumber(totales.por_estado.SIN_BARRIO)}</dd></div>}
        </dl>

        <Seccion
          ancha
          titulo="Cuentas excluidas"
          descripcion="Una factura entregada no deja registro propio: si el barrio tuvo un lote cerrado y la cuenta no quedó de sobrante, el técnico la contó como entregada."
          aside={plural(totales.total, "cuenta", "cuentas")}
        >
          <table className="ent-hoja-tabla ent-desc-hoja-tabla">
            <thead>
              <tr>
                <th className="is-num">N.º</th>
                <th>Abonado / clave</th>
                <th>Nombre</th>
                {verSaldo ? <th className="is-num">Capital</th> : null}
                {verSaldo ? <th className="is-num">Mora</th> : null}
                {verSaldo ? <th className="is-num">Saldo</th> : null}
                <th>Este ciclo</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((item, indice) => {
                const cuenta = cuentaTexto(item);
                const entrega = entregaTexto(item);
                return (
                  <tr key={item.id} className={entrega.codigo === "ENTREGADA" || entrega.codigo === "REENTREGADA" ? "is-marcado" : ""}>
                    <td className="is-num">{indice + 1}</td>
                    <td className="is-clave">{item.valor}<small>{item.tipo === "CLAVE" ? "Clave" : "Abonado"}</small></td>
                    <td>{cuenta.nombre}{cuenta.linea ? <small>{cuenta.linea}</small> : null}</td>
                    {verSaldo ? <td className="is-num">{item.saldo ? formatLempiras(item.saldo.capital) : "—"}</td> : null}
                    {verSaldo ? <td className="is-num">{item.saldo ? formatLempiras(item.saldo.mora) : "—"}</td> : null}
                    {verSaldo ? <td className="is-num">{item.saldo ? formatLempiras(item.saldo.total) : "—"}</td> : null}
                    <td>{entrega.etiqueta}<small>{entrega.detalle}{entrega.antes ? ` · ${entrega.antes}` : ""}</small></td>
                    <td>{item.nota || "Otro departamento"}</td>
                  </tr>
                );
              })}
              <tr className="is-total">
                <td colSpan={3}>Total · {plural(totales.total, "cuenta", "cuentas")}</td>
                {verSaldo ? <td className="is-num">{formatLempiras(totales.capital)}</td> : null}
                {verSaldo ? <td className="is-num">{formatLempiras(totales.mora)}</td> : null}
                {verSaldo ? <td className="is-num">{formatLempiras(totales.saldo)}</td> : null}
                <td colSpan={2}>{plural(totales.por_estado.ENTREGADA + totales.por_estado.REENTREGADA, "entregada por técnico", "entregadas por técnico")} · {plural(totales.por_estado.SOBRANTE, "sin entregar", "sin entregar")}</td>
              </tr>
            </tbody>
          </table>
        </Seccion>

        <footer className="ent-hoja-pie">
          <span>Uso interno · Administración y Gerencia</span>
          <span>{plural(totales.total, "cuenta", "cuentas")}</span>
          <span>Generado: {formatDateTime(hoja.generadoEn)}</span>
        </footer>
      </article>
    </div>
  );
}
