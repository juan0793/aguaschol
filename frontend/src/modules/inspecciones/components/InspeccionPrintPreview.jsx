import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import logoAguas from "../../../assets/logo-aguas-choluteca.png";
import { printDocument } from "../../../utils/printDocument";
import { escapeHtml } from "../../../utils/html";
import { estadoLabel, formatDate, formatDateTime, printStatusLabel } from "../utils/inspeccionesFormatters";
import { polishInspectionText } from "../utils/inspectionPrintText";
import InspeccionPrintMapCapture from "./InspeccionPrintMapCapture";

const safe = (value) => escapeHtml(value);
const pointLabel = (value) => ({ inicio: "Inicio", observado: "Observado", derivacion: "Derivación", cierre: "Cierre" }[value] || value || "Punto GPS");

const PRINT_STYLES = `<style>
  .ins-print-page { box-sizing:border-box; width:100%; max-width:190mm; margin:0 auto; padding:10mm; background:#fff; color:#17324a; font:10.5px/1.45 Arial,sans-serif; }
  .ins-print-page * { box-sizing:border-box; }
  .ins-doc-header { display:grid; grid-template-columns:54px minmax(0,1fr) auto; gap:12px; align-items:center; padding-bottom:12px; border-bottom:3px solid #0d4d86; }
  .ins-doc-logo { width:50px; height:50px; object-fit:contain; }
  .ins-doc-org { margin:0 0 2px; color:#526b80; font-size:8px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
  .ins-doc-header h1 { margin:0; color:#103a5d; font-size:19px; line-height:1.1; }
  .ins-doc-number { display:block; margin-top:4px; color:#1576d1; font-size:10px; font-weight:800; letter-spacing:.06em; }
  .ins-doc-status { padding:6px 10px; border:1px solid #b8dcca; border-radius:999px; background:#edf9f3; color:#147348; font-size:8px; font-weight:800; text-transform:uppercase; }
  .ins-meta-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:7px; margin:12px 0; }
  .ins-meta-item { min-height:45px; padding:7px 9px; border:1px solid #d9e5ee; border-radius:7px; background:#f8fbfd; }
  .ins-meta-item span { display:block; margin-bottom:2px; color:#6b8194; font-size:7.5px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; }
  .ins-meta-item strong { display:block; overflow-wrap:anywhere; color:#173b58; font-size:10px; }
  .ins-section { margin-top:10px; padding:10px 11px; border:1px solid #d5e2ec; border-radius:8px; break-inside:avoid; page-break-inside:avoid; }
  .ins-section-title { display:flex; align-items:flex-end; justify-content:space-between; gap:8px; margin:0 0 7px; padding-bottom:5px; border-bottom:1px solid #dce7ef; }
  .ins-section-title h2 { margin:0; color:#164568; font-size:11px; letter-spacing:.04em; text-transform:uppercase; }
  .ins-section-title small { color:#708599; font-size:8px; }
  .ins-prose { margin:0; color:#243f56; font-size:11px; line-height:1.6; white-space:pre-line; }
  .ins-findings { border-left:5px solid #1576d1; background:#f1f7fd; }
  .ins-findings .ins-prose { color:#102f49; font-size:12.5px; line-height:1.65; font-weight:600; }
  .ins-observations { background:#fffaf0; border-color:#efdcae; }
  .ins-map-image { display:block; width:100%; height:62mm; object-fit:cover; border:1px solid #b9cedf; border-radius:7px; }
  .ins-map-empty { display:grid; min-height:75px; place-items:center; border:1px dashed #b9cedf; border-radius:7px; color:#6b8194; background:#f5f8fb; }
  .ins-map-legend { display:flex; flex-wrap:wrap; gap:9px; margin:7px 0 2px; color:#536d82; font-size:8px; }
  .ins-map-legend span::before { content:""; display:inline-block; width:7px; height:7px; margin-right:4px; border-radius:50%; background:var(--dot); }
  .ins-table { width:100%; margin-top:7px; border-collapse:collapse; table-layout:fixed; }
  .ins-table th { padding:5px 6px; border:1px solid #cbdbe7; background:#eaf2f8; color:#34566f; font-size:7.5px; text-align:left; text-transform:uppercase; }
  .ins-table td { padding:5px 6px; border:1px solid #d7e3ec; color:#2c465c; font-size:8.5px; vertical-align:top; overflow-wrap:anywhere; }
  .ins-table td strong,.ins-table td small { display:block; }
  .ins-table td small { margin-top:2px; color:#718699; }
  .ins-two-column { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
  .ins-followup { border-left:4px solid #e5a72f; background:#fffaf0; }
  .ins-close { border-left:4px solid #198754; background:#f2faf6; }
  .ins-key-value { display:grid; grid-template-columns:110px 1fr; gap:4px 8px; margin:0; }
  .ins-key-value dt { color:#6a8093; font-size:8px; }
  .ins-key-value dd { margin:0; color:#203e56; font-weight:700; }
  .ins-signatures { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; margin-top:18px; padding-top:12px; break-inside:avoid; }
  .ins-signatures div { padding-top:6px; border-top:1px solid #45657c; color:#516b7f; font-size:8px; text-align:center; }
  .ins-doc-footer { display:flex; justify-content:space-between; gap:12px; margin-top:18px; padding-top:7px; border-top:1px solid #d6e2eb; color:#718599; font-size:7.5px; }
  .ins-notes-space { min-height:80px; border:1px dashed #bfcfdb; border-radius:6px; background:repeating-linear-gradient(#fff,#fff 23px,#e6edf3 24px); }
  @media (max-width:700px) { .ins-print-page{padding:18px}.ins-meta-grid{grid-template-columns:1fr 1fr}.ins-two-column{grid-template-columns:1fr}.ins-map-image{height:auto;aspect-ratio:16/10} }
  @media print { .ins-print-page{max-width:none;padding:0}.ins-section{break-inside:avoid}.ins-map-section{break-before:page;page-break-before:always}.ins-map-image{height:66mm} }
</style>`;

