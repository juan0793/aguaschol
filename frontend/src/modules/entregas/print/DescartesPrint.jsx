import logoAguasCholuteca from "../../../assets/logo-aguas-choluteca.png";
import { Seccion } from "./WeeklyReportBlocks";
import { antecedenteTexto } from "../utils/descartes";
import { estadoDocumentoLabel, formatDate, formatDateTime, formatNumber, tipoDocumentoLabel } from "../utils/entregasFormatters";
import "./loteSobrantesStyles.css";
import "./descartesPrint.css";

const plural = (n, uno, varios) => `${formatNumber(n)} ${n === 1 ? uno : varios}`;

// Tabla de reparto (por técnico o por barrio) con su fila de totales.
function Reparto({ titulo, filas, totales }) {
  return (
    <div className="ent-desc-hoja-reparto">
      <table className="ent-hoja-tabla">
        <thead><tr><th>{titulo}</th><th className="is-num">Sin entregar</th><th className="is-num">Repetidos</th></tr></thead>
        <tbody>
          {filas.map((fila) => <tr key={fila.llave}><td>{fila.nombre}</td><td className="is-num">{formatNumber(fila.documentos)}</td><td className="is-num">{formatNumber(fila.repetidos)}</td></tr>)}
          <tr className="is-total"><td>Total</td><td className="is-num">{formatNumber(totales.documentos)}</td><td className="is-num">{formatNumber(totales.repetidos)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

// Lista de Descartes con los filtros puestos en pantalla: arriba qué filtros lleva,
// las cifras y el reparto por técnico y por barrio; después cada documento y la fila
// de totales. Una columna que el filtro deja con un solo valor (día, barrio o
// técnico) no se repite en cada fila: ya se lee en "Filtros". El PDF
// (descartesPdf.js) arma lo mismo.
export default function DescartesPrint({ hoja }) {
  if (!hoja) return null;
  const { ciclo, filtros, columnas, totales, lista, motivos } = hoja;
  const motivoDe = (codigo) => motivos.find((item) => item.codigo === codigo)?.etiqueta || String(codigo || "—").replaceAll("_", " ");
  const reparto = [columnas.tecnico ? "tecnico" : null, columnas.barrio ? "barrio" : null].filter(Boolean);

  return (
    <div className="ent-hojas">
      <article className="ent-hoja ent-desc-hoja">
        <header className="ent-hoja-head">
          <img src={logoAguasCholuteca} alt="Aguas de Choluteca" />
          <div className="ent-hoja-head-texto">
            <span>Aguas de Choluteca · Control de entregas</span>
            <h1>Control de descartes</h1>
            <p>
              Documentos sin entregar · ciclo {ciclo.fecha_inicio ? `del ${formatDate(ciclo.fecha_inicio)} al ${formatDate(ciclo.fecha_fin)}` : `hasta el ${formatDate(ciclo.fecha_fin)}`}
            </p>
          </div>
        </header>

        <section className="ent-hoja-ficha ent-desc-hoja-filtros" aria-label="Filtros aplicados">
          {filtros.map((filtro) => <div key={filtro.rotulo}><span>{filtro.rotulo}</span><strong>{filtro.valor}</strong></div>)}
          {filtros.length === 1 ? <div><span>Filtros</span><strong>Sin filtros: todo lo sin entregar</strong></div> : null}
        </section>

        <dl className="ent-hoja-kpis ent-desc-hoja-kpis">
          <div className="is-destacado"><dt>Sin entregar</dt><dd>{formatNumber(totales.documentos)}</dd></div>
          <div><dt>Repetidos</dt><dd>{formatNumber(totales.repetidos)}</dd></div>
          <div><dt>Sin responsable</dt><dd>{formatNumber(totales.sin_responsable)}</dd></div>
          <div><dt>Técnicos</dt><dd>{formatNumber(totales.tecnicos)}</dd></div>
          <div><dt>Barrios</dt><dd>{formatNumber(totales.por_barrio.length)}</dd></div>
        </dl>

        {reparto.length ? (
          <Seccion titulo="Totales" descripcion="Documentos sin entregar y repetidos de lo filtrado.">
            <div className={`ent-desc-hoja-repartos${reparto.length === 1 ? " is-uno" : ""}`}>
              {columnas.tecnico ? <Reparto titulo="Técnico" filas={totales.por_tecnico} totales={totales} /> : null}
              {columnas.barrio ? <Reparto titulo="Barrio" filas={totales.por_barrio} totales={totales} /> : null}
            </div>
          </Seccion>
        ) : null}

        <Seccion
          ancha
          titulo="Documentos sin entregar"
          descripcion={columnas.fecha ? "Del día más reciente al más viejo; dentro de cada día, los repetidos primero." : "Los repetidos primero."}
          aside={plural(totales.documentos, "documento", "documentos")}
        >
          <table className="ent-hoja-tabla ent-desc-hoja-tabla">
            <thead>
              <tr>
                <th className="is-num">N.º</th>
                {columnas.fecha ? <th>Fecha</th> : null}
                <th>Abonado / clave</th>
                <th>Nombre</th>
                {columnas.barrio ? <th>Barrio</th> : null}
                {columnas.tecnico ? <th>Técnico</th> : null}
                <th>Motivo</th>
                <th>Antecedentes</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((item, indice) => (
                <tr key={item.id} className={item.repetido ? "is-marcado" : ""}>
                  <td className="is-num">{indice + 1}</td>
                  {columnas.fecha ? <td className="is-clave">{formatDate(item.fecha_lote)}</td> : null}
                  <td className="is-clave">{item.numero_abonado || "Sin abonado"}<small>{item.clave_catastral || "Sin clave"}</small></td>
                  <td>{item.abonado_nombre || "Sin nombre registrado"}<small>{tipoDocumentoLabel(item.tipo_documento)} · Lote #{item.lote_id}</small></td>
                  {columnas.barrio ? <td>{item.barrio_nombre || "Sin barrio"}</td> : null}
                  {columnas.tecnico ? <td>{item.responsable_nombre || "Sin responsable"}</td> : null}
                  <td>{motivoDe(item.motivo)}</td>
                  <td>{antecedenteTexto(item)}</td>
                  <td>{estadoDocumentoLabel(item.estado)}</td>
                </tr>
              ))}
              <tr className="is-total">
                <td colSpan={3 + Number(columnas.fecha)}>Total</td>
                <td colSpan={1 + Number(columnas.barrio) + Number(columnas.tecnico) + 3}>
                  {plural(totales.documentos, "documento sin entregar", "documentos sin entregar")} · {plural(totales.repetidos, "repetido", "repetidos")} · {plural(totales.abonados, "abonado", "abonados")}
                </td>
              </tr>
            </tbody>
          </table>
        </Seccion>

        <footer className="ent-hoja-pie">
          <span>Uso interno · Administración y Gerencia</span>
          <span>{plural(totales.documentos, "documento", "documentos")}</span>
          <span>Generado: {formatDateTime(hoja.generadoEn)}</span>
        </footer>
      </article>
    </div>
  );
}
