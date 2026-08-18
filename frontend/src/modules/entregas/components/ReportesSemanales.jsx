import { useCallback, useEffect, useState } from "react";
import { Icon } from "../../../components/Icon";
import WeeklyReportPrint from "../print/WeeklyReportPrint";
import { descargarReporteSemanalPdf } from "../print/weeklyReportPdf";
import { useReportesSemanales } from "../hooks/useReportesSemanales";
import {
  estadoClass,
  estadoReporteLabel,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  tipoDocumentoLabel
} from "../utils/entregasFormatters";

export default function ReportesSemanales({ api, config, permissions, notify }) {
  const historico = useReportesSemanales(api);
  const [rango, setRango] = useState(config.semana_actual);
  const [tipoDocumento, setTipoDocumento] = useState("");
  const [incluirAnexo, setIncluirAnexo] = useState(false);
  const [vista, setVista] = useState(null); // { snapshot, meta }
  const [cargando, setCargando] = useState(false);
  const [generando, setGenerando] = useState(false);

  // La vista previa usa datos vivos y NO crea snapshot en la base.
  const cargarPreview = useCallback(async () => {
    setCargando(true);
    try {
      const data = await api.reportePreview({
        fecha_inicio: rango.fecha_inicio,
        fecha_fin: rango.fecha_fin,
        tipo_documento: tipoDocumento,
        incluir_anexo: incluirAnexo ? "1" : ""
      });
      setVista({ snapshot: data, meta: null, existentes: data.reportes_existentes || [] });
    } catch (error) {
      notify(error.message);
    } finally {
      setCargando(false);
    }
  }, [api, incluirAnexo, notify, rango, tipoDocumento]);

  useEffect(() => {
    if (permissions.can_generate_report) cargarPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirHistorico = async (reporte) => {
    setCargando(true);
    try {
      const data = await api.reporte(reporte.id);
      setVista({ snapshot: data.snapshot, meta: data, existentes: [] });
    } catch (error) {
      notify(error.message);
    } finally {
      setCargando(false);
    }
  };

  const generar = async (confirmarDuplicado = false) => {
    if (generando) return;
    setGenerando(true);
    try {
      const data = await api.generarReporte({
        fecha_inicio: rango.fecha_inicio,
        fecha_fin: rango.fecha_fin,
        tipo_documento: tipoDocumento,
        incluir_anexo_pendientes: incluirAnexo,
        confirmar_duplicado: confirmarDuplicado
      });
      setVista({ snapshot: data.snapshot, meta: data, existentes: [] });
      historico.reload();
      notify("Informe semanal generado y archivado en el histórico.");
    } catch (error) {
      if (error.status === 409) {
        notify(`${error.message} Si aún así deseas emitir otro, usa "Generar de todos modos".`);
      } else {
        notify(error.message);
      }
    } finally {
      setGenerando(false);
    }
  };

  const corregir = async (reporte) => {
    const motivo = window.prompt("Motivo de la corrección:");
    if (motivo === null) return;
    try {
      const data = await api.generarCorreccion(reporte.id, { motivo, incluir_anexo_pendientes: incluirAnexo });
      setVista({ snapshot: data.snapshot, meta: data, existentes: [] });
      historico.reload();
      notify(`Versión ${data.version} emitida.`);
    } catch (error) {
      notify(error.message);
    }
  };

  const descargarPdf = async () => {
    try {
      await descargarReporteSemanalPdf(vista?.snapshot, { incluirAnexo });
    } catch (error) {
      notify(`No fue posible generar el PDF: ${error.message}`);
    }
  };

  return (
    <section className="ent-reportes">
      <div className="cl-inbox ent-reportes-panel">
        <div className="cl-inbox-head">
          <div>
            <span className="cl-kicker">Consolidado</span>
            <h3>Reporte semanal</h3>
            <p>{vista?.snapshot?.periodo?.etiqueta || "Selecciona una semana para generar la vista previa."}</p>
          </div>
          <div className="ent-acciones">
            <button type="button" className="cl-secondary" onClick={cargarPreview} disabled={cargando}>
              <Icon name="refresh" />
              Vista previa
            </button>
            <button type="button" className="cl-secondary" onClick={() => window.print()} disabled={!vista}>
              <Icon name="print" />
              Imprimir
            </button>
            <button type="button" className="cl-secondary" onClick={descargarPdf} disabled={!vista}>
              <Icon name="download" />
              Descargar PDF
            </button>
            {permissions.can_generate_report && !vista?.meta ? (
              <button type="button" className="cl-primary" onClick={() => generar(false)} disabled={generando}>
                <Icon name="archive" />
                {generando ? "Generando…" : "Generar informe semanal"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="cl-toolbar ent-toolbar">
          <label>
            Desde (lunes)
            <input
              type="date"
              value={rango.fecha_inicio}
              onChange={(event) => {
                setRango({ ...rango, fecha_inicio: event.target.value });
                setVista(null);
              }}
            />
          </label>
          <label>
            Hasta (viernes)
            <input
              type="date"
              value={rango.fecha_fin}
              onChange={(event) => {
                setRango({ ...rango, fecha_fin: event.target.value });
                setVista(null);
              }}
            />
          </label>
          <label>
            Tipo de documento
            <select
              value={tipoDocumento}
              onChange={(event) => {
                setTipoDocumento(event.target.value);
                setVista(null);
              }}
            >
              <option value="">Ambos</option>
              {config.tipos_documento.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipoDocumentoLabel(tipo)}
                </option>
              ))}
            </select>
          </label>
          <label className="ent-check">
            <input type="checkbox" checked={incluirAnexo} onChange={(event) => setIncluirAnexo(event.target.checked)} />
            Incluir anexo completo de pendientes
          </label>
        </div>

        {vista?.existentes?.length ? (
          <p className="ent-diferencia is-atencion">
            Ya existe un informe emitido para esta semana ({vista.existentes.map((item) => item.version_etiqueta).join(", ")}).
            Usa una corrección desde el histórico en lugar de duplicarlo.
            {permissions.can_generate_report ? (
              <button type="button" className="cl-quiet ent-boton-mini" onClick={() => generar(true)}>
                Generar de todos modos
              </button>
            ) : null}
          </p>
        ) : null}

        {vista?.meta ? (
          <p className="ent-diferencia">
            Informe archivado · {vista.meta.version_etiqueta} · {estadoReporteLabel(vista.meta.estado)} · generado por{" "}
            {vista.meta.generado_por_nombre || "—"} el {formatDateTime(vista.meta.fecha_generacion)}.
          </p>
        ) : vista ? (
          <p className="ent-diferencia">
            Vista previa con datos vivos. El histórico solo se crea al presionar «Generar informe semanal».
          </p>
        ) : null}

        <div className="ent-print-preview">
          {cargando ? (
            <p className="cl-module-loading">
              <Icon name="refresh" />
              Calculando informe…
            </p>
          ) : (
            <WeeklyReportPrint snapshot={vista?.snapshot} incluirAnexo={incluirAnexo} />
          )}
        </div>
      </div>

      <div className="cl-inbox ent-historico">
        <div className="cl-inbox-head">
          <div>
            <span className="cl-kicker">Histórico</span>
            <h3>Informes emitidos</h3>
            <p>Cada informe conserva la foto cerrada de su semana.</p>
          </div>
        </div>

        {historico.error ? <p className="cl-alert">{historico.error}</p> : null}

        <div className="cl-table-wrap">
          <table className="cl-table ent-table">
            <thead>
              <tr>
                <th>Semana</th>
                <th>Generado por</th>
                <th className="is-num">Asignadas</th>
                <th className="is-num">Entregadas</th>
                <th className="is-num">Pendientes</th>
                <th className="is-num">Efectividad</th>
                <th>Versión</th>
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {!historico.items.length ? (
                <tr>
                  <td colSpan={9} className="cl-empty">
                    Todavía no se ha archivado ningún informe semanal.
                  </td>
                </tr>
              ) : null}
              {historico.items.map((reporte) => (
                <tr key={reporte.id}>
                  <td>
                    <button type="button" className="cl-link" onClick={() => abrirHistorico(reporte)}>
                      <strong>{reporte.periodo_etiqueta}</strong>
                      <span>
                        {formatDate(reporte.fecha_inicio)} — {formatDate(reporte.fecha_fin)}
                      </span>
                    </button>
                  </td>
                  <td>{reporte.generado_por_nombre || "—"}</td>
                  <td className="is-num">{formatNumber(reporte.total_asignadas)}</td>
                  <td className="is-num">{formatNumber(reporte.total_entregadas)}</td>
                  <td className="is-num">{formatNumber(reporte.total_pendientes)}</td>
                  <td className="is-num">{formatPercent(reporte.efectividad)}</td>
                  <td>{reporte.version_etiqueta}</td>
                  <td>
                    <span className={`cl-status ${estadoClass(reporte.estado)}`}>
                      <i />
                      {estadoReporteLabel(reporte.estado)}
                    </span>
                  </td>
                  <td className="ent-acciones-celda">
                    <button type="button" className="cl-icon-button" onClick={() => abrirHistorico(reporte)} aria-label="Ver">
                      <Icon name="search" />
                    </button>
                    {permissions.can_correct_report && reporte.estado !== "ANULADO" ? (
                      <button type="button" className="cl-secondary ent-boton-mini" onClick={() => corregir(reporte)}>
                        Generar corrección
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
