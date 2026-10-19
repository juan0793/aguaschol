// Informe de campo en PDF (técnico con coordenadas o censo sin coordenadas) para una o
// varias jornadas, pensado para el catastro: se ordena por zona, no por día.
//
// - Hoja 1: datos, resumen por tipo y por jornada, y el mapa general con el índice de
//   láminas (un recuadro por lámina).
// - Después, cada barrio una sola vez (aunque se haya trabajado en varios días), partido en
//   láminas: cada lámina es un mapa a todo el ancho con los puntos numerados y, debajo, la
//   tabla de esos puntos. El folio del mapa es el "#" de la tabla y el día es una columna.
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
import { getMapPointTypeLabel } from "../../utils/mapField";
import { fechaConDia, fechaLarga, textoJornadas } from "./utils/informeJornadas";
import { getPointTypeStyle } from "../campo/pointTypes";

const ZONA = "America/Tegucigalpa";
const AZUL_PROFUNDO = [11, 63, 115];
const AZUL = [20, 101, 217];
const TINTA = [22, 36, 47];
const TENUE = [91, 107, 122];
const BANDA = [238, 244, 251];
const BORDE = [201, 213, 224];
const FILETE = [223, 229, 236];
const MARGEN = 14;
const PIE = 14;
// Proporción de la imagen de cada lámina (1800 × 800 px).
const PROPORCION_LAMINA = 800 / 1800;

const fechaCorta = new Intl.DateTimeFormat("es-HN", { timeZone: ZONA, day: "numeric", month: "short" });
const horaCorta = new Intl.DateTimeFormat("es-HN", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const fechaHora = (punto) => {
  const fecha = punto.created_at ? new Date(punto.created_at) : null;
  if (!fecha || Number.isNaN(fecha.getTime())) return punto.__dia ? fechaCorta.format(new Date(`${punto.__dia}T12:00:00`)).replace(".", "") : "--";
  return `${fechaCorta.format(fecha).replace(".", "")} ${horaCorta.format(fecha)}`;
};

const rgb = (hex) => {
  const limpio = String(hex || "#1465d9").replace("#", "");
  return [0, 2, 4].map((inicio) => parseInt(limpio.slice(inicio, inicio + 2), 16) || 0);
};

const plural = (n, uno, varios) => `${n.toLocaleString("es-HN")} ${n === 1 ? uno : varios}`;

const coordenada = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero.toFixed(6) : "--";
};

// La descripción del técnico suele empezar con la clave: ya va en su columna.
const CLAVE_AL_INICIO = /^\s*-?\d{2,3}-\d{2,3}-\d{2,3}(?:-\d{2})?\s*[,.;:-]?\s*/;
const descripcionDe = (punto) => {
  const texto = (getMapPointTechnicalDescription(punto) || "").replace(CLAVE_AL_INICIO, "").replace(/\s+/g, " ").trim();
  const referencia = getMapPointReferenceNote(punto);
  const partes = [texto, referencia && !texto.includes(referencia) ? `Ref.: ${referencia}` : ""].filter(Boolean);
  return partes.join(" · ") || "--";
};

const tipoCorto = (tipo) => getPointTypeStyle(tipo).short || getMapPointTypeLabel(tipo);

// Tipos de punto presentes, con el color con que se dibujan en el mapa.
const leyendaDeTipos = (puntos) => {
  const vistos = new Map();
  for (const punto of puntos) {
    const etiqueta = getMapPointTypeLabel(punto.point_type);
    if (!vistos.has(etiqueta)) vistos.set(etiqueta, getPointTypeStyle(punto.point_type).color);
  }
  return [...vistos].map(([label, color]) => ({ label, color }));
};

const totalesPorTipo = (jornadas) => {
  const totales = {};
  for (const jornada of jornadas) {
    for (const [tipo, total] of Object.entries(jornada.data.totalsByType || {})) totales[tipo] = (totales[tipo] || 0) + total;
  }
  return Object.entries(totales).sort((a, b) => b[1] - a[1]);
};

const esCaja = (punto) => punto.point_type === "caja_registro";
const cajasDe = (data) => data.zones.reduce((total, zone) => total + zone.items.filter(esCaja).length, 0);