const header = (inspeccion, title) => `
  <header class="ins-doc-header">
    <img class="ins-doc-logo" src="${logoAguas}" alt="Aguas de Choluteca" />
    <div><p class="ins-doc-org">Servicio Autónomo Nacional de Acueductos y Alcantarillados</p><h1>${title}</h1><span class="ins-doc-number">${safe(inspeccion.numero_inspeccion)}</span></div>
    <span class="ins-doc-status">${safe(estadoLabel(inspeccion.estado))}</span>
  </header>`;

const metadata = (inspeccion) => `
  <section class="ins-meta-grid">
    <div class="ins-meta-item"><span>Clave catastral</span><strong>${safe(inspeccion.clave_catastral)}</strong></div>
    <div class="ins-meta-item"><span>Abonado</span><strong>${safe(inspeccion.abonado_nombre_snapshot || "Inspección general")}</strong></div>
    <div class="ins-meta-item"><span>Cuenta</span><strong>${safe(inspeccion.abonado_numero || "No aplica")}</strong></div>
    <div class="ins-meta-item"><span>Barrio o colonia</span><strong>${safe(inspeccion.barrio_snapshot || "No especificado")}</strong></div>
    <div class="ins-meta-item"><span>Fecha de asignación</span><strong>${safe(formatDate(inspeccion.fecha_asignacion))}</strong></div>
    <div class="ins-meta-item"><span>Motivo</span><strong>${safe(inspeccion.motivo)}</strong></div>
  </section>`;

const staff = (inspeccion) => {
  const responsable = inspeccion.participantes.find((item) => item.rol === "RESPONSABLE")?.tecnico_nombre || "No especificado";
  const apoyo = inspeccion.participantes.filter((item) => item.rol === "APOYO").map((item) => item.tecnico_nombre).join(", ") || "Sin apoyo asignado";
  return `<dl class="ins-key-value"><dt>Técnico responsable</dt><dd>${safe(responsable)}</dd><dt>Personal de apoyo</dt><dd>${safe(apoyo)}</dd></dl>`;
};

