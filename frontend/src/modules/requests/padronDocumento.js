import logoAguasCholuteca from "../../assets/logo-aguas-choluteca.png";
import { escapeHtml } from "../../utils/html";
import { formatCurrency } from "../../utils/formatting";
import { formatDateTime } from "../../utils/datesAndBusiness";
import { printDocument } from "../../utils/printDocument";

// Documento impreso de Consultas del padrón. Todas las consultas salen con la misma
// hoja: encabezado con logo, la leyenda de información confidencial, cifras en una
// línea (solo si la consulta las lleva) y tablas de líneas finas. Se lee igual en
// blanco y negro y sin tarjetas ni fondos de color.

export const docCount = (value) => Number(value || 0).toLocaleString("es-HN");
export const docMoney = (value) => formatCurrency(Number(value) || 0);
export const docPct = (value) => `${Number(value || 0).toLocaleString("es-HN", { maximumFractionDigits: 1 })}%`;
export const docText = (value, empty = "--") => escapeHtml(String(value ?? "").trim() || empty);

const ESTILOS = `
  .pq-doc-body { background: #fff; }
  .pq-doc {
    --doc-tinta: #16242f;
    --doc-suave: #5b6b7a;
    --doc-azul: #0b3f73;
    --doc-borde: #c9d5e0;
    --doc-linea: #e3eaf1;
    --doc-fondo: #f2f6fa;
    display: grid;
    gap: 5mm;
    color: var(--doc-tinta);
    font-family: "Plus Jakarta Sans", "Segoe UI", Arial, sans-serif;
    font-size: 9.5px;
    line-height: 1.4;
  }
  .pq-doc p { margin: 0; }
  .pq-doc-cabeza { display: flex; align-items: flex-start; gap: 12px; padding-bottom: 8px; border-bottom: 2px solid var(--doc-azul); }
  .pq-doc-cabeza img { width: 42px; height: auto; }
  .pq-doc-titulo { flex: 1; min-width: 0; }
  .pq-doc-titulo span { display: block; color: var(--doc-suave); font-size: 8px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; }
  .pq-doc-titulo h1 { margin: 2px 0 1px; color: var(--doc-azul); font-size: 16px; font-weight: 750; line-height: 1.2; }
  .pq-doc-titulo p { color: var(--doc-suave); font-size: 9.5px; }
  .pq-doc-fecha { text-align: right; color: var(--doc-suave); font-size: 8.5px; white-space: nowrap; }
  .pq-doc-fecha b { display: block; color: var(--doc-tinta); font-size: 9.5px; font-weight: 700; }
  .pq-doc-confidencial { display: flex; align-items: baseline; gap: 8px; padding: 4px 8px; border: 1px solid var(--doc-tinta); font-size: 8.5px; }
  .pq-doc-confidencial strong { font-size: 8.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; }
  .pq-doc-confidencial span { color: var(--doc-suave); }
  .pq-doc-filtro { color: var(--doc-suave); font-size: 9px; }
  .pq-doc-filtro b { color: var(--doc-tinta); }
  .pq-doc-cifras { display: flex; flex-wrap: wrap; gap: 0; margin: 0; border-top: 1px solid var(--doc-linea); border-bottom: 1px solid var(--doc-linea); }
  .pq-doc-cifras div { flex: 1 1 0; min-width: 0; padding: 5px 10px; border-left: 1px solid var(--doc-linea); }
  .pq-doc-cifras div:first-child { border-left: 0; padding-left: 0; }
  .pq-doc-cifras dt { color: var(--doc-suave); font-size: 8px; }
  .pq-doc-cifras dd { margin: 0; font-size: 13px; font-weight: 750; font-variant-numeric: tabular-nums; }
  .pq-doc-seccion { display: grid; gap: 4px; }
  .pq-doc-seccion + .pq-doc-seccion { margin-top: 2mm; }
  .pq-doc-seccion h2 { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin: 0; padding-bottom: 3px; border-bottom: 1px solid var(--doc-borde); color: var(--doc-azul); font-size: 10.5px; font-weight: 750; }
  .pq-doc-seccion h2 small { color: var(--doc-suave); font-size: 8.5px; font-weight: 600; }
  .pq-doc-seccion.is-barrio { break-before: auto; }
  .pq-doc-seccion.is-salto { break-before: page; }
  /* El documento se imprime sin doctype (modo quirks): las tablas no heredan la letra. */
  .pq-doc table { width: 100%; border-collapse: collapse; font-size: 9px; line-height: 1.35; color: var(--doc-tinta); }
  .pq-doc thead { display: table-header-group; }
  .pq-doc tr { break-inside: avoid; page-break-inside: avoid; }
  .pq-doc th, .pq-doc td { padding: 3px 6px; border-bottom: 1px solid var(--doc-linea); text-align: left; vertical-align: top; }
  .pq-doc thead th { padding-top: 4px; padding-bottom: 4px; border-bottom: 1px solid var(--doc-borde); background: var(--doc-fondo); color: var(--doc-azul); font-size: 7.5px; font-weight: 750; letter-spacing: .04em; text-transform: uppercase; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pq-doc .is-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .pq-doc .is-centro { text-align: center; }
  .pq-doc .is-suave { color: var(--doc-suave); }
  .pq-doc .is-cero { color: #9aa7b3; }
  .pq-doc .is-mono { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .pq-doc td small { color: var(--doc-suave); font-size: 8px; margin-left: 3px; }
  .pq-doc tfoot td, .pq-doc tfoot th { border-top: 1.5px solid var(--doc-tinta); border-bottom: 0; font-weight: 750; }
  .pq-doc-nota { color: var(--doc-suave); font-size: 8.5px; }
  .pq-doc-vacio { padding: 10px; border: 1px dashed var(--doc-borde); color: var(--doc-suave); text-align: center; }
  .pq-doc-pie { display: flex; justify-content: space-between; gap: 12px; padding-top: 5px; border-top: 1px solid var(--doc-linea); color: var(--doc-suave); font-size: 8px; }
  .pq-doc-body .print-document-id { position: static; margin-top: 2px; color: #8796a5; font-size: 7.5px; }
`;

