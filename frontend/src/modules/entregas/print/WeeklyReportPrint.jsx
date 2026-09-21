import logoAguasCholuteca from "../../../assets/logo-aguas-choluteca.png";
import {
  Destacados,
  Firmas,
  GraficoDiarioImpreso,
  IndicadoresAtencion,
  Seccion,
  TablaBarrios,
  TablaDiaria,
  TablaMotivos,
  TablaPendientes,
  TablaSobrantes,
  TablaResponsables,
  TablaTipoDocumento,
  TarjetasKpi
} from "./WeeklyReportBlocks";
import { construirResumenEjecutivo } from "./weeklyReportSummary";
import {
  estadoReporteLabel,
  formatDate,
  formatDateTime,
  formatNumber,
  tipoDocumentoLabel
} from "../utils/entregasFormatters";
import "./weeklyReportStyles.css";

const Hoja = ({ snapshot, numero, total, titulo, paginacion, children }) => (
  <article className="ent-hoja">
    <header className="ent-hoja-head">
      <img src={logoAguasCholuteca} alt="Aguas de Choluteca" />
      <div className="ent-hoja-head-texto">
        <span>Aguas de Choluteca · Control de entregas</span>
        <h1>Reporte semanal de control de entregas</h1>
        <p>{snapshot.periodo.etiqueta}</p>
      </div>
      {titulo ? <span className="ent-hoja-seccion-actual">{titulo}</span> : null}
    </header>
    {children}
    <footer className="ent-hoja-pie">
      <span>
        Período {formatDate(snapshot.periodo.fecha_inicio)} al {formatDate(snapshot.periodo.fecha_fin)}
      </span>
      <span>Generado: {formatDateTime(snapshot.generacion?.generado_en)}</span>
      <span>{paginacion || `Página ${numero} de ${total}`}</span>
    </footer>
  </article>
);

// Cinta de identificación del documento: de qué período habla, con qué filtro se
// calculó, quién lo emitió y si es un borrador en pantalla o un informe archivado.
const FichaDocumento = ({ snapshot, meta }) => {
  const esPreview = Boolean(snapshot.es_preview) || !meta;
  const campos = [
    ["Período", `${formatDate(snapshot.periodo.fecha_inicio)} al ${formatDate(snapshot.periodo.fecha_fin)}`],
    [
      "Tipo de documento",
      snapshot.periodo.tipo_documento && snapshot.periodo.tipo_documento !== "TODOS"
        ? tipoDocumentoLabel(snapshot.periodo.tipo_documento)
        : "Factura y nota de cobro"
    ],
    ["Lotes incluidos", `${formatNumber(snapshot.totales.lotes)} (${formatNumber(snapshot.totales.lotes_cerrados)} cerrados)`],
    ["Emitido por", snapshot.generacion?.generado_por_nombre || meta?.generado_por_nombre || "—"],
    ["Versión", esPreview ? "Vista previa" : meta.version_etiqueta || `Versión ${meta.version}`],
    ["Estado", esPreview ? "Sin archivar" : estadoReporteLabel(meta.estado)]
  ];

  return (
    <section className={`ent-hoja-ficha${esPreview ? " is-preview" : ""}`}>
      {campos.map(([etiqueta, valor]) => (
        <div key={etiqueta}>
          <span>{etiqueta}</span>
          <strong>{valor}</strong>
        </div>
      ))}
    </section>
  );
};

