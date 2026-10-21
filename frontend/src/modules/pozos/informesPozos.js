// Arma y descarga los informes de pozos: carga jsPDF, el logo y los mapas, y le pasa todo a
// pozosPdf.js. Los mapas usan los mosaicos de /api/map-tiles con la caché de Puntos GPS; sin red
// salen sobre un fondo claro, igual que en los informes de campo.
import logoAguasCholuteca from "../../assets/logo-aguas-choluteca.png";
import { API_URL } from "../../config/api";
import { formatDateTime } from "../../utils/datesAndBusiness";
import { urlToDataUrl } from "../../utils/imageUtils";
import { saveReportPdf } from "../../utils/printDocument";
import { dibujarMapaPuntos } from "../reports/utils/reportMapImage";
import { calidadDe } from "./pozosFiltros";
import { TIPOS_INFORME, colorCalidadHex, crearInformePozos, nombreArchivoPozos, planPorColonia } from "./pozosPdf";

const comoPunto = (pozo) => ({ latitude: pozo.latitud, longitude: pozo.longitud, __pozo: pozo });
const colorDe = (punto) => colorCalidadHex[calidadDe(punto.__pozo)];
const etiquetaDe = (punto) => String(punto.__pozo.codigo || "").replace(/^\D+/, "");
const conMapa = (pozos) => pozos.filter((pozo) => pozo.coordenada_valida).map(comoPunto);

// De cuatro en cuatro, para no pedir todos los mosaicos de golpe.
const enTandas = async (items, hacer, onAvance) => {
  const resultados = [];
  for (let inicio = 0; inicio < items.length; inicio += 4) {
    resultados.push(...await Promise.all(items.slice(inicio, inicio + 4).map(hacer)));
    onAvance?.(Math.min(inicio + 4, items.length), items.length);
  }
  return resultados;
};

/**
 * @param {object} opciones
 * @param {"inventario"|"fichas"|"calidad"|"levantamiento"} opciones.tipo
 * @param {object[]} opciones.pozos  lista filtrada, en el orden de pantalla
 * @param {(texto: string) => void} [opciones.onProgreso]
 */
export async function descargarInformePozos({ tipo, pozos, alcance = "", fuente = "", onProgreso }) {
  const modulos = Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const logo = urlToDataUrl(logoAguasCholuteca).catch(() => "");
  onProgreso?.("Dibujando los mapas…");

  let mapaGeneral = "";
  let mapas = new Map();
  if (tipo === "inventario") {
    mapaGeneral = await dibujarMapaPuntos({ points: conMapa(pozos), apiUrl: API_URL, ancho: 1500, alto: 1240, colorDe }).catch(() => "");
  } else if (tipo === "calidad") {
    const medidos = pozos.filter((pozo) => calidadDe(pozo) !== "sin");
    mapaGeneral = await dibujarMapaPuntos({ points: conMapa(medidos), apiUrl: API_URL, ancho: 1800, alto: 900, colorDe }).catch(() => "");
  } else if (tipo === "fichas") {
    const ubicados = pozos.filter((pozo) => pozo.coordenada_valida);
    const imagenes = await enTandas(ubicados, (pozo) => dibujarMapaPuntos({ points: [comoPunto(pozo)], apiUrl: API_URL, ancho: 1000, alto: 820, colorDe, calidad: 0.8 }).catch(() => ""),
      (hechos, total) => total > 4 && onProgreso?.(`Mapas: ${hechos} de ${total}…`));
    mapas = new Map(ubicados.map((pozo, indice) => [pozo.id, imagenes[indice]]));
  } else if (tipo === "levantamiento") {
    const grupos = planPorColonia(pozos).filter((grupo) => grupo.items.some((item) => item.pozo.coordenada_valida));
    const imagenes = await enTandas(grupos, (grupo) => dibujarMapaPuntos({
      points: conMapa(grupo.items.map((item) => item.pozo)), apiUrl: API_URL, ancho: 1800, alto: 640, colorDe, etiquetaDe, calidad: 0.8
    }).catch(() => ""), (hechos, total) => total > 4 && onProgreso?.(`Mapas: ${hechos} de ${total}…`));
    mapas = new Map(grupos.map((grupo, indice) => [grupo.colonia, imagenes[indice]]));
  }

  onProgreso?.("Armando el PDF…");
  const [[{ jsPDF }, autoTableModulo], logoDataUrl] = await Promise.all([modulos, logo]);
  const doc = crearInformePozos({
    jsPDF,
    autoTable: autoTableModulo.default,
    tipo,
    pozos,
    alcance,
    fuente,
    logoDataUrl,
    mapaGeneral,
    mapas,
    generadoEn: formatDateTime(new Date().toISOString())
  });
  saveReportPdf(doc, nombreArchivoPozos(tipo), { title: TIPOS_INFORME[tipo].titulo, reportType: `pozos-${tipo}` });
}
