import { defaultMapReportSettings } from "../../constants/formsAndUi";
import { formatCoordinate, getMapPointContextKey, getMapPointTypeLabel } from "../../utils/mapField";
import { formatDateTime, formatMapDiaryLabel, getMapDiaryDateKey } from "../../utils/datesAndBusiness";
import {
  getMapPointReferenceNote,
  getMapPointTechnicalDescription,
  getMapReportBarrioZone,
  getMapReportPointClave,
  getMapReportTechniciansLabel
} from "../../utils/mapReport";
import logoAguasCholuteca from "../../assets/logo-aguas-choluteca.png";
import { roleLabel } from "../../utils/formatting";
import { saveReportPdf } from "../../utils/printDocument";
import { urlToDataUrl } from "../../utils/imageUtils";

export function createRegulatorEvidencePdf({
  activeMapDiaryDateKey,
  apiFetch,
  captureReportMapImage,
  generatingRegulatorReport,
  isAdmin,
  mapPointContexts,
  mapReportSettings,
  mapReportStaff,
  safeAuditLogs,
  safeBarrioCodes,
  safeMapPoints,
  safeUsers,
  selectedRegulatorDiaryKeys,
  session,
  setGeneratingRegulatorReport,
  showAlert,
  visibleMapPoints
}) {
  const handleDownloadRegulatorEvidencePdf = async () => {
    if (generatingRegulatorReport) return;
    const selectedDateKeys = selectedRegulatorDiaryKeys.length ? selectedRegulatorDiaryKeys : [activeMapDiaryDateKey].filter(Boolean);
    if (!selectedDateKeys.length) {
      showAlert("Selecciona al menos una jornada con puntos GPS para generar el resumen.");
      return;
    }

    setGeneratingRegulatorReport(true);
    showAlert("Generando resumen de trabajo realizado...");

    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableModule.default;
      const document = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter", compress: true });
      const generatedAtIso = new Date().toISOString();
      const generatedAt = formatDateTime(generatedAtIso);
      const reportTitle = "Resumen de trabajo realizado";
      const reportSubtitle = mapReportSettings.subtitle.trim() || defaultMapReportSettings.subtitle;
      const mapImageDataUrl =
        mapReportSettings.map_image_data_url ||
        (await Promise.race([
          captureReportMapImage(),
          new Promise((resolve) => window.setTimeout(() => resolve(""), 3500))
        ]));
      const pageWidth = document.internal.pageSize.getWidth();
      const pageHeight = document.internal.pageSize.getHeight();
      const maxPages = 5;
      const journeyEntries = await Promise.all(
        selectedDateKeys.map(async (dateKey) => {
          const localPoints = safeMapPoints.filter((point) => getMapDiaryDateKey(point) === dateKey);
          if (localPoints.length) {
            return { dateKey, points: localPoints };
          }

          try {
            const response = await apiFetch(`/map-points?date=${encodeURIComponent(dateKey)}`);
            const data = await response.json();
            return { dateKey, points: response.ok && Array.isArray(data) ? data : [] };
          } catch {
            return { dateKey, points: [] };
          }
        })
      );
      const evidencePoints = journeyEntries
        .flatMap((entry) => entry.points.map((point) => ({ ...point, evidence_date_key: entry.dateKey })))
        .sort((left, right) => new Date(right.updated_at || right.created_at) - new Date(left.updated_at || left.created_at));
      let evidenceContexts = {};
      if (evidencePoints.length && isAdmin) {
        try {
          const response = await apiFetch("/map-points/context", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              points: evidencePoints.map((point) => ({
                latitude: point.latitude,
                longitude: point.longitude
              }))
            })
          });
          const data = await response.json();
          if (response.ok) {
            evidenceContexts = Object.fromEntries((Array.isArray(data.contexts) ? data.contexts : []).map((context) => [context.key, context]));
          }
        } catch {
          evidenceContexts = {};
        }
      }
      const getEvidenceContext = (point) => evidenceContexts[getMapPointContextKey(point)] ?? mapPointContexts[getMapPointContextKey(point)] ?? null;
      const recentPoints = evidencePoints.slice(0, 40);
      const latestPoint = recentPoints[0] || visibleMapPoints[0] || null;
      const partialUserRows = recentPoints.slice(0, 28).map((point, index) => {
        const context = getEvidenceContext(point);
        return [
          String(index + 1),
          getMapReportPointClave(point, context) || "--",
          formatMapDiaryLabel(point.evidence_date_key || getMapDiaryDateKey(point)),
          getMapReportBarrioZone(point, context, safeBarrioCodes),
          getMapPointTypeLabel(point.point_type),
          `${formatCoordinate(point.latitude)}, ${formatCoordinate(point.longitude)}`,
          getMapPointReferenceNote(point) || point.suggested_reference || getMapPointTechnicalDescription(point) || "--",
          formatDateTime(point.updated_at || point.created_at)
        ];
      });
      const evidenceZoneMap = evidencePoints.reduce((accumulator, point) => {
        const context = getEvidenceContext(point);
        const zone = getMapReportBarrioZone(point, context, safeBarrioCodes);
        const current = accumulator.get(zone) ?? { zone, total: 0, dates: new Set(), types: new Set(), claves: new Set() };
        current.total += 1;
        current.dates.add(point.evidence_date_key || getMapDiaryDateKey(point));
        current.types.add(getMapPointTypeLabel(point.point_type));
        const clave = getMapReportPointClave(point, context);
        if (clave) current.claves.add(clave);
        accumulator.set(zone, current);
        return accumulator;
      }, new Map());
      const formatWorkDuration = (minutes) => {
        const safeMinutes = Math.max(0, Math.round(Number(minutes || 0)));
        const hours = Math.floor(safeMinutes / 60);
        const rest = safeMinutes % 60;
        if (!hours) return `${rest} min`;
        return rest ? `${hours} h ${rest} min` : `${hours} h`;
      };
      const getJourneyStats = (entry) => {
        const sortedPoints = [...entry.points].sort(
          (left, right) => new Date(left.created_at || left.updated_at) - new Date(right.created_at || right.updated_at)
        );
        const first = sortedPoints[0] ?? null;
        const last = sortedPoints[sortedPoints.length - 1] ?? null;
        const firstTime = first ? new Date(first.created_at || first.updated_at).getTime() : 0;
        const lastTime = last ? new Date(last.updated_at || last.created_at).getTime() : 0;
        const rangeMinutes = firstTime && lastTime ? Math.max(0, Math.round((lastTime - firstTime) / 60000)) : 0;
        const estimatedMinutes = entry.points.length ? Math.max(rangeMinutes, Math.min(entry.points.length * 4, 600)) : 0;
        return { first, last, rangeMinutes, estimatedMinutes };
      };
      const journeyStatsByDate = Object.fromEntries(journeyEntries.map((entry) => [entry.dateKey, getJourneyStats(entry)]));
      const totalEstimatedMinutes = Object.values(journeyStatsByDate).reduce(
        (sum, stats) => sum + Number(stats.estimatedMinutes || 0),
        0
      );
      const auditActors = new Map();
      safeAuditLogs.forEach((log) => {
        const actor = String(log.actor_name || log.actor_email || "Sistema").trim();
        if (!actor || actor === "Sistema") return;
        const current = auditActors.get(actor) ?? { actor, total: 0, latest: log.created_at };
        current.total += 1;
        if (new Date(log.created_at) > new Date(current.latest)) {
          current.latest = log.created_at;
        }
        auditActors.set(actor, current);
      });
      const appUserRows = (safeUsers.length ? safeUsers : [session?.user].filter(Boolean))
        .map((user) => {
          const actorActivity = auditActors.get(user.full_name) || auditActors.get(user.email) || auditActors.get(user.username);
          return {
            name: user.full_name || user.username || user.email || "Usuario",
            username: user.username || user.email || "--",
            role: roleLabel(user.role || "operador"),
            sessions: Number(user.active_sessions || 0),
            latest: actorActivity?.latest || user.last_login_at || "",
            events: actorActivity?.total || 0,
            isOnline: Boolean(user.is_online || Number(user.active_sessions || 0) > 0)
          };
        })
        .sort((left, right) => {
          if (right.sessions !== left.sessions) return right.sessions - left.sessions;
          return new Date(right.latest || 0) - new Date(left.latest || 0);
        })
        .slice(0, 12)
        .map((user, index) => [
          String(index + 1),
          user.name,
          user.role,
          user.username,
          user.isOnline ? "En linea" : "Fuera de linea",
          user.latest ? formatDateTime(user.latest) : "--",
          String(user.events)
        ]);
      const evidenceRows = [
        ["Sistema fuente", "Aguas de Choluteca / modulo Reportes GPS"],
        ["Jornadas revisadas", selectedDateKeys.map(formatMapDiaryLabel).join(" / ")],
        ["Generado", generatedAt],
        ["Ultima actualizacion visible", latestPoint ? formatDateTime(latestPoint.updated_at || latestPoint.created_at) : "Sin puntos registrados"],
        ["Puntos incluidos", String(evidencePoints.length)],
        ["Barrios / zonas", String(evidenceZoneMap.size)],
        ["Horas estimadas de campo", formatWorkDuration(totalEstimatedMinutes)],
        ["Usuarios registrados", String(safeUsers.length || appUserRows.length)],
        ["Usuarios con eventos recientes", String(auditActors.size)],
        ["Tecnicos", getMapReportTechniciansLabel(mapReportStaff)],
        ["Responsable de datos", mapReportStaff.data_engineer || "--"]
      ];
      const getJourneyEvidenceSummary = (entry) => {
        const stats = journeyStatsByDate[entry.dateKey] ?? getJourneyStats(entry);
        const creators = Array.from(
          new Set(entry.points.map((point) => String(point.created_by_name || "").trim()).filter(Boolean))
        );
        const zones = new Set();
        const claves = new Set();
        const references = new Set();
        const types = entry.points.reduce((accumulator, point) => {
          const context = getEvidenceContext(point);
          zones.add(getMapReportBarrioZone(point, context, safeBarrioCodes));
          const clave = getMapReportPointClave(point, context);
          if (clave) claves.add(clave);
          const reference = getMapPointReferenceNote(point) || getMapPointTechnicalDescription(point) || context?.reference || "";
          if (reference) references.add(reference);
          const label = getMapPointTypeLabel(point.point_type);
          accumulator[label] = (accumulator[label] || 0) + 1;
          return accumulator;
        }, {});
        return {
          stats,
          creators,
          zones: Array.from(zones).filter(Boolean),
          claves: Array.from(claves).filter(Boolean),
          references: Array.from(references).filter(Boolean),
          types
        };
      };
      const journeyEvidenceRows = journeyEntries.slice(0, 5).map((entry, index) => {
        const summary = getJourneyEvidenceSummary(entry);
        return [
          String(index + 1),
          formatMapDiaryLabel(entry.dateKey),
          `${entry.points.length} puntos\n${formatWorkDuration(summary.stats.estimatedMinutes)}`,
          `${summary.zones.length} zonas\n${summary.creators.slice(0, 3).join(" / ") || getMapReportTechniciansLabel(mapReportStaff)}`,
          Object.entries(summary.types).map(([label, total]) => `${label}: ${total}`).join("\n") || "--",
          [
            summary.claves.length ? `Claves: ${summary.claves.slice(0, 5).join(", ")}` : "",
            summary.references.length ? `Refs: ${summary.references.slice(0, 3).join(" | ")}` : ""
          ].filter(Boolean).join("\n") || "Referencias registradas en puntos GPS."
        ];
      });
      const addFooter = () => {
        const currentPage = document.getCurrentPageInfo().pageNumber;
        document.setFont("helvetica", "normal");
        document.setFontSize(8);
        document.setTextColor(78, 101, 123);
        document.text(`Pagina ${currentPage} de maximo ${maxPages}`, pageWidth - 14, pageHeight - 8, { align: "right" });
        document.text("Resumen del trabajo realizado", 14, pageHeight - 8);
      };
      const addPage = () => {
        if (document.getNumberOfPages() >= maxPages) return false;
        document.addPage("letter", "landscape");
        addFooter();
        return true;
      };

      try {
        const logoDataUrl = await urlToDataUrl(logoAguasCholuteca);
        document.addImage(logoDataUrl, "PNG", 14, 10, 20, 20);
      } catch {
        // Logo optional in generated evidence.
      }

      document.setFont("helvetica", "bold");
      document.setFontSize(17);
      document.setTextColor(18, 59, 93);
      document.text(reportTitle, 38, 16);
      document.setFont("helvetica", "normal");
      document.setFontSize(9.5);
      document.setTextColor(71, 95, 118);
      document.text(reportSubtitle, 38, 22);
      document.text("Jornadas seleccionadas, capturas pequenas, puntos de mapa y pruebas generales de trabajo.", 38, 28);

      autoTable(document, {
        startY: 38,
        head: [["Indicador", "Valor"]],
        body: evidenceRows,
        theme: "grid",
        styles: { fontSize: 8.5, cellPadding: 2.4, overflow: "linebreak" },
        headStyles: { fillColor: [21, 118, 209], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 251, 255] },
        margin: { left: 14, right: 150 },
        columnStyles: {
          0: { cellWidth: 43, fontStyle: "bold" },
          1: { cellWidth: 94 }
        }
      });
      const distributionStartY = Math.min(Math.max((document.lastAutoTable?.finalY ?? 108) + 10, 116), 166);

      document.setFillColor(237, 245, 252);
      document.roundedRect(154, 38, 104, 62, 3, 3, "F");
      if (mapImageDataUrl) {
        const mapImageType = mapImageDataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
        document.addImage(mapImageDataUrl, mapImageType, 157, 41, 98, 56);
      } else {
        document.setFont("helvetica", "bold");
        document.setFontSize(10);
        document.setTextColor(81, 106, 128);
        document.text("Mapa / captura no disponible", 206, 69, { align: "center" });
      }

      document.setFont("helvetica", "bold");
      document.setFontSize(11);
      document.setTextColor(18, 59, 93);
      document.text("Distribucion del informe", 14, distributionStartY);
      autoTable(document, {
        startY: distributionStartY + 6,
        head: [["Hoja", "Contenido"]],
        body: [
          ["1", "Resumen ejecutivo del trabajo realizado"],
          ["2", "Usuarios que han trabajado en la aplicacion"],
          ["3", "Jornadas de trabajo seleccionadas"],
          ["4", "Listado parcial de puntos de mapa"],
          ["5", "Mapa principal adjunto y constancia"]
        ],
        theme: "grid",
        styles: { fontSize: 8.4, cellPadding: 2.3, overflow: "linebreak" },
        headStyles: { fillColor: [21, 118, 209], textColor: [255, 255, 255], fontStyle: "bold" },
        margin: { left: 14, right: 150 },
        tableWidth: 150,
        columnStyles: {
          0: { cellWidth: 16, halign: "center", fontStyle: "bold" },
          1: { cellWidth: 134 }
        }
      });
      addFooter();

      if (addPage()) {
        document.setFont("helvetica", "bold");
        document.setFontSize(14);
        document.setTextColor(18, 59, 93);
        document.text("Usuarios que han trabajado en la aplicacion", 14, 16);
        document.setFont("helvetica", "normal");
        document.setFontSize(8.5);
        document.setTextColor(71, 95, 118);
        document.text("Cuentas operativas con actividad, sesiones o eventos recientes dentro del sistema.", 14, 22);
        autoTable(document, {
          startY: 31,
          head: [["#", "Usuario", "Rol", "Cuenta", "Estado", "Ultimo ingreso / evento", "Eventos"]],
          body: appUserRows.length ? appUserRows : [["1", "Sin usuarios cargados", "--", "--", "--", "--", "0"]],
          theme: "grid",
          styles: { fontSize: 8.1, cellPadding: 2.2, overflow: "linebreak" },
          headStyles: { fillColor: [21, 118, 209], textColor: [255, 255, 255], fontStyle: "bold" },
          alternateRowStyles: { fillColor: [248, 251, 255] },
          margin: { left: 14, right: 14 },
          columnStyles: {
            0: { cellWidth: 9, halign: "center" },
            1: { cellWidth: 52 },
            2: { cellWidth: 33 },
            3: { cellWidth: 52 },
            4: { cellWidth: 26 },
            5: { cellWidth: 56 },
            6: { cellWidth: 18, halign: "center" }
          }
        });
      }

      if (addPage()) {
        document.setFont("helvetica", "bold");
        document.setFontSize(14);
        document.setTextColor(18, 59, 93);
        document.text("Evidencia de jornadas de trabajo", 14, 16);
        document.setFont("helvetica", "normal");
        document.setFontSize(8.5);
        document.setTextColor(71, 95, 118);
        document.text("Resumen legible de las jornadas seleccionadas: trabajo levantado, personal, zonas, claves y referencias.", 14, 22);
        autoTable(document, {
          startY: 31,
          head: [["#", "Jornada", "Puntos / horas", "Zonas / equipo", "Tipos de trabajo", "Evidencia"]],
          body: journeyEvidenceRows.length
            ? journeyEvidenceRows
            : [["1", "Sin jornadas", "0 puntos", "--", "--", "--"]],
          theme: "grid",
          styles: { fontSize: 7.8, cellPadding: 2.4, overflow: "linebreak", valign: "top" },
          headStyles: { fillColor: [21, 118, 209], textColor: [255, 255, 255], fontStyle: "bold" },
          alternateRowStyles: { fillColor: [248, 251, 255] },
          margin: { left: 14, right: 14 },
          columnStyles: {
            0: { cellWidth: 9, halign: "center" },
            1: { cellWidth: 30 },
            2: { cellWidth: 28 },
            3: { cellWidth: 50 },
            4: { cellWidth: 58 },
            5: { cellWidth: 71 }
          }
        });
      }

      if (addPage()) {
        document.setFont("helvetica", "bold");
        document.setFontSize(14);
        document.setTextColor(18, 59, 93);
        document.text("Listado parcial de puntos de mapa", 14, 16);
        document.setFont("helvetica", "normal");
        document.setFontSize(8.5);
        document.setTextColor(71, 95, 118);
        document.text("Muestra limitada para evidencia documental; el sistema conserva el historial completo en base de datos.", 14, 22);
        autoTable(document, {
          startY: 30,
          head: [["#", "Clave", "Jornada", "Barrio / zona", "Tipo", "Coordenada", "Referencia / evidencia", "Actualizado"]],
          body: partialUserRows.length ? partialUserRows : [["1", "--", "--", "Sin puntos", "--", "--", "--", "--"]],
          theme: "grid",
          styles: { fontSize: 7.1, cellPadding: 1.8, overflow: "linebreak" },
          headStyles: { fillColor: [21, 118, 209], textColor: [255, 255, 255], fontStyle: "bold" },
          alternateRowStyles: { fillColor: [248, 251, 255] },
          margin: { left: 14, right: 14 },
          columnStyles: {
            0: { cellWidth: 9, halign: "center" },
            1: { cellWidth: 24 },
            2: { cellWidth: 26 },
            3: { cellWidth: 43 },
            4: { cellWidth: 26 },
            5: { cellWidth: 38 },
            6: { cellWidth: 64 },
            7: { cellWidth: 26 }
          }
        });
      }

      if (addPage()) {
        document.setFont("helvetica", "bold");
        document.setFontSize(14);
        document.setTextColor(18, 59, 93);
        document.text("Mapa principal adjunto y constancia", 14, 16);
        document.setFont("helvetica", "normal");
        document.setFontSize(8.5);
        document.setTextColor(71, 95, 118);
        document.text("Evidencia visual separada del resumen operativo para evitar mezclar actividades.", 14, 22);
        document.setFillColor(237, 245, 252);
        document.roundedRect(14, 28, 246, 92, 3, 3, "F");
        if (mapImageDataUrl) {
          const mapImageType = mapImageDataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
          document.addImage(mapImageDataUrl, mapImageType, 18, 32, 238, 84);
        } else {
          document.setFont("helvetica", "bold");
          document.setFontSize(11);
          document.setTextColor(81, 106, 128);
          document.text("Adjunta una captura o deja visible el mapa para incluir evidencia grafica.", pageWidth / 2, 75, { align: "center" });
        }
        autoTable(document, {
          startY: 128,
          head: [["Elemento", "Detalle"]],
          body: [
            ["Alcance", "Reporte maximo de 5 paginas con evidencia visual, jornadas seleccionadas y muestra parcial del sistema."],
            ["Base del reporte", `${selectedDateKeys.length} jornadas con ${evidencePoints.length} puntos y ${evidenceZoneMap.size} barrios / zonas.`],
            ["Horas empleadas", `${formatWorkDuration(totalEstimatedMinutes)} estimadas a partir de la bitacora de puntos GPS.`],
            ["Usuarios del sistema", `${safeUsers.length || appUserRows.length} usuarios registrados y ${auditActors.size} con eventos recientes.`],
            ["Actualizacion reciente", latestPoint ? `Ultimo punto actualizado: ${formatDateTime(latestPoint.updated_at || latestPoint.created_at)}` : "Sin actualizacion registrada en la jornada."],
            ["Responsables", `Tecnicos: ${getMapReportTechniciansLabel(mapReportStaff)}. Datos: ${mapReportStaff.data_engineer || "--"}.`],
            ["Observaciones", mapReportSettings.report_notes.trim() || "Sin observaciones adicionales."]
          ],
          theme: "grid",
          styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak" },
          headStyles: { fillColor: [21, 118, 209], textColor: [255, 255, 255], fontStyle: "bold" },
          margin: { left: 14, right: 14 },
          columnStyles: {
            0: { cellWidth: 48, fontStyle: "bold" },
            1: { cellWidth: 200 }
          }
        });
        const signY = Math.min((document.lastAutoTable?.finalY ?? 85) + 20, pageHeight - 42);
        document.setDrawColor(120, 151, 178);
        document.line(154, signY, 244, signY);
        document.setFont("helvetica", "normal");
        document.setFontSize(9);
        document.setTextColor(71, 95, 118);
        document.text("Firma y sello", 199, signY + 7, { align: "center" });
      }

      while (document.getNumberOfPages() > maxPages) {
        document.deletePage(document.getNumberOfPages());
      }

      saveReportPdf(document, `resumen-trabajo-realizado-${selectedDateKeys[0] || generatedAtIso.slice(0, 10)}.pdf`);
      showAlert("Resumen de trabajo realizado descargado.");
    } catch (error) {
      showAlert(error.message || "No fue posible generar el PDF para ente regulador.");
    } finally {
      setGeneratingRegulatorReport(false);
    }
  };

  return { handleDownloadRegulatorEvidencePdf };
}
