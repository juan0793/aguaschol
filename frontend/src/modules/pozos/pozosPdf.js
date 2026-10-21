// Informes en PDF de la red de pozos (sin React; los arma informesPozos.js). Cuatro documentos
// con una identidad propia de hoja técnica: encabezado con doble filete "nivel de agua",
// tonos agua y teal, escalas de pH y TDS dibujadas y un cajetín al pie de cada hoja, como en
// un plano (documento, fuente, fecha y hoja). Todos parten de la lista filtrada en pantalla.
//
// - inventario: cifras, gráficos, mapa general y la tabla de todos los pozos (horizontal).
// - fichas: una hoja técnica por pozo (vertical).
// - calidad: pH y TDS contra el valor guía, solo pozos medidos (vertical).
// - levantamiento: lo que falta medir, por colonia, con mapa y casillas para campo (vertical).
import { CALIDADES, DATOS, RANGOS, calidadDe, faltantesDe, formatoNumero, fueraDeRango, histograma, pozosPorColonia } from "./pozosFiltros.js";

const TINTA = [16, 42, 67];
const TENUE = [82, 103, 124];
const AGUA = [14, 94, 111];
const AGUA_CLARO = [234, 245, 246];
const AZUL = [20, 101, 217];
const FILETE = [221, 229, 236];
const COLOR = { dentro: [24, 166, 137], fuera: [201, 42, 58], sin: [163, 177, 192], en_uso: [20, 101, 217], fuera_de_uso: [213, 145, 36], sin_dato: [163, 177, 192] };
const FUERA_FONDO = [253, 236, 238];
const OCRE_FONDO = [255, 247, 232];
const OCRE = [154, 90, 6];
const MARGEN = 14;
const ALTO_CAJETIN = 13;

export const TIPOS_INFORME = {
  inventario: { titulo: "Inventario de pozos", codigo: "POZ-INV", orientacion: "landscape", archivo: "inventario-pozos" },
  fichas: { titulo: "Fichas técnicas de pozos", codigo: "POZ-FIC", orientacion: "portrait", archivo: "fichas-pozos" },
  calidad: { titulo: "Calidad del agua en pozos", codigo: "POZ-CAL", orientacion: "portrait", archivo: "calidad-agua-pozos" },
  levantamiento: { titulo: "Plan de levantamiento de pozos", codigo: "POZ-LEV", orientacion: "portrait", archivo: "levantamiento-pozos" }
};

const NORMA = "Valores guía: pH de 6.5 a 8.5 y sólidos totales disueltos (TDS) hasta 1 g/L (1000 mg/L), Norma Técnica Nacional para la Calidad del Agua Potable de Honduras.";
const ETIQUETA_CALIDAD = { dentro: "Dentro del valor guía", fuera: "Fuera del valor guía", sin: "Sin medición" };
const plural = (n, uno, varios) => `${Number(n).toLocaleString("es-HN")} ${n === 1 ? uno : varios}`;
const vacio = (valor) => valor === null || valor === undefined || valor === "";
const numero = (valor, decimales) => (vacio(valor) ? "--" : formatoNumero(valor, decimales, true));
const conUnidad = (valor, unidad, decimales) => (vacio(valor) ? "--" : `${formatoNumero(valor, decimales)} ${unidad}`);
const usoTexto = (pozo) => (pozo.en_uso === true ? "En uso" : pozo.en_uso === false ? "Fuera de uso" : "Sin dato");
const numeroCodigo = (pozo) => String(pozo.codigo || "").replace(/^\D+/, "") || String(pozo.id);

// Pozos con algo por levantar, por colonia (la de más pendientes primero) y por código.
export const planPorColonia = (pozos = []) => {
  const grupos = new Map();
  pozos.forEach((pozo) => {
    const faltan = faltantesDe(pozo);
    if (!faltan.length) return;
    const colonia = pozo.colonia || "Sin colonia";
    if (!grupos.has(colonia)) grupos.set(colonia, []);
    grupos.get(colonia).push({ pozo, faltan });
  });
  const porCodigo = (a, b) => Number(numeroCodigo(a.pozo)) - Number(numeroCodigo(b.pozo)) || (a.pozo.id ?? 0) - (b.pozo.id ?? 0);
  return [...grupos.entries()]
    .map(([colonia, items]) => ({ colonia, items: items.sort(porCodigo), datos: items.reduce((suma, item) => suma + item.faltan.length, 0) }))
    .sort((a, b) => b.items.length - a.items.length || a.colonia.localeCompare(b.colonia, "es"));
};

const tablaBase = {
  theme: "grid",
  showHead: "everyPage",
  rowPageBreak: "avoid",
  styles: { font: "helvetica", fontSize: 7.4, cellPadding: { top: 1.3, bottom: 1.3, left: 1.5, right: 1.5 }, textColor: TINTA, lineColor: FILETE, lineWidth: 0.2, overflow: "linebreak", valign: "middle" },
  headStyles: { fillColor: AGUA, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.2 },
  alternateRowStyles: { fillColor: [248, 251, 252] }
};

