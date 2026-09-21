import logoAguasCholuteca from "../../../assets/logo-aguas-choluteca.png";
import { Seccion } from "./WeeklyReportBlocks";
import {
  estadoDocumentoLabel,
  formatDate,
  formatDateTime,
  formatNumber,
  tipoDocumentoLabel
} from "../utils/entregasFormatters";
import "./loteSobrantesStyles.css";

// Acta consolidada: el acta por lote sirve para el papel que acompaña a un
// recorrido, pero la oficina también necesita una sola hoja con todas las
// personas que quedaron sin su documento en los lotes ya cerrados de un rango.
// Va agrupada por lote porque las facturas vuelven así, atadas por recorrido, y
// lleva un pie de firmas único para dejar constancia de la recepción completa.
export default function SobrantesConsolidadoPrint({ grupos = [], rango = null, motivos = [], generadoEn }) {
  if (!grupos.length) return null;

  const motivoLabel = (codigo) =>
    motivos.find((item) => item.codigo === codigo)?.etiqueta || String(codigo || "—").replaceAll("_", " ");

  const documentos = grupos.reduce((suma, grupo) => suma + grupo.documentos.length, 0);
  const personas = new Set(
    grupos.flatMap((grupo) => grupo.documentos.map((doc) => doc.numero_abonado || doc.clave_catastral || `#${doc.id}`))
  ).size;
  const responsables = new Set(grupos.map((grupo) => grupo.responsable_nombre).filter(Boolean)).size;

  return (
    <div className="ent-hojas">
      <article className="ent-hoja">
        <header className="ent-hoja-head">
          <img src={logoAguasCholuteca} alt="Aguas de Choluteca" />
          <div className="ent-hoja-head-texto">
            <span>Aguas de Choluteca · Control de entregas</span>
            <h1>Acta consolidada de documentos sobrantes</h1>
            <p>
              Lotes cerrados
              {rango?.fecha_desde || rango?.fecha_hasta
                ? ` · ${formatDate(rango.fecha_desde) || "inicio"} al ${formatDate(rango.fecha_hasta) || "hoy"}`
                : ""}
            </p>
          </div>
        </header>

        <dl className="ent-hoja-kpis ent-hoja-kpis-3">
          <div>
            <dt>Lotes</dt>
            <dd>{formatNumber(grupos.length)}</dd>
          </div>
          <div>
            <dt>Personas</dt>
            <dd>{formatNumber(personas)}</dd>
          </div>
          <div className="is-destacado">
            <dt>Documentos sobrantes</dt>
            <dd>{formatNumber(documentos)}</dd>
          </div>
        </dl>

        {grupos.map((grupo) => (
          <Seccion
            key={grupo.lote_id}
            ancha
            titulo={`Lote #${grupo.lote_id} · ${grupo.responsable_nombre || "Sin responsable"}`}
            descripcion={`${formatDate(grupo.fecha)} · ${grupo.barrio_nombre || "Sin barrio"} · ${tipoDocumentoLabel(grupo.tipo_documento)}`}
            aside={`${formatNumber(grupo.documentos.length)} ${grupo.documentos.length === 1 ? "documento" : "documentos"}`}
          >
            <table className="ent-hoja-tabla">
              <thead>
                <tr>
                  <th className="is-num">N.º</th>
                  <th>Persona</th>
                  <th>Abonado</th>
                  <th>Clave catastral</th>
                  <th>Motivo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {grupo.documentos.map((documento, indice) => (
                  <tr key={documento.id}>
                    <td className="is-num">{indice + 1}</td>
                    <td>{documento.abonado_nombre || "Sin nombre registrado"}</td>
                    <td className="is-clave">{documento.numero_abonado || "—"}</td>
                    <td className="is-clave">{documento.clave_catastral || "—"}</td>
                    <td>{motivoLabel(documento.motivo)}</td>
                    <td>{estadoDocumentoLabel(documento.estado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Seccion>
        ))}

        <section className="ent-hoja-firmas">
          <div>
            <i />
            <span>Entrega</span>
            <small>{responsables === 1 ? grupos[0].responsable_nombre : `${formatNumber(responsables)} responsables`}</small>
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
          <span>{formatNumber(grupos.length)} lotes cerrados</span>
          <span>{formatNumber(documentos)} documentos relacionados</span>
          <span>Generado: {formatDateTime(generadoEn)}</span>
        </footer>
      </article>
    </div>
  );
}
