import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../../components/Icon";
import { printDocument } from "../../../utils/printDocument";
import { escapeHtml } from "../../../utils/html";
import { estadoLabel, formatDate, formatDateTime, printStatusLabel } from "../utils/inspeccionesFormatters";

const safe = (value) => escapeHtml(value);

const PRINT_STYLES = `<style>
  .ins-print-page { color: #111; font: 11px/1.35 Arial, sans-serif; }
  .ins-print-brand { display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 2px solid #102a43; }
  .ins-print-page h3 { margin: 16px 0; font-size: 18px; text-transform: uppercase; }
  .ins-print-section { margin-bottom: 12px; padding: 10px; border: 1px solid #ccd6df; }
  .ins-print-section h4 { margin: 0 0 8px; font-size: 11px; text-transform: uppercase; color: #52606d; }
  .ins-print-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .ins-print-grid p { margin: 0; display: grid; padding: 6px; border-bottom: 1px solid #e4edf5; }
  .ins-print-grid span { color: #52606d; font-size: 9px; text-transform: uppercase; }
  .ins-print-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  .ins-print-table th, .ins-print-table td { padding: 6px; border: 1px solid #cbd5df; text-align: left; font-size: 10px; }
  .ins-print-signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 30px; text-align: center; }
  .ins-print-signatures div { border-top: 1px solid #333; padding-top: 6px; }
  .ins-print-notes-space { min-height: 60px; border: 1px solid #ccd6df; margin-top: 6px; }
  .ins-print-page footer { margin-top: 20px; color: #52606d; text-align: center; }
</style>`;

const buildOrdenBody = (inspeccion, opciones) => `
  <article class="ins-print-page">
    <div class="ins-print-brand"><strong>CONTROL AGUAS</strong><span>ORDEN DE INSPECCIÓN<br/>${safe(inspeccion.numero_inspeccion)}</span></div>
    <div class="ins-print-grid">
      <p><span>Fecha asignación</span><strong>${safe(formatDate(inspeccion.fecha_asignacion))}</strong></p>
      <p><span>Estado</span><strong>${safe(estadoLabel(inspeccion.estado))}</strong></p>
      <p><span>Clave catastral</span><strong>${safe(inspeccion.clave_catastral)}</strong></p>
      <p><span>Barrio</span><strong>${safe(inspeccion.barrio_snapshot || "—")}</strong></p>
      <p><span>Abonado</span><strong>${safe(inspeccion.abonado_nombre_snapshot || "General")}</strong></p>
      <p><span>Cuenta</span><strong>${safe(inspeccion.abonado_numero || "—")}</strong></p>
    </div>
    <div class="ins-print-section"><h4>Motivo</h4><p>${safe(inspeccion.motivo)}</p></div>
    <div class="ins-print-section"><h4>Trabajo solicitado</h4><p>${safe(inspeccion.trabajo_solicitado)}</p></div>
    <div class="ins-print-section">
      <h4>Personal asignado</h4>
      <p>Responsable: ${safe(inspeccion.participantes.find((item) => item.rol === "RESPONSABLE")?.tecnico_nombre || "—")}</p>
      <p>Apoyo: ${safe(inspeccion.participantes.filter((item) => item.rol === "APOYO").map((item) => item.tecnico_nombre).join(", ") || "Sin apoyo asignado")}</p>
    </div>
    ${opciones.mostrarAbonados && inspeccion.abonados_asociados?.length > 1 ? `
    <div class="ins-print-section">
      <h4>Abonados asociados a la clave</h4>
      <table class="ins-print-table"><thead><tr><th>Cuenta</th><th>Nombre</th></tr></thead><tbody>
        ${inspeccion.abonados_asociados.map((item) => `<tr><td>${safe(item.abonado)}</td><td>${safe(item.nombre)}</td></tr>`).join("")}
      </tbody></table>
    </div>` : ""}
    <div class="ins-print-section"><h4>Espacio para anotación de campo</h4><div class="ins-print-notes-space"></div></div>
    ${opciones.mostrarFirmas ? `<div class="ins-print-signatures"><div>Firma técnico</div><div>Firma quien atendió</div><div>Vo.Bo. supervisor</div></div>` : ""}
    <footer>Documento generado desde Control Aguas · ${new Date().toLocaleDateString("es-HN")}</footer>
  </article>`;

