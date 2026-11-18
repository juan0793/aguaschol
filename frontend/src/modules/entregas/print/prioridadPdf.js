// PDF de barrios por prioridad. Arma lo mismo que la hoja impresa (PrioridadPrint):
// cifras, línea de filtros y la tabla con la casilla para marcar, agrupada por
// técnico si así se pidió. La mora solo va si quien lo genera la puede ver.
// Se genera en el navegador, como el de Barrios de entrega.

import { saveReportPdf } from "../../../utils/printDocument";
import { formatDate, formatLempiras, formatNumber } from "../utils/entregasFormatters";
import { NIVELES, agruparPorTecnico, resumenPrioridad, textoCarga, textoFiltros, textoMotivos } from "../utils/prioridadBarrios.js";

const AZUL_PROFUNDO = [11, 63, 115];
const GRIS = [246, 249, 252];
const TEXTO = [22, 36, 47];
const TEXTO_SUAVE = [91, 107, 122];
const COLOR_NIVEL = { alta: [251, 228, 225], media: [248, 236, 210], baja: [238, 242, 246] };
const TINTA_NIVEL = { alta: [143, 31, 20], media: [107, 70, 0], baja: [61, 90, 115] };
const MARGEN = 36;
const ALTO_ENCABEZADO = 70;

// Helvetica (WinAnsi) no tiene el signo de aproximado: la carga va sin él y "~"
// sigue marcando la estimada.
const carga = (barrio) => textoCarga(barrio, formatNumber).replace("≈", "");

