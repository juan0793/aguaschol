import logoAguasCholuteca from "../../assets/logo-aguas-choluteca.png";
import fuenteRegular from "../../assets/fonts/PlusJakartaSans-Regular.ttf";
import fuenteSemiBold from "../../assets/fonts/PlusJakartaSans-SemiBold.ttf";
import fuenteBold from "../../assets/fonts/PlusJakartaSans-Bold.ttf";
import { escapeHtml } from "../../utils/html";
import { formatCurrency } from "../../utils/formatting";
import { formatDateTime } from "../../utils/datesAndBusiness";
import { urlToDataUrl } from "../../utils/imageUtils";
import { printDocument, saveReportPdf } from "../../utils/printDocument";

// Documento de Consultas del padrón. Cada informe describe sus datos una sola vez (cifras,
// secciones con columnas y filas) y de ahí salen las dos salidas con el mismo diseño: la
// hoja para imprimir (HTML) y el PDF que se descarga (jsPDF). Encabezado con logo, leyenda
// de información confidencial, cifras en una línea (solo si la consulta las lleva) y tablas
// cebradas. Se lee igual en blanco y negro.

export const docCount = (value) => Number(value || 0).toLocaleString("es-HN");
export const docMoney = (value) => formatCurrency(Number(value) || 0);
export const docPct = (value) => `${Number(value || 0).toLocaleString("es-HN", { maximumFractionDigits: 1 })}%`;

const CONFIDENCIAL = "Información confidencial de la empresa";
const CONFIDENCIAL_DETALLE = "Uso interno de Aguas de Choluteca. No debe compartirse fuera de la empresa.";

// Una celda: texto y, si hace falta, una nota pequeña (un porcentaje), gris si es cero o en
// negrita. `barra` (0 a 1) dibuja una barra fina bajo la cifra.
export const celda = (texto, { nota = "", cero = false, negrita = false, barra = null } = {}) => ({ texto: String(texto ?? ""), nota, cero, negrita, barra });
const comoCelda = (valor) => (valor && typeof valor === "object" ? valor : celda(valor));

// columnas: [{ titulo, alinear: "num" | "centro" | "mono" | "suave" }]; filas y pie: celdas.
// Una sección sin columnas lleva solo `texto`. `salto` la empieza en hoja nueva.
export const docSeccion = (seccion) => seccion;

// ---------- Diseño compartido ----------
// Hoja institucional en Plus Jakarta Sans, la letra de la app (OFL, en assets/fonts).
// Membrete con logo y la marca de confidencial; título grande en azul profundo; cifras en
// fichas iguales; tablas con encabezado azul, filas cebradas, totales sobre fondo claro y
// porcentajes en su propia columna para que se lean alineados. Se lee bien en blanco y negro.

const PESOS_FUENTE = [["Regular", 400, fuenteRegular], ["SemiBold", 600, fuenteSemiBold], ["Bold", 700, fuenteBold]];

// ¿Alguna fila de la columna lleva nota (un porcentaje)? Entonces la nota va en su propia
// columna, angosta y gris, justo a la derecha del valor.
const columnasConNota = (seccion) => (seccion.columnas || []).map((_, indice) =>
  [...(seccion.filas || []), ...(seccion.pie ? [seccion.pie] : [])].some((fila) => comoCelda(fila[indice]).nota));

// ---------- Hoja para imprimir ----------