const buildReporteBody = (inspeccion, gps, opciones) => `
  <article class="ins-print-page">
    <div class="ins-print-brand"><strong>CONTROL AGUAS</strong><span>REPORTE DE INSPECCIÓN<br/>${safe(inspeccion.numero_inspeccion)}</span></div>
    <div class="ins-print-grid">
      <p><span>Clave catastral</span><strong>${safe(inspeccion.clave_catastral)}</strong></p>
      <p><span>Abonado</span><strong>${safe(inspeccion.abonado_nombre_snapshot || "General")}</strong></p>
      <p><span>Barrio</span><strong>${safe(inspeccion.barrio_snapshot || "—")}</strong></p>
      <p><span>Estado</span><strong>${safe(estadoLabel(inspeccion.estado))}</strong></p>
    </div>
    <div class="ins-print-section"><h4>Trabajo solicitado</h4><p>${safe(inspeccion.trabajo_solicitado)}</p></div>
    <div class="ins-print-section"><h4>Información encontrada</h4><p>${safe(inspeccion.informacion_encontrada || "Sin información registrada.")}</p></div>
    ${inspeccion.observaciones ? `<div class="ins-print-section"><h4>Observaciones</h4><p>${safe(inspeccion.observaciones)}</p></div>` : ""}
    ${opciones.mostrarGps ? `
    <div class="ins-print-section">
      <h4>Ubicación / GPS</h4>
      ${gps.length ? `<table class="ins-print-table"><thead><tr><th>Tipo</th><th>Coordenadas</th><th>Precisión</th><th>Registrado por</th><th>Fecha</th></tr></thead><tbody>
        ${gps.map((punto) => `<tr><td>${safe(punto.tipo_punto)}</td><td>${Number(punto.latitude).toFixed(6)}, ${Number(punto.longitude).toFixed(6)}</td><td>±${punto.accuracy_meters ? Math.round(punto.accuracy_meters) : "?"} m</td><td>${safe(punto.usuario_nombre || "—")}</td><td>${safe(formatDateTime(punto.created_at))}</td></tr>`).join("")}
      </tbody></table>` : "<p>Sin puntos GPS registrados.</p>"}
    </div>` : ""}
    <div class="ins-print-section">
      <h4>Personal participante</h4>
      <p>Responsable: ${safe(inspeccion.participantes.find((item) => item.rol === "RESPONSABLE")?.tecnico_nombre || "—")}</p>
      <p>Apoyo: ${safe(inspeccion.participantes.filter((item) => item.rol === "APOYO").map((item) => item.tecnico_nombre).join(", ") || "Sin apoyo asignado")}</p>
    </div>
    <div class="ins-print-section">
      <h4>Seguimiento</h4>
      <p>Requiere seguimiento: ${inspeccion.requiere_seguimiento ? "Sí" : "No"}</p>
      ${inspeccion.requiere_seguimiento ? `<p>Detalle: ${safe(inspeccion.seguimiento_detalle || "—")}</p>` : ""}
    </div>
    <div class="ins-print-section">
      <h4>Cierre</h4>
      <p>Estado final: ${safe(estadoLabel(inspeccion.estado))}</p>
      <p>Finalizada por: ${safe(inspeccion.finalizada_por_nombre || "—")}</p>
      <p>Fecha/hora: ${safe(formatDateTime(inspeccion.fecha_finalizacion))}</p>
    </div>
    ${opciones.mostrarFirmas ? `<div class="ins-print-signatures"><div>Firma técnico</div><div>Firma quien atendió</div><div>Vo.Bo. supervisor</div></div>` : ""}
    <footer>Documento generado desde Control Aguas · ${new Date().toLocaleDateString("es-HN")}</footer>
  </article>`;

