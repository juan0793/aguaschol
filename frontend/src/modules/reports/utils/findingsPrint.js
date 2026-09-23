import { MAP_POINT_TYPES } from "../../../constants/formsAndUi.js";

// Listados imprimibles de los hallazgos: para Comercialización (alcantarillado
// sin facturar) y para cobro (predios con mora). Carta horizontal.

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const lempiras = (value) => `L ${Number(value || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const TIPO = Object.fromEntries(MAP_POINT_TYPES.map(({ value, label }) => [value, label]));

// printDocument arma la página en modo quirks: la tabla lleva su propia fuente.
export const FINDINGS_PRINT_STYLES = `<style>
  .fp { color: #111; font: 10px/1.35 Arial, Helvetica, sans-serif; }
  .fp-brand { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 7px; border-bottom: 2px solid #102a43; }
  .fp-brand strong { display: block; font-size: 14px; }
  .fp-brand small { color: #52606d; font-size: 9.5px; }
  .fp-brand .fp-right { text-align: right; }
  .fp-sum { margin: 8px 0; padding: 6px 8px; border: 1px solid #cbd5df; background: #f5f8fb; }
  .fp table { width: 100%; border-collapse: collapse; font: 10px/1.35 Arial, Helvetica, sans-serif; }
  .fp th, .fp td { padding: 4px 5px; border: 1px solid #cbd5df; text-align: left; vertical-align: top; font-size: 10px; }
  .fp th { background: #edf3f8; font-size: 8.5px; text-transform: uppercase; letter-spacing: .04em; }
  .fp thead { display: table-header-group; }
  .fp tr { break-inside: avoid; }
  .fp .num { text-align: right; white-space: nowrap; }
  .fp .clave { font-weight: 700; white-space: nowrap; }
  .fp .chk span { display: block; width: 11px; height: 11px; margin: 1px auto; border: 1.2px solid #334e68; }
  .fp-sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 26px; margin-top: 26px; }
  .fp-sign div { padding-top: 5px; border-top: 1px solid #334e68; color: #52606d; text-align: center; }
  .fp-key-report { border-top: 5px solid #1769e0; }
  .fp-key-heading { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; padding: 12px 0 8px; border-bottom: 1px solid #cbd5df; }
  .fp-key-heading h1 { margin: 2px 0; color: #102a43; font-size: 19px; }
  .fp-key-heading p, .fp-key-heading small { margin: 0; color: #52606d; }
  .fp-key-heading .fp-right { text-align: right; }
  .fp-key-kicker { color: #1769e0 !important; font-size: 8px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  .fp-key-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0; }
  .fp-key-metrics > div { display: grid; gap: 2px; padding: 7px 9px; border: 1px solid #d7e4ee; border-left: 3px solid #1769e0; background: #f5f9fd; }
  .fp-key-metrics small { color: #52606d; font-size: 8px; text-transform: uppercase; letter-spacing: .05em; }
  .fp-key-metrics strong { color: #102a43; font-size: 13px; }
  .fp-key-report table { font-size: 9px; }
  .fp-key-report th { background: #eaf2fe; color: #163d5c; }
  .fp-key-report tr:nth-child(even) td { background: #f8fbfe; }
  .fp-key-report .fp-key-id { color: #1769e0; font-weight: 700; white-space: nowrap; }
  .fp-key-report .fp-coords { white-space: nowrap; font-variant-numeric: tabular-nums; }
  .fp-key-report .fp-note { max-width: 270px; }
  .fp-key-report .fp-date { white-space: nowrap; }
  @media print { .fp-key-report, .fp-key-report * { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>`;

/**
 * items: predios de una categoría (con cuentas).
 * opciones: { tipo: "facturacion" | "cobro", periodo, total }
 */
export const buildFindingsPrint = (items = [], { tipo = "facturacion", periodo = "", total = null } = {}, now = new Date()) => {
  if (tipo === "sin_clave") {
    const zonas = new Set(items.map((item) => item.barrio).filter((value) => value && !["Sin barrio", "Sin barrio identificado"].includes(value)));
    const coordenados = items.filter((item) => item.latitude != null && item.longitude != null).length;
    const filas = items.map((item, index) => {
      const coords = item.latitude != null && item.longitude != null
        ? `${Number(item.latitude).toFixed(6)}, ${Number(item.longitude).toFixed(6)}`
        : "Sin coordenadas";
      return `<tr><td class="num">${index + 1}</td><td class="fp-key-id">#${escapeHtml(item.id)}</td><td>${escapeHtml(TIPO[item.point_type] || item.point_type || "--")}</td><td>${escapeHtml(item.barrio || "Sin barrio identificado")}</td><td class="fp-date">${escapeHtml(item.diary_date || "Sin fecha")}</td><td class="fp-note">${escapeHtml(item.reference || "--")}</td><td>${escapeHtml(item.description || "--")}</td><td class="fp-coords">${escapeHtml(coords)}</td></tr>`;
    }).join("");
    return `<article class="fp fp-key-report">
      <header class="fp-brand"><div><strong>AGUAS DE CHOLUTECA</strong><small>Departamento de Comercialización · Control territorial GPS</small></div><div class="fp-right"><small>Reporte de calidad del levantamiento</small></div></header>
      <div class="fp-key-heading"><div><p class="fp-key-kicker">Hallazgos de campo</p><h1>Puntos GPS sin clave catastral</h1><p>Registros que requieren revisar referencia, descripción o ubicación.</p></div><div class="fp-right"><strong>${escapeHtml(periodo)}</strong><br /><small>Impreso el ${escapeHtml(now.toLocaleString("es-HN", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" }))}</small></div></div>
      <section class="fp-key-metrics"><div><small>Puntos por revisar</small><strong>${items.length.toLocaleString("es-HN")}</strong></div><div><small>Con coordenadas</small><strong>${coordenados.toLocaleString("es-HN")}</strong></div><div><small>Barrios identificados</small><strong>${zonas.size.toLocaleString("es-HN")}</strong></div></section>
      <table><thead><tr><th>#</th><th>Punto GPS</th><th>Tipo de registro</th><th>Barrio / sector</th><th>Fecha</th><th>Referencia</th><th>Descripción</th><th>Coordenadas</th></tr></thead><tbody>${filas || '<tr><td colspan="8">No hay puntos para este periodo.</td></tr>'}</tbody></table>
      <div class="fp-sign"><div>Revisado por</div><div>Responsable de corregir</div><div>Fecha</div></div>
    </article>`;
  }

  const cobro = tipo === "cobro";
  const filas = [];
  let n = 0;
  items.forEach((item) => {
    // En cobro solo van las cuentas que deben; en facturación, todas las del predio.
    const cuentas = cobro ? item.cuentas.filter((cuenta) => Number(cuenta.deuda) > 0) : item.cuentas;
    cuentas.forEach((cuenta, index) => {
      n += 1;
      filas.push(`<tr><td class="num">${n}</td><td class="clave">${escapeHtml(cuenta.clave || item.clave)}</td><td>${escapeHtml(cuenta.abonado)}</td><td>${escapeHtml(cuenta.nombre)}</td><td>${escapeHtml(item.barrio)}</td>${cobro
        ? `<td class="num">${lempiras(cuenta.deuda)}</td>`
        : `<td>${cuenta.agua ? "Agua potable" : "Sin agua"}</td><td>${index === 0 ? escapeHtml(item.puntos.map((id) => `#${id}`).join(" ")) : ""}</td>`}<td class="chk"><span></span></td><td></td></tr>`);
    });
  });
  const titulo = cobro ? "Listado de cobro · predios levantados con mora" : "Alcantarillado sin facturar · predios con caja de aguas negras";
  const resumen = cobro
    ? `${items.length} predios · ${n} cuentas · mora total ${lempiras(total)}`
    : `${items.length} predios · ${n} cuentas que no pagan alcantarillado aunque en campo se levantó caja de registro o descarga`;
  return `<article class="fp">
    <header class="fp-brand"><div><strong>AGUAS DE CHOLUTECA</strong><small>Departamento de Comercialización · Hallazgos del levantamiento GPS</small></div><div class="fp-right"><strong>${titulo}</strong><small>${escapeHtml(periodo)} · impreso el ${escapeHtml(now.toLocaleString("es-HN", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" }))}</small></div></header>
    <p class="fp-sum"><strong>${escapeHtml(resumen)}</strong></p>
    <table><thead><tr><th>#</th><th>Clave</th><th>Abonado</th><th>Nombre</th><th>Barrio</th>${cobro ? "<th>Mora</th>" : "<th>Servicio actual</th><th>Puntos GPS</th>"}<th>${cobro ? "Gestionado" : "Revisado"}</th><th>Observación</th></tr></thead>
    <tbody>${filas.join("")}</tbody></table>
    <div class="fp-sign"><div>Elaborado por</div><div>Revisado por</div><div>Fecha</div></div>
  </article>`;
};