const ESTILOS = `
  ${PESOS_FUENTE.map(([, peso, url]) => `@font-face { font-family: "PJS Doc"; font-weight: ${peso}; font-style: normal; src: url("${url}") format("truetype"); }`).join("\n  ")}
  .pq-doc-body { background: #fff; }
  .pq-doc {
    --doc-tinta: #16242f;
    --doc-suave: #5b6b7a;
    --doc-azul: #0b3f73;
    --doc-acento: #1465d9;
    --doc-borde: #c9d5e0;
    --doc-linea: #e4eaf1;
    --doc-banda: #f3f7fc;
    --doc-cebra: #f8fafc;
    /* Bloques y no rejilla: Chrome solo respeta "no cortar antes del pie" entre bloques. */
    display: block;
    color: var(--doc-tinta);
    font-family: "PJS Doc", "Plus Jakarta Sans", "Segoe UI", Arial, sans-serif;
    font-size: 9.5px;
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .pq-doc p { margin: 0; }
  .pq-doc-membrete { display: flex; align-items: center; gap: 10px; padding-bottom: 3.2mm; border-bottom: 1.2px solid var(--doc-azul); }
  .pq-doc-membrete img { width: 40px; height: 40px; object-fit: contain; }
  .pq-doc-empresa { flex: 1; min-width: 0; }
  .pq-doc-empresa b { display: block; color: var(--doc-tinta); font-size: 11.5px; font-weight: 600; }
  .pq-doc-empresa span { color: var(--doc-suave); font-size: 9px; }
  .pq-doc-meta { display: grid; justify-items: end; gap: 3px; color: var(--doc-suave); font-size: 8.5px; text-align: right; white-space: nowrap; }
  .pq-doc-meta b { color: var(--doc-tinta); font-weight: 600; }
  .pq-doc-sello { padding: 2px 7px; border: 1px solid var(--doc-azul); border-radius: 4px; color: var(--doc-azul); font-size: 7.5px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; }
  .pq-doc-titulo h1 { margin: 0; color: var(--doc-azul); font-size: 21px; font-weight: 700; line-height: 1.18; text-wrap: balance; }
  .pq-doc-titulo p { margin-top: 3px; color: var(--doc-suave); font-size: 10px; }
  .pq-doc-filtro { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin-top: 2.6mm; font-size: 8.5px; }
  .pq-doc-filtro > b { margin-right: 2px; color: var(--doc-suave); font-weight: 600; }
  .pq-doc-filtro span { padding: 2px 8px; border-radius: 4px; background: var(--doc-banda); color: var(--doc-tinta); font-weight: 600; }
  .pq-doc-filtro span i { color: var(--doc-suave); font-style: normal; font-weight: 400; }
  .pq-doc-cifras { display: grid; grid-auto-columns: minmax(0, 1fr); grid-auto-flow: column; gap: 2mm; margin: 0; }
  .pq-doc-cifras div { padding: 2.6mm 3.2mm 2.8mm; border-radius: 5px; background: var(--doc-banda); }
  .pq-doc-cifras dd { margin: 0; color: var(--doc-tinta); font-size: 15px; font-weight: 700; line-height: 1.15; }
  .pq-doc-cifras div:first-child dd { color: var(--doc-azul); font-size: 18px; }
  .pq-doc-cifras dd small { display: inline-block; margin-left: 4px; color: var(--doc-suave); font-size: 9px; font-weight: 600; }
  .pq-doc-cifras dt { margin-top: 2px; color: var(--doc-suave); font-size: 8.5px; line-height: 1.3; }
  .pq-doc > * + * { margin-top: 3.4mm; }
  .pq-doc-seccion > * + * { margin-top: 2mm; }
  .pq-doc-seccion + .pq-doc-seccion { margin-top: 4.5mm; }
  .pq-doc-seccion h2 { break-after: avoid; page-break-after: avoid; }
  .pq-doc-seccion h2 { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin: 0; color: var(--doc-azul); font-size: 12.5px; font-weight: 700; }
  .pq-doc-seccion h2 small { color: var(--doc-suave); font-size: 9px; font-weight: 400; }
  .pq-doc-seccion.is-salto { break-before: page; }
  .pq-doc-seccion > p { color: var(--doc-tinta); font-size: 8.6px; line-height: 1.45; }
  /* El documento se imprime sin doctype (modo quirks): las tablas no heredan la letra. */
  .pq-doc table { width: 100%; border-collapse: separate; border-spacing: 0; font-family: inherit; font-size: 9.2px; line-height: 1.35; color: var(--doc-tinta); }
  .pq-doc thead { display: table-header-group; }
  .pq-doc tr { break-inside: avoid; page-break-inside: avoid; }
  .pq-doc th, .pq-doc td { padding: 4px 7px; border-bottom: 1px solid var(--doc-linea); text-align: left; vertical-align: top; }
  .pq-doc thead th { padding-top: 5.5px; padding-bottom: 5.5px; border-bottom: 0; background: var(--doc-azul); color: #fff; font-size: 7.6px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; white-space: nowrap; }
  .pq-doc thead th:first-child { border-top-left-radius: 4px; }
  .pq-doc thead th:last-child { border-top-right-radius: 4px; }
  .pq-doc tbody tr:nth-child(even) td { background: var(--doc-cebra); }
  .pq-doc tbody td:first-child { font-weight: 600; }
  .pq-doc .is-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .pq-doc .is-centro { text-align: center; }
  .pq-doc .is-suave { color: var(--doc-suave); }
  .pq-doc .is-cero { color: #a0acb8; }
  .pq-doc .is-mono { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .pq-doc td.is-nota { width: 1%; padding-left: 0; color: var(--doc-suave); font-size: 8px; white-space: nowrap; }
  .pq-doc td.has-nota { padding-right: 4px; }
  .pq-doc .pq-doc-barra { display: block; width: 22mm; max-width: 100%; height: 2px; margin: 2px 0 0 auto; border-radius: 1px; background: var(--doc-linea); }
  .pq-doc .pq-doc-barra i { display: block; height: 100%; margin-left: auto; border-radius: 1px; background: var(--doc-acento); }
  .pq-doc tfoot td { border-top: 1.4px solid var(--doc-tinta); border-bottom: 0; background: var(--doc-banda); font-weight: 700; }
  .pq-doc-nota { color: var(--doc-suave); font-size: 8.5px; line-height: 1.5; }
  .pq-doc-nota b { color: var(--doc-tinta); font-weight: 600; }
  .pq-doc-vacio { padding: 10px; border: 1px dashed var(--doc-borde); border-radius: 5px; color: var(--doc-suave); text-align: center; }
  /* La nota, el pie y el ID nunca quedan solos en una hoja nueva. */
  .pq-doc-nota, .pq-doc-pie, .pq-doc-body .print-document-id { break-before: avoid; page-break-before: avoid; break-inside: avoid; }
  .pq-doc-pie { display: flex; justify-content: space-between; gap: 12px; height: 11px; padding-top: 2mm; border-top: 1px solid var(--doc-linea); color: var(--doc-suave); font-size: 8px; }
  .pq-doc-body .print-document-id { position: static; margin-top: -11px; text-align: right; color: #8796a5; font-family: "PJS Doc", Arial, sans-serif; font-size: 7.5px; }
`;