// Hoja Letter vertical. Cada página repite encabezado y pie, y las tablas
// arrastran su cabecera si se cortan entre páginas.
export default function WeeklyReportPrint({ snapshot, meta = null, incluirAnexo = false, incluirSobrantes = false }) {
  if (!snapshot) return null;
  const anexo = incluirAnexo && snapshot.anexo_pendientes?.length ? snapshot.anexo_pendientes : [];
  const sobrantes = incluirSobrantes && snapshot.anexo_sobrantes?.length ? snapshot.anexo_sobrantes : [];
  const resumenSobrantes = snapshot.sobrantes_resumen || null;
  // Cada hoja es una sección cerrada. Los pendientes viven en su propia hoja
  // porque son la lista más larga y, mezclados con las observaciones, empujaban
  // el pie de página a una hoja de más al imprimir.
  const totalPaginas = 5 + (anexo.length ? 1 : 0) + (sobrantes.length ? 1 : 0);
  const totales = snapshot.totales;
  const resumen = construirResumenEjecutivo(snapshot);
  const filtrado = snapshot.periodo.tipo_documento && snapshot.periodo.tipo_documento !== "TODOS";

  return (
    <div className="ent-hojas">
      <Hoja snapshot={snapshot} numero={1} total={totalPaginas} titulo="Resumen ejecutivo">
        <FichaDocumento snapshot={snapshot} meta={meta} />

        {resumen.length ? (
          <section className="ent-hoja-resumen">
            <h2>Lectura de la semana</h2>
            {resumen.map((frase) => (
              <p key={frase}>{frase}</p>
            ))}
          </section>
        ) : null}

        <Seccion
          titulo="Indicadores del período"
          descripcion={
            snapshot.comparativo?.con_datos
              ? `Comparado con el período del ${formatDate(snapshot.comparativo.periodo.fecha_inicio)} al ${formatDate(snapshot.comparativo.periodo.fecha_fin)}.`
              : "Sin período anterior con datos para comparar."
          }
        >
          <TarjetasKpi totales={totales} comparativo={snapshot.comparativo} />
          {filtrado ? (
            <p className="ent-hoja-nota">
              Informe filtrado por tipo de documento: {tipoDocumentoLabel(snapshot.periodo.tipo_documento)}. Los totales
              no incluyen el resto de documentos repartidos en el período.
            </p>
          ) : null}
        </Seccion>

        <Seccion
          titulo="Avance por día"
          descripcion="La altura de cada columna es la carga del día; el corte muestra en qué terminó."
        >
          <GraficoDiarioImpreso rows={snapshot.por_dia} />
          <TablaDiaria rows={snapshot.por_dia} />
        </Seccion>

      </Hoja>

      <Hoja snapshot={snapshot} numero={2} total={totalPaginas} titulo="Atención y desempeño">
        <Seccion titulo="Indicadores de atención" aside="Casos detectados al cierre del período">
          <IndicadoresAtencion indicadores={snapshot.indicadores_atencion} />
        </Seccion>

        <Seccion titulo="Puntos destacados del período">
          <Destacados destacados={snapshot.destacados} />
          {!snapshot.destacados ? (
            <p className="ent-hoja-nota">Este informe se archivó antes de que existiera esta sección.</p>
          ) : null}
        </Seccion>

        <Seccion
          titulo="Rendimiento por responsable"
          descripcion="Ordenado por volumen asignado. La barra marca en ámbar a quien cerró por debajo del 85%."
        >
          <TablaResponsables rows={snapshot.por_responsable} tipoDocumentoLabel={tipoDocumentoLabel} />
        </Seccion>

        <Seccion titulo="Resultado por tipo de documento">
          <TablaTipoDocumento rows={snapshot.por_tipo_documento} tipoDocumentoLabel={tipoDocumentoLabel} />
        </Seccion>
      </Hoja>

      <Hoja snapshot={snapshot} numero={3} total={totalPaginas} titulo="Territorio y causas">
        <Seccion
          titulo="Resultado por barrio"
          descripcion="Los barrios marcados quedaron por debajo del 85% de efectividad."
          aside={
            snapshot.destacados?.barrios_bajo_umbral
              ? `${formatNumber(snapshot.destacados.barrios_bajo_umbral)} barrio(s) bajo el umbral`
              : null
          }
        >
          <TablaBarrios rows={snapshot.por_barrio} />
        </Seccion>

        <Seccion
          titulo="Motivos de no entrega"
          descripcion="Por qué no se pudo entregar, según lo declarado al cerrar cada lote."
        >
          <TablaMotivos rows={snapshot.por_motivo} total={totales.no_entregadas} />
          {snapshot.destacados?.concentracion_pendientes ? (
            <p className="ent-hoja-nota">
              El {snapshot.destacados.concentracion_pendientes.porcentaje}% de los pendientes del período se concentra en{" "}
              {snapshot.destacados.concentracion_pendientes.barrio_nombre} (
              {formatNumber(snapshot.destacados.concentracion_pendientes.pendientes)} documentos).
            </p>
          ) : null}
        </Seccion>
      </Hoja>

      <Hoja snapshot={snapshot} numero={4} total={totalPaginas} titulo="Voz del personal">
        <Seccion
          titulo="Observaciones del personal de campo"
          descripcion="Texto tal como lo registró cada responsable al cerrar su lote."
          aside={snapshot.observaciones.length ? `${formatNumber(snapshot.observaciones.length)} registradas` : null}
          ancha
        >
          {snapshot.observaciones.length ? (
            <ul className="ent-hoja-observaciones">
              {snapshot.observaciones.map((observacion) => (
                <li key={observacion.lote_id}>
                  <strong>
                    {observacion.responsable_nombre} · {observacion.barrio_nombre} · {formatDate(observacion.fecha)}
                  </strong>
                  <p>&laquo;{observacion.texto}&raquo;</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ent-hoja-nota">No se registraron observaciones de campo en este período.</p>
          )}
        </Seccion>

      </Hoja>

      <Hoja snapshot={snapshot} numero={5} total={totalPaginas} titulo="Pendientes y cierre">
        <Seccion
          titulo="Pendientes prioritarios"
          descripcion="Documentos con más de 3 días sin entregar o con dos o más intentos. Las filas marcadas superan los 7 días."
          aside={`${formatNumber(snapshot.pendientes_prioritarios.length)} de ${formatNumber(totales.pendientes)} pendientes`}
          ancha
        >
          <TablaPendientes rows={snapshot.pendientes_prioritarios} />
          {snapshot.pendientes_prioritarios_omitidos > 0 ? (
            <p className="ent-hoja-nota">
              Se omitieron {formatNumber(snapshot.pendientes_prioritarios_omitidos)} caso(s) adicionales. Marca «Incluir
              anexo completo de pendientes» para verlos todos.
            </p>
          ) : null}
        </Seccion>

        <Firmas />
      </Hoja>

      {anexo.length ? (
        <Hoja snapshot={snapshot} numero={6} total={totalPaginas} titulo="Anexo" paginacion={`Anexo · ${formatNumber(anexo.length)} documentos`}>
          <Seccion
            ancha
            titulo="Anexo · pendientes completos"
            descripcion={`${formatNumber(anexo.length)} documentos pendientes de seguimiento al cierre del período.`}
          >
            <TablaPendientes rows={anexo} />
          </Seccion>
        </Hoja>
      ) : null}

      {sobrantes.length ? (
        <Hoja
          snapshot={snapshot}
          numero={5 + (anexo.length ? 1 : 0) + 1}
          total={totalPaginas}
          titulo="Anexo"
          paginacion={`Sobrantes · ${formatNumber(sobrantes.length)} documentos`}
        >
          <Seccion
            ancha
            titulo="Anexo · sobrantes de lotes cerrados"
            descripcion={`Personas que quedaron sin recibir su documento en los lotes cerrados del período. ${
              resumenSobrantes
                ? `${formatNumber(resumenSobrantes.personas)} persona(s) en ${formatNumber(resumenSobrantes.lotes)} lote(s).`
                : ""
            }`}
            aside={`${formatNumber(sobrantes.length)} documentos`}
          >
            <TablaSobrantes rows={sobrantes} />
          </Seccion>
        </Hoja>
      ) : null}
    </div>
  );
}
