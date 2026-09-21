// Generacion del PDF del informe semanal, bajo demanda y siempre a partir del
// snapshot. Nada se almacena en el servidor: el archivo se arma en el navegador.
// Sigue el mismo orden y las mismas cifras que la hoja impresa, para que nadie
// tenga que comparar dos documentos distintos de la misma semana.

import { construirResumenEjecutivo } from "./weeklyReportSummary";
import {
  estadoReporteLabel,
  formatDate,
  formatNumber,
  formatPercent,
  tipoDocumentoLabel
} from "../utils/entregasFormatters";

const AZUL_PROFUNDO = [11, 63, 115];
const GRIS = [246, 249, 252];
const TEXTO = [22, 36, 47];
const TEXTO_SUAVE = [91, 107, 122];
const MARGEN = 48;
const ALTO_ENCABEZADO = 78;

const cargarJsPdf = async () => {
  const [{ jsPDF }, autoTable] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  return { jsPDF, autoTable: autoTable.default || autoTable };
};

const etiquetaTipo = (tipo) => (tipo && tipo !== "TODOS" ? tipoDocumentoLabel(tipo) : "Factura y nota de cobro");

// "▲ +230 (20.9%)" con el signo del lado correcto; el PDF no pinta color de
// tendencia porque en blanco y negro no aporta nada.
const textoTendencia = (indicador) => {
  if (!indicador) return "—";
  if (indicador.direccion === "igual") return "Sin cambio";
  const flecha = indicador.direccion === "sube" ? "▲" : "▼";
  const signo = indicador.diferencia > 0 ? "+" : "−";
  const magnitud = `${formatNumber(Math.abs(indicador.diferencia))}${indicador.unidad === "puntos" ? " pts" : ""}`;
  const variacion = indicador.variacion === null || indicador.variacion === undefined ? "" : ` (${formatPercent(indicador.variacion)})`;
  return `${flecha} ${signo}${magnitud}${variacion}`;
};

