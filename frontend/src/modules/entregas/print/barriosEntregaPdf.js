// PDF de los barrios de entrega del ciclo. Arma lo mismo que la hoja impresa
// (BarriosEntregaPrint): cifras, resumen por técnico y la tabla de barrios agrupada
// por técnico con la casilla para marcar. Con un técnico elegido lleva solo los suyos.
// Se genera en el navegador, como el de Exclusiones y Descartes.

import { saveReportPdf } from "../../../utils/printDocument";
import { gruposPorTecnico } from "../utils/avanceMes.js";
import { formatDate, formatNumber } from "../utils/entregasFormatters";

const AZUL_PROFUNDO = [11, 63, 115];
const GRIS = [246, 249, 252];
const TEXTO = [22, 36, 47];
const TEXTO_SUAVE = [91, 107, 122];
const MARCADO = [236, 247, 241];
const ABIERTO = [255, 248, 230];
const MARGEN = 40;
const ALTO_ENCABEZADO = 70;

const ESTADOS = { entregado: "Entregado", en_curso: "Lote abierto", pendiente: "Pendiente" };
const sumaClaves = (barrios) => barrios.reduce((suma, barrio) => suma + (Number(barrio.claves) || 0), 0);
const archivo = (texto) => String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const descargarBarriosEntregaPdf = async (hoja) => {
  const [{ jsPDF }, autoTableModulo] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModulo.default || autoTableModulo;
  const { mes, tecnicoId, generadoEn } = hoja;
  const barrios = tecnicoId == null ? mes.barrios : mes.barrios.filter((barrio) => barrio.responsable_id === tecnicoId);
  const grupos = gruposPorTecnico(barrios);
  const contar = (estado) => barrios.filter((barrio) => barrio.estado === estado).length;
  const claves = sumaClaves(barrios);
  const entregadas = barrios.reduce((suma, barrio) => suma + (Number(barrio.entregadas) || 0), 0);
  const unTecnico = tecnicoId != null && grupos.length === 1;
  const periodo = `${mes.ciclo_declarado ? "Ciclo" : "Mes"} desde el ${formatDate(mes.desde)}`;

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
    doc.text("Barrios de entrega de facturas", MARGEN, 44);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`${unTecnico ? `${grupos[0].nombre} · ` : ""}${periodo}`, MARGEN, 59);
    doc.setTextColor(...TEXTO);
  };

  // La cabeza y el pie siguen la alineación de su columna (los números a la derecha).
  const tabla = (head, body, startY, { didParseCell, ...opciones } = {}) => {
    const columnas = opciones.columnStyles || {};
    autoTable(doc, {
      didParseCell: (celda) => {
        const halign = columnas[celda.column.index]?.halign;
        if (celda.section !== "body" && halign && celda.cell.colSpan === 1 && !celda.cell.raw?.styles?.halign) celda.cell.styles.halign = halign;
        didParseCell?.(celda);
      },
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

  const titulo = (texto, nota, y) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...AZUL_PROFUNDO);
    doc.text(texto, MARGEN, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXTO_SUAVE);
    doc.text(nota, MARGEN, y + 11, { maxWidth: ancho - MARGEN * 2 });
    doc.setTextColor(...TEXTO);
    return y + 20;
  };

  encabezado();
  let y = ALTO_ENCABEZADO + 24;

  const cifras = [
    ["Barrios", formatNumber(barrios.length)],
    ["Entregados", formatNumber(contar("entregado"))],
    ["Lote abierto", formatNumber(contar("en_curso"))],
    ["Pendientes", formatNumber(contar("pendiente"))],
    unTecnico ? ["Claves", formatNumber(claves)] : ["Técnicos", formatNumber(grupos.length)]
  ];
  y = tabla(cifras.map(([rotulo]) => rotulo), [cifras.map(([, valor]) => valor)], y, {
    styles: { fontSize: 11, fontStyle: "bold", halign: "center", textColor: AZUL_PROFUNDO, cellPadding: 5, lineColor: [233, 238, 244], lineWidth: 0.4 },
    headStyles: { fillColor: GRIS, textColor: TEXTO_SUAVE, fontSize: 7.5, halign: "center", lineColor: AZUL_PROFUNDO, lineWidth: { bottom: 1 } }
  });

  const derecha = { halign: "right" };
  if (!unTecnico) {
    y = titulo("Resumen por técnico", "Barrios asignados en el reparto y cuántos ya se entregaron en el ciclo.", y);
    y = tabla(
      ["Técnico", "Barrios", "Entregados", "Faltan", "Claves"],
      grupos.map((grupo) => [
        grupo.nombre,
        formatNumber(grupo.barrios.length),
        formatNumber(grupo.entregados),
        formatNumber(grupo.barrios.length - grupo.entregados),
        formatNumber(sumaClaves(grupo.barrios))
      ]),
      y,
      {
        columnStyles: { 0: { fontStyle: "bold" }, 1: derecha, 2: derecha, 3: derecha, 4: derecha },
        foot: [["Total", formatNumber(barrios.length), formatNumber(contar("entregado")), formatNumber(barrios.length - contar("entregado")), formatNumber(claves)]
          .map((content, indice) => ({ content, styles: indice ? derecha : {} }))]
      }
    );
  }

  y = titulo(`Barrios y técnico responsable · ${formatNumber(barrios.length)} barrios`, "En orden de ruta dentro de cada técnico. La casilla queda para marcar en campo.", y);

  // Filas en el orden de la hoja impresa; la primera de cada técnico lleva una raya arriba.
  // Helvetica no trae "✓": la columna de la casilla se rotula "Ok".
  const filas = grupos.flatMap((grupo) => grupo.barrios.map((barrio, indice) => ({ barrio, primero: indice === 0, indice })));
  tabla(
    ["N.º", "Código", "Barrio", "Técnico", "Claves", "Estado", "Entregadas", "Ok"],
    filas.map(({ barrio, indice }) => [
      String(barrio.orden_ruta || indice + 1),
      barrio.codigo,
      barrio.nombre,
      barrio.responsable_nombre,
      formatNumber(barrio.claves),
      ESTADOS[barrio.estado] || barrio.estado,
      barrio.estado === "entregado" ? formatNumber(barrio.entregadas) : "—",
      ""
    ]),
    y,
    {
      styles: { fontSize: 7.5, cellPadding: 3, textColor: TEXTO, lineColor: [233, 238, 244], lineWidth: 0.4, overflow: "linebreak", valign: "middle" },
      // Sin rayado: el color de fondo es el del estado.
      alternateRowStyles: { fillColor: [255, 255, 255] },
      columnStyles: {
        0: { halign: "right", cellWidth: 26 },
        1: { cellWidth: 46 },
        3: { cellWidth: 110 },
        4: { halign: "right", cellWidth: 44 },
        5: { cellWidth: 64 },
        6: { halign: "right", cellWidth: 56 },
        7: { cellWidth: 26 }
      },
      foot: [[
        { content: `Total · ${formatNumber(barrios.length)} barrios`, colSpan: 4 },
        { content: formatNumber(claves), styles: derecha },
        "",
        { content: formatNumber(entregadas), styles: derecha },
        ""
      ]],
      didParseCell: (celda) => {
        if (celda.section !== "body") return;
        const fila = filas[celda.row.index];
        if (fila?.barrio.estado === "entregado") celda.cell.styles.fillColor = MARCADO;
        else if (fila?.barrio.estado === "en_curso") celda.cell.styles.fillColor = ABIERTO;
        if (fila?.primero && celda.row.index > 0) {
          celda.cell.styles.lineWidth = { top: 1, bottom: 0.4 };
          celda.cell.styles.lineColor = AZUL_PROFUNDO;
        }
      },
      // Casilla vacía dibujada para marcar en campo.
      didDrawCell: (celda) => {
        if (celda.section !== "body" || celda.column.index !== 7) return;
        const lado = 9;
        doc.setDrawColor(...TEXTO_SUAVE);
        doc.setLineWidth(0.8);
        doc.rect(celda.cell.x + (celda.cell.width - lado) / 2, celda.cell.y + (celda.cell.height - lado) / 2, lado, lado);
      }
    }
  );

  const paginas = doc.internal.getNumberOfPages();
  const generado = new Date(generadoEn || Date.now()).toLocaleString("es-HN");
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    doc.setPage(pagina);
    const alto = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXTO_SUAVE);
    doc.text(`Barrios de entrega · ${periodo}`, MARGEN, alto - 22);
    doc.text(`Generado: ${generado}`, ancho / 2, alto - 22, { align: "center" });
    doc.text(`Página ${pagina} de ${paginas}`, ancho - MARGEN, alto - 22, { align: "right" });
  }

  const nombre = `barrios-entrega-${mes.desde || "inicio"}${unTecnico ? `-${archivo(grupos[0].nombre)}` : ""}`;
  return saveReportPdf(doc, nombre, { title: "Barrios de entrega de facturas", reportType: "entregas-barrios" });
};