// Una tabla del documento. columnas: [{ titulo, clase }]; filas: arreglos de celdas ya
// escapadas; pie: fila de totales opcional (también celdas ya escapadas).
export const docTabla = ({ columnas = [], filas = [], pie = null, vacio = "Sin datos para mostrar." }) => {
  if (!filas.length) return `<p class="pq-doc-vacio">${escapeHtml(vacio)}</p>`;
  const celda = (valor, columna = {}, etiqueta = "td") => `<${etiqueta}${columna.clase ? ` class="${columna.clase}"` : ""}>${valor}</${etiqueta}>`;
  return `<table>
    <thead><tr>${columnas.map((columna) => celda(escapeHtml(columna.titulo), columna, "th")).join("")}</tr></thead>
    <tbody>${filas.map((fila) => `<tr>${fila.map((valor, indice) => celda(valor, columnas[indice])).join("")}</tr>`).join("")}</tbody>
    ${pie ? `<tfoot><tr>${pie.map((valor, indice) => celda(valor, columnas[indice])).join("")}</tr></tfoot>` : ""}
  </table>`;
};

export const docSeccion = ({ titulo, detalle = "", cuerpo = "", clase = "" }) => `
  <section class="pq-doc-seccion ${clase}">
    <h2><span>${escapeHtml(titulo)}</span>${detalle ? `<small>${escapeHtml(detalle)}</small>` : ""}</h2>
    ${cuerpo}
  </section>`;

// Arma e imprime el documento. cifras: [[valor ya formateado, etiqueta]]; si la consulta
// no debe mostrar los totales de la empresa, simplemente no se pasan.
export const imprimirDocumentoPadron = ({
  titulo,
  subtitulo = "",
  tipo = "Consulta del padrón",
  filtro = "",
  cifras = [],
  secciones = [],
  nota = "",
  padronActualizado = "",
  orientacion = "portrait"
}) => {
  const generado = formatDateTime(new Date().toISOString());
  const cuerpo = `
    <div class="pq-doc">
      <header class="pq-doc-cabeza">
        <img src="${logoAguasCholuteca}" alt="Aguas de Choluteca" />
        <div class="pq-doc-titulo">
          <span>Aguas de Choluteca, S.A. de C.V. · ${escapeHtml(tipo)}</span>
          <h1>${escapeHtml(titulo)}</h1>
          ${subtitulo ? `<p>${escapeHtml(subtitulo)}</p>` : ""}
        </div>
        <div class="pq-doc-fecha"><b>${escapeHtml(generado)}</b>${padronActualizado ? `Padrón del ${escapeHtml(formatDateTime(padronActualizado))}` : "Padrón maestro activo"}</div>
      </header>
      <p class="pq-doc-confidencial"><strong>Información confidencial de la empresa</strong><span>Uso interno de Aguas de Choluteca. No debe compartirse fuera de la empresa.</span></p>
      ${filtro ? `<p class="pq-doc-filtro">${filtro}</p>` : ""}
      ${cifras.length ? `<dl class="pq-doc-cifras">${cifras.map(([valor, etiqueta]) => `<div><dd>${valor}</dd><dt>${escapeHtml(etiqueta)}</dt></div>`).join("")}</dl>` : ""}
      ${secciones.join("")}
      ${nota ? `<p class="pq-doc-nota">${escapeHtml(nota)}</p>` : ""}
      <footer class="pq-doc-pie"><span>Información confidencial de la empresa · ${escapeHtml(titulo)}</span><span>Control Aguas</span></footer>
    </div>`;

  return printDocument(titulo, cuerpo, {
    pageSize: `Letter ${orientacion}`,
    pageMargin: "11mm 10mm",
    bodyClassName: "pq-doc-body",
    reportType: "consulta-padron",
    extraStyles: ESTILOS
  });
};