const estiloPunto = (data) => {
  if (data.section !== "body") return;
  const punto = data.row.raw?.rawPoint;
  if (!punto) return;
  if (isAlertReportPoint(punto)) {
    data.cell.styles.textColor = REPORT_POINT_ALERT_RGB;
    data.cell.styles.fillColor = REPORT_POINT_ALERT_FILL_RGB;
    data.cell.styles.lineColor = REPORT_POINT_ALERT_BORDER_RGB;
  } else if (isRedReportPoint(punto)) {
    data.cell.styles.textColor = REPORT_POINT_DANGER_RGB;
    data.cell.styles.fillColor = REPORT_POINT_DANGER_FILL_RGB;
    data.cell.styles.lineColor = REPORT_POINT_DANGER_BORDER_RGB;
  }
};

const tablaBase = {
  theme: "grid",
  showHead: "everyPage",
  rowPageBreak: "avoid",
  styles: { font: "helvetica", fontSize: 7.2, cellPadding: { top: 1.2, bottom: 1.2, left: 1.4, right: 1.4 }, textColor: TINTA, lineColor: FILETE, lineWidth: 0.2, overflow: "linebreak", valign: "top" },
  headStyles: { fillColor: AZUL_PROFUNDO, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.2 },
  alternateRowStyles: { fillColor: [248, 251, 255] }
};

/**
 * @param {object} opciones
 * @param {"technical"|"census"} opciones.tipo
 * @param {{ dateKey: string, data: object }[]} opciones.jornadas  ya filtradas por barrio (para los resúmenes)
 * @param {object[]} opciones.barrios  barrios unidos entre jornadas, con `laminas` y `items` en orden de folio
 * @param {object[]} opciones.laminas  láminas con `imagen` (puede faltar si no hay mapa)
 * @param {Map} opciones.folios  folio de cada punto
 */
