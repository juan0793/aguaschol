import { EXECUTIVE_REPORT_CREDIT } from "../../constants/workspace";
import { formatPercent } from "../../utils/timeFormat";
import { formatSpanishDate } from "../../utils/datesAndBusiness";
import { saveReportPdf } from "../../utils/printDocument";

export function createExecutiveReportPdf({
  alertRecords,
  executiveReportData,
  mapDiaryGroups,
  safeAuditLogs,
  safeMapPoints,
  safeRecords,
  safeUsers,
  showAlert
}) {
  const handleDownloadExecutiveReportPdf = async () => {
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableModule.default;
      const document = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "letter"
      });
      const pageWidth = document.internal.pageSize.getWidth();
      const pageHeight = document.internal.pageSize.getHeight();
      const marginX = 14;
      let y = 16;
      const addFooter = () => {
        const pageCount = document.internal.getNumberOfPages();
        for (let page = 1; page <= pageCount; page += 1) {
          document.setPage(page);
          document.setFontSize(8);
          document.setTextColor(96, 116, 134);
          document.text("Aguas de Choluteca - Resumen de Operaciones realizadas", marginX, pageHeight - 8);
          document.text(`Página ${page} de ${pageCount}`, pageWidth - marginX, pageHeight - 8, { align: "right" });
        }
      };
      const ensureSpace = (needed = 24) => {
        if (y + needed > pageHeight - 18) {
          document.addPage();
          y = 16;
        }
      };
      const sectionTitle = (title) => {
        ensureSpace(14);
        document.setFont("helvetica", "bold");
        document.setFontSize(13);
        document.setTextColor(18, 59, 93);
        document.text(title, marginX, y);
        y += 7;
      };
      const addReportPage = (title, subtitle = "") => {
        document.addPage();
        y = 16;
        document.setFont("helvetica", "bold");
        document.setFontSize(15);
        document.setTextColor(18, 59, 93);
        document.text(title, marginX, y);
        y += 7;
        if (subtitle) {
          document.setFont("helvetica", "normal");
          document.setFontSize(9);
          document.setTextColor(84, 113, 139);
          document.text(document.splitTextToSize(subtitle, pageWidth - marginX * 2), marginX, y);
          y += 12;
        }
      };
      const drawBarChart = (title, rows, options = {}) => {
        const chartRows = rows.slice(0, options.limit ?? 10);
        const chartHeight = options.height ?? 72;
        const chartWidth = pageWidth - marginX * 2;
        const labelWidth = options.labelWidth ?? 54;
        const barWidth = chartWidth - labelWidth - 20;
        const rowHeight = chartHeight / Math.max(chartRows.length, 1);
        const maxValue = Math.max(...chartRows.map((item) => Number(item.total || item.value || 0)), 1);

        ensureSpace(chartHeight + 18);
        document.setFont("helvetica", "bold");
        document.setFontSize(11);
        document.setTextColor(18, 59, 93);
        document.text(title, marginX, y);
        y += 7;

        chartRows.forEach((item, index) => {
          const rawValue = Number(item.total || item.value || 0);
          const barLength = Math.max(2, (rawValue / maxValue) * barWidth);
          const rowY = y + index * rowHeight;
          document.setFont("helvetica", "normal");
          document.setFontSize(7.2);
          document.setTextColor(64, 92, 118);
          document.text(String(item.label || item.name || "--").slice(0, 28), marginX, rowY + 4);
          document.setFillColor(...(options.color || [21, 118, 209]));
          document.roundedRect(marginX + labelWidth, rowY, barLength, Math.max(3, rowHeight - 2), 1.4, 1.4, "F");
          document.setFont("helvetica", "bold");
          document.setTextColor(18, 59, 93);
          document.text(String(rawValue), marginX + labelWidth + barLength + 3, rowY + 4);
        });

        y += chartHeight + 8;
      };

      document.setFillColor(237, 246, 255);
      document.rect(0, 0, pageWidth, 42, "F");
      document.setFont("helvetica", "bold");
      document.setFontSize(22);
      document.setTextColor(18, 59, 93);
      document.text("Resumen de Operaciones realizadas", marginX, 18);
      document.setFontSize(11);
      document.setFont("helvetica", "normal");
      document.setTextColor(64, 92, 118);
      document.text("Aplicación de inmuebles clandestinos, geolocalización, mapeo, reportes y trazabilidad", marginX, 26);
      const creditLines = document.splitTextToSize(EXECUTIVE_REPORT_CREDIT, pageWidth - marginX * 2);
      document.text(creditLines, marginX, 34);
      document.text(`Generado: ${formatSpanishDate(executiveReportData.generatedAt)}`, marginX, 34 + creditLines.length * 5);
      y = 52 + Math.max(0, creditLines.length - 1) * 5;

      autoTable(document, {
        startY: y,
        head: [["Periodo", "Primera actividad", "Última actividad", "Acreditación del trabajo"]],
        body: [[
          "Desde el primer día registrado",
          executiveReportData.firstDate ? formatSpanishDate(executiveReportData.firstDate) : "Sin registros",
          executiveReportData.lastDate ? formatSpanishDate(executiveReportData.lastDate) : "Sin registros",
          EXECUTIVE_REPORT_CREDIT
        ]],
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 3, textColor: [23, 52, 78] },
        headStyles: { fillColor: [21, 118, 209], textColor: [255, 255, 255] }
      });
      y = (document.lastAutoTable?.finalY ?? y) + 9;

      sectionTitle("Indicadores principales");
      autoTable(document, {
        startY: y,
        head: [["Indicador", "Total", "Lectura ejecutiva"]],
        body: [
          ["Fichas activas", safeRecords.length, "Registros operativos visibles en el módulo de fichas."],
          ["Clandestinas", executiveReportData.statusTotals.clandestino || 0, "Pendientes de cierre o procesamiento."],
          ["Reportadas", executiveReportData.statusTotals.reportada || 0, "Procesadas y retiradas del flujo activo."],
          ["Varios padrones", executiveReportData.statusTotals.varios_padrones || 0, "Coincidencias entre Alcaldía y Aguas."],
          ["Puntos geolocalizados", safeMapPoints.length, "Levantamientos GPS y puntos técnicos de campo."],
          ["Jornadas de campo", mapDiaryGroups.length, "Días con bitácora de mapeo."],
          ["Eventos auditados", safeAuditLogs.length, "Historial de accesos, cambios y operaciones."],
          ["Usuarios", safeUsers.length, "Cuentas registradas para operación y administración."]
        ],
        theme: "striped",
        styles: { fontSize: 8.5, cellPadding: 2.6, textColor: [23, 52, 78] },
        headStyles: { fillColor: [18, 59, 93], textColor: [255, 255, 255] },
        columnStyles: { 1: { halign: "center", cellWidth: 24 } }
      });
      y = (document.lastAutoTable?.finalY ?? y) + 9;

      sectionTitle("Trabajo realizado por módulo");
      autoTable(document, {
        startY: y,
        head: [["Módulo", "Alcance construido", "Evidencia actual"]],
        body: executiveReportData.modules.map((item) => [item.title, item.detail, item.evidence]),
        theme: "grid",
        styles: { fontSize: 8.2, cellPadding: 2.5, textColor: [23, 52, 78], valign: "top" },
        headStyles: { fillColor: [21, 118, 209], textColor: [255, 255, 255] },
        columnStyles: { 0: { cellWidth: 38 }, 1: { cellWidth: 82 }, 2: { cellWidth: 62 } }
      });
      y = (document.lastAutoTable?.finalY ?? y) + 9;

      sectionTitle("Funciones desarrolladas en la aplicación");
      autoTable(document, {
        startY: y,
        head: [["Función", "Descripción operativa"]],
        body: executiveReportData.applicationFunctions,
        theme: "grid",
        styles: { fontSize: 8.1, cellPadding: 2.4, textColor: [23, 52, 78], valign: "top" },
        headStyles: { fillColor: [13, 77, 134], textColor: [255, 255, 255] },
        columnStyles: { 0: { cellWidth: 44 }, 1: { cellWidth: 138 } }
      });
      y = (document.lastAutoTable?.finalY ?? y) + 9;

      sectionTitle("Ahorro estimado de tiempo para técnicos");
      autoTable(document, {
        startY: y,
        head: [["Proceso", "Antes", "Con la aplicación", "Beneficio"]],
        body: executiveReportData.timeSavingsRows,
        theme: "striped",
        styles: { fontSize: 7.4, cellPadding: 2.1, textColor: [23, 52, 78], valign: "top" },
        headStyles: { fillColor: [17, 116, 95], textColor: [255, 255, 255] },
        columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 36 }, 2: { cellWidth: 39 }, 3: { cellWidth: 67 } }
      });
      y = (document.lastAutoTable?.finalY ?? y) + 9;

      sectionTitle("Trabajo realizado en campo");
      autoTable(document, {
        startY: y,
        head: [["Jornada", "Puntos GPS", "Zonas", "Fichas trabajadas", "Con foto"]],
        body: executiveReportData.fieldJourneyRows.length
          ? executiveReportData.fieldJourneyRows.map((item) => [item.label, item.points, item.zones, item.records, item.photos])
          : [["Sin jornadas registradas", 0, 0, 0, 0]],
        theme: "striped",
        styles: { fontSize: 8.4, cellPadding: 2.4, textColor: [23, 52, 78] },
        headStyles: { fillColor: [17, 116, 95], textColor: [255, 255, 255] }
      });
      y = (document.lastAutoTable?.finalY ?? y) + 8;

      autoTable(document, {
        startY: y,
        head: [["Responsable / técnico", "Fichas", "Con foto", "En alerta"]],
        body: executiveReportData.fieldResponsibleRows.length
          ? executiveReportData.fieldResponsibleRows.map((item) => [item.name, item.records, item.withPhoto, item.alert])
          : [["Sin responsable asignado", 0, 0, 0]],
        theme: "grid",
        styles: { fontSize: 8.4, cellPadding: 2.4, textColor: [23, 52, 78] },
        headStyles: { fillColor: [13, 77, 134], textColor: [255, 255, 255] }
      });
      y = (document.lastAutoTable?.finalY ?? y) + 9;

      sectionTitle("Detalle de fichas");
      autoTable(document, {
        startY: y,
        head: [["Concepto", "Cantidad", "Porcentaje"]],
        body: [
          ["Con fotografía", executiveReportData.photoCount, formatPercent(executiveReportData.photoCount, safeRecords.length)],
          ["Sin fotografía", executiveReportData.pendingPhotoCount, formatPercent(executiveReportData.pendingPhotoCount, safeRecords.length)],
          ["Listas para aviso", executiveReportData.printedReadyRecords, formatPercent(executiveReportData.printedReadyRecords, safeRecords.length)],
          ["Con plazo crítico", alertRecords.length, formatPercent(alertRecords.length, safeRecords.length)],
          ["Archivadas según bitácora", executiveReportData.archivedEvents, "Evento histórico"]
        ],
        theme: "striped",
        styles: { fontSize: 8.6, cellPadding: 2.5, textColor: [23, 52, 78] },
        headStyles: { fillColor: [22, 112, 75], textColor: [255, 255, 255] }
      });
      y = (document.lastAutoTable?.finalY ?? y) + 9;

      sectionTitle("Geolocalización y mapeo");
      autoTable(document, {
        startY: y,
        head: [["Tipo de punto", "Total"]],
        body: executiveReportData.mapTypeRows.length
          ? executiveReportData.mapTypeRows.map((item) => [item.label, item.total])
          : [["Sin puntos registrados", 0]],
        theme: "grid",
        styles: { fontSize: 8.6, cellPadding: 2.5, textColor: [23, 52, 78] },
        headStyles: { fillColor: [17, 116, 95], textColor: [255, 255, 255] }
      });
      y = (document.lastAutoTable?.finalY ?? y) + 8;

      autoTable(document, {
        startY: y,
        head: [["Zonas principales", "Puntos"]],
        body: executiveReportData.mapZoneRows.length
          ? executiveReportData.mapZoneRows.map((item) => [item.label, item.total])
          : [["Sin zonas registradas", 0]],
        theme: "striped",
        styles: { fontSize: 8.4, cellPadding: 2.4, textColor: [23, 52, 78] },
        headStyles: { fillColor: [13, 77, 134], textColor: [255, 255, 255] }
      });
      y = (document.lastAutoTable?.finalY ?? y) + 9;

      sectionTitle("Trazabilidad y control");
      autoTable(document, {
        startY: y,
        head: [["Evento", "Total"]],
        body: executiveReportData.auditRows.length
          ? executiveReportData.auditRows.map((item) => [item.label, item.total])
          : [["Sin eventos registrados", 0]],
        theme: "grid",
        styles: { fontSize: 8.4, cellPadding: 2.4, textColor: [23, 52, 78] },
        headStyles: { fillColor: [95, 63, 177], textColor: [255, 255, 255] }
      });

      addReportPage(
        "Análisis estadístico de fichas por barrio",
        "Distribución territorial de las fichas registradas, con lectura por estado operativo, evidencia fotográfica y alertas."
      );
      drawBarChart("Barrios con mayor cantidad de fichas", executiveReportData.recordZoneRows, {
        limit: 12,
        height: 88,
        color: [18, 59, 93],
        labelWidth: 64
      });
      autoTable(document, {
        startY: y,
        head: [["Barrio / colonia", "Total", "Clandestinas", "Reportadas", "Varios padrones", "Con foto", "Alertas"]],
        body: executiveReportData.recordZoneRows.length
          ? executiveReportData.recordZoneRows.slice(0, 18).map((item) => [
              item.label,
              item.total,
              item.clandestino || 0,
              item.reportada || 0,
              item.varios_padrones || 0,
              item.withPhoto,
              item.alert
            ])
          : [["Sin barrios registrados", 0, 0, 0, 0, 0, 0]],
        theme: "striped",
        styles: { fontSize: 7.3, cellPadding: 2.1, textColor: [23, 52, 78] },
        headStyles: { fillColor: [18, 59, 93], textColor: [255, 255, 255] }
      });

      addReportPage(
        "Análisis GPS distribuido por zona",
        "Resumen de puntos levantados en campo, tipos de punto, precisión promedio disponible y primera/última jornada detectada por zona."
      );
      drawBarChart("Zonas con mayor levantamiento GPS", executiveReportData.gpsZoneDetailRows, {
        limit: 12,
        height: 84,
        color: [17, 116, 95],
        labelWidth: 64
      });
      autoTable(document, {
        startY: y,
        head: [["Zona", "Puntos", "Tipos registrados", "Precisión prom.", "Primera jornada", "Última jornada"]],
        body: executiveReportData.gpsZoneDetailRows.length
          ? executiveReportData.gpsZoneDetailRows.slice(0, 14).map((item) => [
              item.label,
              item.total,
              item.typeLabel || "--",
              item.averageAccuracy === null ? "--" : `${item.averageAccuracy} m`,
              item.firstDate ? formatSpanishDate(item.firstDate) : "--",
              item.lastDate ? formatSpanishDate(item.lastDate) : "--"
            ])
          : [["Sin zonas GPS registradas", 0, "--", "--", "--", "--"]],
        theme: "grid",
        styles: { fontSize: 7.1, cellPadding: 2, textColor: [23, 52, 78], valign: "top" },
        headStyles: { fillColor: [17, 116, 95], textColor: [255, 255, 255] },
        columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 17 }, 2: { cellWidth: 55 } }
      });

      addReportPage(
        "Gráficos estadísticos generales",
        "Lectura visual de estados de fichas, evidencia fotográfica, puntos GPS por tipo y actividad acumulada."
      );
      drawBarChart("Estados de fichas", executiveReportData.statusRows, {
        limit: 6,
        height: 44,
        color: [21, 118, 209],
        labelWidth: 58
      });
      drawBarChart("Puntos GPS por tipo", executiveReportData.mapTypeRows, {
        limit: 8,
        height: 58,
        color: [17, 116, 95],
        labelWidth: 64
      });
      drawBarChart(
        "Evidencia fotográfica",
        [
          { label: "Con fotografía", total: executiveReportData.photoCount },
          { label: "Sin fotografía", total: executiveReportData.pendingPhotoCount }
        ],
        {
          limit: 2,
          height: 28,
          color: [13, 77, 134],
          labelWidth: 58
        }
      );

      addReportPage(
        "Evolución mensual de trabajo",
        "Comparativo acumulado por mes entre fichas registradas o actualizadas y puntos geolocalizados en campo."
      );
      autoTable(document, {
        startY: y,
        head: [["Mes", "Fichas", "Puntos GPS", "Lectura"]],
        body: executiveReportData.monthlyRows.length
          ? executiveReportData.monthlyRows.map((item) => [
              item.label,
              item.records,
              item.points,
              item.records || item.points ? "Mes con movimiento operativo registrado." : "Sin movimiento."
            ])
          : [["Sin meses registrados", 0, 0, "Sin información acumulada."]],
        theme: "striped",
        styles: { fontSize: 8, cellPadding: 2.4, textColor: [23, 52, 78] },
        headStyles: { fillColor: [21, 118, 209], textColor: [255, 255, 255] }
      });
      y = (document.lastAutoTable?.finalY ?? y) + 8;
      drawBarChart(
        "Fichas por mes",
        executiveReportData.monthlyRows.map((item) => ({ label: item.label, total: item.records })),
        { limit: 12, height: 64, color: [18, 59, 93], labelWidth: 58 }
      );
      drawBarChart(
        "Puntos GPS por mes",
        executiveReportData.monthlyRows.map((item) => ({ label: item.label, total: item.points })),
        { limit: 12, height: 64, color: [17, 116, 95], labelWidth: 58 }
      );

      addReportPage(
        "Resumen de operaciones, avance y defensa del trabajo",
        "Síntesis para presentar el valor operativo del sistema y del levantamiento realizado."
      );
      autoTable(document, {
        startY: y,
        head: [["Eje", "Resultado defendible"]],
        body: [
          ["Campo", `${safeMapPoints.length} puntos GPS distribuidos por zona, con ${mapDiaryGroups.length} jornadas registradas y lectura por tipo de punto.`],
          ["Fichas", `${safeRecords.length} fichas administradas, ${executiveReportData.photoCount} con fotografía y ${executiveReportData.printedReadyRecords} con datos base para aviso.`],
          ["Barrios", `${executiveReportData.recordZoneRows.length} barrios o colonias aparecen en el consolidado operativo.`],
          ["Reportes", "Se cuenta con impresión de fichas, avisos, lote de impresiones, reportes de campo, reportes de padrón y resumen de operaciones PDF."],
          ["Ahorro técnico", "La aplicación reduce búsqueda, validación, redacción, impresión y consolidación de reportes que antes se hacían manualmente."],
          ["Control", `${safeAuditLogs.length} eventos en bitácora respaldan trazabilidad de cambios, usuarios y operaciones.`],
          ["Acreditación", EXECUTIVE_REPORT_CREDIT]
        ],
        theme: "grid",
        styles: { fontSize: 8.3, cellPadding: 2.6, textColor: [23, 52, 78], valign: "top" },
        headStyles: { fillColor: [95, 63, 177], textColor: [255, 255, 255] },
        columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 148 } }
      });

      addReportPage(
        "Matriz de información generada",
        "Inventario de salidas y evidencias producidas por la aplicación para sustentar el trabajo operativo."
      );
      autoTable(document, {
        startY: y,
        head: [["Producto", "Contenido", "Uso para defensa del trabajo"]],
        body: [
          ["Ficha técnica", "Datos catastrales, servicios, fotografía, responsables, estado de padrón y datos de aviso.", "Demuestra levantamiento individual y seguimiento del inmueble."],
          ["Aviso", "Documento formal para regularización del inmueble clandestino.", "Permite evidenciar comunicación administrativa al abonado."],
          ["Mapa de campo", "Puntos GPS, precisión, tipo de punto, referencia y jornada.", "Acredita presencia y registro en sitio."],
          ["Reporte de campo", "Puntos agrupados por zona y detalles técnicos de levantamiento.", "Sirve para socializar rutas, zonas y avance por jornada."],
          ["Padrón maestro", "Búsqueda por clave, nombre o abonado y solicitudes por palabras clave.", "Soporta validación contra base administrativa."],
          ["Bitácora", "Eventos de usuarios, fichas, fotos, padrones y operaciones.", "Respalda trazabilidad y control interno."],
          ["Resumen de operaciones", "Indicadores, gráficos, barrios, zonas GPS, responsables, funciones, ahorro de tiempo y conclusiones.", "Resume el proyecto para supervisión y presentación institucional."]
        ],
        theme: "grid",
        styles: { fontSize: 8.1, cellPadding: 2.4, textColor: [23, 52, 78], valign: "top" },
        headStyles: { fillColor: [13, 77, 134], textColor: [255, 255, 255] },
        columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: 72 }, 2: { cellWidth: 74 } }
      });

      addReportPage(
        "Conclusiones ejecutivas",
        "Cierre del informe con la lectura administrativa del trabajo de campo y del sistema implementado."
      );
      autoTable(document, {
        startY: y,
        head: [["Conclusión", "Detalle"]],
        body: [
          ["Digitalización del proceso", "El flujo manual de fichas, avisos, búsqueda, fotografía e impresión queda centralizado en una aplicación web con actualización sin recargar."],
          ["Evidencia territorial", "El módulo GPS permite demostrar zonas cubiertas, puntos técnicos levantados y jornadas de campo registradas."],
          ["Control institucional", "La integración de padrones, reportes PDF y bitácora permite sustentar decisiones con datos y trazabilidad."],
          ["Operación defendible", "El informe consolida fichas por barrio, puntos por zona, responsables, estados, fotografías, eventos y resultados acumulados."],
          ["Siguiente etapa", "El sistema queda preparado para ampliar filtros, exportaciones, autenticación más granular, mejoras de rendimiento y analítica histórica adicional."]
        ],
        theme: "striped",
        styles: { fontSize: 8.5, cellPadding: 2.8, textColor: [23, 52, 78], valign: "top" },
        headStyles: { fillColor: [18, 59, 93], textColor: [255, 255, 255] },
        columnStyles: { 0: { cellWidth: 44 }, 1: { cellWidth: 138 } }
      });

      addFooter();
      saveReportPdf(document, `resumen-operaciones-realizadas-${new Date().toISOString().slice(0, 10)}.pdf`);
      showAlert("Resumen de operaciones descargado en PDF.");
    } catch (error) {
      showAlert(error.message || "No fue posible descargar el resumen de operaciones.");
    }
  };

  return { handleDownloadExecutiveReportPdf };
}
