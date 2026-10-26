import logoAguasCholuteca from "../../assets/logo-aguas-choluteca.png";
import { escapeHtml } from "../../utils/html";
import { formatCurrency } from "../../utils/formatting";
import { formatDateTime } from "../../utils/datesAndBusiness";
import { urlToDataUrl } from "../../utils/imageUtils";
import { printDocument, saveReportPdf } from "../../utils/printDocument";

// Documento de Consultas del padrón. Cada informe describe sus datos una sola vez (cifras,
// secciones con columnas y filas) y de ahí salen las dos salidas con el mismo diseño: la
// hoja para imprimir (HTML) y el PDF que se descarga (jsPDF). Encabezado con logo, leyenda
// de información confidencial, cifras en una línea (solo si la consulta las lleva) y tablas
// de líneas finas. Se lee igual en blanco y negro.

export const docCount = (value) => Number(value || 0).toLocaleString("es-HN");
export const docMoney = (value) => formatCurrency(Number(value) || 0);
export const docPct = (value) => `${Number(value || 0).toLocaleString("es-HN", { maximumFractionDigits: 1 })}%`;

const CONFIDENCIAL = "Información confidencial de la empresa";
const CONFIDENCIAL_DETALLE = "Uso interno de Aguas de Choluteca. No debe compartirse fuera de la empresa.";

// Una celda: texto y, si hace falta, una nota pequeña (un porcentaje), gris si es cero o en negrita.
export const celda = (texto, { nota = "", cero = false, negrita = false } = {}) => ({ texto: String(texto ?? ""), nota, cero, negrita });
const comoCelda = (valor) => (valor && typeof valor === "object" ? valor : celda(valor));

// columnas: [{ titulo, alinear: "num" | "centro" | "mono" | "suave" }]; filas y pie: celdas.
// Una sección sin columnas lleva solo `texto`. `salto` la empieza en hoja nueva.
export const docSeccion = (seccion) => seccion;