/**
 * @param {object} opciones
 * @param {"inventario"|"fichas"|"calidad"|"levantamiento"} opciones.tipo
 * @param {object[]} opciones.pozos  la lista filtrada, en el orden de pantalla
 * @param {string} [opciones.alcance]  qué filtros se aplicaron ("Todos los pozos", "Bo. Guadalupe · Fuera del valor guía"…)
 * @param {string} [opciones.mapaGeneral]  mapa de todos los pozos con coordenada (inventario y calidad)
 * @param {Map} [opciones.mapas]  mapa por pozo (fichas, clave id) o por colonia (levantamiento, clave nombre)
 */
export function crearInformePozos({ jsPDF, autoTable, tipo, pozos = [], alcance = "", fuente = "", logoDataUrl = "", mapaGeneral = "", mapas = new Map(), generadoEn = "" }) {
  const info = TIPOS_INFORME[tipo];
  if (!info) throw new Error("Tipo de informe no reconocido.");
  const doc = new jsPDF({ orientation: info.orientacion, unit: "mm", format: "letter", compress: true });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const util = ancho - MARGEN * 2;
  const limite = alto - ALTO_CAJETIN - 8;
  const nuevaHoja = () => { doc.addPage("letter", info.orientacion); return encabezado({ compacto: true }); };

  const texto = (contenido, x, y, { tam = 8.4, negrita = false, color = TINTA, alinear = "left", max } = {}) => {
    doc.setFont("helvetica", negrita ? "bold" : "normal");
    doc.setFontSize(tam);
    doc.setTextColor(...color);
    const lineas = Array.isArray(contenido) ? contenido : max ? doc.splitTextToSize(String(contenido), max) : String(contenido);
    doc.text(lineas, x, y, { align: alinear });
    return Array.isArray(lineas) ? lineas.length : 1;
  };

  const partir = (contenido, max, tam, negrita = false) => {
    doc.setFont("helvetica", negrita ? "bold" : "normal");
    doc.setFontSize(tam);
    return doc.splitTextToSize(String(contenido), max);
  };

  // Encabezado: logo, sello de la red, título y el código del documento; debajo el doble filete.
  function encabezado({ compacto = false, titulo = info.titulo, subtitulo = alcance } = {}) {
    const top = 10;
    const lado = compacto ? 11 : 16;
    if (logoDataUrl) {
      try { doc.addImage(logoDataUrl, "PNG", MARGEN, top, lado, lado); } catch { /* sigue sin logo */ }
    }
    const x = MARGEN + lado + 4;
    texto("AGUAS DE CHOLUTECA  ·  RED DE POZOS", x, top + 3, { tam: 6.8, negrita: true, color: AGUA });
    // Bloque del código, a la derecha; el título se achica si no cabe antes del bloque.
    const anchoBloque = 46;
    const maxTitulo = ancho - MARGEN - anchoBloque - 6 - x;
    let tam = compacto ? 12 : 16;
    doc.setFont("helvetica", "bold");
    while (tam > 10 && doc.setFontSize(tam).getTextWidth(titulo) > maxTitulo) tam -= 0.5;
    const tituloVisible = doc.getTextWidth(titulo) > maxTitulo ? `${doc.splitTextToSize(titulo, maxTitulo - 3)[0]}…` : titulo;
    texto(tituloVisible, x, top + (compacto ? 8.6 : 10), { tam, negrita: true });
    if (!compacto && subtitulo) texto(partir(subtitulo, maxTitulo, 8.6)[0], x, top + 15.2, { tam: 8.6, color: TENUE });
    const bx = ancho - MARGEN - anchoBloque;
    doc.setDrawColor(...AGUA);
    doc.setLineWidth(0.35);
    doc.rect(bx, top, anchoBloque, compacto ? 11 : 14);
    texto("DOCUMENTO", bx + 2.5, top + 3.6, { tam: 5.8, negrita: true, color: TENUE });
    texto(info.codigo, bx + 2.5, top + (compacto ? 8.6 : 9.4), { tam: compacto ? 10 : 12, negrita: true, color: AGUA });
    if (!compacto) texto(generadoEn, bx + 2.5, top + 12.4, { tam: 6.4, color: TENUE });
    const y = top + (compacto ? 14 : 19.5);
    doc.setDrawColor(...AGUA);
    doc.setLineWidth(0.8);
    doc.line(MARGEN, y, ancho - MARGEN, y);
    doc.setLineWidth(0.2);
    doc.line(MARGEN, y + 1.3, ancho - MARGEN, y + 1.3);
    return y + 6;
  }

  // Cajetín al pie de cada hoja: fuente a la izquierda y la ficha del documento a la derecha.
  const cajetines = () => {
    const total = doc.getNumberOfPages();
    for (let hoja = 1; hoja <= total; hoja += 1) {
      doc.setPage(hoja);
      const y = alto - ALTO_CAJETIN - 5;
      doc.setDrawColor(...AGUA);
      doc.setLineWidth(0.3);
      doc.rect(MARGEN, y, util, ALTO_CAJETIN);
      const celdas = [["Documento", info.codigo, 26], ["Generado", generadoEn || "--", 44], ["Hoja", `${hoja} de ${total}`, 20]];
      let cx = ancho - MARGEN - celdas.reduce((suma, celda) => suma + celda[2], 0);
      doc.line(cx, y, cx, y + ALTO_CAJETIN);
      texto(`Fuente: ${fuente || "encuesta de pozos de Choluteca"}.`, MARGEN + 2.5, y + 4.4, { tam: 6.4, color: TENUE, max: cx - MARGEN - 5 });
      texto(NORMA, MARGEN + 2.5, y + 8.2, { tam: 5.8, color: TENUE, max: cx - MARGEN - 5 });
      celdas.forEach(([etiqueta, valor, anchoCelda], indice) => {
        if (indice) doc.line(cx, y, cx, y + ALTO_CAJETIN);
        texto(etiqueta.toUpperCase(), cx + 2, y + 4, { tam: 5.4, negrita: true, color: TENUE });
        texto(valor, cx + 2, y + 9.2, { tam: 7.6, negrita: true, color: indice === 0 ? AGUA : TINTA, max: anchoCelda - 3 });
        cx += anchoCelda;
      });
    }
  };

  // Cifras: etiqueta tenue arriba y valor grande, separadas por filetes verticales.
  const cifras = (items, y) => {
    const anchoCelda = util / items.length;
    items.forEach(([etiqueta, valor, color], indice) => {
      const x = MARGEN + anchoCelda * indice;
      if (indice) { doc.setDrawColor(...FILETE); doc.setLineWidth(0.25); doc.line(x, y - 1, x, y + 10); }
      texto(etiqueta.toUpperCase(), x + (indice ? 3 : 0), y + 2, { tam: 6, negrita: true, color: TENUE });
      texto(valor, x + (indice ? 3 : 0), y + 9, { tam: 14, negrita: true, color: color || TINTA });
    });
    doc.setDrawColor(...FILETE);
    doc.line(MARGEN, y + 13, ancho - MARGEN, y + 13);
    return y + 19;
  };

  const subtitulo = (contenido, x, y, max) => {
    texto(contenido, x, y, { tam: 9.6, negrita: true, color: AGUA, max });
    return y + 5;
  };

  const leyenda = (items, x, y, max) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    let cx = x;
    let cy = y;
    items.forEach(([etiqueta, color]) => {
      const medida = doc.getTextWidth(etiqueta) + 6;
      if (cx + medida > x + max && cx > x) { cx = x; cy += 4; }
      doc.setFillColor(...color);
      doc.roundedRect(cx, cy - 2.4, 2.8, 2.8, 0.6, 0.6, "F");
      doc.setTextColor(...TINTA);
      doc.text(etiqueta, cx + 4, cy);
      cx += medida + 3;
    });
    return cy + 3;
  };

  // Barras horizontales con la misma escala y la cifra al final.
  const barras = (filas, x, y, w) => {
    const maximo = Math.max(1, ...filas.map((fila) => fila.n));
    const anchoEtiqueta = w * 0.38;
    const anchoBarra = w - anchoEtiqueta - 10;
    filas.forEach((fila, indice) => {
      const cy = y + indice * 6;
      texto(fila.label, x, cy + 2.6, { tam: 7.2, max: anchoEtiqueta - 2 });
      doc.setFillColor(...(fila.color || AZUL));
      doc.roundedRect(x + anchoEtiqueta, cy, Math.max(0.8, (fila.n / maximo) * anchoBarra), 3.2, 0.8, 0.8, "F");
      texto(String(fila.n), x + w, cy + 2.6, { tam: 7.4, negrita: true, alinear: "right" });
    });
    return y + filas.length * 6 + 2;
  };

  // Franja al 100 % (uso o calidad) con 0.6 mm de aire entre partes y su leyenda con cifras.
  const franja = (partes, x, y, w) => {
    const total = partes.reduce((suma, parte) => suma + parte.n, 0) || 1;
    const visibles = partes.filter((parte) => parte.n > 0);
    const aire = 0.6 * Math.max(0, visibles.length - 1);
    let cx = x;
    visibles.forEach((parte) => {
      const largo = (parte.n / total) * (w - aire);
      doc.setFillColor(...parte.color);
      doc.rect(cx, y, largo, 4, "F");
      cx += largo + 0.6;
    });
    return leyenda(visibles.map((parte) => [`${parte.label}: ${parte.n} (${Math.round((parte.n / total) * 100)} %)`, parte.color]), x, y + 8.5, w);
  };

  // Histograma de cortes fijos: columnas teal dentro y rojas fuera del valor guía.
  const histogramaPdf = (campo, x, y, w, h, decimales) => {
    const datos = histograma(pozos, campo);
    const maximo = Math.max(1, ...datos.map((barra) => barra.n));
    const paso = w / datos.length;
    doc.setDrawColor(...[201, 214, 227]);
    doc.setLineWidth(0.25);
    doc.line(x, y + h, x + w, y + h);
    datos.forEach((barra, indice) => {
      const cx = x + paso * indice;
      if (barra.n) {
        const altura = (barra.n / maximo) * (h - 5);
        doc.setFillColor(...(barra.fuera ? COLOR.fuera : COLOR.dentro));
        doc.rect(cx + paso * 0.14, y + h - altura, paso * 0.72, altura, "F");
        texto(String(barra.n), cx + paso / 2, y + h - altura - 1.2, { tam: 6.6, negrita: true, alinear: "center" });
      }
      const rotulo = barra.abiertaAbajo ? `<${formatoNumero(barra.hasta, decimales)}` : formatoNumero(barra.desde, decimales);
      texto(rotulo, cx + (barra.abiertaAbajo ? paso / 2 : 0), y + h + 3.6, { tam: 6, color: TENUE, alinear: "center" });
    });
    return leyenda([[`Dentro del valor guía (${RANGOS[campo].texto})`, COLOR.dentro], ["Fuera", COLOR.fuera]], x, y + h + 8.5, w);
  };

  // Escala de una medición: banda del valor guía y la marca del pozo.
  const escala = (campo, valor, x, y, w) => {
    const limites = campo === "ph" ? [4, 10] : [0, 2];
    const pos = (n) => x + ((Math.min(Math.max(n, limites[0]), limites[1]) - limites[0]) / (limites[1] - limites[0])) * w;
    const rango = RANGOS[campo];
    doc.setFillColor(237, 242, 247);
    doc.roundedRect(x, y, w, 2.2, 1.1, 1.1, "F");
    doc.setFillColor(178, 228, 217);
    doc.rect(pos(rango.min ?? limites[0]), y, pos(rango.max) - pos(rango.min ?? limites[0]), 2.2, "F");
    [limites[0], ...(rango.min != null ? [rango.min] : []), rango.max, limites[1]].forEach((corte) => texto(formatoNumero(corte, 1), pos(corte), y + 5.6, { tam: 5.6, color: TENUE, alinear: "center" }));
    if (!vacio(valor)) {
      const fuera = fueraDeRango(campo, valor);
      doc.setFillColor(...(fuera ? COLOR.fuera : TINTA));
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.5);
      doc.rect(pos(valor) - 0.7, y - 1.4, 1.4, 5, "FD");
    }
  };

  const ponerMapa = (imagen, x, y, w, h) => {
    if (imagen) {
      try { doc.addImage(imagen, imagen.startsWith("data:image/jpeg") ? "JPEG" : "PNG", x, y, w, h); } catch { /* sin mapa */ }
    } else {
      doc.setFillColor(...AGUA_CLARO);
      doc.rect(x, y, w, h, "F");
      texto("Sin ubicación en el mapa", x + w / 2, y + h / 2, { tam: 8, negrita: true, color: TENUE, alinear: "center" });
    }
    doc.setDrawColor(...AGUA);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, h);
  };

  const conteoCalidad = (lista) => CALIDADES.map((calidad) => ({ label: calidad.label, n: lista.filter((pozo) => calidadDe(pozo) === calidad.clave).length, color: COLOR[calidad.clave] }));
  const sinPozos = () => { texto("No hay pozos para este informe con los filtros elegidos.", MARGEN, 52, { tam: 10, color: TENUE }); };

  // Celdas de medición: rojo y fondo tenue si están fuera del valor guía.
  const marcarFuera = (campos) => (data) => {
    if (data.section !== "body") return;
    const campo = campos[data.column.index];
    const pozo = data.row.raw?.__pozo;
    if (campo && pozo && fueraDeRango(campo, pozo[campo])) {
      data.cell.styles.textColor = COLOR.fuera;
      data.cell.styles.fontStyle = "bold";
      data.cell.styles.fillColor = FUERA_FONDO;
    }
  };

  // ======================================================================== inventario
  if (tipo === "inventario") {
    let y = encabezado();
    if (!pozos.length) { sinPozos(); cajetines(); return doc; }
    const uso = { en_uso: pozos.filter((pozo) => pozo.en_uso === true).length, fuera: pozos.filter((pozo) => pozo.en_uso === false).length };
    const enMapa = pozos.filter((pozo) => pozo.coordenada_valida).length;
    y = cifras([
      ["Pozos", plural(pozos.length, "pozo", "pozos")],
      ["En uso", String(uso.en_uso)],
      ["Con calidad medida", String(pozos.filter((pozo) => calidadDe(pozo) !== "sin").length)],
      ["Fuera del valor guía", String(pozos.filter((pozo) => calidadDe(pozo) === "fuera").length), COLOR.fuera],
      ["Colonias", String(new Set(pozos.map((pozo) => pozo.colonia || "Sin colonia")).size)],
      ["En el mapa", `${enMapa} de ${pozos.length}`]
    ], y);
    const anchoIzq = util * 0.36;
    const xMapa = MARGEN + anchoIzq + 8;
    const anchoMapa = util - anchoIzq - 8;
    const altoMapa = Math.min(limite - y - 12, anchoMapa * 0.86);
    let yi = subtitulo("Pozos por colonia", MARGEN, y);
    yi = barras(pozosPorColonia(pozos, 7).map((fila) => ({ label: fila.colonia, n: fila.total })), MARGEN, yi, anchoIzq);
    yi = subtitulo("Estado de uso", MARGEN, yi + 3);
    yi = franja([{ label: "En uso", n: uso.en_uso, color: COLOR.en_uso }, { label: "Fuera de uso", n: uso.fuera, color: COLOR.fuera_de_uso }, { label: "Sin dato", n: pozos.length - uso.en_uso - uso.fuera, color: COLOR.sin_dato }], MARGEN, yi, anchoIzq);
    yi = subtitulo("Calidad del agua", MARGEN, yi + 3);
    franja(conteoCalidad(pozos), MARGEN, yi, anchoIzq);
    subtitulo("Ubicación de los pozos", xMapa, y);
    ponerMapa(mapaGeneral, xMapa, y + 2, anchoMapa, altoMapa);
    leyenda(CALIDADES.map((calidad) => [calidad.label, COLOR[calidad.clave]]), xMapa, y + altoMapa + 7, anchoMapa);
    if (enMapa < pozos.length) texto(`${pozos.length - enMapa} sin coordenada válida no aparecen en el mapa.`, xMapa + anchoMapa, y + altoMapa + 7, { tam: 6.6, color: TENUE, alinear: "right" });

    const campos = [null, null, null, null, null, null, "profundidad_m", "nivel_freatico_m", "diametro_pulg", "ph", "tds_g_l", "salinidad", "temperatura_c", "oxigeno_disuelto", "cloro_residual"];
    y = nuevaHoja();
    autoTable(doc, {
      ...tablaBase,
      startY: y,
      head: [["#", "Código", "Nombre", "Colonia", "Uso", "Calidad", "Prof. m", "N. freát. m", "Diám. pulg", "pH", "TDS g/L", "Salin.", "Temp. °C", "O.D. %", "Cloro"]],
      body: pozos.map((pozo, indice) => Object.assign([
        indice + 1, pozo.codigo, pozo.nombre || "--", pozo.colonia || "--", usoTexto(pozo), { dentro: "Dentro de guía", fuera: "Fuera de guía", sin: "Sin medición" }[calidadDe(pozo)],
        numero(pozo.profundidad_m, 2), numero(pozo.nivel_freatico_m, 2), numero(pozo.diametro_pulg, 0), numero(pozo.ph, 2), numero(pozo.tds_g_l, 3),
        numero(pozo.salinidad, 2), numero(pozo.temperatura_c, 1), numero(pozo.oxigeno_disuelto, 1), numero(pozo.cloro_residual, 2)
      ], { __pozo: pozo })),
      columnStyles: {
        0: { cellWidth: 8, textColor: TENUE }, 1: { cellWidth: 19, fontStyle: "bold" }, 2: { cellWidth: 46 }, 3: { cellWidth: 32 }, 4: { cellWidth: 17 }, 5: { cellWidth: 22 },
        ...Object.fromEntries([6, 7, 8, 9, 10, 11, 12, 13, 14].map((columna) => [columna, { halign: "right" }]))
      },
      didParseCell: (data) => {
        marcarFuera(campos)(data);
        if (data.section === "body" && data.column.index === 5) {
          const calidad = calidadDe(data.row.raw.__pozo);
          data.cell.styles.textColor = calidad === "fuera" ? COLOR.fuera : calidad === "dentro" ? [18, 128, 106] : TENUE;
          data.cell.styles.fontStyle = calidad === "sin" ? "normal" : "bold";
        }
      },
      margin: { left: MARGEN, right: MARGEN, top: 28, bottom: ALTO_CAJETIN + 10 },
      didDrawPage: (data) => { if (data.pageNumber > 1 && doc.getCurrentPageInfo().pageNumber > 2) encabezado({ compacto: true }); }
    });
    cajetines();
    return doc;
  }

  // ======================================================================== fichas
  if (tipo === "fichas") {
    if (!pozos.length) { encabezado(); sinPozos(); cajetines(); return doc; }
    pozos.forEach((pozo, indice) => {
      if (indice) doc.addPage("letter", info.orientacion);
      let y = encabezado({ titulo: `Pozo ${pozo.codigo}`, subtitulo: [pozo.nombre || "Sin nombre", pozo.colonia, pozo.municipio].filter(Boolean).join(" · ") });
      // Sellos de estado.
      const sellos = [
        [usoTexto(pozo), pozo.en_uso === true ? COLOR.en_uso : COLOR.sin_dato],
        [ETIQUETA_CALIDAD[calidadDe(pozo)], COLOR[calidadDe(pozo)]],
        ...(pozo.codigo_repetido ? [["Código repetido en otro pozo", COLOR.fuera_de_uso]] : []),
        ...(!pozo.coordenada_valida ? [["Coordenada fuera de Choluteca", COLOR.fuera_de_uso]] : [])
      ];
      let sx = MARGEN;
      sellos.forEach(([etiqueta, color]) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.2);
        const largo = doc.getTextWidth(etiqueta) + 6;
        doc.setDrawColor(...color);
        doc.setLineWidth(0.4);
        doc.roundedRect(sx, y - 3.6, largo, 5.4, 1.2, 1.2, "S");
        doc.setTextColor(...color);
        doc.text(etiqueta, sx + 3, y);
        sx += largo + 2.5;
      });
      y += 6;

      // Columna izquierda: datos; derecha: ubicación en el mapa.
      const anchoCol = (util - 8) / 2;
      const xDer = MARGEN + anchoCol + 8;
      const datos = (titulo, filas, yInicio) => {
        const yTabla = subtitulo(titulo, MARGEN, yInicio);
        autoTable(doc, {
          startY: yTabla - 2,
          body: filas,
          theme: "plain",
          styles: { font: "helvetica", fontSize: 8, cellPadding: { top: 1.2, bottom: 1.2, left: 0, right: 1.5 }, textColor: TINTA, lineColor: FILETE, lineWidth: { bottom: 0.2 } },
          columnStyles: { 0: { cellWidth: 34, textColor: TENUE, fontStyle: "bold", fontSize: 7 }, 1: { fontStyle: "bold" } },
          margin: { left: MARGEN, right: ancho - MARGEN - anchoCol }
        });
        return doc.lastAutoTable.finalY + 5;
      };
      let yi = datos("Pozo y bomba", [
        ["Profundidad", conUnidad(pozo.profundidad_m, "m", 2)], ["Nivel freático", conUnidad(pozo.nivel_freatico_m, "m", 2)],
        ["Diámetro", conUnidad(pozo.diametro_pulg, "pulg", 0)], ["Bomba", pozo.tipo_bomba || "--"]
      ], y);
      yi = datos("Ubicación", [
        ["UTM 16N", `${formatoNumero(pozo.utm_x, 0)} E · ${formatoNumero(pozo.utm_y, 0)} N`],
        ["Latitud, longitud", pozo.coordenada_valida ? `${Number(pozo.latitud).toFixed(6)}, ${Number(pozo.longitud).toFixed(6)}` : "No se puede ubicar (coordenada fuera de Choluteca)"],
        ["Elevación", conUnidad(pozo.elevacion_m, "m", 0)]
      ], yi);
      const altoMapa = Math.max(yi - y - 3, 62);
      subtitulo("Ubicación en el mapa", xDer, y);
      ponerMapa(mapas.get(pozo.id) || "", xDer, y + 2, anchoCol, altoMapa - 2);
      y = Math.max(yi, y + altoMapa + 4);

      // Calidad del agua: escalas de pH y TDS, y las demás mediciones.
      y = subtitulo("Calidad del agua", MARGEN, y);
      if (calidadDe(pozo) === "sin" && [pozo.salinidad, pozo.temperatura_c, pozo.oxigeno_disuelto, pozo.cloro_residual].every(vacio)) {
        texto("No hay mediciones de calidad para este pozo.", MARGEN, y + 2, { tam: 8.4, color: TENUE });
        y += 8;
      } else {
        [["ph", "pH", ""], ["tds_g_l", "Sólidos disueltos (TDS)", "g/L"]].forEach(([campo, etiqueta, unidad], columna) => {
          const x = MARGEN + columna * (anchoCol + 8);
          const valor = pozo[campo];
          const fuera = fueraDeRango(campo, valor);
          texto(etiqueta.toUpperCase(), x, y + 1, { tam: 6.4, negrita: true, color: TENUE });
          texto(`${numero(valor, campo === "ph" ? 2 : 3)}${!vacio(valor) && unidad ? ` ${unidad}` : ""}`, x, y + 8, { tam: 15, negrita: true, color: fuera ? COLOR.fuera : TINTA });
          if (!vacio(valor)) texto(fuera ? "Fuera del valor guía" : "Dentro del valor guía", x + anchoCol, y + 8, { tam: 7, negrita: true, color: fuera ? COLOR.fuera : [18, 128, 106], alinear: "right" });
          escala(campo, valor, x, y + 12, anchoCol);
        });
        y += 22;
        const otras = [
          ["Salinidad", numero(pozo.salinidad, 2)], ["Temperatura", conUnidad(pozo.temperatura_c, "°C", 1)],
          ["Oxígeno disuelto", conUnidad(pozo.oxigeno_disuelto, "%", 1)], ["Cloro residual", numero(pozo.cloro_residual, 2)], ["Conductividad", pozo.conductividad || "--"]
        ];
        const anchoOtra = util / otras.length;
        otras.forEach(([etiqueta, valor], columna) => {
          const x = MARGEN + anchoOtra * columna;
          texto(etiqueta.toUpperCase(), x, y, { tam: 6, negrita: true, color: TENUE });
          texto(valor, x, y + 5.5, { tam: 10, negrita: true });
        });
        doc.setDrawColor(...FILETE);
        doc.line(MARGEN, y + 9, ancho - MARGEN, y + 9);
        y += 14;
      }

      const faltan = faltantesDe(pozo);
      if (faltan.length) {
        const lineas = partir(`Falta levantar: ${faltan.join(", ")}.`, util - 8, 8, true);
        const altoCaja = lineas.length * 4 + 4;
        doc.setFillColor(...OCRE_FONDO);
        doc.rect(MARGEN, y - 1, util, altoCaja, "F");
        texto(lineas, MARGEN + 4, y + 3.4, { tam: 8, negrita: true, color: OCRE });
        y += altoCaja + 5;
      }
      if (pozo.observaciones) {
        y = subtitulo("Observaciones", MARGEN, y);
        const lineas = partir(pozo.observaciones, util, 8.2);
        texto(lineas.slice(0, Math.max(1, Math.floor((limite - 22 - y) / 3.8))), MARGEN, y, { tam: 8.2 });
        y += Math.min(lineas.length, Math.floor((limite - 22 - y) / 3.8)) * 3.8 + 4;
      }
      // Verificación de campo, para firmar en papel.
      const yFirma = limite - 8;
      doc.setDrawColor(...TENUE);
      doc.setLineWidth(0.25);
      [[MARGEN, "Verificado en campo por"], [MARGEN + util * 0.42, "Fecha"], [MARGEN + util * 0.64, "Firma"]].forEach(([x, etiqueta], indice, lista) => {
        const fin = indice < lista.length - 1 ? lista[indice + 1][0] - 6 : ancho - MARGEN;
        doc.line(x, yFirma, fin, yFirma);
        texto(etiqueta, x, yFirma + 3.6, { tam: 6.6, color: TENUE });
      });
    });
    cajetines();
    return doc;
  }

  // ======================================================================== calidad
  if (tipo === "calidad") {
    let y = encabezado();
    const medidos = pozos.filter((pozo) => calidadDe(pozo) !== "sin");
    if (!medidos.length) { sinPozos(); cajetines(); return doc; }
    const fuera = medidos.filter((pozo) => calidadDe(pozo) === "fuera");
    y = cifras([
      ["Pozos medidos", `${medidos.length} de ${pozos.length}`],
      ["Dentro del valor guía", String(medidos.length - fuera.length), [18, 128, 106]],
      ["Fuera del valor guía", String(fuera.length), COLOR.fuera],
      ["pH fuera", String(medidos.filter((pozo) => fueraDeRango("ph", pozo.ph)).length), COLOR.fuera],
      ["TDS fuera", String(medidos.filter((pozo) => fueraDeRango("tds_g_l", pozo.tds_g_l)).length), COLOR.fuera]
    ], y);
    // Recuadro de la norma.
    const lineasNorma = partir(NORMA, util - 8, 7.6);
    doc.setFillColor(...AGUA_CLARO);
    doc.rect(MARGEN, y - 3, util, lineasNorma.length * 3.8 + 4, "F");
    texto(lineasNorma, MARGEN + 4, y + 0.8, { tam: 7.6, color: AGUA });
    y += lineasNorma.length * 3.8 + 6;
    const anchoCol = (util - 10) / 2;
    subtitulo("Distribución de pH", MARGEN, y);
    subtitulo("Distribución de TDS (g/L)", MARGEN + anchoCol + 10, y);
    histogramaPdf("ph", MARGEN, y + 3, anchoCol, 34, 1);
    const finHist = histogramaPdf("tds_g_l", MARGEN + anchoCol + 10, y + 3, anchoCol, 34, 2);
    y = finHist + 4;
    const altoMapa = Math.min(limite - y - 10, util * 0.5);
    if (altoMapa > 40) {
      subtitulo("Pozos medidos en el mapa", MARGEN, y);
      ponerMapa(mapaGeneral, MARGEN, y + 2, util, altoMapa);
      leyenda([[ETIQUETA_CALIDAD.dentro, COLOR.dentro], [ETIQUETA_CALIDAD.fuera, COLOR.fuera]], MARGEN, y + altoMapa + 7, util);
    }

    y = nuevaHoja();
    y = subtitulo("Mediciones por pozo (primero los que están fuera del valor guía)", MARGEN, y);
    const orden = [...medidos].sort((a, b) => (calidadDe(a) === "fuera" ? 0 : 1) - (calidadDe(b) === "fuera" ? 0 : 1) || Number(numeroCodigo(a)) - Number(numeroCodigo(b)));
    const campos = [null, null, null, "ph", "tds_g_l", "salinidad", "temperatura_c", "oxigeno_disuelto", "cloro_residual", null];
    autoTable(doc, {
      ...tablaBase,
      startY: y,
      head: [["Código", "Nombre", "Colonia", "pH", "TDS g/L", "Salin.", "Temp. °C", "O.D. %", "Cloro", "Veredicto"]],
      body: orden.map((pozo) => Object.assign([
        pozo.codigo, pozo.nombre || "--", pozo.colonia || "--", numero(pozo.ph, 2), numero(pozo.tds_g_l, 3), numero(pozo.salinidad, 2),
        numero(pozo.temperatura_c, 1), numero(pozo.oxigeno_disuelto, 1), numero(pozo.cloro_residual, 2), calidadDe(pozo) === "fuera" ? "Fuera" : "Dentro"
      ], { __pozo: pozo })),
      columnStyles: { 0: { cellWidth: 18, fontStyle: "bold" }, 1: { cellWidth: 40 }, 2: { cellWidth: 30 }, ...Object.fromEntries([3, 4, 5, 6, 7, 8].map((columna) => [columna, { halign: "right" }])), 9: { fontStyle: "bold" } },
      didParseCell: (data) => {
        marcarFuera(campos)(data);
        if (data.section === "body" && data.column.index === 9) data.cell.styles.textColor = calidadDe(data.row.raw.__pozo) === "fuera" ? COLOR.fuera : [18, 128, 106];
      },
      margin: { left: MARGEN, right: MARGEN, top: 28, bottom: ALTO_CAJETIN + 10 },
      didDrawPage: () => { if (doc.getCurrentPageInfo().pageNumber > 2) encabezado({ compacto: true }); }
    });
    const sinMedir = pozos.filter((pozo) => calidadDe(pozo) === "sin");
    if (sinMedir.length) {
      let yNota = doc.lastAutoTable.finalY + 6;
      if (yNota > limite - 12) yNota = nuevaHoja();
      texto(`Sin medición (${sinMedir.length}): ${sinMedir.map((pozo) => pozo.codigo).join(", ")}.`, MARGEN, yNota, { tam: 7.4, color: TENUE, max: util });
    }
    cajetines();
    return doc;
  }

  // ======================================================================== levantamiento
  let y = encabezado();
  const grupos = planPorColonia(pozos);
  if (!grupos.length) { texto("Ningún pozo filtrado tiene datos por levantar.", MARGEN, y + 4, { tam: 10, color: TENUE }); cajetines(); return doc; }
  const totalPozos = grupos.reduce((suma, grupo) => suma + grupo.items.length, 0);
  y = cifras([
    ["Pozos por visitar", String(totalPozos)],
    ["Colonias", String(grupos.length)],
    ["Datos por levantar", String(grupos.reduce((suma, grupo) => suma + grupo.datos, 0))],
    ["Sin coordenada válida", String(grupos.reduce((suma, grupo) => suma + grupo.items.filter((item) => !item.pozo.coordenada_valida).length, 0))]
  ], y);
  const nota = partir("Una hoja por colonia, para repartirlas entre los técnicos. Cada casilla vacía es un dato que falta: márquela al levantarlo y anote el valor en Notas de campo. Las columnas con «sí» ya están registradas.", util, 7.6);
  texto(nota, MARGEN, y - 2, { tam: 7.6, color: TENUE });
  y += nota.length * 3.4 + 4;
  const cortos = { profundidad_m: "Prof.", nivel_freatico_m: "Nivel", diametro_pulg: "Diám.", ph: "pH", tds_g_l: "TDS", temperatura_c: "Temp.", en_uso: "Uso", coordenada: "Coord." };
  grupos.forEach((grupo, indice) => {
    const imagen = mapas.get(grupo.colonia) || "";
    const altoMapa = imagen ? 58 : 0;
    if (indice) y = nuevaHoja();
    texto(grupo.colonia, MARGEN, y, { tam: 11, negrita: true });
    texto(`${plural(grupo.items.length, "pozo", "pozos")} · ${plural(grupo.datos, "dato", "datos")} por levantar`, ancho - MARGEN, y, { tam: 7.6, color: TENUE, alinear: "right" });
    doc.setDrawColor(...AGUA);
    doc.setLineWidth(0.4);
    doc.line(MARGEN, y + 2, ancho - MARGEN, y + 2);
    y += 5;
    if (imagen) {
      ponerMapa(imagen, MARGEN, y, util, altoMapa);
      y += altoMapa + 4;
    }
    autoTable(doc, {
      ...tablaBase,
      startY: y,
      head: [["Código", "Nombre o referencia", ...DATOS.map((dato) => cortos[dato.clave]), "Notas de campo"]],
      body: grupo.items.map(({ pozo }) => Object.assign([
        pozo.codigo, pozo.nombre || "--", ...DATOS.map((dato) => (dato.tiene(pozo) ? "sí" : "")), ""
      ], { __pozo: pozo })),
      styles: { ...tablaBase.styles, minCellHeight: 8 },
      columnStyles: {
        0: { cellWidth: 18, fontStyle: "bold" }, 1: { cellWidth: 38 },
        ...Object.fromEntries(DATOS.map((_, indice) => [indice + 2, { cellWidth: 11.5, halign: "center", textColor: TENUE, fontSize: 6.6 }]))
      },
      didParseCell: (data) => {
        if (data.section === "head" && data.column.index >= 2 && data.column.index <= DATOS.length + 1) {
          data.cell.styles.fontSize = 6.2;
          data.cell.styles.halign = "center";
          data.cell.styles.cellPadding = { top: 1.3, bottom: 1.3, left: 0.4, right: 0.4 };
        }
      },
      didDrawCell: (data) => {
        if (data.section !== "body" || data.column.index < 2 || data.column.index > DATOS.length + 1) return;
        if (data.cell.raw) return;
        const lado = 3.6;
        doc.setDrawColor(...TINTA);
        doc.setLineWidth(0.3);
        doc.rect(data.cell.x + (data.cell.width - lado) / 2, data.cell.y + (data.cell.height - lado) / 2, lado, lado);
      },
      margin: { left: MARGEN, right: MARGEN, top: 28, bottom: ALTO_CAJETIN + 10 },
      didDrawPage: (data) => { if (data.pageNumber > 1) encabezado({ compacto: true }); }
    });
    y = doc.lastAutoTable.finalY + 9;
  });
  // Responsable del levantamiento.
  if (y + 14 > limite) y = nuevaHoja();
  doc.setDrawColor(...TENUE);
  doc.setLineWidth(0.25);
  [[MARGEN, "Técnico responsable"], [MARGEN + util * 0.42, "Fecha del levantamiento"], [MARGEN + util * 0.7, "Firma"]].forEach(([x, etiqueta], indice, lista) => {
    const fin = indice < lista.length - 1 ? lista[indice + 1][0] - 6 : ancho - MARGEN;
    doc.line(x, y + 8, fin, y + 8);
    texto(etiqueta, x, y + 11.6, { tam: 6.6, color: TENUE });
  });
  cajetines();
  return doc;
}

export const nombreArchivoPozos = (tipo, fecha = new Date()) => `${TIPOS_INFORME[tipo]?.archivo || "informe-pozos"}-${fecha.toISOString().slice(0, 10)}.pdf`;
export const colorCalidadHex = { dentro: "#18a689", fuera: "#c92a3a", sin: "#a3b1c0" };
