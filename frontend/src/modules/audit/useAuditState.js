import { useState } from "react";
import { EMPTY_AUDIT_FILTERS } from "../../utils/audit";

export function useAuditState() {
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedAuditReport, setSelectedAuditReport] = useState(null);
  const [loadingAuditReportId, setLoadingAuditReportId] = useState("");
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [auditFilters, setAuditFilters] = useState(EMPTY_AUDIT_FILTERS);
  // Los campos de texto escriben en `auditFilters` al instante (la UI responde) pero
  // la consulta al backend viaja sobre la copia retrasada: antes cada tecla disparaba
  // un fetch del historial completo.
  const [auditFiltersQuery, setAuditFiltersQuery] = useState(EMPTY_AUDIT_FILTERS);
  const [auditFiltersOpen, setAuditFiltersOpen] = useState(false);

  return {
    auditLogs,
    setAuditLogs,
    selectedAuditReport,
    setSelectedAuditReport,
    loadingAuditReportId,
    setLoadingAuditReportId,
    loadingLogs,
    setLoadingLogs,
    auditFilters,
    setAuditFilters,
    auditFiltersQuery,
    setAuditFiltersQuery,
    auditFiltersOpen,
    setAuditFiltersOpen
  };
}
