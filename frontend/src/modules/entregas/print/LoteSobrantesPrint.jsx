import logoAguasCholuteca from "../../../assets/logo-aguas-choluteca.png";
import { Seccion } from "./WeeklyReportBlocks";
import {
  estadoDocumentoLabel,
  estadoLoteLabel,
  formatDate,
  formatDateTime,
  formatLempiras,
  formatNumber,
  tipoDocumentoLabel
} from "../utils/entregasFormatters";
import "./loteSobrantesStyles.css";

// Acta de documentos sobrantes de un lote: es el papel que acompaña a las
// facturas que vuelven a la oficina, así que lleva el detalle documento por
// documento y un pie de firmas para dejar constancia de la entrega física.
// Reutiliza la hoja Letter del reporte semanal (.ent-hoja) para que ambos
// impresos se vean como el mismo sistema.
export default function LoteSobrantesPrint({ lote, motivos = [], generadoEn }) {
  if (!lote) return null;
  const documentos = lote.no_entregadas || [];
  const motivoLabel = (codigo) => motivos.find((item) => item.codigo === codigo)?.etiqueta || String(codigo || "—").replaceAll("_", " ");
  // El saldo solo llega a quien puede verlo (administración y gerencia); sin él,
  // el acta sale como antes, sin columnas vacías.
  const saldo = lote.saldo_sobrantes;
  const conSaldo = Boolean(saldo) || documentos.some((documento) => documento.saldo);
  const suma = (campo) => documentos.reduce((total, documento) => total + (documento.saldo?.encontrado ? Number(documento.saldo[campo]) || 0 : 0), 0);
  const totales = { capital: saldo?.capital ?? suma("capital"), mora: saldo?.mora ?? suma("mora"), total: saldo?.total ?? suma("total") };

  return (
    <div className="ent-hojas">
      <article className="ent-hoja">
        <header className="ent-hoja-head">
          <img src={logoAguasCholuteca} alt="Aguas de Choluteca" />
          <div className="ent-hoja-head-texto">
            <span>Aguas de Choluteca · Control de entregas</span>
            <h1>Acta de documentos sobrantes</h1>
            <p>
              Lote #{lote.id} · {tipoDocumentoLabel(lote.tipo_documento)} · {formatDate(lote.fecha)}
            </p>
          </div>
        </header>

        <section className="ent-hoja-datos">
          <div>
            <span>Responsable del recorrido</span>
            <strong>{lote.responsable_nombre || "—"}</strong>
          </div>
          <div>
            <span>Barrio o recorrido</span>
            <strong>{lote.barrio_nombre || "—"}</strong>
          </div>
          <div>
            <span>Estado del lote</span>
            <strong>{estadoLoteLabel(lote.estado)}</strong>
          </div>
          <div>
            <span>Cerrado por</span>
            <strong>{lote.closed_by_nombre || (lote.closed_by ? `Usuario #${lote.closed_by}` : "—")}</strong>
          </div>
          <div>
            <span>Fecha de cierre</span>
            <strong>{lote.closed_at ? formatDateTime(lote.closed_at) : "—"}</strong>
          </div>
          <div>
            <span>Documentos sobrantes</span>
            <strong>{formatNumber(documentos.length)}</strong>
          </div>
        </section>

        <dl className="ent-hoja-kpis ent-hoja-kpis-3">
          <div>
            <dt>Asignadas</dt>
            <dd>{formatNumber(lote.total_asignadas)}</dd>
          </div>
          <div>
            <dt>Entregadas</dt>
            <dd>{formatNumber(lote.total_entregadas)}</dd>
          </div>
          <div className="is-destacado">
            <dt>No entregadas</dt>
            <dd>{formatNumber(lote.total_sobrantes)}</dd>
          </div>
        </dl>

        {conSaldo ? (
          <dl className="ent-hoja-kpis ent-hoja-kpis-3 ent-acta-saldo">
            <div>
              <dt>Capital</dt>
              <dd>{formatLempiras(totales.capital)}</dd>
            </div>
            <div className="is-mora">
              <dt>Mora</dt>
              <dd>{formatLempiras(totales.mora)}</dd>
            </div>
            <div className="is-destacado">
              <dt>Saldo de lo no entregado</dt>
              <dd>{formatLempiras(totales.total)}</dd>
            </div>
          </dl>
        ) : null}
        {saldo ? (
          <p className="ent-hoja-nota ent-acta-saldo-nota">
            Según el padrón vigente · {formatNumber(saldo.con_saldo)} de {formatNumber(saldo.cuentas)} cuentas con saldo
            {saldo.sin_padron ? ` · ${formatNumber(saldo.sin_padron)} sin registro en el padrón` : ""}
          </p>
        ) : null}

        <Seccion
          ancha
          titulo="Detalle de documentos no entregados"
          descripcion="Documentos que regresan a la oficina junto con esta acta."
          aside={`${formatNumber(documentos.length)} documentos`}
        >
          {documentos.length ? (
            <table className={`ent-hoja-tabla${conSaldo ? " ent-acta-tabla-saldo" : ""}`}>
              <thead>
                <tr>
                  <th className="is-num">N.º</th>
                  <th>Documento</th>
                  <th>Abonado</th>
                  <th>Motivo</th>
                  {conSaldo ? (
                    <>
                      <th className="is-num">Capital</th>
                      <th className="is-num">Mora</th>
                      <th className="is-num">Saldo</th>
                    </>
                  ) : (
                    <>
                      <th>Estado</th>
                      <th>Observación</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {documentos.map((documento, indice) => {
                  const cuenta = documento.saldo;
                  return (
                    <tr key={documento.id}>
                      <td className="is-num">{indice + 1}</td>
                      <td className="is-clave">{documento.numero_abonado || documento.clave_catastral || "—"}</td>
                      <td>
                        {documento.abonado_nombre || documento.clave_catastral || "—"}
                        {conSaldo && documento.observacion ? <small className="ent-acta-obs">{documento.observacion}</small> : null}
                      </td>
                      <td>
                        {motivoLabel(documento.motivo)}
                        {conSaldo ? <small className="ent-acta-obs">{estadoDocumentoLabel(documento.estado)}</small> : null}
                      </td>
                      {conSaldo ? (
                        cuenta?.encontrado ? (
                          <>
                            <td className="is-num">{formatLempiras(cuenta.capital)}</td>
                            <td className={`is-num${Number(cuenta.mora) > 0 ? " is-mora" : ""}`}>{formatLempiras(cuenta.mora)}</td>
                            <td className="is-num is-saldo">{formatLempiras(cuenta.total)}</td>
                          </>
                        ) : (
                          <td className="is-sin-padron" colSpan={3}>Sin registro en el padrón</td>
                        )
                      ) : (
                        <>
                          <td>{estadoDocumentoLabel(documento.estado)}</td>
                          <td>{documento.observacion || ""}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              {conSaldo ? (
                <tfoot>
                  <tr>
                    <th colSpan={4}>Total de lo no entregado · {formatNumber(documentos.length)} documentos</th>
                    <th className="is-num">{formatLempiras(totales.capital)}</th>
                    <th className="is-num is-mora">{formatLempiras(totales.mora)}</th>
                    <th className="is-num is-saldo">{formatLempiras(totales.total)}</th>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          ) : (
            <p className="ent-hoja-nota">Este lote no registra documentos sobrantes.</p>
          )}
        </Seccion>

        {lote.observacion_inicial || lote.observacion_responsable ? (
          <Seccion titulo="Observaciones">
            <ul className="ent-hoja-observaciones">
              {lote.observacion_inicial ? (
                <li>
                  <strong>Al asignar el lote</strong>
                  <p>{lote.observacion_inicial}</p>
                </li>
              ) : null}
              {lote.observacion_responsable ? (
                <li>
                  <strong>Del responsable</strong>
                  <p>{lote.observacion_responsable}</p>
                </li>
              ) : null}
            </ul>
          </Seccion>
        ) : null}

        <section className="ent-hoja-firmas">
          <div>
            <i />
            <span>Entrega</span>
            <small>{lote.responsable_nombre || "Responsable del recorrido"}</small>
          </div>
          <div>
            <i />
            <span>Recibe</span>
            <small>Oficina de Control de Entregas</small>
          </div>
          <div>
            <i />
            <span>Fecha de recepción</span>
            <small>Día / mes / año</small>
          </div>
        </section>

        <footer className="ent-hoja-pie">
          <span>Lote #{lote.id} · {formatDate(lote.fecha)}</span>
          <span>{formatNumber(documentos.length)} documentos relacionados</span>
          <span>Generado: {formatDateTime(generadoEn)}</span>
        </footer>
      </article>
    </div>
  );
}