export const descargarReporteSemanalPdf = async (snapshot, { incluirAnexo = false, incluirSobrantes = false, meta = null } = {}) => {
  if (!snapshot) return;
  const { jsPDF, autoTable } = await cargarJsPdf();
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
  const ancho = doc.internal.pageSize.getWidth();
  const totales = snapshot.totales;
  const comparativo = snapshot.comparativo;
  const indicador = (clave) => comparativo?.indicadores?.find((item) => item.clave === clave) || null;

  const encabezado = () => {
    doc.setFillColor(...AZUL_PROFUNDO);
    doc.rect(0, 0, ancho, ALTO_ENCABEZADO, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8.5);
    doc.text("AGUAS DE CHOLUTECA · CONTROL DE ENTREGAS", MARGEN, 26);
    doc.setFontSize(15);
    doc.text("Reporte semanal de control de entregas", MARGEN, 48);
    doc.setFontSize(9.5);
    doc.text(snapshot.periodo.etiqueta || "", MARGEN, 65);
    doc.setTextColor(...TEXTO);
  };

  const pie = () => {
    const paginas = doc.internal.getNumberOfPages();
    for (let pagina = 1; pagina <= paginas; pagina += 1) {
      doc.setPage(pagina);
      const alto = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(...TEXTO_SUAVE);
      doc.text(
        `Período ${formatDate(snapshot.periodo.fecha_inicio)} al ${formatDate(snapshot.periodo.fecha_fin)}`,
        MARGEN,
        alto - 24
      );
      doc.text(
        `Generado: ${new Date(snapshot.generacion?.generado_en || Date.now()).toLocaleString("es-HN")}`,
        ancho / 2,
        alto - 24,
        { align: "center" }
      );
      doc.text(`Página ${pagina} de ${paginas}`, ancho - MARGEN, alto - 24, { align: "right" });
      doc.setTextColor(...TEXTO);
    }
  };

  const titulo = (texto, y) => {
    doc.setFontSize(11.5);
    doc.setTextColor(...AZUL_PROFUNDO);
    doc.text(texto, MARGEN, y);
    doc.setTextColor(...TEXTO);
    return y + 8;
  };

  const parrafos = (lineas, y) => {
    doc.setFontSize(9.5);
    let cursor = y;
    lineas.forEach((linea) => {
      const partido = doc.splitTextToSize(linea, ancho - MARGEN * 2);
      doc.text(partido, MARGEN, cursor);
      cursor += partido.length * 12 + 4;
    });
    return cursor + 8;
  };

  const tabla = (head, body, startY, opciones = {}) => {
    autoTable(doc, {
      startY,
      head: [head],
      body: body.length ? body : [[{ content: "Sin datos en el período.", colSpan: head.length }]],
      margin: { left: MARGEN, right: MARGEN, top: ALTO_ENCABEZADO + 22, bottom: 48 },
      styles: { fontSize: 8.5, cellPadding: 4.5, textColor: TEXTO, lineColor: [233, 238, 244], lineWidth: 0.4 },
      headStyles: { fillColor: GRIS, textColor: AZUL_PROFUNDO, fontStyle: "bold", lineColor: AZUL_PROFUNDO, lineWidth: { bottom: 1 } },
      alternateRowStyles: { fillColor: [250, 252, 254] },
      showHead: "everyPage",
      didDrawPage: () => encabezado(),
      ...opciones
    });
    return doc.lastAutoTable.finalY + 20;
  };

  encabezado();
  let y = ALTO_ENCABEZADO + 28;

  // --- Ficha del documento ---
  const esPreview = Boolean(snapshot.es_preview) || !meta;
  y = tabla(
    ["Dato del informe", "Detalle"],
    [
      ["Período", `${formatDate(snapshot.periodo.fecha_inicio)} al ${formatDate(snapshot.periodo.fecha_fin)}`],
      ["Tipo de documento", etiquetaTipo(snapshot.periodo.tipo_documento)],
      ["Lotes incluidos", `${formatNumber(totales.lotes)} (${formatNumber(totales.lotes_cerrados)} cerrados)`],
      ["Emitido por", snapshot.generacion?.generado_por_nombre || meta?.generado_por_nombre || "—"],
      ["Versión", esPreview ? "Vista previa" : meta.version_etiqueta || `Versión ${meta.version}`],
      ["Estado", esPreview ? "Sin archivar" : estadoReporteLabel(meta.estado)]
    ],
    y,
    { columnStyles: { 0: { fontStyle: "bold", cellWidth: 150 } } }
  );

  // --- Resumen ejecutivo ---
  const resumen = construirResumenEjecutivo(snapshot);
  if (resumen.length) {
    y = titulo("Lectura de la semana", y);
    y = parrafos(resumen, y + 8);
  }

  y = titulo("Indicadores del período", y);
  y = tabla(
    ["Indicador", "Período actual", "Período anterior", "Variación"],
    [
      ["Documentos asignados", formatNumber(totales.asignadas), "asignadas"],
      ["Entregados", formatNumber(totales.entregadas), "entregadas"],
      ["No entregados", formatNumber(totales.no_entregadas), "no_entregadas"],
      ["Pendientes de seguimiento", formatNumber(totales.pendientes), "pendientes"],
      ["Reentregados", formatNumber(totales.reentregadas), null],
      ["Efectividad", formatPercent(totales.efectividad), "efectividad"]
    ].map(([etiqueta, valor, clave]) => {
      const comparado = clave ? indicador(clave) : null;
      const anterior = comparativo?.con_datos && comparado
        ? clave === "efectividad"
          ? formatPercent(comparado.anterior)
          : formatNumber(comparado.anterior)
        : "—";
      return [etiqueta, valor, anterior, comparativo?.con_datos && comparado ? textoTendencia(comparado) : "—"];
    }),
    y + 8,
    { columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } } }
  );

  y = titulo("Avance por día", y);
  y = tabla(
    ["Día", "Lotes", "Asignados", "Entregados", "No entregados", "Efectividad"],
    snapshot.por_dia.map((fila) => [
      formatDate(fila.fecha),
      formatNumber(fila.lotes),
      formatNumber(fila.asignadas),
      formatNumber(fila.entregadas),
      formatNumber(fila.no_entregadas),
      fila.asignadas ? formatPercent(fila.efectividad) : "—"
    ]),
    y + 8,
    { columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } } }
  );

  y = titulo("Indicadores de atención", y);
  tabla(
    ["Indicador", "Casos"],
    snapshot.indicadores_atencion.map((fila) => [fila.etiqueta, formatNumber(fila.total)]),
    y + 8,
    { columnStyles: { 1: { halign: "right", cellWidth: 70 } } }
  );

  // --- Desempeño ---
  doc.addPage();
  encabezado();
  y = ALTO_ENCABEZADO + 28;

  const destacados = snapshot.destacados;
  if (destacados?.mejor_responsable) {
    y = titulo("Puntos destacados del período", y);
    y = tabla(
      ["Lectura", "Quién o dónde", "Resultado"],
      [
        destacados.mejor_responsable && [
          "Mejor desempeño",
          destacados.mejor_responsable.responsable_nombre,
          formatPercent(destacados.mejor_responsable.efectividad)
        ],
        destacados.responsable_a_reforzar && [
          "Requiere apoyo",
          destacados.responsable_a_reforzar.responsable_nombre,
          formatPercent(destacados.responsable_a_reforzar.efectividad)
        ],
        destacados.barrio_critico && [
          "Zona más difícil",
          destacados.barrio_critico.barrio_nombre,
          formatPercent(destacados.barrio_critico.efectividad)
        ],
        destacados.mejor_dia && [
          "Mejor jornada",
          formatDate(destacados.mejor_dia.fecha),
          formatPercent(destacados.mejor_dia.efectividad)
        ]
      ].filter(Boolean),
      y + 8,
      { columnStyles: { 0: { fontStyle: "bold", cellWidth: 130 }, 2: { halign: "right", cellWidth: 80 } } }
    );
  }

  y = titulo("Rendimiento por responsable", y);
  y = tabla(
    ["Responsable", "Documento", "Lotes", "Asignados", "Entregados", "Pendientes", "Efectividad"],
    snapshot.por_responsable.map((fila) => [
      fila.responsable_nombre,
      tipoDocumentoLabel(fila.tipo_predominante),
      formatNumber(fila.lotes),
      formatNumber(fila.asignadas),
      formatNumber(fila.entregadas),
      formatNumber(fila.pendientes),
      formatPercent(fila.efectividad)
    ]),
    y + 8,
    { columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } } }
  );

  y = titulo("Resultado por tipo de documento", y);
  tabla(
    ["Tipo de documento", "Lotes", "Asignados", "Entregados", "No entregados", "Pendientes", "Efectividad"],
    (snapshot.por_tipo_documento || []).map((fila) => [
      tipoDocumentoLabel(fila.tipo_documento),
      formatNumber(fila.lotes),
      formatNumber(fila.asignadas),
      formatNumber(fila.entregadas),
      formatNumber(fila.no_entregadas),
      formatNumber(fila.pendientes),
      fila.asignadas ? formatPercent(fila.efectividad) : "—"
    ]),
    y + 8,
    { columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } } }
  );

  // --- Territorio y causas ---
  doc.addPage();
  encabezado();
  y = ALTO_ENCABEZADO + 28;

  y = titulo("Resultado por barrio", y);
  y = tabla(
    ["Barrio o colonia", "Lotes", "Asignados", "Entregados", "No entregados", "Pendientes", "Efectividad"],
    snapshot.por_barrio.map((fila) => [
      fila.barrio_nombre,
      formatNumber(fila.lotes),
      formatNumber(fila.asignadas),
      formatNumber(fila.entregadas),
      formatNumber(fila.no_entregadas),
      formatNumber(fila.pendientes),
      formatPercent(fila.efectividad)
    ]),
    y + 8,
    { columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } } }
  );

  y = titulo("Motivos de no entrega", y);
  tabla(
    ["Motivo declarado por el personal de campo", "Casos", "Participación"],
    snapshot.por_motivo.map((fila) => [fila.motivo_etiqueta, formatNumber(fila.total), formatPercent(fila.porcentaje)]),
    y + 8,
    { columnStyles: { 1: { halign: "right", cellWidth: 70 }, 2: { halign: "right", cellWidth: 90 } } }
  );

  // --- Seguimiento ---
  doc.addPage();
  encabezado();
  y = ALTO_ENCABEZADO + 28;

  y = titulo("Observaciones del personal de campo", y);
  y = tabla(
    ["Responsable", "Barrio", "Fecha", "Observación"],
    snapshot.observaciones.map((fila) => [
      fila.responsable_nombre,
      fila.barrio_nombre,
      formatDate(fila.fecha),
      fila.texto
    ]),
    y + 8,
    { columnStyles: { 3: { cellWidth: "auto" } } }
  );

  const pendientes = incluirAnexo && snapshot.anexo_pendientes?.length
    ? snapshot.anexo_pendientes
    : snapshot.pendientes_prioritarios;

  y = titulo(incluirAnexo && snapshot.anexo_pendientes?.length ? "Anexo · pendientes completos" : "Pendientes prioritarios", y);
  y = tabla(
    ["Abonado", "Clave catastral", "Barrio", "Responsable", "Motivo", "Días", "Intentos"],
    pendientes.map((fila) => [
      fila.numero_abonado || "—",
      fila.clave_catastral || "—",
      fila.barrio_nombre,
      fila.responsable_nombre,
      fila.motivo_etiqueta,
      formatNumber(fila.dias_pendiente),
      formatNumber(fila.intentos)
    ]),
    y + 8,
    { columnStyles: { 5: { halign: "right", cellWidth: 40 }, 6: { halign: "right", cellWidth: 50 } } }
  );

  // Las personas que quedaron sin su documento en los lotes ya cerrados. Va al
  // final porque es un anexo y su largo depende del periodo.
  const sobrantes = incluirSobrantes && snapshot.anexo_sobrantes?.length ? snapshot.anexo_sobrantes : [];
  if (sobrantes.length) {
    y = titulo("Anexo · sobrantes de lotes cerrados", y);
    tabla(
      ["Persona", "Abonado", "Clave catastral", "Barrio", "Motivo", "Lote", "Responsable"],
      sobrantes.map((fila) => [
        fila.abonado_nombre || "Sin nombre registrado",
        fila.numero_abonado || "—",
        fila.clave_catastral || "—",
        fila.barrio_nombre || "—",
        fila.motivo_etiqueta || "—",
        `#${fila.lote_id}`,
        fila.responsable_nombre || "—"
      ]),
      y + 8,
      { columnStyles: { 5: { halign: "right", cellWidth: 40 } } }
    );
  }

  pie();
  doc.save(`reporte-entregas-${snapshot.periodo.fecha_inicio}-a-${snapshot.periodo.fecha_fin}.pdf`);
};
