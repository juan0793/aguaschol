import {
  MAP_REPORT_SERVICE_LEGEND,
  REPORT_POINT_ALERT_BORDER_RGB,
  REPORT_POINT_ALERT_FILL_RGB,
  REPORT_POINT_ALERT_RGB,
  REPORT_POINT_DANGER_BORDER_RGB,
  REPORT_POINT_DANGER_FILL_RGB,
  REPORT_POINT_DANGER_RGB,
  buildMapReportBriefRows,
  buildMapReportStaffMarkup,
  buildMapReportTypeChartMarkup,
  getMapPointPadronNames,
  getMapPointReferenceNote,
  getMapPointReportReferenceLabel,
  getMapPointTechnicalDescription,
  getMapReportTechniciansLabel,
  getMapReportTypeChartRows,
  getReportPointRowClassName,
  isAlertReportPoint,
  isRedReportPoint
} from "../../utils/mapReport";
import { defaultMapReportSettings } from "../../constants/formsAndUi";
import { escapeHtml } from "../../utils/html";
import { formatCoordinate, getMapPointContextKey, getMapPointTypeLabel } from "../../utils/mapField";
import { formatCurrency } from "../../utils/formatting";
import { formatDateTime, formatMapDiaryLabel } from "../../utils/datesAndBusiness";
import logoAguasCholuteca from "../../assets/logo-aguas-choluteca.png";
import { printDocument, saveReportPdf } from "../../utils/printDocument";
import { urlToDataUrl } from "../../utils/imageUtils";
import { crearInformeCampoPdf } from "./fieldReportPdf";
import { fechaLarga, nombreArchivoInforme } from "./utils/informeJornadas";
import { COLORES_DIA, dibujarMapaPuntos } from "./utils/reportMapImage";
import { API_URL } from "../../config/api";
import { applyMapReportZoneOverrides, buildMapReportData } from "./utils/mapReportBuilder";
import { selectReportZones } from "./utils/reportSelectors";

// Se conservan entre renders (la fábrica se vuelve a crear en cada uno): marcar otra
// jornada en el diálogo solo pide la nueva, y un barrio ya consultado no se pide otra vez.
const PUNTOS_VIGENCIA_MS = 2 * 60 * 1000;
const puntosPorJornada = new Map(); // dateKey -> { points, at }
const contextosConocidos = {};