export function crearInformeCampoPdf({ jsPDF, autoTable, tipo = "technical", jornadas = [], barrios = [], laminas = [], folios = new Map(), settings = {}, staff = {}, padronNames = {}, logoDataUrl = "", mapaGeneral = "", leyendaGeneral = null, generadoEn = "" }) {
  const tecnico = tipo !== "census";
  const orientacion = tecnico ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation: orientacion, unit: "mm", format: "letter", compress: true });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const util = ancho - MARGEN * 2;
  const limiteInferior = alto - PIE - 4;
  const varias = jornadas.length > 1;
  const claves = jornadas.map((jornada) => jornada.dateKey);
  const jornadasTexto = textoJornadas(claves);
  const titulo = String(settings.title || "").trim() || "Reporte de levantamiento de campo";
  const subtitulo = String(settings.subtitle || "").trim() || "Aguas de Choluteca, S.A. de C.V.";
  const notas = String(settings.report_notes || "").trim();
  const totalPuntos = jornadas.reduce((total, jornada) => total + jornada.data.totalPoints, 0);
  const totalCajas = jornadas.reduce((total, jornada) => total + cajasDe(jornada.data), 0);
  const imagenDe = new Map(laminas.filter((lamina) => lamina.imagen).map((lamina) => [lamina.numero, lamina.imagen]));
  const conLaminas = imagenDe.size > 0;
  const nuevaHoja = () => { doc.addPage("letter", orientacion); return 16; };
  const titulito = (texto, x, yTexto) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...AZUL_PROFUNDO);
    doc.text(texto, x, yTexto);
  };

  // Leyenda: un punto de color y su nombre, en renglones que no pasan del ancho dado.
  const dibujarLeyenda = (items, x, yInicio, anchoMax, { alinearDerecha = false } = {}) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    const medidas = items.map((item) => doc.getTextWidth(item.label) + 5.5);
    let cx = alinearDerecha ? x + anchoMax - Math.min(anchoMax, medidas.reduce((t, m) => t + m + 3.5, -3.5)) : x;
    let cy = yInicio;
    items.forEach(({ label, color }, indice) => {
      if (cx + medidas[indice] > x + anchoMax && cx > x) { cx = x; cy += 4.2; }
      doc.setFillColor(...rgb(color));
      doc.circle(cx + 1.5, cy - 1.1, 1.35, "F");
      doc.setTextColor(...TINTA);
      doc.text(label, cx + 4, cy);
      cx += medidas[indice] + 3.5;
    });
    return cy + 2;
  };
  const ponerMapa = (imagen, x, yMapa, anchoMapa, altoMapa) => {
    doc.addImage(imagen, imagen.startsWith("data:image/jpeg") ? "JPEG" : "PNG", x, yMapa, anchoMapa, altoMapa);
    doc.setDrawColor(...BORDE);
    doc.setLineWidth(0.3);
    doc.rect(x, yMapa, anchoMapa, altoMapa);
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
    ["Puntos", totalPuntos.toLocaleString("es-HN")],
    ["Barrios", String(barrios.length)],
    ...(conLaminas ? [["Láminas", String(laminas.length)]] : []),
    ["Cajas de registro", totalCajas.toLocaleString("es-HN")],
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

  // ---------- Resumen e índice de láminas ----------
  // En horizontal (técnico) el mapa va a la derecha; en vertical (censo), debajo.
  const anchoResumen = mapaGeneral && tecnico ? util * 0.38 : util;
  const inicioResumen = y;
  const tablaResumen = (cabeza, filas, opciones = {}) => {
    autoTable(doc, {
      ...tablaBase,
      startY: y + 2,
      head: [cabeza],
      body: filas,
      styles: { ...tablaBase.styles, fontSize: 7.8 },
      headStyles: { ...tablaBase.headStyles, fontSize: 7.8 },
      tableWidth: anchoResumen,
      margin: { left: MARGEN, right: ancho - MARGEN - anchoResumen },
      ...opciones
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 6;
  };

  const dibujarMapaGeneral = () => {
    if (!mapaGeneral) return;
    try {
      const leyenda = leyendaGeneral || leyendaDeTipos(barrios.flatMap((barrio) => barrio.items));
      const tituloMapa = conLaminas ? "Zona trabajada e índice de láminas" : varias ? "Zona trabajada en las jornadas" : "Zona trabajada en la jornada";
      if (tecnico) {
        const xMapa = MARGEN + anchoResumen + 7;
        const anchoMapa = ancho - MARGEN - xMapa;
        const altoMapa = Math.min(limiteInferior - inicioResumen - 14, anchoMapa * (820 / 1400));
        titulito(tituloMapa, xMapa, inicioResumen);
        ponerMapa(mapaGeneral, xMapa, inicioResumen + 2, anchoMapa, altoMapa);
        if (leyenda.length) dibujarLeyenda(leyenda, xMapa, inicioResumen + altoMapa + 7, anchoMapa);
      } else {
        const altoMapa = util * (820 / 1400);
        if (y + altoMapa + 16 > limiteInferior) y = nuevaHoja();
        titulito(tituloMapa, MARGEN, y);
        ponerMapa(mapaGeneral, MARGEN, y + 2, util, altoMapa);
        y = (leyenda.length ? dibujarLeyenda(leyenda, MARGEN, y + altoMapa + 7, util) : y + altoMapa + 4) + 5;
      }
    } catch { /* sin mapa, el informe sigue */ }
  };

  if (!tecnico) dibujarMapaGeneral();

  titulito("Puntos por tipo", MARGEN, y);
  const tipos = totalesPorTipo(jornadas);
  tablaResumen(["Tipo de punto", "Puntos"], tipos.length ? tipos.map(([tipoPunto, total]) => [tipoPunto, total.toLocaleString("es-HN")]) : [["Sin puntos", "0"]], {
    columnStyles: { 1: { halign: "right", cellWidth: 18 } }
  });

  if (varias) {
    titulito("Puntos por jornada", MARGEN, y);
    tablaResumen(["Día", "Fecha", "Puntos", "Cajas"], jornadas.map((jornada, indice) => [
      String(indice + 1),
      fechaConDia(jornada.dateKey),
      jornada.data.totalPoints.toLocaleString("es-HN"),
      cajasDe(jornada.data).toLocaleString("es-HN")
    ]), {
      foot: [["", "Total", totalPuntos.toLocaleString("es-HN"), totalCajas.toLocaleString("es-HN")]],
      footStyles: { fillColor: BANDA, textColor: AZUL_PROFUNDO, fontStyle: "bold", fontSize: 7.8 },
      didParseCell: (data) => { if (data.section === "foot" && data.column.index >= 2) data.cell.styles.halign = "right"; },
      columnStyles: { 0: { cellWidth: 9, halign: "center" }, 2: { halign: "right", cellWidth: 15 }, 3: { halign: "right", cellWidth: 13 } }
    });
  }

  if (conLaminas) {
    titulito("Índice de láminas", MARGEN, y);
    const porBarrio = new Map(barrios.map((barrio) => [barrio.overrideKey || barrio.zone, barrio.displayName || barrio.zone]));
    tablaResumen(["Lámina", "Barrio", "Folios", "Puntos"], laminas.map((lamina) => [
      `L${lamina.numero}`,
      porBarrio.get(lamina.barrio) || lamina.barrio,
      lamina.desde === lamina.hasta ? String(lamina.desde) : `${lamina.desde}–${lamina.hasta}`,
      lamina.puntos.length.toLocaleString("es-HN")
    ]), {
      columnStyles: { 0: { cellWidth: 13, fontStyle: "bold" }, 2: { cellWidth: 20 }, 3: { halign: "right", cellWidth: 14 } }
    });
  }

  if (tecnico) dibujarMapaGeneral();

  if (notas) {
    const lineas = doc.splitTextToSize(notas, anchoResumen);
    if (y + lineas.length * 4 + 8 > limiteInferior) y = nuevaHoja();
    titulito("Observaciones", MARGEN, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.6);
    doc.setTextColor(...TINTA);
    doc.text(lineas, MARGEN, y + 5);
    y += lineas.length * 4 + 9;
  }

  // ---------- Tabla de puntos ----------
  const columnas = tecnico
    ? {
      head: [["#", "Clave", "Tipo", "Descripción", "Coordenadas", "± m", "Fecha"]],
      fila: (punto) => [
        String(folios.get(punto) ?? ""),
        punto.report_key || "--",
        tipoCorto(punto.point_type),
        descripcionDe(punto),
        `${coordenada(punto.latitude)}, ${coordenada(punto.longitude)}`,
        Number(punto.accuracy_meters) > 0 ? Number(punto.accuracy_meters).toLocaleString("es-HN", { maximumFractionDigits: 1 }) : "--",
        fechaHora(punto)
      ],
      estilos: { 0: { cellWidth: 10, halign: "center", fontStyle: "bold" }, 1: { cellWidth: 22, fontStyle: "bold" }, 2: { cellWidth: 20 }, 4: { cellWidth: 34, fontSize: 6.8 }, 5: { cellWidth: 9, halign: "right", fontSize: 6.8 }, 6: { cellWidth: 18, fontSize: 6.8 } }
    }
    : {
      head: [["#", "Clave / abonado", "Nombre en padrón", "Tipo", "Descripción", "Fecha"]],
      fila: (punto) => [
        String(folios.get(punto) ?? ""),
        getMapPointReportReferenceLabel(punto),
        getMapPointPadronNames(punto, padronNames),
        tipoCorto(punto.point_type),
        descripcionDe(punto),
        fechaHora(punto)
      ],
      estilos: { 0: { cellWidth: 10, halign: "center", fontStyle: "bold" }, 1: { cellWidth: 26, fontStyle: "bold" }, 2: { cellWidth: 36 }, 3: { cellWidth: 19 }, 5: { cellWidth: 18, fontSize: 6.8 } }
    };
  const columnaTipo = tecnico ? 2 : 3;
  const tablaDePuntos = (puntos, startY) => {
    autoTable(doc, {
      ...tablaBase,
      startY,
      head: columnas.head,
      body: puntos.map((punto) => Object.assign(columnas.fila(punto), { rawPoint: punto })),
      didParseCell: (data) => {
        estiloPunto(data);
        if (data.section === "body" && data.column.index === columnaTipo) data.cell.styles.cellPadding = { top: 1.2, bottom: 1.2, left: 4.2, right: 1.2 };
      },
      // Un punto del color del tipo, como en el mapa.
      didDrawCell: (data) => {
        if (data.section !== "body" || data.column.index !== columnaTipo) return;
        const punto = data.row.raw?.rawPoint;
        if (!punto) return;
        doc.setFillColor(...rgb(getPointTypeStyle(punto.point_type).color));
        doc.circle(data.cell.x + 2.2, data.cell.y + 2.75, 1.05, "F");
      },
      columnStyles: columnas.estilos,
      margin: { left: MARGEN, right: MARGEN, top: 16, bottom: PIE + 4 }
    });
    return (doc.lastAutoTable?.finalY ?? startY + 20) + 6;
  };

  // ---------- Barrios y láminas ----------
  const anchoLamina = util;
  const altoLamina = util * PROPORCION_LAMINA;
  // En horizontal el mapa general ocupa la columna derecha de la hoja 1: los barrios
  // empiezan en otra hoja. En vertical siguen donde termina el índice si caben.
  if (tecnico) y = nuevaHoja();
  else y += 4;
  barrios.forEach((barrio) => {
    const propias = (barrio.laminas || []).filter((lamina) => imagenDe.has(lamina.numero));
    const referencia = String(barrio.displayReference || "").trim();
    const datos = [
      plural(barrio.items.length, "punto", "puntos"),
      `${plural(barrio.clavesTotal ?? 0, "clave", "claves")}`,
      plural(barrio.items.filter(esCaja).length, "caja", "cajas"),
      tecnico && barrio.averageAccuracy != null ? `precisión promedio ${barrio.averageAccuracy} m` : "",
      varias && barrio.dias?.length ? (barrio.dias.length === 1 ? fechaLarga(barrio.dias[0]) : `${barrio.dias.length} jornadas`) : ""
    ].filter(Boolean).join(" · ");
    doc.setFontSize(8);
    const lineaRef = tecnico && referencia ? doc.splitTextToSize(`Referencia: ${referencia}`, util - 8)[0] : "";
    const altoBanda = lineaRef ? 15 : 11;
    const primerBloque = propias.length ? altoLamina + 10 : 0;
    if (y > 16 && y + altoBanda + primerBloque + 18 > limiteInferior) y = nuevaHoja();

    // Encabezado del barrio: nombre y láminas arriba, cifras debajo.
    doc.setFillColor(...BANDA);
    doc.rect(MARGEN, y, util, altoBanda, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...AZUL_PROFUNDO);
    doc.text(barrio.displayName || barrio.zone, MARGEN + 3.5, y + 5.6);
    if (propias.length) {
      doc.setFontSize(8.5);
      const rango = propias.length === 1 ? `Lámina L${propias[0].numero}` : `Láminas L${propias[0].numero} a L${propias[propias.length - 1].numero}`;
      doc.text(rango, ancho - MARGEN - 3.5, y + 5.6, { align: "right" });
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TENUE);
    doc.text(datos, MARGEN + 3.5, y + 9.6);
    if (lineaRef) doc.text(lineaRef, MARGEN + 3.5, y + 13.4);
    y += altoBanda + 4;

    if (!propias.length) {
      y = tablaDePuntos(barrio.items, y);
      return;
    }
    propias.forEach((lamina) => {
      // El mapa se achica (hasta el 70 %) si así cabe en lo que queda de la hoja.
      const disponible = limiteInferior - y - 26;
      const escala = disponible >= altoLamina ? 1 : disponible >= altoLamina * 0.7 ? disponible / altoLamina : 0;
      if (!escala) y = nuevaHoja();
      const factor = escala || 1;
      // Rótulo de la lámina a la izquierda y los tipos presentes a la derecha.
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...AZUL_PROFUNDO);
      const rotulo = `Lámina L${lamina.numero}`;
      doc.text(rotulo, MARGEN, y + 3);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...TENUE);
      const detalle = ` · folios ${lamina.desde === lamina.hasta ? lamina.desde : `${lamina.desde} al ${lamina.hasta}`} · ${plural(lamina.puntos.length, "punto", "puntos")}`;
      doc.setFontSize(9.5);
      const anchoRotulo = doc.getTextWidth(rotulo);
      doc.setFontSize(8);
      doc.text(detalle.trim(), MARGEN + anchoRotulo + 1.6, y + 3);
      dibujarLeyenda(leyendaDeTipos(lamina.puntos), MARGEN + util * 0.45, y + 3, util * 0.55, { alinearDerecha: true });
      try {
        ponerMapa(imagenDe.get(lamina.numero), MARGEN, y + 5.5, anchoLamina * factor, altoLamina * factor);
        y += altoLamina * factor + 9;
      } catch {
        y += 7;
      }
      y = tablaDePuntos(lamina.puntos, y);
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