const CLASE = { num: "is-num", centro: "is-centro", mono: "is-mono", suave: "is-suave" };

const celdaHtml = (valor, columna = {}, etiqueta = "td", { conNota = false } = {}) => {
  const { texto, nota, cero, negrita, barra } = comoCelda(valor);
  let contenido = escapeHtml(texto);
  if (negrita) contenido = `<b>${contenido}</b>`;
  if (cero) contenido = `<span class="is-cero">${contenido}</span>`;
  if (barra != null && etiqueta === "td") contenido += `<span class="pq-doc-barra"><i style="width:${Math.round(Math.min(1, Math.max(0, barra)) * 100)}%"></i></span>`;
  const clases = [CLASE[columna.alinear], conNota ? "has-nota" : ""].filter(Boolean).join(" ");
  const principal = `<${etiqueta}${clases ? ` class="${clases}"` : ""}>${contenido}</${etiqueta}>`;
  return conNota ? `${principal}<td class="is-nota">${escapeHtml(nota)}</td>` : principal;
};

const tablaHtml = (seccion) => {
  const { columnas = [], filas = [], pie = null, vacio = "Sin datos para mostrar." } = seccion;
  if (!filas.length) return `<p class="pq-doc-vacio">${escapeHtml(vacio)}</p>`;
  const notas = columnasConNota(seccion);
  const fila = (celdas) => celdas.map((valor, indice) => celdaHtml(valor, columnas[indice], "td", { conNota: notas[indice] })).join("");
  const cabeza = columnas.map((columna, indice) => {
    const clase = CLASE[columna.alinear];
    return `<th${notas[indice] ? ' colspan="2"' : ""}${clase ? ` class="${clase}"` : ""}>${escapeHtml(columna.titulo)}</th>`;
  }).join("");
  return `<table>
    <thead><tr>${cabeza}</tr></thead>
    <tbody>${filas.map((celdas) => `<tr>${fila(celdas)}</tr>`).join("")}</tbody>
    ${pie ? `<tfoot><tr>${fila(pie)}</tr></tfoot>` : ""}
  </table>`;
};