const archivo = (texto) => String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const descargarPrioridadPdf = async (hoja) => {
  const [{ jsPDF }, autoTableModulo] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModulo.default || autoTableModulo;
  const { barrios, opciones, datos, generadoEn } = hoja;
  const { conMora, agrupar, tecnicoNombre } = opciones;
  const resumen = resumenPrioridad(barrios);
  const conTecnico = !tecnicoNombre && !agrupar;
  const periodo = `${datos.ciclo_declarado ? "Ciclo" : "Mes"} desde el ${formatDate(datos.desde)} · al ${formatDate(datos.hoy)}`;

  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
  const ancho = doc.internal.pageSize.getWidth();

  const encabezado = () => {
    doc.setFillColor(...AZUL_PROFUNDO);
    doc.rect(0, 0, ancho, ALTO_ENCABEZADO, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("AGUAS DE CHOLUTECA · CONTROL DE ENTREGAS", MARGEN, 24);
    doc.setFontSize(15);
    doc.text("Barrios por prioridad", MARGEN, 44);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`${tecnicoNombre ? `${tecnicoNombre} · ` : ""}${periodo}`, MARGEN, 59);
    doc.setTextColor(...TEXTO);
  };

  encabezado();
  let y = ALTO_ENCABEZADO + 22;

  const cifras = [
    ["Faltan", `${formatNumber(resumen.barrios)} ${resumen.barrios === 1 ? "barrio" : "barrios"}`],
    ["Alta", formatNumber(resumen.alta)],
    ["Media", formatNumber(resumen.media)],
    ["Baja", formatNumber(resumen.baja)],
    ["Documentos", `aprox. ${formatNumber(resumen.documentos)}`],
    ...(conMora ? [["Mora", formatLempiras(resumen.mora)]] : [])
  ];
  autoTable(doc, {
    startY: y,
    head: [cifras.map(([rotulo]) => rotulo)],
    body: [cifras.map(([, valor]) => valor)],
    margin: { left: MARGEN, right: MARGEN },
    styles: { font: "helvetica", fontSize: 10.5, fontStyle: "bold", halign: "center", textColor: AZUL_PROFUNDO, cellPadding: 5, lineColor: [233, 238, 244], lineWidth: 0.4 },
    headStyles: { fillColor: GRIS, textColor: TEXTO_SUAVE, fontSize: 7.5, halign: "center", lineColor: AZUL_PROFUNDO, lineWidth: { bottom: 1 } }
  });
  y = doc.lastAutoTable.finalY + 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXTO_SUAVE);
  doc.text(textoFiltros(opciones), MARGEN, y, { maxWidth: ancho - MARGEN * 2 });
  doc.setTextColor(...TEXTO);
  y += 10;

  // Helvetica no trae "✓": la casilla se rotula "Ok".
  const cabeza = ["#", "Barrio", ...(conTecnico ? ["Técnico"] : []), "Motivo", "Docs.", ...(conMora ? ["Mora"] : []), "Prioridad", "Ok"];
  const columnaNivel = cabeza.indexOf("Prioridad");
  const columnaCasilla = cabeza.length - 1;
  const fila = (barrio) => [
    String(barrio.posicion),
    `${barrio.nombre} (${barrio.codigo})`,
    ...(conTecnico ? [barrio.responsable_nombre] : []),
    textoMotivos(barrio),
    carga(barrio),
    ...(conMora ? [formatLempiras(barrio.mora?.mora)] : []),
    NIVELES[barrio.nivel],
    ""
  ];
  const filas = [];
  const grupos = agrupar ? agruparPorTecnico(barrios) : [{ id: "todos", barrios }];
  for (const grupo of grupos) {
    if (agrupar) {
      filas.push({ grupo: true, celdas: [{ content: `${grupo.nombre} · ${formatNumber(grupo.barrios.length)} ${grupo.barrios.length === 1 ? "barrio" : "barrios"} · aprox. ${formatNumber(grupo.documentos)} documentos`, colSpan: cabeza.length, styles: { halign: "left", fontStyle: "bold", textColor: AZUL_PROFUNDO, fillColor: [255, 255, 255], lineColor: AZUL_PROFUNDO, lineWidth: { bottom: 1 } } }] });
    }
    for (const barrio of grupo.barrios) filas.push({ barrio, celdas: fila(barrio) });
  }

  const derecha = { halign: "right" };
  const columnStyles = { 0: { ...derecha, cellWidth: 20 }, 1: { fontStyle: "bold" } };
  columnStyles[cabeza.indexOf("Docs.")] = { ...derecha, cellWidth: 46 };
  if (conMora) columnStyles[cabeza.indexOf("Mora")] = { ...derecha, cellWidth: 70 };
  if (conTecnico) columnStyles[2] = { cellWidth: 92, textColor: AZUL_PROFUNDO };
  columnStyles[columnaNivel] = { cellWidth: 48 };
  columnStyles[columnaCasilla] = { cellWidth: 22 };

  autoTable(doc, {
    startY: y,
    head: [cabeza],
    body: filas.map((item) => item.celdas),
    margin: { left: MARGEN, right: MARGEN, top: ALTO_ENCABEZADO + 18, bottom: 44 },
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 3, textColor: TEXTO, lineColor: [233, 238, 244], lineWidth: 0.4, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: GRIS, textColor: AZUL_PROFUNDO, fontStyle: "bold", lineColor: AZUL_PROFUNDO, lineWidth: { bottom: 1 } },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    columnStyles,
    showHead: "everyPage",
    rowPageBreak: "avoid",
    didDrawPage: () => encabezado(),
    didParseCell: (celda) => {
      const halign = columnStyles[celda.column.index]?.halign;
      if (celda.section === "head" && halign) celda.cell.styles.halign = halign;
      if (celda.section !== "body") return;
      const item = filas[celda.row.index];
      if (item?.barrio && celda.column.index === columnaNivel) {
        celda.cell.styles.fillColor = COLOR_NIVEL[item.barrio.nivel];
        celda.cell.styles.textColor = TINTA_NIVEL[item.barrio.nivel];
        celda.cell.styles.fontStyle = "bold";
      }
    },
    // Casilla vacía dibujada para marcar en campo.
    didDrawCell: (celda) => {
      if (celda.section !== "body" || celda.column.index !== columnaCasilla || !filas[celda.row.index]?.barrio) return;
      const lado = 9;
      doc.setDrawColor(...TEXTO_SUAVE);
      doc.setLineWidth(0.8);
      doc.rect(celda.cell.x + (celda.cell.width - lado) / 2, celda.cell.y + (celda.cell.height - lado) / 2, lado, lado);
    }
  });

  y = doc.lastAutoTable.finalY + 12;
  const alto = doc.internal.pageSize.getHeight();
  if (y > alto - 52) { doc.addPage(); encabezado(); y = ALTO_ENCABEZADO + 24; }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXTO_SUAVE);
  doc.text(
    "Alta: lote abierto, anotado para la próxima jornada, sin entregas registradas o 31 días o más desde la última. Media: de 27 a 30 días. Baja: el resto. Documentos: promedio de los últimos ciclos, o claves del padrón (~) si no hay historial.",
    MARGEN, y, { maxWidth: ancho - MARGEN * 2 }
  );

  const paginas = doc.internal.getNumberOfPages();
  const generado = new Date(generadoEn || Date.now()).toLocaleString("es-HN");
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    doc.setPage(pagina);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXTO_SUAVE);
    doc.text(`Barrios por prioridad · al ${formatDate(datos.hoy)}`, MARGEN, alto - 22);
    doc.text(`Generado: ${generado}`, ancho / 2, alto - 22, { align: "center" });
    doc.text(`Página ${pagina} de ${paginas}`, ancho - MARGEN, alto - 22, { align: "right" });
  }

  const nombre = `barrios-prioridad-${datos.hoy || "hoy"}${tecnicoNombre ? `-${archivo(tecnicoNombre)}` : ""}`;
  return saveReportPdf(doc, nombre, { title: "Barrios por prioridad", reportType: "entregas-prioridad" });
};
