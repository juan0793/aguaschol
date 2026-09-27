import { EMPTY_AUDIT_FILTERS } from "../../utils/audit";

export function createAuditActions({ apiFetch, auditFilters, setAuditFilters, setAuditFiltersOpen, showAlert }) {
  const handleAuditFilterChange = (event) => {
    const { name, value } = event.target;
    setAuditFilters((current) => ({ ...current, [name]: value }));
  };

  const handleAuditFilterClear = (key) => {
    setAuditFilters((current) => ({ ...current, [key]: "" }));
  };

  const handleAuditFiltersReset = () => {
    setAuditFilters(EMPTY_AUDIT_FILTERS);
  };

  const handleAuditReportArchiveShortcut = () => {
    setAuditFilters((current) => ({ ...current, action: "report.generated", entity_type: "report" }));
    setAuditFiltersOpen(true);
  };

  const handleExportAuditLogs = async () => {
    try {
      const params = new URLSearchParams({ limit: "500" });
      Object.entries(auditFilters).forEach(([key, value]) => {
        if (String(value ?? "").trim()) {
          params.set(key, String(value).trim());
        }
      });

      const response = await apiFetch(`/users/audit-logs/export?${params.toString()}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "No se pudo exportar la bitacora.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "bitacora-auditoria.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showAlert(error.message || "No se pudo exportar la bitacora.");
    }
  };

  return {
    handleAuditFilterChange,
    handleAuditFilterClear,
    handleAuditFiltersReset,
    handleAuditReportArchiveShortcut,
    handleExportAuditLogs
  };
}