const filtroHtml = (filtro = []) => `<b>Filtro</b>${filtro.map(([etiqueta, texto]) => `<span>${etiqueta && etiqueta !== "Filtro" ? `<i>${escapeHtml(etiqueta)}: </i>` : ""}${escapeHtml(texto)}</span>`).join("")}`;

const documentoHtml = (doc, generado) => `
  <div class="pq-doc">
    <header class="pq-doc-membrete">
      <img src="${logoAguasCholuteca}" alt="Aguas de Choluteca" />
      <div class="pq-doc-empresa"><b>Aguas de Choluteca, S.A. de C.V.</b><span>${escapeHtml(doc.tipo || "Consultas del padrón")}</span></div>
      <div class="pq-doc-meta"><span class="pq-doc-sello">Confidencial · Uso interno</span><span>Emitido <b>${escapeHtml(generado)}</b></span><span>${escapeHtml(padronTexto(doc))}</span></div>
    </header>
    <div class="pq-doc-titulo">
      <h1>${escapeHtml(doc.titulo)}</h1>
      ${doc.subtitulo ? `<p>${escapeHtml(doc.subtitulo)}</p>` : ""}
      ${doc.filtro?.length ? `<p class="pq-doc-filtro">${filtroHtml(doc.filtro)}</p>` : ""}
    </div>
    ${doc.cifras?.length ? `<dl class="pq-doc-cifras">${doc.cifras.map(([valor, etiqueta, nota]) => `<div><dd>${escapeHtml(valor)}${nota ? `<small>${escapeHtml(nota)}</small>` : ""}</dd><dt>${escapeHtml(etiqueta)}</dt></div>`).join("")}</dl>` : ""}
    ${(doc.secciones || []).filter(Boolean).map((seccion) => `
      <section class="pq-doc-seccion ${seccion.salto ? "is-salto" : ""}">
        <h2><span>${escapeHtml(seccion.titulo)}</span>${seccion.detalle ? `<small>${escapeHtml(seccion.detalle)}</small>` : ""}</h2>
        ${seccion.columnas ? tablaHtml(seccion) : `<p>${escapeHtml(seccion.texto || "")}</p>`}
      </section>`).join("")}
    ${doc.nota ? `<p class="pq-doc-nota"><b>Nota.</b> ${escapeHtml(doc.nota)}</p>` : ""}
    <footer class="pq-doc-pie"><span>${CONFIDENCIAL} · ${CONFIDENCIAL_DETALLE}</span></footer>
  </div>`;

const padronTexto = (doc) => (doc.padronActualizado ? `Padrón del ${formatDateTime(doc.padronActualizado)}` : "Padrón maestro activo");

export const imprimirDocumentoPadron = (doc) => printDocument(doc.titulo, documentoHtml(doc, formatDateTime(new Date().toISOString())), {
  pageSize: `Letter ${doc.orientacion || "portrait"}`,
  pageMargin: "11mm 11mm",
  bodyClassName: "pq-doc-body",
  reportType: "consulta-padron",
  extraStyles: ESTILOS
});

// ---------- PDF ----------

const TINTA = [22, 36, 47];
const SUAVE = [91, 107, 122];
const AZUL = [11, 63, 115];
const ACENTO = [20, 101, 217];
const BORDE = [201, 213, 224];
const LINEA = [228, 234, 241];
const BANDA = [243, 247, 252];
const CEBRA = [248, 250, 252];
const CERO = [160, 172, 184];
const BLANCO = [255, 255, 255];
const MARGEN = 12;
const ALINEAR_PDF = { num: "right", centro: "center" };

// La letra se descarga una vez por sesión, solo al generar el primer PDF.
const aBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let texto = "";
  for (let inicio = 0; inicio < bytes.length; inicio += 0x8000) texto += String.fromCharCode.apply(null, bytes.subarray(inicio, inicio + 0x8000));
  return btoa(texto);
};
let fuentesPdf = null;
const cargarFuentesPdf = () => {
  fuentesPdf ||= Promise.all(PESOS_FUENTE.map(async ([nombre, , url]) => {
    const respuesta = await fetch(url);
    if (!respuesta.ok) throw new Error("Sin fuente");
    return [nombre, aBase64(await respuesta.arrayBuffer())];
  })).catch(() => { fuentesPdf = null; return null; });
  return fuentesPdf;
};

