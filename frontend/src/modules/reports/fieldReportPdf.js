// Informe de campo en PDF (técnico con coordenadas o censo sin coordenadas) para una o
// varias jornadas. Con varias jornadas, cada día empieza en su propia hoja, para poder
// adjuntar los puntos día por día; al inicio va el resumen de todas.
import {
  REPORT_POINT_ALERT_BORDER_RGB,
  REPORT_POINT_ALERT_FILL_RGB,
  REPORT_POINT_ALERT_RGB,
  REPORT_POINT_DANGER_BORDER_RGB,
  REPORT_POINT_DANGER_FILL_RGB,
  REPORT_POINT_DANGER_RGB,
  getMapPointPadronNames,
  getMapPointReferenceNote,
  getMapPointReportReferenceLabel,
  getMapPointTechnicalDescription,
  getMapReportTechniciansLabel,
  isAlertReportPoint,
  isRedReportPoint
} from "../../utils/mapReport";
import { formatCoordinate, getMapPointTypeLabel } from "../../utils/mapField";
import { fechaConDia, fechaLarga, textoJornadas } from "./utils/informeJornadas";
import { getPointTypeStyle } from "../campo/pointTypes";

const ZONA = "America/Tegucigalpa";
const AZUL_PROFUNDO = [11, 63, 115];
const AZUL = [20, 101, 217];
const TINTA = [22, 36, 47];
const TENUE = [91, 107, 122];
const BANDA = [238, 244, 251];
const BORDE = [201, 213, 224];
const MARGEN = 14;
const PIE = 14;

const hora = (iso) =>
  iso ? new Intl.DateTimeFormat("es-HN", { timeZone: ZONA, hour: "numeric", minute: "2-digit" }).format(new Date(iso)) : "--";

const rgb = (hex) => {
  const limpio = String(hex || "#1465d9").replace("#", "");
  return [0, 2, 4].map((inicio) => parseInt(limpio.slice(inicio, inicio + 2), 16) || 0);
};

// Tipos de punto presentes, con el color con que se dibujan en el mapa.
const leyendaDeTipos = (zonas) => {
  const vistos = new Map();
  for (const zona of zonas) {
    for (const punto of zona.items) {
      const estilo = getPointTypeStyle(punto.point_type);
      const etiqueta = getMapPointTypeLabel(punto.point_type);
      if (!vistos.has(etiqueta)) vistos.set(etiqueta, estilo.color);
    }
  }
  return [...vistos].map(([label, color]) => ({ label, color }));
};

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

const totalesPorTipo = (jornadas) => {
  const totales = {};
  for (const jornada of jornadas) {
    for (const [tipo, total] of Object.entries(jornada.data.totalsByType || {})) totales[tipo] = (totales[tipo] || 0) + total;
  }
  return Object.entries(totales).sort((a, b) => b[1] - a[1]);
};

const cajasDe = (data) => data.zones.reduce((total, zone) => total + zone.items.filter((point) => point.point_type === "caja_registro").length, 0);

const estiloPunto = (data) => {
  if (data.section !== "body") return;
  const punto = data.row.raw?.rawPoint;
  if (isAlertReportPoint(punto)) {
    data.cell.styles.textColor = REPORT_POINT_ALERT_RGB;
    data.cell.styles.fillColor = REPORT_POINT_ALERT_FILL_RGB;
    data.cell.styles.lineColor = REPORT_POINT_ALERT_BORDER_RGB;
  } else if (isRedReportPoint(punto)) {
    data.cell.styles.textColor = REPORT_POINT_DANGER_RGB;
    data.cell.styles.fillColor = REPORT_POINT_DANGER_FILL_RGB;
    data.cell.styles.lineColor = REPORT_POINT_DANGER_BORDER_RGB;
  } else {
    return;
  }
  if (data.column.index === 1) data.cell.styles.fontStyle = "bold";
};

const tablaBase = {
  theme: "grid",
  showHead: "everyPage",
  rowPageBreak: "avoid",
  styles: { font: "helvetica", fontSize: 7.6, cellPadding: 1.8, textColor: TINTA, lineColor: BORDE, lineWidth: 0.2, overflow: "linebreak", valign: "top" },
  headStyles: { fillColor: AZUL, textColor: [255, 255, 255], fontStyle: "bold" },
  alternateRowStyles: { fillColor: [248, 251, 255] }
};