const footer = (inspeccion) => `<footer class="ins-doc-footer"><span>Control Aguas - Documento oficial de inspección</span><span>${safe(inspeccion.numero_inspeccion)} - Generado ${safe(new Date().toLocaleDateString("es-HN"))}</span></footer>`;

const buildOrdenBody = (inspeccion, opciones) => `
  <article class="ins-print-page">
    ${header(inspeccion, "Orden de inspección")}${metadata(inspeccion)}
    <section class="ins-section"><div class="ins-section-title"><h2>Trabajo solicitado</h2><small>Instrucción para trabajo de campo</small></div><p class="ins-prose">${safe(opciones.trabajo)}</p></section>
    <section class="ins-section"><div class="ins-section-title"><h2>Personal asignado</h2></div>${staff(inspeccion)}</section>
    ${opciones.mostrarAbonados && inspeccion.abonados_asociados?.length > 1 ? `<section class="ins-section"><div class="ins-section-title"><h2>Abonados asociados a la clave</h2><small>${inspeccion.abonados_asociados.length} cuentas</small></div><table class="ins-table"><thead><tr><th style="width:28%">Cuenta</th><th>Nombre</th></tr></thead><tbody>${inspeccion.abonados_asociados.map((item) => `<tr><td>${safe(item.abonado)}</td><td>${safe(item.nombre)}</td></tr>`).join("")}</tbody></table></section>` : ""}
    <section class="ins-section"><div class="ins-section-title"><h2>Anotaciones de campo</h2></div><div class="ins-notes-space"></div></section>
    ${opciones.mostrarFirmas ? `<div class="ins-signatures"><div>Firma del técnico responsable</div><div>Firma de quien atendió</div><div>Vo. Bo. de supervisión</div></div>` : ""}
    ${footer(inspeccion)}
  </article>`;

