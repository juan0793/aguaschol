import logoAguasCholuteca from "../../../assets/logo-aguas-choluteca.png";
import {
  estadoDocumentoLabel,
  estadoLoteLabel,
  formatDate,
  formatDateTime,
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

  return (
    <div className="ent-hojas">
      <article className="ent-hoja">
        <header className="ent-hoja-head">
          <img src={logoAguasCholuteca} alt="Aguas de Choluteca" />
          <div>
            <span>AGUAS DE CHOLUTECA</span>
            <h1>ACTA DE DOCUMENTOS SOBRANTES</h1>
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

        <section className="ent-hoja-kpis ent-hoja-kpis-3">
          <div>
            <span>Asignadas</span>
            <strong>{formatNumber(lote.total_asignadas)}</strong>
          </div>
          <div>
            <span>Entregadas</span>
            <strong>{formatNumber(lote.total_entregadas)}</strong>
          </div>
          <div className="is-destacado">
            <span>No entregadas</span>
            <strong>{formatNumber(lote.total_sobrantes)}</strong>
          </div>
        </section>

        <section className="ent-hoja-bloque ent-hoja-listado">
          <h2>Detalle de documentos no entregados</h2>
          {documentos.length ? (
            <table className="ent-hoja-tabla">
              <thead>
                <tr>
                  <th className="is-num">N.º</th>
                  <th>Documento</th>
                  <th>Abonado</th>
                  <th>Motivo</th>
                  <th>Estado</th>
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody>
                {documentos.map((documento, indice) => (
                  <tr key={documento.id}>
                    <td className="is-num">{indice + 1}</td>
                    <td className="is-clave">{documento.numero_abonado || documento.clave_catastral || "—"}</td>
                    <td>{documento.abonado_nombre || documento.clave_catastral || "—"}</td>
                    <td>{motivoLabel(documento.motivo)}</td>
                    <td>{estadoDocumentoLabel(documento.estado)}</td>
                    <td>{documento.observacion || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="ent-hoja-nota">Este lote no registra documentos sobrantes.</p>
          )}
        </section>

        {lote.observacion_inicial || lote.observacion_responsable ? (
          <section className="ent-hoja-bloque">
            <h2>Observaciones</h2>
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
          </section>
        ) : null}

        <section className="ent-hoja-firmas">
          <div>
            <i />
            <span>Entrega — {lote.responsable_nombre || "responsable del recorrido"}</span>
          </div>
          <div>
            <i />
            <span>Recibe — oficina de Control de Entregas</span>
          </div>
          <div>
            <i />
            <span>Fecha de recepción</span>
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
