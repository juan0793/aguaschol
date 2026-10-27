import logoAguasCholuteca from "../../../assets/logo-aguas-choluteca.png";
import { formatCurrency } from "../../../utils/formatting";
import { urlToDataUrl } from "../../../utils/imageUtils";
import { saveReportPdf } from "../../../utils/printDocument";
import { nombreArchivo } from "./estadoCuentaDatos";

// PDF del estado de cuenta: el mismo diseño de la hoja impresa (EstadoCuentaImpresion),
// dibujado en carta vertical. Medidas en milímetros.
const AZUL = [20, 101, 217];
const PROFUNDO = [11, 63, 115];
const TINTA = [22, 36, 47];
const SUAVE = [86, 102, 118];
const FILETE = [211, 221, 231];
const FONDO = [242, 247, 253];
const BORDE_SALDO = [207, 224, 243];
const OCRE = [192, 127, 21];
const OCRE_TEXTO = [138, 90, 12];
const VERDE = [15, 122, 99];
const PISTA = [223, 232, 242];

const money = (valor) => formatCurrency(Number(valor) || 0).replace(/ /g, " ");

export const descargarEstadoCuentaPdf = async (datos) => {
  const [{ jsPDF }, logo] = await Promise.all([import("jspdf"), urlToDataUrl(logoAguasCholuteca).catch(() => "")]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const M = 16;
  const ancho = pdf.internal.pageSize.getWidth();
  const util = ancho - M * 2;
  const derecha = ancho - M;
  const texto = (contenido, x, y, { tam = 9, peso = "normal", color = TINTA, alinear = "left", maximo } = {}) => {
    pdf.setFont("helvetica", peso);
    pdf.setFontSize(tam);
    pdf.setTextColor(...color);
    pdf.text(String(contenido ?? ""), x, y, { align: alinear, maxWidth: maximo });
  };
  const linea = (x1, y1, x2, y2, color = FILETE, grosor = 0.25) => {
    pdf.setDrawColor(...color);
    pdf.setLineWidth(grosor);
    pdf.line(x1, y1, x2, y2);
  };

  // Cabecera: logo, empresa y título; a la derecha emisión y padrón.
  let y = 16;
  if (logo) pdf.addImage(logo, "PNG", M, y - 1, 13, 13);
  texto("Aguas de Choluteca, S.A. de C.V.", M + 17, y + 3, { tam: 8, peso: "bold", color: SUAVE });
  texto("Estado de cuenta", M + 17, y + 10, { tam: 17, peso: "bold", color: PROFUNDO });
  texto(`Emitido  ${datos.emitido || "--"}`, derecha, y + 3, { tam: 8, color: SUAVE, alinear: "right" });
  if (datos.padron) texto(`Padrón  ${datos.padron}`, derecha, y + 7.5, { tam: 8, color: SUAVE, alinear: "right" });
  y += 16;
  linea(M, y, derecha, y, PROFUNDO, 0.6);

  // Abonado y sus datos en tres columnas con filetes.
  y += 9;
  texto("Abonado", M, y, { tam: 7.5, peso: "bold", color: SUAVE });
  y += 6.5;
  texto(datos.nombre, M, y, { tam: 14, peso: "bold", maximo: util });
  y += 6;
  linea(M, y, derecha, y);
  const columnas = [["Número de abonado", datos.abonado, 0.26], ["Clave catastral", datos.clave, 0.32], ["Barrio o colonia", datos.barrio, 0.42]];
  let x = M;
  columnas.forEach(([rotulo, valor, parte], indice) => {
    const anchoCol = util * parte;
    if (indice) linea(x, y, x, y + 13);
    const dentro = indice ? x + 4 : x;
    texto(rotulo, dentro, y + 5, { tam: 7.5, peso: "bold", color: SUAVE });
    texto(valor, dentro, y + 10.5, { tam: 9.5, peso: "bold", maximo: anchoCol - 6 });
    x += anchoCol;
  });
  y += 13;
  linea(M, y, derecha, y);

  // Saldo: recuadro azul muy claro; la cifra grande a la izquierda, el desglose a la derecha.
  y += 8;
  const altoSaldo = 40;
  pdf.setFillColor(...FONDO);
  pdf.setDrawColor(...BORDE_SALDO);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(M, y, util, altoSaldo, 2, 2, "FD");
  const aFavor = datos.estado === "a-favor";
  const totalVisible = money(aFavor ? Math.abs(datos.total) : datos.total);
  texto(datos.rotuloSaldo, M + 7, y + 10, { tam: 8, peso: "bold", color: SUAVE });
  texto(totalVisible, M + 7, y + 22, { tam: 23, peso: "bold", color: aFavor ? VERDE : datos.estado === "al-dia" ? SUAVE : PROFUNDO });
  texto(datos.notaSaldo, M + 7, y + 30, { tam: 8, color: SUAVE, maximo: util * 0.42 });

  const px = M + util * 0.5;
  const pAncho = util * 0.5 - 7;
  let py = y + 8;
  if (datos.estado === "deuda") {
    pdf.setFillColor(...PISTA);
    pdf.roundedRect(px, py, pAncho, 3, 1.5, 1.5, "F");
    const capitalAncho = (pAncho * datos.parteCapital) / 100;
    if (capitalAncho > 0) { pdf.setFillColor(...AZUL); pdf.rect(px, py, capitalAncho, 3, "F"); }
    if (datos.parteIntereses > 0) { pdf.setFillColor(...OCRE); pdf.rect(px + capitalAncho, py, pAncho - capitalAncho, 3, "F"); }
    py += 9;
  } else {
    py += 4;
  }
  const filaParte = (rotulo, valor, pct, colorCuadro, colorValor) => {
    if (colorCuadro) { pdf.setFillColor(...colorCuadro); pdf.rect(px, py - 2.6, 2.6, 2.6, "F"); }
    texto(rotulo, px + (colorCuadro ? 4.5 : 0), py, { tam: 9 });
    texto(valor, px + pAncho - 12, py, { tam: 9.5, peso: "bold", color: colorValor, alinear: "right" });
    if (pct) texto(pct, px + pAncho, py, { tam: 8, color: SUAVE, alinear: "right" });
    py += 6;
  };
  const deuda = datos.estado === "deuda";
  filaParte("Capital", money(datos.capital), deuda ? `${datos.parteCapital} %` : "", AZUL, TINTA);
  filaParte("Intereses", money(datos.intereses), deuda ? `${datos.parteIntereses} %` : "", OCRE, OCRE_TEXTO);
  linea(px, py - 3.5, px + pAncho, py - 3.5, BORDE_SALDO);
  py += 1;
  texto(aFavor ? "Saldo a favor" : "Saldo total", px, py, { tam: 9.5, peso: "bold", color: PROFUNDO });
  texto(totalVisible, px + pAncho - 12, py, { tam: 10, peso: "bold", color: PROFUNDO, alinear: "right" });
  y += altoSaldo + 11;

  // Servicios: cinco casillas iguales; la activa en azul muy claro.
  texto("Servicios del inmueble", M, y, { tam: 9.5, peso: "bold", color: PROFUNDO });
  y += 4;
  const hueco = 2;
  const casilla = (util - hueco * 4) / 5;
  datos.servicios.forEach((servicio, indice) => {
    const cx = M + indice * (casilla + hueco);
    pdf.setLineWidth(0.25);
    if (servicio.activo) { pdf.setFillColor(...FONDO); pdf.setDrawColor(185, 209, 239); pdf.roundedRect(cx, y, casilla, 17, 1.5, 1.5, "FD"); }
    else { pdf.setDrawColor(...FILETE); pdf.roundedRect(cx, y, casilla, 17, 1.5, 1.5, "S"); }
    texto(servicio.etiqueta, cx + 3, y + 5.5, { tam: 7.5, peso: "bold", maximo: casilla - 5 });
    texto(servicio.activo ? "Activo" : "No tiene", cx + 3, y + 14, { tam: 7.5, peso: "bold", color: servicio.activo ? PROFUNDO : SUAVE });
  });
  y += 17 + 26;

  // Firmas.
  const mitad = (util - 14) / 2;
  linea(M, y, M + mitad, y, TINTA, 0.3);
  linea(derecha - mitad, y, derecha, y, TINTA, 0.3);
  texto("Atendido por (nombre y firma)", M, y + 4.5, { tam: 8, color: SUAVE });
  texto("Recibido por el abonado", derecha - mitad, y + 4.5, { tam: 8, color: SUAVE });

  // Pie al final de la hoja.
  const pieY = pdf.internal.pageSize.getHeight() - 14;
  linea(M, pieY - 4, derecha, pieY - 4);
  texto("Información confidencial.", M, pieY, { tam: 7, peso: "bold" });
  texto("Uso interno de Aguas de Choluteca; montos según el padrón maestro.", M + 31, pieY, { tam: 7, color: SUAVE });
  if (datos.reportId) texto(`ID ${datos.reportId}`, derecha, pieY, { tam: 7, color: SUAVE, alinear: "right" });

  return saveReportPdf(pdf, nombreArchivo(datos), { reportId: datos.reportId, title: `Estado de cuenta · ${datos.nombre}`, reportType: "estado-cuenta-abonado" });
};