// Familias: "PJS" normal/bold y "PJS-Semi" para el seminegrita. Sin la letra, Helvetica.
const prepararLetra = (pdf, fuentes) => {
  if (!fuentes) return (peso = "normal") => pdf.setFont("helvetica", peso === "normal" ? "normal" : "bold");
  fuentes.forEach(([nombre, datos]) => pdf.addFileToVFS(`PlusJakartaSans-${nombre}.ttf`, datos));
  pdf.addFont("PlusJakartaSans-Regular.ttf", "PJS", "normal");
  pdf.addFont("PlusJakartaSans-Bold.ttf", "PJS", "bold");
  pdf.addFont("PlusJakartaSans-SemiBold.ttf", "PJS-Semi", "normal");
  return (peso = "normal") => (peso === "semi" ? pdf.setFont("PJS-Semi", "normal") : pdf.setFont("PJS", peso));
};

const nombreArchivo = (texto) => String(texto || "consulta-padron").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export const descargarPdfPadron = async (doc) => {
  const [{ jsPDF }, autoTableModulo, logo, fuentes] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    urlToDataUrl(logoAguasCholuteca).catch(() => ""),
    cargarFuentesPdf()
  ]);
  const autoTable = autoTableModulo.default;
  const pdf = new jsPDF({ orientation: doc.orientacion || "portrait", unit: "mm", format: "letter" });
  const letra = prepararLetra(pdf, fuentes);
  const familia = fuentes ? "PJS" : "helvetica";
  const familiaSemi = fuentes ? "PJS-Semi" : "helvetica";
  const ancho = pdf.internal.pageSize.getWidth();
  const alto = pdf.internal.pageSize.getHeight();
  const util = ancho - MARGEN * 2;
  const generado = formatDateTime(new Date().toISOString());
  const limite = alto - 15;
  const texto = (contenido, x, y, { peso = "normal", tam = 8, color = TINTA, ...opciones } = {}) => {
    letra(peso);
    pdf.setFontSize(tam).setTextColor(...color).text(contenido, x, y, opciones);
  };
  const medir = (contenido, peso, tam) => { letra(peso); return pdf.setFontSize(tam).getTextWidth(contenido); };

  // Membrete: logo, empresa y consulta; a la derecha el sello y las fechas.
  let y = MARGEN;
  if (logo) pdf.addImage(logo, "PNG", MARGEN, y, 13, 13);
  const x = MARGEN + (logo ? 16.5 : 0);
  texto("Aguas de Choluteca, S.A. de C.V.", x, y + 5.6, { peso: "semi", tam: 10.5 });
  texto(doc.tipo || "Consultas del padrón", x, y + 10, { tam: 8, color: SUAVE });
  const sello = "CONFIDENCIAL · USO INTERNO";
  letra("bold");
  pdf.setFontSize(6.4);
  const anchoSello = pdf.getTextWidth(sello) + sello.length * 0.28 + 5;
  pdf.setDrawColor(...AZUL).setLineWidth(0.3).roundedRect(ancho - MARGEN - anchoSello, y, anchoSello, 5, 1, 1, "S");
  pdf.setTextColor(...AZUL).text(sello, ancho - MARGEN - anchoSello + 2.5, y + 3.5, { charSpace: 0.28 });
  texto(`Emitido ${generado}`, ancho - MARGEN, y + 9.2, { tam: 7.4, color: SUAVE, align: "right" });
  texto(padronTexto(doc), ancho - MARGEN, y + 12.8, { tam: 7.4, color: SUAVE, align: "right" });
  y += 16.5;
  pdf.setDrawColor(...AZUL).setLineWidth(0.45).line(MARGEN, y, ancho - MARGEN, y);

  // Título, subtítulo y filtro.
  // Un título largo (una combinación de cinco servicios) se achica hasta 15.5 pt para
  // quedar en una línea; si aún no cabe, usa dos.
  let tamTitulo = 19;
  while (tamTitulo > 15.5 && medir(String(doc.titulo || ""), "bold", tamTitulo) > util) tamTitulo -= 0.5;
  letra("bold");
  pdf.setFontSize(tamTitulo);
  const lineasTitulo = pdf.splitTextToSize(String(doc.titulo || ""), util).slice(0, 2);
  y += 9.5;
  texto(lineasTitulo, MARGEN, y, { peso: "bold", tam: tamTitulo, color: AZUL, lineHeightFactor: 1.12 });
  y += (lineasTitulo.length - 1) * tamTitulo * 0.4;
  if (doc.subtitulo) {
    y += 5.6;
    texto(doc.subtitulo, MARGEN, y, { tam: 9, color: SUAVE });
  }
  if (doc.filtro?.length) {
    y += 4;
    texto("Filtro", MARGEN, y + 3.6, { peso: "semi", tam: 7.6, color: SUAVE });
    let cursor = MARGEN + medir("Filtro", "semi", 7.6) + 2.2;
    doc.filtro.forEach(([etiqueta, valor]) => {
      const previo = etiqueta && etiqueta !== "Filtro" ? `${etiqueta}: ` : "";
      const anchoPrevio = previo ? medir(previo, "normal", 7.6) : 0;
      letra("semi");
      pdf.setFontSize(7.6);
      const resto = pdf.splitTextToSize(String(valor || ""), ancho - MARGEN - cursor - anchoPrevio - 5)[0] || "";
      const anchoChip = anchoPrevio + medir(resto, "semi", 7.6) + 5;
      pdf.setFillColor(...BANDA).roundedRect(cursor, y, anchoChip, 5.2, 1.2, 1.2, "F");
      if (previo) texto(previo, cursor + 2.5, y + 3.6, { tam: 7.6, color: SUAVE });
      texto(resto, cursor + 2.5 + anchoPrevio, y + 3.6, { peso: "semi", tam: 7.6 });
      cursor += anchoChip + 2;
    });
    y += 5.2;
  }

  // Cifras: fichas iguales; la primera, en azul profundo.
  if (doc.cifras?.length) {
    y += 4.2;
    const hueco = 2.2;
    const anchoFicha = (util - hueco * (doc.cifras.length - 1)) / doc.cifras.length;
    const cabe = anchoFicha - 6;
    // La cifra se achica si no cabe en la ficha; si con la nota tampoco cabe, la nota
    // baja a la etiqueta ("de deuda · de L 1,044,113.00").
    const fichas = doc.cifras.map(([valor, etiqueta, nota], indice) => {
      let tam = indice === 0 ? 15 : 12.5;
      while (tam > 9.5 && medir(String(valor), "bold", tam) > cabe) tam -= 0.5;
      const conNota = Boolean(nota) && medir(String(valor), "bold", tam) + 1.4 + medir(String(nota), "semi", 7.4) <= cabe;
      letra("normal");
      const rotulo = pdf.setFontSize(7.4).splitTextToSize(nota && !conNota ? `${etiqueta} · ${nota}` : String(etiqueta || ""), cabe).slice(0, 2);
      return { valor: String(valor), nota: conNota ? String(nota) : "", tam, rotulo };
    });
    const altoFicha = fichas.some((ficha) => ficha.rotulo.length > 1) ? 18.5 : 15.5;
    fichas.forEach((ficha, indice) => {
      const fx = MARGEN + indice * (anchoFicha + hueco);
      pdf.setFillColor(...BANDA).roundedRect(fx, y, anchoFicha, altoFicha, 1.6, 1.6, "F");
      texto(ficha.valor, fx + 3, y + 7.4, { peso: "bold", tam: ficha.tam, color: indice === 0 ? AZUL : TINTA });
      if (ficha.nota) texto(ficha.nota, fx + 3 + medir(ficha.valor, "bold", ficha.tam) + 1.4, y + 7.4, { peso: "semi", tam: 7.4, color: SUAVE });
      texto(ficha.rotulo, fx + 3, y + 12, { tam: 7.4, color: SUAVE, lineHeightFactor: 1.2 });
    });
    y += altoFicha;
  }

  // Encabezado corto en las hojas que siguen.
  const encabezadoCorto = () => {
    texto(String(doc.titulo || ""), MARGEN, MARGEN + 3.5, { peso: "semi", tam: 9, color: AZUL });
    texto("Aguas de Choluteca · Consultas del padrón", ancho - MARGEN, MARGEN + 3.5, { tam: 7.4, color: SUAVE, align: "right" });
    pdf.setDrawColor(...LINEA).setLineWidth(0.3).line(MARGEN, MARGEN + 6, ancho - MARGEN, MARGEN + 6);
  };
  const nuevaHoja = () => { pdf.addPage(); encabezadoCorto(); return MARGEN + 11; };

  // Secciones
  (doc.secciones || []).filter(Boolean).forEach((seccion, indice) => {
    if (seccion.salto && indice) y = nuevaHoja();
    else {
      y += 6.5;
      if (y > limite - 24) y = nuevaHoja();
    }
    texto(seccion.titulo, MARGEN, y + 3, { peso: "bold", tam: 11, color: AZUL });
    if (seccion.detalle) texto(seccion.detalle, ancho - MARGEN, y + 3, { tam: 7.6, color: SUAVE, align: "right" });
    y += 6;

    // Texto corrido (p. ej. los barrios donde nadie cumple): compacto y, si no cabe en la
    // hoja, sigue en la siguiente en vez de salirse por debajo del pie.
    if (!seccion.columnas) {
      letra("normal");
      const interlinea = 3.25;
      const lineas = pdf.setFontSize(7).splitTextToSize(seccion.texto || "", util);
      lineas.forEach((linea) => {
        if (y + interlinea > limite) y = nuevaHoja();
        texto(linea, MARGEN, y + 2.5, { tam: 7 });
        y += interlinea;
      });
      return;
    }
    if (!seccion.filas?.length) {
      pdf.setDrawColor(...BORDE).setLineWidth(0.25).setLineDashPattern([1, 1], 0).roundedRect(MARGEN, y, util, 10, 1.5, 1.5, "S").setLineDashPattern([], 0);
      texto(seccion.vacio || "Sin datos para mostrar.", ancho / 2, y + 6.2, { tam: 8, color: SUAVE, align: "center" });
      y += 12;
      return;
    }

    // Cada columna con nota se parte en dos: el valor y la nota gris, alineados.
    const columnas = seccion.columnas;
    const notas = columnasConNota(seccion);
    const expandir = (fila, enPie = false) => fila.flatMap((valor, posicion) => {
      const { texto: contenido, nota, cero, negrita, barra } = comoCelda(valor);
      const alinear = ALINEAR_PDF[columnas[posicion]?.alinear] || "left";
      const color = cero ? CERO : columnas[posicion]?.alinear === "suave" ? SUAVE : TINTA;
      const principal = { content: contenido, barra, styles: { halign: alinear, textColor: color, fontStyle: negrita || enPie ? "bold" : "normal", ...(notas[posicion] ? { cellPadding: { top: 1.45, bottom: 1.45, left: 2.4, right: 1.2 } } : {}) } };
      return notas[posicion] ? [principal, { content: nota, styles: { halign: "left", textColor: SUAVE, fontSize: 6.6, cellPadding: { top: 1.75, bottom: 1.45, left: 0, right: 2.4 } } }] : [principal];
    });
    const cabeza = columnas.map((columna, posicion) => ({ content: String(columna.titulo || "").toUpperCase(), colSpan: notas[posicion] ? 2 : 1, styles: { halign: ALINEAR_PDF[columna.alinear] || "left" } }));
    autoTable(pdf, {
      startY: y,
      margin: { left: MARGEN, right: MARGEN, top: MARGEN + 11, bottom: 18 },
      theme: "plain",
      showHead: "everyPage",
      rowPageBreak: "avoid",
      head: [cabeza],
      body: seccion.filas.map((fila) => expandir(fila)),
      foot: seccion.pie ? [expandir(seccion.pie, true)] : undefined,
      showFoot: "lastPage",
      // El fondo de cada fila se pinta entero en willDrawCell: si cada celda pinta el suyo,
      // los visores dejan rayitas claras entre columnas.
      styles: { font: familia, fontSize: 7.7, fillColor: false, cellPadding: { top: 1.45, bottom: 1.45, left: 2.4, right: 2.4 }, textColor: TINTA, lineColor: LINEA, lineWidth: { bottom: 0.2 }, overflow: "linebreak", valign: "top" },
      headStyles: { font: familiaSemi, fontStyle: fuentes ? "normal" : "bold", fillColor: false, textColor: BLANCO, fontSize: 6.5, cellPadding: { top: 2.5, bottom: 2.5, left: 2.4, right: 2.4 }, lineWidth: 0 },
      footStyles: { fillColor: false, textColor: TINTA, lineColor: TINTA, lineWidth: { top: 0.45 } },
      willDrawCell: (data) => {
        if (data.column.index !== 0) return;
        const fondo = data.section === "head" ? AZUL : data.section === "foot" ? BANDA : data.row.index % 2 ? CEBRA : null;
        if (!fondo) return;
        pdf.setFillColor(...fondo);
        if (data.section === "head") {
          pdf.roundedRect(MARGEN, data.cell.y, util, data.row.height, 1.2, 1.2, "F").rect(MARGEN, data.cell.y + data.row.height / 2, util, data.row.height / 2, "F");
        } else pdf.rect(MARGEN, data.cell.y, util, data.row.height, "F");
      },
      didParseCell: (data) => {
        // El nombre (primera columna) en seminegrita; el pie, todo en negrita.
        if (data.section === "body" && data.column.index === 0) {
          // La seminegrita no tiene variante negrita: una celda en negrita usa la negrita normal.
          if (fuentes) data.cell.styles.font = data.cell.styles.fontStyle === "bold" ? "PJS" : familiaSemi;
          else data.cell.styles.fontStyle = "bold";
        }
      },
      didDrawCell: (data) => {
        // Barra fina bajo la cifra (p. ej. "Parte de la deuda"): pista gris y el dato en azul.
        const barra = data.cell.raw?.barra;
        if (data.section !== "body" || barra == null) return;
        const parte = Math.min(1, Math.max(0, barra));
        const largo = Math.min(data.cell.width - 4.8, 22);
        const bx = data.cell.x + data.cell.width - 2.4 - largo;
        const by = data.cell.y + data.cell.height - 0.95;
        pdf.setFillColor(...LINEA).rect(bx, by, largo, 0.55, "F");
        if (parte > 0) pdf.setFillColor(...ACENTO).rect(bx + largo * (1 - parte), by, largo * parte, 0.55, "F");
      },
      didDrawPage: () => { if (pdf.getCurrentPageInfo().pageNumber > 1) encabezadoCorto(); }
    });
    y = pdf.lastAutoTable?.finalY ?? y;
  });

  if (doc.nota) {
    letra("normal");
    const lineas = pdf.setFontSize(7.4).splitTextToSize(`Nota. ${doc.nota}`, util);
    // La nota puede usar el aire que queda sobre el pie: así no se va sola a otra hoja.
    if (y + 4.5 + lineas.length * 3.2 > alto - 12.5) y = nuevaHoja();
    texto(lineas, MARGEN, y + 5, { tam: 7.4, color: SUAVE, lineHeightFactor: 1.4 });
  }

  // Pie en cada hoja: leyenda y número de página.
  const total = pdf.getNumberOfPages();
  for (let pagina = 1; pagina <= total; pagina += 1) {
    pdf.setPage(pagina);
    pdf.setDrawColor(...LINEA).setLineWidth(0.3).line(MARGEN, alto - 11, ancho - MARGEN, alto - 11);
    texto(`${CONFIDENCIAL} · ${CONFIDENCIAL_DETALLE}`, MARGEN, alto - 7, { tam: 6.8, color: SUAVE });
    texto(`Página ${pagina} de ${total}`, ancho - MARGEN, alto - 7, { peso: "semi", tam: 6.8, color: TINTA, align: "right" });
  }

  saveReportPdf(pdf, `${nombreArchivo(doc.archivo || doc.titulo)}-${new Date().toISOString().slice(0, 10)}.pdf`, { title: doc.titulo, reportType: "consulta-padron-pdf" });
};

// Imprime o descarga el mismo documento.
export const salidaPadron = (doc, modo = "imprimir") => (modo === "pdf" ? descargarPdfPadron(doc) : imprimirDocumentoPadron(doc));