export function createMapReportPrinters({
  activeMapDiaryDateKey,
  apiFetch,
  buildMapReportPadronData,
  captureReportMapImage,
  getSelectedCajaTotal,
  getSelectedMapReportData,
  mapPointContexts = {},
  mapReportPrintData,
  mapReportSettings,
  mapReportStaff,
  safeBarrioCodes = [],
  showAlert
}) {
  // Datos del informe para varias jornadas. La jornada activa usa lo que ya está en
  // pantalla; las otras se piden a la API con su contexto (barrio y referencias).
  const cargarPuntosJornada = async (dateKey) => {
    const guardada = puntosPorJornada.get(dateKey);
    if (guardada && Date.now() - guardada.at < PUNTOS_VIGENCIA_MS) return guardada.points;
    const response = await apiFetch(`/map-points?date=${encodeURIComponent(dateKey)}`);
    const data = await response.json().catch(() => []);
    if (!response.ok) throw new Error(data.message || `No se pudieron cargar los puntos del ${formatMapDiaryLabel(dateKey)}.`);
    const points = Array.isArray(data) ? data : [];
    puntosPorJornada.set(dateKey, { points, at: Date.now() });
    return points;
  };

  const loadReportJornadas = async (claves = [], { onProgreso } = {}) => {
    const unicas = [...new Set(claves.filter(Boolean))].sort();
    const otras = unicas.filter((dateKey) => dateKey !== activeMapDiaryDateKey);
    onProgreso?.("Cargando puntos de las jornadas…");
    const puntosPorDia = await Promise.all(otras.map(async (dateKey) => ({ dateKey, points: await cargarPuntosJornada(dateKey) })));
    // Solo se piden los barrios que todavía no se conocen.
    const sinContexto = puntosPorDia
      .flatMap((dia) => dia.points)
      .filter((point) => {
        const clave = getMapPointContextKey(point);
        return clave && !mapPointContexts[clave] && !contextosConocidos[clave];
      });
    if (sinContexto.length) {
      onProgreso?.("Buscando barrios y referencias…");
      try {
        const response = await apiFetch("/map-points/context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ points: sinContexto.map((point) => ({ latitude: point.latitude, longitude: point.longitude })) })
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) (Array.isArray(data.contexts) ? data.contexts : []).forEach((context) => { contextosConocidos[context.key] = context; });
      } catch {
        // Sin contexto, el barrio sale de la clave de cada punto.
      }
    }
    const contextos = { ...mapPointContexts, ...contextosConocidos };
    return unicas.map((dateKey) => {
      if (dateKey === activeMapDiaryDateKey && mapReportPrintData) return { dateKey, data: mapReportPrintData };
      const dia = puntosPorDia.find((item) => item.dateKey === dateKey);
      const data = buildMapReportData({ points: dia?.points || [], contexts: contextos, barrioCodes: safeBarrioCodes });
      return { dateKey, data: applyMapReportZoneOverrides(data, mapReportSettings) };
    });
  };

  // Informe de campo en PDF (técnico o censo) de una o varias jornadas.
  // `jornadasCargadas`: las que el diálogo ya cargó para listar los barrios; si son las
  // mismas jornadas se usan tal cual y no se vuelven a pedir.
  const descargarInformeCampo = async ({ tipo, includedZoneKeys, jornadas: claves, jornadasCargadas, onProgreso } = {}) => {
    const modulosPdf = Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const lista = Array.isArray(claves) && claves.length ? claves : [activeMapDiaryDateKey].filter(Boolean);
    const soloActiva = lista.length === 1 && lista[0] === activeMapDiaryDateKey;
    const mismasCargadas = Array.isArray(jornadasCargadas) && jornadasCargadas.length
      && [...new Set(lista)].sort().join(",") === jornadasCargadas.map((jornada) => jornada.dateKey).join(",");
    const crudas = soloActiva
      ? [{ dateKey: activeMapDiaryDateKey, data: mapReportPrintData }]
      : mismasCargadas ? jornadasCargadas : await loadReportJornadas(lista, { onProgreso });
    const jornadas = crudas.map((jornada) => ({ ...jornada, data: selectReportZones(jornada.data, includedZoneKeys, getMapPointTypeLabel) }));
    onProgreso?.(jornadas.length > 1 ? `Dibujando ${jornadas.length + 1} mapas…` : "Dibujando el mapa…");
    // Padrón, mapas y logo a la vez: cada mapa espera sus mosaicos por la red.
    const padronPromesa = tipo === "census"
      ? buildMapReportPadronData({ zones: jornadas.flatMap((jornada) => jornada.data.zones) }).then((datos) => datos.padronNames)
      : Promise.resolve({});
    // Mapa de la zona trabajada (técnico y censo). Un mapa oficial adjunto en Configurar
    // tiene prioridad sobre el general dibujado.
    const puntosDe = (jornada) => jornada.data.zones.flatMap((zona) => zona.items);
    const varias = jornadas.length > 1;
    const colorDia = Object.fromEntries(jornadas.map((jornada, indice) => [jornada.dateKey, COLORES_DIA[indice % COLORES_DIA.length]]));
    const conDia = jornadas.flatMap((jornada) => puntosDe(jornada).map((punto) => ({ ...punto, __jornada: jornada.dateKey })));
    const mapaGeneralPromesa = mapReportSettings.map_image_data_url
      ? Promise.resolve(mapReportSettings.map_image_data_url)
      : dibujarMapaPuntos({ points: conDia, apiUrl: API_URL, colorDe: varias ? (punto) => colorDia[punto.__jornada] : null }).catch(() => "");
    const mapasDiaPromesa = varias
      ? Promise.all(jornadas.map(async (jornada) => [
        jornada.dateKey,
        await dibujarMapaPuntos({ points: puntosDe(jornada), apiUrl: API_URL, ancho: 1200, alto: 640 }).catch(() => "")
      ]))
      : Promise.resolve([]);
    const [padronNames, mapaGeneral, mapasDia] = await Promise.all([padronPromesa, mapaGeneralPromesa, mapasDiaPromesa]);
    const mapasPorDia = Object.fromEntries(mapasDia);
    const leyendaGeneral = varias && !mapReportSettings.map_image_data_url
      ? jornadas.map((jornada, indice) => ({ label: `Día ${indice + 1} · ${fechaLarga(jornada.dateKey)}`, color: colorDia[jornada.dateKey] }))
      : null;
    onProgreso?.("Armando el PDF…");
    const [{ jsPDF }, autoTableModule] = await modulosPdf;
    let logoDataUrl = "";
    try { logoDataUrl = await urlToDataUrl(logoAguasCholuteca); } catch { logoDataUrl = ""; }
    const doc = crearInformeCampoPdf({
      jsPDF,
      autoTable: autoTableModule.default,
      tipo,
      jornadas,
      settings: mapReportSettings,
      staff: mapReportStaff,
      padronNames,
      logoDataUrl,
      mapaGeneral,
      leyendaGeneral,
      mapasPorDia,
      generadoEn: formatDateTime(new Date().toISOString())
    });
    saveReportPdf(doc, nombreArchivoInforme(tipo === "census" ? "reporte-censo" : "reporte-campo", jornadas.map((jornada) => jornada.dateKey)));
    return jornadas;
  };

  const handleDownloadMapReport = async () => {
    try {
      const response = await apiFetch(`/map-points/export?date=${encodeURIComponent(activeMapDiaryDateKey)}`);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "No fue posible descargar el reporte.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `reporte-detallado-puntos-campo-${activeMapDiaryDateKey || new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showAlert("Reporte detallado de puntos descargado.");
    } catch (error) {
      showAlert(error.message || "No fue posible descargar el reporte.");
    }
  };

  const handlePrintMapFieldReport = async ({ includedZoneKeys } = {}) => {
    const generatedAt = formatDateTime(new Date().toISOString());
    const reportData = getSelectedMapReportData(includedZoneKeys);
    // La captura de pantalla del mapa ya no existe en Reportes: se dibuja el mapa de los puntos.
    const mapImageDataUrl = mapReportSettings.map_image_data_url ||
      (await dibujarMapaPuntos({ points: reportData.zones.flatMap((zona) => zona.items), apiUrl: API_URL }).catch(() => ""));
    const reportCajaTotal = getSelectedCajaTotal(reportData);
    const reportTitle = mapReportSettings.title.trim() || defaultMapReportSettings.title;
    const reportSubtitle = mapReportSettings.subtitle.trim() || defaultMapReportSettings.subtitle;
    const reportDescription = mapReportSettings.description.trim() || defaultMapReportSettings.description;
    const reportNotes = mapReportSettings.report_notes.trim();
    const totalsMarkup = Object.entries(reportData.totalsByType)
      .map(
        ([label, total]) => `
          <div class="field-report-total-chip">
            <strong>${label}</strong>
            <span>${total}</span>
          </div>
        `
      )
      .join("");
    const portadaMarkup = `
      <section class="field-report-cover">
        <div class="field-report-cover-copy">
          <span class="field-report-kicker">Resumen de operaciones</span>
          <h2>Levantamiento consolidado de puntos de campo</h2>
          <p>Vista institucional del trabajo levantado, lista para seguimiento y revision administrativa.</p>
          <div class="field-report-cover-metrics">
            <div>
              <strong>Total de puntos</strong>
              <span>${reportData.totalPoints}</span>
            </div>
            <div>
              <strong>Total de barrios</strong>
              <span>${reportData.totalZones}</span>
            </div>
            <div>
              <strong>Cajas de registro</strong>
              <span>${reportCajaTotal}</span>
            </div>
          </div>
          ${buildMapReportStaffMarkup(mapReportStaff)}
        </div>
        <div class="field-report-cover-map">
          ${
            mapImageDataUrl
              ? `<img src="${mapImageDataUrl}" alt="Mapa visual del levantamiento" class="field-report-map-image" />`
              : `<div class="field-report-map-fallback">No fue posible capturar la vista del mapa para esta impresion.</div>`
          }
        </div>
      </section>
    `;

    const zonesMarkup = reportData.zones
      .map(
        (zone, index) => `
          <section class="field-report-zone">
            <div class="field-report-zone-head">
              <div>
                <span class="field-report-zone-kicker">${escapeHtml(zone.displayKicker || `Zona ${index + 1}`)}</span>
                <h3>${escapeHtml(zone.displayName || zone.zone)}</h3>
                <p>Referencia sugerida: ${escapeHtml(zone.displayReference || "Sin contexto cercano")}</p>
                <p>Ubicacion completa: ${escapeHtml(zone.displayLocation || "Sin direccion ampliada")}</p>
              </div>
              <div class="field-report-zone-meta">
                <span>Total: ${zone.total}</span>
                <span>Tipos: ${zone.pointTypesLabel || "--"}</span>
                <span>Precision prom.: ${zone.averageAccuracy ?? "--"} m</span>
              </div>
            </div>
            <table class="field-report-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tipo</th>
                  <th>Marca</th>
                  <th>Latitud</th>
                  <th>Longitud</th>
                  <th>Precision</th>
                  <th>Barrio</th>
                  <th>Referencia cercana</th>
                  <th>Referencia</th>
                  <th>Descripcion</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                ${zone.items
                  .map(
                    (point, pointIndex) => `
                      <tr class="${getReportPointRowClassName(point)}">
                        <td>${pointIndex + 1}</td>
                        <td>${getMapPointTypeLabel(point.point_type)}</td>
                        <td>
                          <span class="field-report-color-chip" style="--point-color: ${escapeHtml(point.marker_color || "#1576d1")}"></span>
                          ${point.is_terminal_point ? "Pin final" : point.marker_color || "#1576d1"}
                        </td>
                        <td>${formatCoordinate(point.latitude)}</td>
                        <td>${formatCoordinate(point.longitude)}</td>
                        <td>${point.accuracy_meters ? `${point.accuracy_meters} m` : "--"}</td>
                        <td>${escapeHtml(point.report_zone_label || point.suggested_zone || zone.zone)}</td>
                        <td>${escapeHtml(point.suggested_reference || "--")}</td>
                        <td>${escapeHtml(getMapPointReferenceNote(point) || "--")}</td>
                        <td>${escapeHtml(getMapPointTechnicalDescription(point) || "--")}</td>
                        <td>${formatDateTime(point.created_at)}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </section>
        `
      )
      .join("");

    await printDocument(
      reportTitle,
      `
        <div class="field-report-shell">
          <header class="field-report-header">
            <div class="field-report-brand">
              <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" />
              <div>
                <p class="field-report-kicker">${escapeHtml(reportSubtitle)}</p>
                <h1>${escapeHtml(reportTitle)}</h1>
                <p>${escapeHtml(reportDescription)}</p>
              </div>
            </div>
            <div class="field-report-meta">
              <span>Generado: ${generatedAt}</span>
              <span>Total de puntos: ${reportData.totalPoints}</span>
              <span>Total de barrios: ${reportData.totalZones}</span>
            </div>
            ${buildMapReportStaffMarkup(mapReportStaff)}
          </header>
          ${portadaMarkup}
          <section class="field-report-summary">
            ${totalsMarkup || '<div class="field-report-total-chip"><strong>Sin puntos</strong><span>0</span></div>'}
          </section>
          ${reportNotes ? `<section class="field-report-notes"><strong>Observaciones del censo</strong><p>${escapeHtml(reportNotes)}</p></section>` : ""}
          ${zonesMarkup || '<p class="field-report-empty">No hay puntos guardados para generar el reporte.</p>'}
        </div>
      `,
      {
        pageSize: "Letter landscape",
        pageMargin: "8mm",
        bodyClassName: "field-report-body",
        showPageFooter: true
      }
    );
  };

  const handleDownloadMapFieldPdf = async (opciones = {}) => {
    try {
      const jornadas = await descargarInformeCampo({ ...opciones, tipo: "technical" });
      showAlert(jornadas.length > 1 ? `Reporte PDF de ${jornadas.length} jornadas descargado.` : "Reporte PDF descargado.");
    } catch (error) {
      showAlert(error.message || "No fue posible descargar el reporte PDF.");
    }
  };

  const handlePrintMapCensusReport = async ({ includedZoneKeys } = {}) => {
    const generatedAt = formatDateTime(new Date().toISOString());
    const reportData = getSelectedMapReportData(includedZoneKeys);
    const reportCajaTotal = getSelectedCajaTotal(reportData);
    const { padronNames } = await buildMapReportPadronData(reportData);
    const reportTitle = mapReportSettings.title.trim() || defaultMapReportSettings.title;
    const reportSubtitle = mapReportSettings.subtitle.trim() || defaultMapReportSettings.subtitle;
    const reportDescription = mapReportSettings.description.trim() || defaultMapReportSettings.description;
    const reportNotes = mapReportSettings.report_notes.trim();
    const mapImageDataUrl = mapReportSettings.map_image_data_url ||
      (await dibujarMapaPuntos({ points: reportData.zones.flatMap((zona) => zona.items), apiUrl: API_URL }).catch(() => ""));
    const zonesMarkup = reportData.zones
      .map(
        (zone, index) => `
          <section class="field-report-zone census-report-zone">
            <div class="field-report-zone-head census-report-zone-head">
              <div>
                <span class="field-report-zone-kicker">${escapeHtml(zone.displayKicker || `Zona ${index + 1}`)}</span>
                <h3>${escapeHtml(zone.displayName || zone.zone)}</h3>
                <p>Ubicación: ${escapeHtml(zone.displayLocation || "Sin referencia")}</p>
              </div>
              <div class="field-report-zone-meta">
                <span>Puntos: ${zone.total}</span>
              </div>
            </div>
            <table class="field-report-table census-report-table map-points-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Barrio / sector</th>
                  <th>Clave / abonado</th>
                  <th>Nombre en padrón</th>
                  <th>Tipo</th>
                  <th>Referencia</th>
                  <th>Descripción</th>
                </tr>
              </thead>
              <tbody>
                ${zone.items
                  .map(
                    (point, pointIndex) => `
                      <tr class="${getReportPointRowClassName(point)}">
                        <td>${pointIndex + 1}</td>
                        <td>${escapeHtml(zone.displayName || zone.zone || "--")}</td>
                        <td>${escapeHtml(getMapPointReportReferenceLabel(point))}</td>
                        <td>${escapeHtml(getMapPointPadronNames(point, padronNames))}</td>
                        <td>${escapeHtml(getMapPointTypeLabel(point.point_type))}</td>
                        <td>${escapeHtml(getMapPointReferenceNote(point) || zone.displayLocation || "--")}</td>
                        <td>${escapeHtml(getMapPointTechnicalDescription(point) || "--")}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </section>
        `
      )
      .join("");

    await printDocument(
      `${reportTitle} - Censo sin coordenadas`,
      `
        <div class="field-report-shell census-report-shell">
          <header class="field-report-header census-report-header">
            <div class="field-report-brand">
              <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" />
              <div>
                <p class="field-report-kicker">${escapeHtml(reportSubtitle)}</p>
                <h1>${escapeHtml(reportTitle)}</h1>
                <p>${escapeHtml(reportDescription)}</p>
              </div>
            </div>
            <div class="field-report-meta">
              <span>Tipo: Reporte de censo sin coordenadas</span>
              <span>Generado: ${generatedAt}</span>
              <span>Total de puntos: ${reportData.totalPoints}</span>
              <span>Zonas / manzanas: ${reportData.totalZones}</span>
            </div>
            ${buildMapReportStaffMarkup(mapReportStaff)}
          </header>
          ${
            mapImageDataUrl
              ? `<section class="census-report-map"><img src="${mapImageDataUrl}" alt="Mapa del censo" class="field-report-map-image" /></section>`
              : ""
          }
          <section class="field-report-summary">
            <div class="field-report-total-chip"><strong>Total de puntos</strong><span>${reportData.totalPoints}</span></div>
            <div class="field-report-total-chip"><strong>Zonas / manzanas</strong><span>${reportData.totalZones}</span></div>
            <div class="field-report-total-chip"><strong>Cajas de registro</strong><span>${reportCajaTotal}</span></div>
          </section>
          ${buildMapReportTypeChartMarkup(reportData)}
          ${reportNotes ? `<section class="field-report-notes"><strong>Observaciones del censo</strong><p>${escapeHtml(reportNotes)}</p></section>` : ""}
          ${zonesMarkup || '<p class="field-report-empty">No hay puntos guardados para generar el reporte.</p>'}
        </div>
      `,
      {
        pageSize: "Letter portrait",
        pageMargin: "10mm",
        bodyClassName: "field-report-body census-report-body",
        showPageFooter: true
      }
    );
  };

  const handleDownloadMapCensusPdf = async (opciones = {}) => {
    try {
      const jornadas = await descargarInformeCampo({ ...opciones, tipo: "census" });
      showAlert(jornadas.length > 1 ? `Censo de ${jornadas.length} jornadas descargado.` : "Reporte de censo sin coordenadas descargado.");
    } catch (error) {
      showAlert(error.message || "No fue posible descargar el reporte de censo.");
    }
  };

  const handlePrintMapBriefReport = async ({ sharedKeys: includeSharedKeys = false, debtSummary: includeDebtSummary = false, includedZoneKeys } = {}) => {
    const generatedAt = formatDateTime(new Date().toISOString());
    const reportData = getSelectedMapReportData(includedZoneKeys);
    const reportCajaTotal = getSelectedCajaTotal(reportData);
    const { padronNames, sharedKeys, debtRows } = await buildMapReportPadronData(reportData);
    const reportTitle = mapReportSettings.title.trim() || defaultMapReportSettings.title;
    const reportSubtitle = mapReportSettings.subtitle.trim() || defaultMapReportSettings.subtitle;
    const reportNotes = mapReportSettings.report_notes.trim();
    const sharedAccounts = sharedKeys.reduce((total, item) => total + item.total, 0);
    const totalDebt = debtRows.reduce((total, item) => total + item.total, 0);
    const rowsMarkup = buildMapReportBriefRows(reportData, padronNames)
      .map(
        ([index, barrio, clave, nombre, tipo, descripcion, services]) => `
          <tr>
            <td>${escapeHtml(index)}</td>
            <td>${escapeHtml(barrio)}</td>
            <td>${escapeHtml(clave)}</td>
            <td>${escapeHtml(nombre)}</td>
            <td>${escapeHtml(tipo)}</td>
            <td>${escapeHtml(descripcion)}</td>
            <td class="map-brief-service-cell">${escapeHtml(services)}</td>
          </tr>
        `
      )
      .join("");

    await printDocument(
      `${reportTitle} - Resumen ligero`,
      `
        <div class="field-report-shell map-brief-report-shell">
          <header class="field-report-header map-brief-report-header">
            <div class="field-report-brand">
              <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" />
              <div>
                <p class="field-report-kicker">${escapeHtml(reportSubtitle)}</p>
                <h1>${escapeHtml(reportTitle)}</h1>
                <p>Resumen ligero de jornada GPS para lectura rapida, archivo PDF e impresion.</p>
              </div>
            </div>
            <div class="field-report-meta">
              <span>Generado: ${generatedAt}</span>
              <span>Jornada: ${escapeHtml(formatMapDiaryLabel(activeMapDiaryDateKey))}</span>
              <span>Tecnicos: ${escapeHtml(getMapReportTechniciansLabel(mapReportStaff))}</span>
            </div>
          </header>
          <section class="map-brief-report-metrics">
            <div><strong>Total general</strong><span>${reportData.totalPoints}</span></div>
            <div><strong>Barrios / zonas</strong><span>${reportData.totalZones}</span></div>
            <div><strong>Cajas de registro</strong><span>${reportCajaTotal}</span></div>
          </section>
          ${buildMapReportTypeChartMarkup(reportData)}
          ${reportNotes ? `<section class="field-report-notes"><strong>Observaciones</strong><p>${escapeHtml(reportNotes)}</p></section>` : ""}
          <section class="field-report-zone map-brief-report-table-section">
            <div class="field-report-zone-head">
              <div>
                <span class="field-report-zone-kicker">Listado resumido</span>
                <h3>Listado por barrio y clave</h3>
                <p class="map-brief-service-legend">${escapeHtml(MAP_REPORT_SERVICE_LEGEND)}</p>
              </div>
              <div class="field-report-zone-meta">
                <span>${reportData.totalZones} barrios</span>
              </div>
            </div>
            <table class="field-report-table map-brief-report-table">
              <colgroup>
                <col class="map-brief-col-index" />
                <col class="map-brief-col-barrio" />
                <col class="map-brief-col-clave" />
                <col class="map-brief-col-nombre" />
                <col class="map-brief-col-tipo" />
                <col class="map-brief-col-descripcion" />
                <col class="map-brief-col-servicios" />
              </colgroup>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Barrio / zona</th>
                  <th>Clave / abonado</th>
                  <th>Nombre en padrón</th>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th>Servicios activos</th>
                </tr>
              </thead>
              <tbody>
                ${rowsMarkup || '<tr><td colspan="7">No hay puntos guardados para generar el resumen.</td></tr>'}
              </tbody>
            </table>
          </section>
          ${includeSharedKeys ? `<section class="map-brief-shared-keys">
            <div>
              <span class="field-report-zone-kicker">Cruce del padrón</span>
              <h3>Abonados que comparten clave catastral</h3>
              <p><strong>${sharedKeys.length}</strong> claves agrupan <strong>${sharedAccounts}</strong> abonados.</p>
            </div>
            ${
              sharedKeys.length
                ? `<table><thead><tr><th>Clave catastral base</th><th>Abonados</th><th>Total</th></tr></thead><tbody>${sharedKeys
                    .map(
                      (item) =>
                        `<tr><td>${escapeHtml(item.clave)}</td><td>${escapeHtml(item.abonados.join(", "))}</td><td>${item.total}</td></tr>`
                    )
                    .join("")}</tbody></table>`
                : "<p>No se detectaron varios abonados con la misma clave catastral.</p>"
            }
          </section>` : ""}
          ${includeDebtSummary ? `<section class="map-brief-debt-summary">
            <header><div><span class="field-report-zone-kicker">Cartera de los abonados</span><h3>Deuda asociada</h3></div><strong>${escapeHtml(formatCurrency(totalDebt))}</strong></header>
            ${
              debtRows.length
                ? `<table><thead><tr><th>Clave</th><th>Abonado</th><th>Nombre</th><th>Deuda</th></tr></thead><tbody>${debtRows
                    .map(
                      (item) =>
                        `<tr><td>${escapeHtml(item.clave)}</td><td>${escapeHtml(item.abonado)}</td><td>${escapeHtml(item.nombre)}</td><td>${escapeHtml(formatCurrency(item.total))}</td></tr>`
                    )
                    .join("")}</tbody></table>`
                : "<p>No se encontraron abonados del padrón para calcular deuda.</p>"
            }
          </section>` : ""}
        </div>
      `,
      {
        pageSize: "Letter portrait",
        pageMargin: "9mm",
        bodyClassName: "field-report-body map-brief-report-body",
        showPageFooter: true
      }
    );
  };

  const handleDownloadMapBriefPdf = async ({ sharedKeys: includeSharedKeys = false, debtSummary: includeDebtSummary = false, includedZoneKeys } = {}) => {
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableModule.default;
      const document = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "letter",
        compress: true
      });
      const reportData = getSelectedMapReportData(includedZoneKeys);
      const reportCajaTotal = getSelectedCajaTotal(reportData);
      const { padronNames, sharedKeys, debtRows } = await buildMapReportPadronData(reportData);
      const generatedAt = formatDateTime(new Date().toISOString());
      const reportTitle = mapReportSettings.title.trim() || defaultMapReportSettings.title;
      const reportSubtitle = mapReportSettings.subtitle.trim() || defaultMapReportSettings.subtitle;
      const reportNotes = mapReportSettings.report_notes.trim();
      const sharedAccounts = sharedKeys.reduce((total, item) => total + item.total, 0);
      const totalDebt = debtRows.reduce((total, item) => total + item.total, 0);
      const pageWidth = document.internal.pageSize.getWidth();
      const pageHeight = document.internal.pageSize.getHeight();
      const addPageFooter = () => {
        const currentPage = document.getCurrentPageInfo().pageNumber;
        document.setFont("helvetica", "normal");
        document.setFontSize(8);
        document.setTextColor(83, 103, 122);
        document.text(`Pagina ${currentPage}`, pageWidth - 14, pageHeight - 8, { align: "right" });
      };

      try {
        const logoDataUrl = await urlToDataUrl(logoAguasCholuteca);
        document.addImage(logoDataUrl, "PNG", 14, 10, 18, 18);
      } catch {
        // Keep the report generation going even if the logo cannot be embedded.
      }

      document.setFont("helvetica", "bold");
      document.setFontSize(15);
      document.setTextColor(18, 59, 93);
      document.text(document.splitTextToSize(reportTitle, 152), 36, 15);
      document.setFont("helvetica", "normal");
      document.setFontSize(9);
      document.setTextColor(64, 91, 117);
      document.text(reportSubtitle, 36, 24);
      document.text(`Resumen ligero GPS | ${generatedAt}`, 36, 29);

      document.setFillColor(238, 246, 252);
      document.roundedRect(14, 38, 188, 24, 3, 3, "F");
      document.setFont("helvetica", "bold");
      document.setFontSize(10);
      document.setTextColor(16, 55, 91);
      document.text("Jornada", 20, 46);
      document.text("Puntos", 80, 46);
      document.text("Barrios", 122, 46);
      document.text("Cajas", 164, 46);
      document.setFontSize(13);
      document.text(formatMapDiaryLabel(activeMapDiaryDateKey), 20, 55);
      document.text(String(reportData.totalPoints), 80, 55);
      document.text(String(reportData.totalZones), 122, 55);
      document.text(String(reportCajaTotal), 164, 55);

      const chartRows = getMapReportTypeChartRows(reportData);
      const maxChartValue = Math.max(1, ...chartRows.map(([, total]) => Number(total || 0)));
      document.setFont("helvetica", "bold");
      document.setFontSize(9);
      document.setTextColor(16, 55, 91);
      document.text("Distribucion de puntos", 14, 70);
      chartRows.forEach(([label, total], index) => {
        const rowY = 76 + index * 5;
        document.setFont("helvetica", "normal");
        document.setFontSize(7.5);
        document.setTextColor(45, 75, 101);
        document.text(String(label).slice(0, 25), 14, rowY);
        document.setFillColor(224, 235, 245);
        document.roundedRect(62, rowY - 2.7, 120, 3, 1.5, 1.5, "F");
        document.setFillColor(21, 118, 209);
        document.roundedRect(62, rowY - 2.7, Math.max(4, (Number(total || 0) / maxChartValue) * 120), 3, 1.5, 1.5, "F");
        document.text(String(total), 198, rowY, { align: "right" });
      });

      let currentY = 80 + chartRows.length * 5;
      if (reportNotes) {
        document.setFont("helvetica", "bold");
        document.setFontSize(9);
        document.setTextColor(16, 55, 91);
        document.text("Observaciones", 14, currentY);
        document.setFont("helvetica", "normal");
        document.setFontSize(8.2);
        document.setTextColor(69, 96, 122);
        const noteLines = document.splitTextToSize(reportNotes, 184);
        document.text(noteLines.slice(0, 4), 14, currentY + 5);
        currentY += Math.min(24, noteLines.length * 4 + 10);
      }

      document.setFont("helvetica", "normal");
      document.setFontSize(7.8);
      document.setTextColor(69, 96, 122);
      document.text(`Servicios: ${MAP_REPORT_SERVICE_LEGEND}`, 14, currentY + 2);

      autoTable(document, {
        startY: currentY + 6,
        head: [["#", "Barrio / zona", "Clave / abonado", "Nombre en padron", "Tipo", "Descripcion", "Servicios"]],
        body: buildMapReportBriefRows(reportData, padronNames),
        theme: "grid",
        styles: {
          fontSize: 7.4,
          cellPadding: 1.8,
          textColor: [28, 44, 62],
          overflow: "linebreak"
        },
        headStyles: {
          fillColor: [21, 118, 209],
          textColor: [255, 255, 255],
          fontStyle: "bold"
        },
        alternateRowStyles: {
          fillColor: [248, 251, 255]
        },
        margin: { left: 14, right: 14, bottom: 14 },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 25 },
          2: { cellWidth: 24 },
          3: { cellWidth: 30 },
          4: { cellWidth: 20 },
          5: { cellWidth: 50 },
          6: { cellWidth: 31, fontStyle: "bold" }
        }
      });

      let appendixY = (document.lastAutoTable?.finalY ?? 220) + 10;
      if (includeSharedKeys) {
        if (appendixY > 230) {
          document.addPage("letter", "portrait");
          appendixY = 18;
        }
        document.setFont("helvetica", "bold");
        document.setFontSize(11);
        document.setTextColor(16, 55, 91);
        document.text("Abonados que comparten clave catastral", 14, appendixY);
        document.setFont("helvetica", "normal");
        document.setFontSize(8.5);
        document.setTextColor(69, 96, 122);
        document.text(`${sharedKeys.length} claves agrupan ${sharedAccounts} abonados.`, 14, appendixY + 6);
        if (sharedKeys.length) {
          autoTable(document, {
            startY: appendixY + 10,
            head: [["Clave catastral base", "Abonados", "Nombres", "Total"]],
            body: sharedKeys.map((item) => [item.clave, item.abonados.join(", "), item.nombres.join(", ") || "--", String(item.total)]),
            theme: "grid",
            styles: { fontSize: 8, cellPadding: 2, textColor: [28, 44, 62] },
            headStyles: { fillColor: [13, 77, 134], textColor: [255, 255, 255], fontStyle: "bold" },
            alternateRowStyles: { fillColor: [248, 251, 255] },
            margin: { left: 14, right: 14, bottom: 14 },
            columnStyles: {
              0: { cellWidth: 40 },
              1: { cellWidth: 45 },
              2: { cellWidth: 87 },
              3: { cellWidth: 16, halign: "center" }
            }
          });
          appendixY = (document.lastAutoTable?.finalY ?? appendixY + 10) + 10;
        } else {
          document.text("No se detectaron varios abonados con la misma clave catastral base.", 14, appendixY + 12);
          appendixY += 20;
        }
      }

      if (includeDebtSummary) {
        if (appendixY > 225) {
          document.addPage("letter", "portrait");
          appendixY = 18;
        }
        document.setFont("helvetica", "bold");
        document.setFontSize(11);
        document.setTextColor(16, 55, 91);
        document.text("Deuda de los abonados del informe", 14, appendixY);
        document.setFontSize(12);
        document.text(formatCurrency(totalDebt), 202, appendixY, { align: "right" });
        if (debtRows.length) {
          autoTable(document, {
            startY: appendixY + 5,
            head: [["Clave", "Abonado", "Nombre", "Deuda"]],
            body: debtRows.map((item) => [item.clave, item.abonado, item.nombre, formatCurrency(item.total)]),
            theme: "grid",
            styles: { fontSize: 7.8, cellPadding: 1.8, textColor: [28, 44, 62] },
            headStyles: { fillColor: [13, 77, 134], textColor: [255, 255, 255], fontStyle: "bold" },
            alternateRowStyles: { fillColor: [248, 251, 255] },
            margin: { left: 14, right: 14, bottom: 14 },
            columnStyles: {
              0: { cellWidth: 38 },
              1: { cellWidth: 30 },
              2: { cellWidth: 80 },
              3: { cellWidth: 40, halign: "right", fontStyle: "bold" }
            }
          });
        } else {
          document.setFont("helvetica", "normal");
          document.setFontSize(8.5);
          document.text("No se encontraron abonados del padron para calcular deuda.", 14, appendixY + 7);
        }
      }

      const pageCount = document.getNumberOfPages();
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        document.setPage(pageNumber);
        addPageFooter();
      }

      saveReportPdf(document, `resumen-ligero-gps-${activeMapDiaryDateKey || new Date().toISOString().slice(0, 10)}.pdf`);
      showAlert("Resumen ligero GPS descargado.");
    } catch (error) {
      showAlert(error.message || "No fue posible descargar el resumen ligero.");
    }
  };

  return {
    loadReportJornadas,
    handleDownloadMapReport,
    handlePrintMapFieldReport,
    handleDownloadMapFieldPdf,
    handlePrintMapCensusReport,
    handleDownloadMapCensusPdf,
    handlePrintMapBriefReport,
    handleDownloadMapBriefPdf
  };
}