export default function InspeccionPrintPreview({ api, inspeccion, gpsPuntos = [], tipoInicial = "orden", onClose, notify }) {
  const [tipo, setTipo] = useState(tipoInicial);
  const [pageSize, setPageSize] = useState("Letter portrait");
  const [mostrarAbonados, setMostrarAbonados] = useState(true);
  const [mostrarGps, setMostrarGps] = useState(true);
  const [mostrarFirmas, setMostrarFirmas] = useState(true);
  const pageRef = useRef(null);

  const printStatus = tipo === "orden" ? inspeccion.print_status?.ORDEN : inspeccion.print_status?.REPORTE;
  const opciones = useMemo(() => ({ mostrarAbonados, mostrarGps, mostrarFirmas }), [mostrarAbonados, mostrarGps, mostrarFirmas]);
  const bodyHtml = useMemo(
    () => (tipo === "orden" ? buildOrdenBody(inspeccion, opciones) : buildReporteBody(inspeccion, gpsPuntos, opciones)),
    [tipo, inspeccion, gpsPuntos, opciones]
  );

  useEffect(() => {
    api.printEvent(inspeccion.id, tipo, "PDF_GENERADO").catch(() => {});
  }, [api, inspeccion.id, tipo]);

  const imprimir = async () => {
    const result = await printDocument(tipo === "orden" ? "Orden de inspección" : "Reporte de inspección", `${PRINT_STYLES}${bodyHtml}`, {
      pageSize,
      pageMargin: "12mm"
    });
    if (!result?.printed) return;
    try {
      await api.printEvent(inspeccion.id, tipo, "IMPRESO");
      notify("Impresión registrada.");
    } catch (error) {
      notify(error.message);
    }
  };

  return (
    <div className="cl-drawer-backdrop" role="dialog" aria-modal="true" aria-label="Impresión de inspección">
      <div className="cl-drawer ins-print-drawer">
        <header>
          <div>
            <span className="cl-kicker">{inspeccion.numero_inspeccion}</span>
            <h2>Impresión de inspección</h2>
          </div>
          <button type="button" className="cl-icon-button" onClick={onClose} aria-label="Cerrar"><Icon name="logout" /></button>
        </header>
        <div className="cl-drawer-scroll">
          <div className="ins-print-controls">
            <div className="cl-module-header nav" style={{ display: "flex", gap: 4 }}>
              <button type="button" className={tipo === "orden" ? "is-active" : ""} onClick={() => setTipo("orden")}>Orden de inspección</button>
              <button type="button" className={tipo === "reporte" ? "is-active" : ""} onClick={() => setTipo("reporte")}>Reporte de inspección</button>
            </div>
            <div className="ins-print-toggles">
              <label><input type="radio" name="pageSize" checked={pageSize === "Letter portrait"} onChange={() => setPageSize("Letter portrait")} /> Carta</label>
              <label><input type="radio" name="pageSize" checked={pageSize === "A4 portrait"} onChange={() => setPageSize("A4 portrait")} /> A4</label>
              {tipo === "orden" ? <label><input type="checkbox" checked={mostrarAbonados} onChange={(event) => setMostrarAbonados(event.target.checked)} /> Mostrar abonados asociados</label> : null}
              {tipo === "reporte" ? <label><input type="checkbox" checked={mostrarGps} onChange={(event) => setMostrarGps(event.target.checked)} /> Mostrar GPS</label> : null}
              <label><input type="checkbox" checked={mostrarFirmas} onChange={(event) => setMostrarFirmas(event.target.checked)} /> Mostrar firmas</label>
            </div>
            <p className={`cl-print-state ${printStatus?.impreso ? "is-printed" : ""}`}>
              {tipo === "orden" ? "Orden de inspección" : "Reporte de inspección"}: {printStatusLabel(printStatus)}
              {printStatus?.impreso ? ` · Primera impresión: ${formatDateTime(printStatus.primera_impresion)}` : ""}
            </p>
          </div>
          <div className="cl-print-pages" ref={pageRef} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        </div>
        <footer>
          <div className="cl-drawer-main-actions">
            <button type="button" className="cl-secondary" onClick={onClose}>Cerrar</button>
            <button type="button" className="cl-primary" onClick={imprimir}>
              <Icon name="print" />
              {printStatus?.impreso ? "Reimprimir / Descargar PDF" : "Imprimir / Descargar PDF"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
