import { printDocument } from "../../utils/printDocument";

export function createAuditLoaders({
  apiFetch,
  auditFiltersQuery,
  clearSession,
  isAdmin,
  isAuthenticated,
  selectedAuditReport,
  setAuditLogs,
  setLoadingAuditReportId,
  setLoadingLogs,
  setSelectedAuditReport,
  showAlert
}) {
  const loadAuditLogs = async ({ silent = false } = {}) => {
    if (!isAuthenticated || !isAdmin) return;
    if (!silent) {
      setLoadingLogs(true);
    }

    try {
      const params = new URLSearchParams({ limit: "120" });
      Object.entries(auditFiltersQuery).forEach(([key, value]) => {
        if (String(value ?? "").trim()) {
          params.set(key, String(value).trim());
        }
      });

      const response = await apiFetch(`/users/audit-logs?${params.toString()}`, { revalidate: true });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible cargar el historial.");
      }

      setAuditLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      setAuditLogs([]);
      if (!silent) {
        showAlert(error.message || "No fue posible cargar el historial.");
      }
    } finally {
      if (!silent) {
        setLoadingLogs(false);
      }
    }
  };

  const handleOpenAuditReport = async (log) => {
    const reportId = String(log?.entity_id || "").trim();
    if (!reportId) return;
    setLoadingAuditReportId(reportId);
    try {
      const response = await apiFetch(`/users/audit-logs/reports/${encodeURIComponent(reportId)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "No fue posible abrir el reporte archivado.");
      }
      setSelectedAuditReport(data);
    } catch (error) {
      showAlert(error.message || "No fue posible abrir el reporte archivado.");
    } finally {
      setLoadingAuditReportId("");
    }
  };

  const handleReprintAuditReport = async () => {
    if (!selectedAuditReport?.body_markup) return;
    await printDocument(selectedAuditReport.title, selectedAuditReport.body_markup, {
      reportId: selectedAuditReport.report_id,
      pageSize: selectedAuditReport.page_size || "Letter portrait",
      pageMargin: selectedAuditReport.page_margin || "10mm",
      bodyClassName: selectedAuditReport.body_class_name || "",
      skipAudit: true,
      reportType: selectedAuditReport.report_type || "print-report"
    });
  };

  return { loadAuditLogs, handleOpenAuditReport, handleReprintAuditReport };
}
