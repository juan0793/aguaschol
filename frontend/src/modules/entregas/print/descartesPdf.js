// PDF de la lista de Descartes con los filtros de la pantalla. Arma lo mismo que la
// hoja impresa (DescartesPrint): filtros, cifras, reparto por técnico y por barrio
// y cada documento con su fila de totales. Se genera en el navegador.

import { saveReportPdf } from "../../../utils/printDocument";
import { antecedenteTexto } from "../utils/descartes";
import { estadoDocumentoLabel, formatDate, formatNumber, tipoDocumentoLabel } from "../utils/entregasFormatters";

const AZUL_PROFUNDO = [11, 63, 115];
const GRIS = [246, 249, 252];
const TEXTO = [22, 36, 47];
const TEXTO_SUAVE = [91, 107, 122];
const MARCADO = [253, 246, 236];
const MARGEN = 40;
const ALTO_ENCABEZADO = 70;

const plural = (n, uno, varios) => `${formatNumber(n)} ${n === 1 ? uno : varios}`;

export const descargarDescartesPdf = async (hoja) => {
  const [{ jsPDF }, autoTableModulo] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModulo.default || autoTableModulo;
  const { ciclo, filtros, columnas, totales, lista, motivos } = hoja;
  const motivoDe = (codigo) => motivos.find((item) => item.codigo === codigo)?.etiqueta || String(codigo || "—").replaceAll("_", " ");
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
  const ancho = doc.internal.pageSize.getWidth();
  const periodoCiclo = ciclo.fecha_inicio ? `del ${formatDate(ciclo.fecha_inicio)} al ${formatDate(ciclo.fecha_fin)}` : `hasta el ${formatDate(ciclo.fecha_fin)}`;

  const encabezado = () => {
    doc.setFillColor(...AZUL_PROFUNDO);
    doc.rect(0, 0, ancho, ALTO_ENCABEZADO, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("AGUAS DE CHOLUTECA · CONTROL DE ENTREGAS", MARGEN, 24);
    doc.setFontSize(15);
    doc.text("Control de descartes", MARGEN, 44);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Documentos sin entregar · ciclo ${periodoCiclo}`, MARGEN, 59);
    doc.setTextColor(...TEXTO);
  };

  const tabla = (head, body, startY, opciones = {}) => {
    autoTable(doc, {
      startY,
      head: [head],
      body,
      margin: { left: MARGEN, right: MARGEN, top: ALTO_ENCABEZADO + 18, bottom: 44 },
      styles: { font: "helvetica", fontSize: 8, cellPadding: 3.5, textColor: TEXTO, lineColor: [233, 238, 244], lineWidth: 0.4, overflow: "linebreak" },
      headStyles: { fillColor: GRIS, textColor: AZUL_PROFUNDO, fontStyle: "bold", lineColor: AZUL_PROFUNDO, lineWidth: { bottom: 1 } },
      footStyles: { fillColor: [255, 255, 255], textColor: AZUL_PROFUNDO, fontStyle: "bold", lineColor: AZUL_PROFUNDO, lineWidth: { top: 1 } },
      showHead: "everyPage",
      showFoot: "lastPage",
      didDrawPage: () => encabezado(),
      ...opciones
    });
    return doc.lastAutoTable.finalY + 16;
  };

  const titulo = (texto, y) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...AZUL_PROFUNDO);
    doc.text(texto, MARGEN, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXTO);
    return y + 6;
  };

  encabezado();
  let y = ALTO_ENCABEZADO + 24;

  // Filtros aplicados y cifras de lo filtrado.
  const filasFiltros = filtros.map((filtro) => [filtro.rotulo, filtro.valor]);
  if (filtros.length === 1) filasFiltros.push(["Filtros", "Sin filtros: todo lo sin entregar"]);
  y = titulo("Filtros aplicados", y);
  y = tabla(["Filtro", "Valor"], filasFiltros, y, { columnStyles: { 0: { fontStyle: "bold", cellWidth: 110 } } });

  y = tabla(
    ["Sin entregar", "Repetidos", "Sin responsable", "Técnicos", "Barrios"],
    [[totales.documentos, totales.repetidos, totales.sin_responsable, totales.tecnicos, totales.por_barrio.length].map(formatNumber)],
    y,
    { styles: { fontSize: 11, fontStyle: "bold", halign: "center", textColor: AZUL_PROFUNDO, cellPadding: 5, lineColor: [233, 238, 244], lineWidth: 0.4 }, headStyles: { fillColor: GRIS, textColor: TEXTO_SUAVE, fontSize: 7.5, halign: "center", lineColor: AZUL_PROFUNDO, lineWidth: { bottom: 1 } } }
  );

  // Reparto por técnico y por barrio, lado a lado; el que el filtro deja en una fila se omite.
  const repartos = [
    columnas.tecnico ? ["Técnico", totales.por_tecnico] : null,
    columnas.barrio ? ["Barrio", totales.por_barrio] : null
  ].filter(Boolean);
  if (repartos.length) {
    y = titulo("Totales", y);
    const hueco = 14;
    const anchoUno = repartos.length === 2 ? (ancho - MARGEN * 2 - hueco) / 2 : (ancho - MARGEN * 2) * 0.6;
    const inicio = y;
    const pagina = doc.internal.getCurrentPageInfo().pageNumber;
    let fin = y;
    let paginaFin = pagina;
    repartos.forEach(([rotulo, filas], indice) => {
      doc.setPage(pagina);
      const izquierda = MARGEN + indice * (anchoUno + hueco);
      autoTable(doc, {
        startY: inicio,
        tableWidth: anchoUno,
        head: [[rotulo, "Sin entregar", "Repetidos"]],
        body: filas.map((fila) => [fila.nombre, formatNumber(fila.documentos), formatNumber(fila.repetidos)]),
        foot: [["Total", { content: formatNumber(totales.documentos), styles: { halign: "right" } }, { content: formatNumber(totales.repetidos), styles: { halign: "right" } }]],
        margin: { left: izquierda, right: ancho - izquierda - anchoUno, top: ALTO_ENCABEZADO + 18, bottom: 44 },
        styles: { fontSize: 8, cellPadding: 3, textColor: TEXTO, lineColor: [233, 238, 244], lineWidth: 0.4 },
        headStyles: { fillColor: GRIS, textColor: AZUL_PROFUNDO, fontStyle: "bold", lineColor: AZUL_PROFUNDO, lineWidth: { bottom: 1 } },
        footStyles: { fillColor: [255, 255, 255], textColor: AZUL_PROFUNDO, fontStyle: "bold", lineColor: AZUL_PROFUNDO, lineWidth: { top: 1 } },
        columnStyles: { 1: { halign: "right", cellWidth: 62 }, 2: { halign: "right", cellWidth: 54 } },
        showHead: "everyPage",
        showFoot: "lastPage",
        didDrawPage: () => encabezado()
      });
      const paginaTabla = doc.internal.getCurrentPageInfo().pageNumber;
      if (paginaTabla > paginaFin || (paginaTabla === paginaFin && doc.lastAutoTable.finalY > fin)) {
        paginaFin = paginaTabla;
        fin = doc.lastAutoTable.finalY;
      }
    });
    doc.setPage(paginaFin);
    y = fin + 16;
  }

  // Cada documento; la columna que el filtro deja con un solo valor se omite.
  y = titulo(`Documentos sin entregar · ${plural(totales.documentos, "documento", "documentos")}`, y);
  const cabeza = [
    "N.º",
    columnas.fecha ? "Fecha" : null,
    "Abonado / clave",
    "Nombre",
    columnas.barrio ? "Barrio" : null,
    columnas.tecnico ? "Técnico" : null,
    "Motivo",
    "Antecedentes",
    "Estado"
  ].filter(Boolean);
  const cuerpo = lista.map((item, indice) => [
    String(indice + 1),
    columnas.fecha ? formatDate(item.fecha_lote) : null,
    `${item.numero_abonado || "Sin abonado"}
${item.clave_catastral || "Sin clave"}`,
    `${item.abonado_nombre || "Sin nombre registrado"}\n${tipoDocumentoLabel(item.tipo_documento)} · Lote #${item.lote_id}`,
    columnas.barrio ? item.barrio_nombre || "Sin barrio" : null,
    columnas.tecnico ? item.responsable_nombre || "Sin responsable" : null,
    motivoDe(item.motivo),
    antecedenteTexto(item),
    estadoDocumentoLabel(item.estado)
  ].filter((celda) => celda !== null));
  const total = `${plural(totales.documentos, "documento sin entregar", "documentos sin entregar")} · ${plural(totales.repetidos, "repetido", "repetidos")} · ${plural(totales.abonados, "abonado", "abonados")}`;
  tabla(cabeza, cuerpo, y, {
    styles: { fontSize: 7.5, cellPadding: 3, textColor: TEXTO, lineColor: [233, 238, 244], lineWidth: 0.4, overflow: "linebreak", valign: "top" },
    // Anchos fijos para lo corto; Nombre, Barrio y Motivo se reparten el resto.
    columnStyles: Object.fromEntries(cabeza.map((nombre, indice) => [indice, {
      "N.º": { halign: "right", cellWidth: 22 },
      Fecha: { cellWidth: 46 },
      "Abonado / clave": { cellWidth: 60 },
      Técnico: { cellWidth: 66 },
      Antecedentes: { cellWidth: 62 },
      Estado: { cellWidth: 52 }
    }[nombre] || {}])),
    foot: [[{ content: "Total", colSpan: 2 }, { content: total, colSpan: cabeza.length - 2 }]],
    // Los repetidos van marcados también en el PDF.
    didParseCell: (celda) => {
      if (celda.section === "body" && lista[celda.row.index]?.repetido) celda.cell.styles.fillColor = MARCADO;
    }
  });

  // Pie con fecha de generación y número de página en cada hoja.
  const paginas = doc.internal.getNumberOfPages();
  const generado = new Date(hoja.generadoEn || Date.now()).toLocaleString("es-HN");
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    doc.setPage(pagina);
    const alto = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXTO_SUAVE);
    doc.text("Uso interno · Administración y Gerencia", MARGEN, alto - 22);
    doc.text(`Generado: ${generado}`, ancho / 2, alto - 22, { align: "center" });
    doc.text(`Página ${pagina} de ${paginas}`, ancho - MARGEN, alto - 22, { align: "right" });
  }

  const sufijo = hoja.dia || `ciclo-${ciclo.fecha_inicio || "inicio"}-a-${ciclo.fecha_fin || ""}`;
  return saveReportPdf(doc, `descartes-${sufijo}`, { title: "Control de descartes", reportType: "entregas-descartes" });
};
