// Listados imprimibles de los hallazgos: para Comercialización (alcantarillado
// sin facturar) y para cobro (predios con mora). Carta horizontal.

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const lempiras = (value) => `L ${Number(value || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
</style>`;

/**
 * items: predios de una categoría (con cuentas).
 * opciones: { tipo: "facturacion" | "cobro", periodo, total }
 */
export const buildFindingsPrint = (items = [], { tipo = "facturacion", periodo = "", total = null } = {}, now = new Date()) => {
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