/**
 * @param {object} opciones
 * @param {"technical"|"census"} opciones.tipo
 * @param {{ dateKey: string, data: object }[]} opciones.jornadas  ya filtradas por barrio
 */
export function crearInformeCampoPdf({ jsPDF, autoTable, tipo = "technical", jornadas = [], settings = {}, staff = {}, padronNames = {}, logoDataUrl = "", mapaGeneral = "", leyendaGeneral = null, mapasPorDia = {}, generadoEn = "" }) {
  const mapImageDataUrl = mapaGeneral;
  const tecnico = tipo !== "census";
  const doc = new jsPDF({ orientation: tecnico ? "landscape" : "portrait", unit: "mm", format: "letter", compress: true });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const util = ancho - MARGEN * 2;
  const varias = jornadas.length > 1;
  const claves = jornadas.map((jornada) => jornada.dateKey);
  const jornadasTexto = textoJornadas(claves);
  const titulo = String(settings.title || "").trim() || "Reporte de levantamiento de campo";
  const subtitulo = String(settings.subtitle || "").trim() || "Aguas de Choluteca, S.A. de C.V.";
  const notas = String(settings.report_notes || "").trim();
  const totalPuntos = jornadas.reduce((total, jornada) => total + jornada.data.totalPoints, 0);
  const barrios = new Set(jornadas.flatMap((jornada) => jornada.data.zones.map((zone) => zone.overrideKey || zone.zone)));
  const totalCajas = jornadas.reduce((total, jornada) => total + cajasDe(jornada.data), 0);

  // Leyenda: un punto de color y su nombre, en renglones que no pasan del ancho dado.
  const dibujarLeyenda = (items, x, yInicio, anchoMax) => {
    let cx = x;
    let cy = yInicio;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    for (const { label, color } of items) {
      const anchoItem = doc.getTextWidth(label) + 5.5;
      if (cx + anchoItem > x + anchoMax && cx > x) { cx = x; cy += 4.4; }
      doc.setFillColor(...rgb(color));
      doc.circle(cx + 1.5, cy - 1.1, 1.4, "F");
      doc.setTextColor(...TINTA);
      doc.text(label, cx + 4, cy);
      cx += anchoItem + 3.5;
    }
    return cy + 2;
  };
  const ponerMapa = (imagen, x, yMapa, anchoMapa, altoMapa) => {
    doc.setDrawColor(...BORDE);
    doc.setLineWidth(0.3);
    doc.rect(x, yMapa, anchoMapa, altoMapa);
    doc.addImage(imagen, imagen.startsWith("data:image/jpeg") ? "JPEG" : "PNG", x + 0.4, yMapa + 0.4, anchoMapa - 0.8, altoMapa - 0.8);
  };

  // ---------- Encabezado ----------
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, "PNG", MARGEN, 10, 17, 17); } catch { /* el informe sigue sin logo */ }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...AZUL_PROFUNDO);
  doc.text(titulo, MARGEN + 21, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TENUE);
  doc.text(subtitulo, MARGEN + 21, 21.5);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(tecnico ? "INFORME TÉCNICO CON COORDENADAS" : "CENSO SIN COORDENADAS", ancho - MARGEN, 14, { align: "right" });
  doc.setFontSize(10);
  doc.setTextColor(...AZUL_PROFUNDO);
  const jornadaLineas = doc.splitTextToSize(`${varias ? "Jornadas" : "Jornada"}: ${jornadasTexto}`, util * 0.45);
  doc.text(jornadaLineas, ancho - MARGEN, 19.5, { align: "right" });
  const finCabeza = Math.max(28, 19.5 + jornadaLineas.length * 4.2);
  doc.setDrawColor(...AZUL_PROFUNDO);
  doc.setLineWidth(0.6);
  doc.line(MARGEN, finCabeza, ancho - MARGEN, finCabeza);

  // Ficha de datos: etiqueta tenue arriba, valor en tinta.
  const ficha = [
    [varias ? "Jornadas" : "Jornada", varias ? `${jornadas.length} jornadas` : fechaLarga(claves[0] || "")],
    ["Puntos", String(totalPuntos)],
    ["Barrios", String(barrios.size)],
    ["Cajas de registro", String(totalCajas)],
    ["Técnicos", getMapReportTechniciansLabel(staff) || "--"],
    ["Ingeniero de datos", staff.data_engineer || "--"],
    ["Generado", generadoEn || "--"]
  ];
  // En la hoja vertical (censo) la ficha va en dos filas para que nada se parta.
  const personas = ["Técnicos", "Ingeniero de datos"];
  const grupos = tecnico ? [ficha] : [ficha.filter(([etiqueta]) => !personas.includes(etiqueta)), ficha.filter(([etiqueta]) => personas.includes(etiqueta))];
  let y = finCabeza + 3;
  for (const grupo of grupos) {
    autoTable(doc, {
      startY: y,
      body: [grupo.map(([etiqueta]) => etiqueta), grupo.map(([, valor]) => valor)],
      theme: "plain",
      styles: { font: "helvetica", fontSize: 8.4, cellPadding: { top: 0.6, bottom: 0.6, left: 1.5, right: 1.5 }, textColor: TINTA, overflow: "linebreak" },
      didParseCell: (data) => {
        if (data.row.index === 0) { data.cell.styles.fontSize = 7; data.cell.styles.textColor = TENUE; data.cell.styles.fontStyle = "bold"; }
        else data.cell.styles.fontStyle = "bold";
      },
      margin: { left: MARGEN, right: MARGEN }
    });
    y = (doc.lastAutoTable?.finalY ?? y + 10) + 1.5;
  }
  y += 3.5;

  // ---------- Resumen ----------
  const anchoResumen = mapImageDataUrl ? util * 0.42 : util;
  const inicioResumen = y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...AZUL_PROFUNDO);
  doc.text("Resumen por tipo de punto", MARGEN, y);
  const tipos = totalesPorTipo(jornadas);
  autoTable(doc, {
    ...tablaBase,
    startY: y + 2,
    head: [["Tipo de punto", "Puntos"]],
    body: tipos.length ? tipos.map(([tipoPunto, total]) => [tipoPunto, String(total)]) : [["Sin puntos", "0"]],
    styles: { ...tablaBase.styles, fontSize: 8.2 },
    columnStyles: { 1: { halign: "right", cellWidth: 20 } },
    tableWidth: Math.min(90, anchoResumen),
    margin: { left: MARGEN, right: MARGEN }
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 6;

  if (varias) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...AZUL_PROFUNDO);
    doc.text("Resumen por jornada", MARGEN, y);
    autoTable(doc, {
      ...tablaBase,
      startY: y + 2,
      head: [["Día", "Fecha", "Puntos", "Barrios", "Cajas"]],
      body: jornadas.map((jornada, indice) => [
        `Día ${indice + 1}`,
        fechaConDia(jornada.dateKey),
        String(jornada.data.totalPoints),
        String(jornada.data.totalZones),
        String(cajasDe(jornada.data))
      ]),
      foot: [["Total", "", String(totalPuntos), String(barrios.size), String(totalCajas)]],
      footStyles: { fillColor: BANDA, textColor: AZUL_PROFUNDO, fontStyle: "bold" },
      didParseCell: (data) => { if (data.section === "foot" && data.column.index >= 2) data.cell.styles.halign = "right"; },
      styles: { ...tablaBase.styles, fontSize: 8.2 },
      columnStyles: { 0: { cellWidth: 13 }, 2: { halign: "right", cellWidth: 15 }, 3: { halign: "right", cellWidth: 15 }, 4: { halign: "right", cellWidth: 14 } },
      tableWidth: Math.min(150, anchoResumen),
      margin: { left: MARGEN, right: MARGEN }
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 6;
  }

  if (mapImageDataUrl) {
    // Zona trabajada: a la derecha del resumen, con su leyenda debajo.
    const xMapa = MARGEN + anchoResumen + 6;
    const anchoMapa = ancho - MARGEN - xMapa;
    const altoMapa = Math.min(alto - inicioResumen - PIE - 22, anchoMapa * (820 / 1400));
    try {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...AZUL_PROFUNDO);
      doc.text(varias ? "Zona trabajada en las jornadas" : "Zona trabajada en la jornada", xMapa, inicioResumen);
      ponerMapa(mapImageDataUrl, xMapa, inicioResumen + 2, anchoMapa, altoMapa);
      const leyenda = leyendaGeneral || leyendaDeTipos(jornadas.flatMap((jornada) => jornada.data.zones));
      const finLeyenda = leyenda.length ? dibujarLeyenda(leyenda, xMapa, inicioResumen + altoMapa + 7, anchoMapa) : inicioResumen + altoMapa + 4;
      y = Math.max(y, finLeyenda + 4);
    } catch { /* sin mapa, el informe sigue */ }
  }

  if (notas) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...AZUL_PROFUNDO);
    doc.text("Observaciones", MARGEN, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.6);
    doc.setTextColor(...TINTA);
    const lineas = doc.splitTextToSize(notas, util);
    doc.text(lineas, MARGEN, y + 5);
    y += lineas.length * 4 + 9;
  }

  // ---------- Detalle por jornada y barrio ----------
  const columnas = tecnico
    ? {
      head: [["#", "Tipo", "Latitud", "Longitud", "Precisión", "Referencia cercana", "Referencia", "Descripción", "Hora"]],
      fila: (punto, indice) => [
        String(indice + 1),
        `${getMapPointTypeLabel(punto.point_type)}${punto.is_terminal_point ? " · pin final" : ""}`,
        formatCoordinate(punto.latitude),
        formatCoordinate(punto.longitude),
        punto.accuracy_meters ? `${punto.accuracy_meters} m` : "--",
        punto.suggested_reference || "--",
        getMapPointReferenceNote(punto) || "--",
        getMapPointTechnicalDescription(punto) || "--",
        hora(punto.created_at)
      ],
      estilos: { 0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 26 }, 2: { cellWidth: 19 }, 3: { cellWidth: 19 }, 4: { cellWidth: 18 }, 5: { cellWidth: 36 }, 6: { cellWidth: 35 }, 8: { cellWidth: 17 } }
    }
    : {
      head: [["#", "Clave / abonado", "Nombre en padrón", "Tipo", "Referencia", "Descripción"]],
      fila: (punto, indice, zona) => [
        String(indice + 1),
        getMapPointReportReferenceLabel(punto),
        getMapPointPadronNames(punto, padronNames),
        getMapPointTypeLabel(punto.point_type),
        getMapPointReferenceNote(punto) || zona.displayLocation || "--",
        getMapPointTechnicalDescription(punto) || "--"
      ],
      estilos: { 0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 28 }, 2: { cellWidth: 38 }, 3: { cellWidth: 24 }, 4: { cellWidth: 34 } }
    };

  const nuevaHoja = () => { doc.addPage("letter", tecnico ? "landscape" : "portrait"); return 16; };

  jornadas.forEach((jornada, indiceDia) => {
    if (varias) {
      // Cada día en su propia hoja: se puede separar y adjuntar por día.
      y = nuevaHoja();
      doc.setFillColor(...AZUL_PROFUNDO);
      doc.rect(MARGEN, y, util, 11, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text(`Día ${indiceDia + 1} · ${fechaConDia(jornada.dateKey)}`, MARGEN + 4, y + 7.2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`${plural(jornada.data.totalPoints, "punto", "puntos")} · ${plural(jornada.data.totalZones, "barrio", "barrios")}`, ancho - MARGEN - 4, y + 7.2, { align: "right" });
      y += 16;

      // Mapa del día a la izquierda; a la derecha, sus barrios y la leyenda de tipos.
      const mapaDia = mapasPorDia[jornada.dateKey];
      if (mapaDia) {
        const anchoMapa = util * 0.6;
        const altoMapa = anchoMapa * (640 / 1200);
        try {
          ponerMapa(mapaDia, MARGEN, y, anchoMapa, altoMapa);
          const xLado = MARGEN + anchoMapa + 8;
          const anchoLado = ancho - MARGEN - xLado;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(...AZUL_PROFUNDO);
          doc.text("Barrios del día", xLado, y + 4);
          let yLado = y + 9.5;
          doc.setFontSize(8.4);
          for (const zona of jornada.data.zones) {
            if (yLado > y + altoMapa - 22) { doc.setFont("helvetica", "normal"); doc.setTextColor(...TENUE); doc.text(`y ${plural(jornada.data.zones.length - jornada.data.zones.indexOf(zona), "barrio", "barrios")} más`, xLado, yLado); yLado += 4.6; break; }
            doc.setFont("helvetica", "normal");
            doc.setTextColor(...TINTA);
            doc.text(doc.splitTextToSize(zona.displayName || zona.zone, anchoLado - 18)[0], xLado, yLado);
            doc.setTextColor(...TENUE);
            doc.text(String(zona.items.length), ancho - MARGEN, yLado, { align: "right" });
            yLado += 4.6;
          }
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.4);
          doc.setTextColor(...AZUL_PROFUNDO);
          doc.text("Tipos de punto", xLado, yLado + 3);
          dibujarLeyenda(leyendaDeTipos(jornada.data.zones), xLado, yLado + 8, anchoLado);
          y += altoMapa + 7;
        } catch { /* sin mapa del día, siguen las tablas */ }
      }
    } else if (y > alto - 60) {
      y = nuevaHoja();
    }

    if (!jornada.data.zones.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...TENUE);
      doc.text("Esta jornada no tiene puntos en los barrios elegidos.", MARGEN, y + 4);
      y += 10;
      return;
    }

    jornada.data.zones.forEach((zona, indiceZona) => {
      doc.setFontSize(8.4);
      const referencia = doc.splitTextToSize(`Referencia sugerida: ${zona.displayReference || "Sin contexto cercano"}`, util - 8);
      const ubicacion = doc.splitTextToSize(`Ubicación: ${zona.displayLocation || "Sin dirección ampliada"}`, util - 8);
      const lineas = tecnico ? [...referencia, ...ubicacion] : ubicacion;
      const altoBanda = 8 + lineas.length * 3.8;
      if (y + altoBanda + 22 > alto - PIE - 4) y = nuevaHoja();

      doc.setFillColor(...BANDA);
      doc.rect(MARGEN, y, util, altoBanda, "F");
      doc.setFillColor(...AZUL);
      doc.rect(MARGEN, y, 1.2, altoBanda, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...AZUL_PROFUNDO);
      doc.text(`${zona.displayKicker || `Zona ${indiceZona + 1}`}: ${zona.displayName || zona.zone}`, MARGEN + 4, y + 5.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...TENUE);
      doc.text(plural(zona.items.length, "punto", "puntos"), ancho - MARGEN - 4, y + 5.5, { align: "right" });
      doc.setFontSize(8.4);
      doc.text(lineas, MARGEN + 4, y + 9.6);

      autoTable(doc, {
        ...tablaBase,
        startY: y + altoBanda + 2,
        head: columnas.head,
        body: zona.items.map((punto, indice) => {
          const fila = columnas.fila(punto, indice, zona);
          fila.rawPoint = punto;
          return fila;
        }),
        didParseCell: estiloPunto,
        columnStyles: columnas.estilos,
        margin: { left: MARGEN, right: MARGEN, top: 16, bottom: PIE + 4 }
      });
      y = (doc.lastAutoTable?.finalY ?? y + 20) + 7;
    });
  });

  // ---------- Pie en todas las hojas ----------
  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    doc.setPage(pagina);
    doc.setDrawColor(...BORDE);
    doc.setLineWidth(0.3);
    doc.line(MARGEN, alto - PIE + 2, ancho - MARGEN, alto - PIE + 2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TENUE);
    doc.text(`${titulo} · ${varias ? "Jornadas" : "Jornada"}: ${jornadasTexto}`, MARGEN, alto - PIE + 6.5, { maxWidth: util - 40 });
    doc.text(`Página ${pagina} de ${paginas}`, ancho - MARGEN, alto - PIE + 6.5, { align: "right" });
  }

  return doc;
}