const gpsSection = (gps, mapImage) => `
  <section class="ins-section ins-map-section"><div class="ins-section-title"><h2>Evidencia geográfica</h2><small>${gps.length} puntos registrados</small></div>
    ${mapImage ? `<img class="ins-map-image" src="${mapImage}" alt="Mapa de la inspección" />` : `<div class="ins-map-empty">Mapa no disponible</div>`}
    <div class="ins-map-legend"><span style="--dot:#0d6efd">Inicio</span><span style="--dot:#7c3aed">Observado</span><span style="--dot:#dc3545">Derivación</span><span style="--dot:#198754">Cierre</span></div>
    ${gps.length ? `<table class="ins-table"><thead><tr><th style="width:6%">#</th><th style="width:25%">Punto y descripción</th><th style="width:25%">Coordenadas</th><th style="width:12%">Precisión</th><th>Registro</th></tr></thead><tbody>${gps.map((point, index) => `<tr><td><strong>${index + 1}</strong></td><td><strong>${safe(pointLabel(point.tipo_punto))}</strong><small>${safe(point.descripcion || "Sin descripción")}</small></td><td>${Number(point.latitude).toFixed(6)}, ${Number(point.longitude).toFixed(6)}</td><td>±${point.accuracy_meters ? Math.round(point.accuracy_meters) : "?"} m</td><td><strong>${safe(point.usuario_nombre || "No especificado")}</strong><small>${safe(formatDateTime(point.created_at))}</small></td></tr>`).join("")}</tbody></table>` : ""}
  </section>`;

const buildReporteBody = (inspeccion, gps, opciones) => `
  <article class="ins-print-page">
    ${header(inspeccion, "Reporte técnico de inspección")}${metadata(inspeccion)}
    <section class="ins-section"><div class="ins-section-title"><h2>Trabajo solicitado</h2><small>Antecedente de la visita</small></div><p class="ins-prose">${safe(opciones.trabajo)}</p></section>
    <section class="ins-section ins-findings"><div class="ins-section-title"><h2>Hallazgos del técnico</h2><small>Resultado principal de la inspección</small></div><p class="ins-prose">${safe(opciones.informacion || "No se registraron hallazgos.")}</p></section>
    ${opciones.observaciones ? `<section class="ins-section ins-observations"><div class="ins-section-title"><h2>Observaciones</h2></div><p class="ins-prose">${safe(opciones.observaciones)}</p></section>` : ""}
    ${opciones.mostrarGps ? gpsSection(gps, opciones.mapImage) : ""}
    <div class="ins-two-column">
      <section class="ins-section ins-followup"><div class="ins-section-title"><h2>Seguimiento</h2></div><dl class="ins-key-value"><dt>Requiere seguimiento</dt><dd>${inspeccion.requiere_seguimiento ? "Sí" : "No"}</dd>${inspeccion.requiere_seguimiento ? `<dt>Detalle</dt><dd>${safe(opciones.seguimiento || "No especificado")}</dd><dt>Fecha sugerida</dt><dd>${safe(inspeccion.seguimiento_fecha_sugerida || "No definida")}</dd>` : ""}</dl></section>
      <section class="ins-section ins-close"><div class="ins-section-title"><h2>Cierre</h2></div><dl class="ins-key-value"><dt>Estado final</dt><dd>${safe(estadoLabel(inspeccion.estado))}</dd><dt>Finalizada por</dt><dd>${safe(inspeccion.finalizada_por_nombre || "No especificado")}</dd><dt>Fecha y hora</dt><dd>${safe(formatDateTime(inspeccion.fecha_finalizacion))}</dd></dl></section>
    </div>
    <section class="ins-section"><div class="ins-section-title"><h2>Personal participante</h2></div>${staff(inspeccion)}</section>
    ${opciones.mostrarFirmas ? `<div class="ins-signatures"><div>Firma del técnico responsable</div><div>Firma de quien atendió</div><div>Vo. Bo. de supervisión</div></div>` : ""}
    ${footer(inspeccion)}
  </article>`;

export default function InspeccionPrintPreview({ api, inspeccion, gpsPuntos = [], tipoInicial = "orden", onClose, notify }) {
  const [tipo, setTipo] = useState(tipoInicial);
  const [pageSize, setPageSize] = useState("Letter portrait");
  const [mostrarAbonados, setMostrarAbonados] = useState(true);
  const [mostrarGps, setMostrarGps] = useState(true);
  const [mostrarFirmas, setMostrarFirmas] = useState(true);
  const [mapImage, setMapImage] = useState("");
  const [trabajo, setTrabajo] = useState(() => polishInspectionText(inspeccion.trabajo_solicitado));
  const [informacion, setInformacion] = useState(() => polishInspectionText(inspeccion.informacion_encontrada));
  const [observaciones, setObservaciones] = useState(() => polishInspectionText(inspeccion.observaciones));
  const [seguimiento, setSeguimiento] = useState(() => polishInspectionText(inspeccion.seguimiento_detalle));

  useEffect(() => {
    setTrabajo(polishInspectionText(inspeccion.trabajo_solicitado));
    setInformacion(polishInspectionText(inspeccion.informacion_encontrada));
    setObservaciones(polishInspectionText(inspeccion.observaciones));
    setSeguimiento(polishInspectionText(inspeccion.seguimiento_detalle));
  }, [inspeccion.id, inspeccion.informacion_encontrada, inspeccion.observaciones, inspeccion.seguimiento_detalle, inspeccion.trabajo_solicitado]);

  const printStatus = tipo === "orden" ? inspeccion.print_status?.ORDEN : inspeccion.print_status?.REPORTE;
  const opciones = useMemo(() => ({ mostrarAbonados, mostrarGps, mostrarFirmas, mapImage, trabajo, informacion, observaciones, seguimiento }), [mostrarAbonados, mostrarGps, mostrarFirmas, mapImage, trabajo, informacion, observaciones, seguimiento]);
  const bodyHtml = useMemo(() => (tipo === "orden" ? buildOrdenBody(inspeccion, opciones) : buildReporteBody(inspeccion, gpsPuntos, opciones)), [tipo, inspeccion, gpsPuntos, opciones]);
  const mapPending = tipo === "reporte" && mostrarGps && gpsPuntos.length > 0 && !mapImage;

  useEffect(() => { api.printEvent(inspeccion.id, tipo, "PDF_GENERADO").catch(() => {}); }, [api, inspeccion.id, tipo]);

  const imprimir = async () => {
    const result = await printDocument(tipo === "orden" ? "Orden de inspección" : "Reporte técnico de inspección", `${PRINT_STYLES}${bodyHtml}`, { pageSize, pageMargin: "8mm" });
    if (!result?.printed) return;
    try { await api.printEvent(inspeccion.id, tipo, "IMPRESO"); notify("Impresión registrada."); }
    catch (error) { notify(error.message); }
  };

  return (
    <div className="cl-drawer-backdrop" role="dialog" aria-modal="true" aria-label="Impresión de inspección">
      <InspeccionPrintMapCapture points={gpsPuntos} onCapture={setMapImage} />
      <div className="cl-drawer ins-print-drawer">
        <header><div><span className="cl-kicker">{inspeccion.numero_inspeccion}</span><h2>Impresión de inspección</h2></div><button type="button" className="cl-icon-button" onClick={onClose} aria-label="Cerrar"><Icon name="logout" /></button></header>
        <div className="cl-drawer-scroll">
          <div className="ins-print-controls">
            <div className="cl-module-header nav ins-print-tabs"><button type="button" className={tipo === "orden" ? "is-active" : ""} onClick={() => setTipo("orden")}>Orden de inspección</button><button type="button" className={tipo === "reporte" ? "is-active" : ""} onClick={() => setTipo("reporte")}>Reporte técnico</button></div>
            <div className="ins-print-toggles"><label><input type="radio" name="pageSize" checked={pageSize === "Letter portrait"} onChange={() => setPageSize("Letter portrait")} /> Carta</label><label><input type="radio" name="pageSize" checked={pageSize === "A4 portrait"} onChange={() => setPageSize("A4 portrait")} /> A4</label>{tipo === "orden" ? <label><input type="checkbox" checked={mostrarAbonados} onChange={(event) => setMostrarAbonados(event.target.checked)} /> Mostrar abonados</label> : <label><input type="checkbox" checked={mostrarGps} onChange={(event) => setMostrarGps(event.target.checked)} /> Mostrar mapa y GPS</label>}<label><input type="checkbox" checked={mostrarFirmas} onChange={(event) => setMostrarFirmas(event.target.checked)} /> Mostrar firmas</label></div>
            {tipo === "reporte" ? <details className="ins-print-editor"><summary>Revisar texto corregido para impresión</summary><p>La corrección es solo para este documento y no modifica el registro original.</p><label><span>Hallazgos del técnico</span><textarea rows="4" value={informacion} onChange={(event) => setInformacion(event.target.value)} /></label><label><span>Observaciones</span><textarea rows="2" value={observaciones} onChange={(event) => setObservaciones(event.target.value)} /></label>{inspeccion.requiere_seguimiento ? <label><span>Detalle del seguimiento</span><textarea rows="2" value={seguimiento} onChange={(event) => setSeguimiento(event.target.value)} /></label> : null}</details> : null}
            <p className={`cl-print-state ${printStatus?.impreso ? "is-printed" : ""}`}>{tipo === "orden" ? "Orden" : "Reporte"}: {printStatusLabel(printStatus)}{mapPending ? " · Preparando mapa…" : ""}</p>
          </div>
          <div className="cl-print-pages ins-print-preview" dangerouslySetInnerHTML={{ __html: `${PRINT_STYLES}${bodyHtml}` }} />
        </div>
        <footer><div className="cl-drawer-main-actions"><button type="button" className="cl-secondary" onClick={onClose}>Cerrar</button><button type="button" className="cl-primary" onClick={imprimir} disabled={mapPending}><Icon name="print" />{mapPending ? "Preparando mapa…" : printStatus?.impreso ? "Reimprimir / Descargar PDF" : "Imprimir / Descargar PDF"}</button></div></footer>
      </div>
    </div>
  );
}