// ---------- Hoja para imprimir ----------

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
  .pq-doc-cifras dd small { margin-left: 3px; color: var(--doc-suave); font-size: 9px; font-weight: 600; }
  .pq-doc-seccion { display: grid; gap: 4px; }
  .pq-doc-seccion + .pq-doc-seccion { margin-top: 2mm; }
  .pq-doc-seccion h2 { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin: 0; padding-bottom: 3px; border-bottom: 1px solid var(--doc-borde); color: var(--doc-azul); font-size: 10.5px; font-weight: 750; }
  .pq-doc-seccion h2 small { color: var(--doc-suave); font-size: 8.5px; font-weight: 600; }
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
  .pq-doc tfoot td { border-top: 1.5px solid var(--doc-tinta); border-bottom: 0; font-weight: 750; }
  .pq-doc-nota { color: var(--doc-suave); font-size: 8.5px; }
  .pq-doc-vacio { padding: 10px; border: 1px dashed var(--doc-borde); color: var(--doc-suave); text-align: center; }
  .pq-doc-pie { display: flex; justify-content: space-between; gap: 12px; padding-top: 5px; border-top: 1px solid var(--doc-linea); color: var(--doc-suave); font-size: 8px; }
  .pq-doc-body .print-document-id { position: static; margin-top: 2px; color: #8796a5; font-size: 7.5px; }
`;

const CLASE = { num: "is-num", centro: "is-centro", mono: "is-mono", suave: "is-suave" };

const celdaHtml = (valor, columna = {}, etiqueta = "td") => {
  const { texto, nota, cero, negrita } = comoCelda(valor);
  let contenido = escapeHtml(texto);
  if (negrita) contenido = `<b>${contenido}</b>`;
  if (nota) contenido += `<small>${escapeHtml(nota)}</small>`;
  if (cero) contenido = `<span class="is-cero">${contenido}</span>`;
  const clase = CLASE[columna.alinear];
  return `<${etiqueta}${clase ? ` class="${clase}"` : ""}>${contenido}</${etiqueta}>`;
};

const tablaHtml = ({ columnas = [], filas = [], pie = null, vacio = "Sin datos para mostrar." }) => {
  if (!filas.length) return `<p class="pq-doc-vacio">${escapeHtml(vacio)}</p>`;
  return `<table>
    <thead><tr>${columnas.map((columna) => celdaHtml(columna.titulo, columna, "th")).join("")}</tr></thead>
    <tbody>${filas.map((fila) => `<tr>${fila.map((valor, indice) => celdaHtml(valor, columnas[indice])).join("")}</tr>`).join("")}</tbody>
    ${pie ? `<tfoot><tr>${pie.map((valor, indice) => celdaHtml(valor, columnas[indice])).join("")}</tr></tfoot>` : ""}
  </table>`;
};

const filtroHtml = (filtro = []) => filtro.map(([etiqueta, texto]) => `<b>${escapeHtml(etiqueta)}:</b> ${escapeHtml(texto)}`).join(" · ");

const documentoHtml = (doc, generado) => `
  <div class="pq-doc">
    <header class="pq-doc-cabeza">
      <img src="${logoAguasCholuteca}" alt="Aguas de Choluteca" />
      <div class="pq-doc-titulo">
        <span>Aguas de Choluteca, S.A. de C.V. · ${escapeHtml(doc.tipo)}</span>
        <h1>${escapeHtml(doc.titulo)}</h1>
        ${doc.subtitulo ? `<p>${escapeHtml(doc.subtitulo)}</p>` : ""}
      </div>
      <div class="pq-doc-fecha"><b>${escapeHtml(generado)}</b>${escapeHtml(padronTexto(doc))}</div>
    </header>
    <p class="pq-doc-confidencial"><strong>${CONFIDENCIAL}</strong><span>${CONFIDENCIAL_DETALLE}</span></p>
    ${doc.filtro?.length ? `<p class="pq-doc-filtro">${filtroHtml(doc.filtro)}</p>` : ""}
    ${doc.cifras?.length ? `<dl class="pq-doc-cifras">${doc.cifras.map(([valor, etiqueta, nota]) => `<div><dd>${escapeHtml(valor)}${nota ? `<small>${escapeHtml(nota)}</small>` : ""}</dd><dt>${escapeHtml(etiqueta)}</dt></div>`).join("")}</dl>` : ""}
    ${(doc.secciones || []).filter(Boolean).map((seccion) => `
      <section class="pq-doc-seccion ${seccion.salto ? "is-salto" : ""}">
        <h2><span>${escapeHtml(seccion.titulo)}</span>${seccion.detalle ? `<small>${escapeHtml(seccion.detalle)}</small>` : ""}</h2>
        ${seccion.columnas ? tablaHtml(seccion) : `<p>${escapeHtml(seccion.texto || "")}</p>`}
      </section>`).join("")}
    ${doc.nota ? `<p class="pq-doc-nota">${escapeHtml(doc.nota)}</p>` : ""}
    <footer class="pq-doc-pie"><span>${CONFIDENCIAL} · ${escapeHtml(doc.titulo)}</span><span>Control Aguas</span></footer>
  </div>`;

const padronTexto = (doc) => (doc.padronActualizado ? `Padrón del ${formatDateTime(doc.padronActualizado)}` : "Padrón maestro activo");

export const imprimirDocumentoPadron = (doc) => printDocument(doc.titulo, documentoHtml(doc, formatDateTime(new Date().toISOString())), {
  pageSize: `Letter ${doc.orientacion || "portrait"}`,
  pageMargin: "11mm 10mm",
  bodyClassName: "pq-doc-body",
  reportType: "consulta-padron",
  extraStyles: ESTILOS
});

// ---------- PDF ----------

const TINTA = [22, 36, 47];
const SUAVE = [91, 107, 122];
const AZUL = [11, 63, 115];
const BORDE = [201, 213, 224];
const LINEA = [227, 234, 241];
const FONDO = [242, 246, 250];
const CERO = [154, 167, 179];
const MARGEN = 11;
const ALINEAR_PDF = { num: "right", centro: "center" };

const celdaPdf = (valor, columna = {}) => {
  const { texto, nota, cero, negrita } = comoCelda(valor);
  return {
    content: nota ? `${texto}  ${nota}` : texto,
    styles: { halign: ALINEAR_PDF[columna.alinear] || "left", textColor: cero ? CERO : columna.alinear === "suave" ? SUAVE : TINTA, fontStyle: negrita ? "bold" : "normal" }
  };
};

const nombreArchivo = (texto) => String(texto || "consulta-padron").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export const descargarPdfPadron = async (doc) => {
  const [{ jsPDF }, autoTableModulo, logo] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    urlToDataUrl(logoAguasCholuteca).catch(() => "")
  ]);
  const autoTable = autoTableModulo.default;
  const pdf = new jsPDF({ orientation: doc.orientacion || "portrait", unit: "mm", format: "letter" });
  const ancho = pdf.internal.pageSize.getWidth();
  const alto = pdf.internal.pageSize.getHeight();
  const util = ancho - MARGEN * 2;
  const generado = formatDateTime(new Date().toISOString());
  const limite = alto - 16;

  // Encabezado
  let y = MARGEN;
  if (logo) pdf.addImage(logo, "PNG", MARGEN, y, 13, 13);
  const x = MARGEN + (logo ? 16 : 0);
  pdf.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(...SUAVE);
  pdf.text(`AGUAS DE CHOLUTECA, S.A. DE C.V. · ${String(doc.tipo || "").toUpperCase()}`, x, y + 2.5, { charSpace: 0.2 });
  pdf.setFontSize(15).setTextColor(...AZUL);
  pdf.text(doc.titulo, x, y + 9);
  if (doc.subtitulo) pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...SUAVE).text(doc.subtitulo, x, y + 13.2);
  pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(...TINTA).text(generado, ancho - MARGEN, y + 2.5, { align: "right" });
  pdf.setFont("helvetica", "normal").setFontSize(7).setTextColor(...SUAVE).text(padronTexto(doc), ancho - MARGEN, y + 6, { align: "right" });
  y += 16;
  pdf.setDrawColor(...AZUL).setLineWidth(0.6).line(MARGEN, y, ancho - MARGEN, y);

  // Leyenda de información confidencial
  y += 3;
  pdf.setDrawColor(...TINTA).setLineWidth(0.3).rect(MARGEN, y, util, 6);
  pdf.setFont("helvetica", "bold").setFontSize(7).setTextColor(...TINTA).text(CONFIDENCIAL.toUpperCase(), MARGEN + 2.5, y + 4, { charSpace: 0.25 });
  const anchoLeyenda = pdf.getTextWidth(CONFIDENCIAL.toUpperCase()) + CONFIDENCIAL.length * 0.25;
  pdf.setFont("helvetica", "normal").setTextColor(...SUAVE).text(CONFIDENCIAL_DETALLE, MARGEN + 5 + anchoLeyenda, y + 4);
  y += 6;

  if (doc.filtro?.length) {
    y += 5;
    let cursor = MARGEN;
    pdf.setFontSize(7.5);
    doc.filtro.forEach(([etiqueta, texto], indice) => {
      const parte = `${indice ? " · " : ""}${etiqueta}: `;
      pdf.setFont("helvetica", "bold").setTextColor(...TINTA).text(parte, cursor, y);
      cursor += pdf.getTextWidth(parte);
      const resto = pdf.splitTextToSize(texto, ancho - MARGEN - cursor)[0] || "";
      pdf.setFont("helvetica", "normal").setTextColor(...SUAVE).text(resto, cursor, y);
      cursor += pdf.getTextWidth(resto);
    });
  }

  // Cifras en una línea
  if (doc.cifras?.length) {
    y += 3;
    const celdaAncho = util / doc.cifras.length;
    pdf.setFont("helvetica", "normal").setFontSize(6.5);
    const etiquetas = doc.cifras.map(([, etiqueta]) => pdf.splitTextToSize(etiqueta, celdaAncho - 3).slice(0, 2));
    const altoCifras = etiquetas.some((lineas) => lineas.length > 1) ? 13.5 : 11;
    pdf.setDrawColor(...LINEA).setLineWidth(0.25).line(MARGEN, y, ancho - MARGEN, y).line(MARGEN, y + altoCifras, ancho - MARGEN, y + altoCifras);
    doc.cifras.forEach(([valor, , nota], indice) => {
      const cx = MARGEN + indice * celdaAncho + (indice ? 2.5 : 0);
      if (indice) pdf.line(MARGEN + indice * celdaAncho, y, MARGEN + indice * celdaAncho, y + altoCifras);
      pdf.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(...TINTA).text(valor, cx, y + 5);
      if (nota) {
        const anchoValor = pdf.getTextWidth(valor);
        pdf.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...SUAVE).text(nota, cx + anchoValor + 1.2, y + 5);
      }
      pdf.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...SUAVE).text(etiquetas[indice], cx, y + 8.6, { lineHeightFactor: 1.15 });
    });
    y += altoCifras;
  }

  // Secciones
  (doc.secciones || []).filter(Boolean).forEach((seccion, indice) => {
    if (seccion.salto && indice) {
      pdf.addPage();
      y = MARGEN;
    } else {
      y += 6;
      if (y > limite - 20) { pdf.addPage(); y = MARGEN; }
    }
    pdf.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...AZUL).text(seccion.titulo, MARGEN, y + 3);
    if (seccion.detalle) pdf.setFont("helvetica", "normal").setFontSize(7).setTextColor(...SUAVE).text(seccion.detalle, ancho - MARGEN, y + 3, { align: "right" });
    y += 4.5;
    pdf.setDrawColor(...BORDE).setLineWidth(0.25).line(MARGEN, y, ancho - MARGEN, y);
    y += 1;

    if (!seccion.columnas) {
      const lineas = pdf.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...TINTA).splitTextToSize(seccion.texto || "", util);
      pdf.text(lineas, MARGEN, y + 3);
      y += lineas.length * 3.4 + 1;
      return;
    }
    if (!seccion.filas?.length) {
      pdf.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...SUAVE).text(seccion.vacio || "Sin datos para mostrar.", ancho / 2, y + 5, { align: "center" });
      y += 8;
      return;
    }
    const columnas = seccion.columnas;
    autoTable(pdf, {
      startY: y,
      margin: { left: MARGEN, right: MARGEN, top: MARGEN, bottom: 16 },
      theme: "plain",
      showHead: "everyPage",
      rowPageBreak: "avoid",
      head: [columnas.map((columna) => ({ content: columna.titulo.toUpperCase(), styles: { halign: ALINEAR_PDF[columna.alinear] || "left" } }))],
      body: seccion.filas.map((fila) => fila.map((valor, posicion) => celdaPdf(valor, columnas[posicion]))),
      foot: seccion.pie ? [seccion.pie.map((valor, posicion) => ({ ...celdaPdf(valor, columnas[posicion]), styles: { ...celdaPdf(valor, columnas[posicion]).styles, fontStyle: "bold", textColor: TINTA } }))] : undefined,
      showFoot: "lastPage",
      styles: { font: "helvetica", fontSize: 7.3, cellPadding: { top: 1.2, bottom: 1.2, left: 1.8, right: 1.8 }, textColor: TINTA, lineColor: LINEA, lineWidth: { bottom: 0.2 }, overflow: "linebreak", valign: "top" },
      headStyles: { fillColor: FONDO, textColor: AZUL, fontStyle: "bold", fontSize: 6.3, lineColor: BORDE, lineWidth: { bottom: 0.25 } },
      footStyles: { fillColor: false, lineColor: TINTA, lineWidth: { top: 0.45 } }
    });
    y = pdf.lastAutoTable?.finalY ?? y;
  });

  if (doc.nota) {
    const lineas = pdf.setFont("helvetica", "normal").setFontSize(7).setTextColor(...SUAVE).splitTextToSize(doc.nota, util);
    if (y + 6 + lineas.length * 3 > limite) { pdf.addPage(); y = MARGEN; }
    pdf.text(lineas, MARGEN, y + 6);
  }

  // Pie en cada hoja: leyenda y número de página.
  const total = pdf.getNumberOfPages();
  for (let pagina = 1; pagina <= total; pagina += 1) {
    pdf.setPage(pagina);
    pdf.setDrawColor(...LINEA).setLineWidth(0.25).line(MARGEN, alto - 10, ancho - MARGEN, alto - 10);
    pdf.setFont("helvetica", "normal").setFontSize(6.8).setTextColor(...SUAVE);
    pdf.text(`${CONFIDENCIAL} · ${doc.titulo}`, MARGEN, alto - 6.5);
    pdf.text(`Página ${pagina} de ${total}`, ancho - MARGEN, alto - 6.5, { align: "right" });
  }

  saveReportPdf(pdf, `${nombreArchivo(doc.archivo || doc.titulo)}-${new Date().toISOString().slice(0, 10)}.pdf`, { title: doc.titulo, reportType: "consulta-padron-pdf" });
};

// Imprime o descarga el mismo documento.
export const salidaPadron = (doc, modo = "imprimir") => (modo === "pdf" ? descargarPdfPadron(doc) : imprimirDocumentoPadron(doc));
