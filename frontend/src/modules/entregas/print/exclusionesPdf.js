// PDF de la lista de Exclusiones con lo que se ve en pantalla. Arma lo mismo que la
// hoja impresa (ExclusionesPrint): cifras, cada cuenta con su saldo y su entrega del
// ciclo, y la fila de totales. Se genera en el navegador, como el de Descartes.

import { saveReportPdf } from "../../../utils/printDocument";
import { cuentaTexto, entregaTexto } from "../utils/exclusiones";
import { formatDate, formatLempiras, formatNumber } from "../utils/entregasFormatters";

const AZUL_PROFUNDO = [11, 63, 115];
const GRIS = [246, 249, 252];
const TEXTO = [22, 36, 47];
const TEXTO_SUAVE = [91, 107, 122];
const MARCADO = [236, 247, 241];
const MARGEN = 40;
const ALTO_ENCABEZADO = 70;

const plural = (n, uno, varios) => `${formatNumber(n)} ${n === 1 ? uno : varios}`;

export const descargarExclusionesPdf = async (hoja) => {
  const [{ jsPDF }, autoTableModulo] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModulo.default || autoTableModulo;
  const { ciclo, filtros, totales, lista, verSaldo } = hoja;
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: verSaldo ? "landscape" : "portrait" });
  const ancho = doc.internal.pageSize.getWidth();
  const entregadas = totales.por_estado.ENTREGADA + totales.por_estado.REENTREGADA;

  const encabezado = () => {
    doc.setFillColor(...AZUL_PROFUNDO);
    doc.rect(0, 0, ancho, ALTO_ENCABEZADO, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("AGUAS DE CHOLUTECA · CONTROL DE ENTREGAS", MARGEN, 24);
    doc.setFontSize(15);
    doc.text("Exclusiones de entrega", MARGEN, 44);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Cuentas que entrega otro departamento · ciclo del ${formatDate(ciclo.desde)} al ${formatDate(ciclo.hasta)}`, MARGEN, 59);
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

  encabezado();
  let y = ALTO_ENCABEZADO + 24;

  if (filtros.length) y = tabla(["Filtro", "Valor"], filtros.map((filtro) => [filtro.rotulo, filtro.valor]), y, { columnStyles: { 0: { fontStyle: "bold", cellWidth: 110 } } });

  const cifras = [
    ["Excluidas", formatNumber(totales.total)],
    ["Entregadas por técnico", formatNumber(entregadas)],
    ["Sin entregar", formatNumber(totales.por_estado.SOBRANTE)],
    ["Sin lote", formatNumber(totales.por_estado.SIN_LOTE + totales.por_estado.LOTE_ABIERTO + totales.por_estado.SIN_BARRIO)],
    verSaldo ? ["Saldo", formatLempiras(totales.saldo)] : ["Sin padrón", formatNumber(totales.por_estado.SIN_BARRIO)]
  ];
  y = tabla(cifras.map(([rotulo]) => rotulo), [cifras.map(([, valor]) => valor)], y, {
    styles: { fontSize: 11, fontStyle: "bold", halign: "center", textColor: AZUL_PROFUNDO, cellPadding: 5, lineColor: [233, 238, 244], lineWidth: 0.4 },
    headStyles: { fillColor: GRIS, textColor: TEXTO_SUAVE, fontSize: 7.5, halign: "center", lineColor: AZUL_PROFUNDO, lineWidth: { bottom: 1 } }
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...AZUL_PROFUNDO);
  doc.text(`Cuentas excluidas · ${plural(totales.total, "cuenta", "cuentas")}`, MARGEN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXTO_SUAVE);
  doc.text("Una factura entregada no deja registro propio: si el barrio tuvo un lote cerrado y la cuenta no quedó de sobrante, el técnico la contó como entregada.", MARGEN, y + 11, { maxWidth: ancho - MARGEN * 2 });
  doc.setTextColor(...TEXTO);
  y += 22;

  const cabeza = ["N.º", "Abonado / clave", "Nombre", ...(verSaldo ? ["Capital", "Mora", "Saldo"] : []), "Este ciclo", "Motivo"];
  const cuerpo = lista.map((item, indice) => {
    const cuenta = cuentaTexto(item);
    const entrega = entregaTexto(item);
    const monto = (campo) => (item.saldo ? formatLempiras(item.saldo[campo]) : "—");
    return [
      String(indice + 1),
      `${item.valor}\n${item.tipo === "CLAVE" ? "Clave" : "Abonado"}`,
      `${cuenta.nombre}${cuenta.linea ? `\n${cuenta.linea}` : ""}`,
      ...(verSaldo ? [monto("capital"), monto("mora"), monto("total")] : []),
      `${entrega.etiqueta}\n${entrega.detalle}${entrega.antes ? `\n${entrega.antes}` : ""}`,
      item.nota || "Otro departamento"
    ];
  });
  const derecha = { halign: "right", cellWidth: 64 };
  tabla(cabeza, cuerpo, y, {
    styles: { fontSize: 7.5, cellPadding: 3, textColor: TEXTO, lineColor: [233, 238, 244], lineWidth: 0.4, overflow: "linebreak", valign: "top" },
    columnStyles: Object.fromEntries(cabeza.map((nombre, indice) => [indice, {
      "N.º": { halign: "right", cellWidth: 22 },
      "Abonado / clave": { cellWidth: 64 },
      Capital: derecha,
      Mora: derecha,
      Saldo: { ...derecha, fontStyle: "bold" },
      Motivo: { cellWidth: 80 }
    }[nombre] || {}])),
    foot: [[
      { content: `Total · ${plural(totales.total, "cuenta", "cuentas")}`, colSpan: 3 },
      ...(verSaldo ? [totales.capital, totales.mora, totales.saldo].map((valor) => ({ content: formatLempiras(valor), styles: { halign: "right" } })) : []),
      { content: `${plural(entregadas, "entregada por técnico", "entregadas por técnico")} · ${plural(totales.por_estado.SOBRANTE, "sin entregar", "sin entregar")}`, colSpan: 2 }
    ]],
    // Las que el técnico entregó van marcadas también en el PDF.
    didParseCell: (celda) => {
      const estado = lista[celda.row.index]?.entrega?.estado;
      if (celda.section === "body" && (estado === "ENTREGADA" || estado === "REENTREGADA")) celda.cell.styles.fillColor = MARCADO;
    }
  });

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

  return saveReportPdf(doc, `exclusiones-ciclo-${ciclo.desde || "inicio"}`, { title: "Exclusiones de entrega", reportType: "entregas-exclusiones" });
};
