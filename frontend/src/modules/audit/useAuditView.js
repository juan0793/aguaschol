import { useMemo } from "react";
import { AUDIT_ACTION_OPTIONS, AUDIT_ENTITY_OPTIONS, AUDIT_FILTER_KEYS, groupAuditLogsByDay } from "../../utils/audit";

export function useAuditView({ auditFilters, auditFiltersQuery, loadingLogs, safeAuditLogs }) {
  const auditDayGroups = useMemo(() => groupAuditLogsByDay(safeAuditLogs), [safeAuditLogs]);
  const auditFilterChips = useMemo(() => {
    const labelFor = (options, value) => options.find((option) => option.value === value)?.label || value;
    const chips = [];
    if (auditFilters.search) chips.push({ key: "search", label: "Búsqueda", value: auditFilters.search });
    if (auditFilters.action) chips.push({ key: "action", label: "Acción", value: labelFor(AUDIT_ACTION_OPTIONS, auditFilters.action) });
    if (auditFilters.entity_type) chips.push({ key: "entity_type", label: "Entidad", value: labelFor(AUDIT_ENTITY_OPTIONS, auditFilters.entity_type) });
    if (auditFilters.actor) chips.push({ key: "actor", label: "Actor", value: auditFilters.actor });
    if (auditFilters.date_from) chips.push({ key: "date_from", label: "Desde", value: auditFilters.date_from });
    if (auditFilters.date_to) chips.push({ key: "date_to", label: "Hasta", value: auditFilters.date_to });
    return chips;
  }, [auditFilters]);
  const auditRangeLabel = auditFilters.date_from || auditFilters.date_to
    ? `${auditFilters.date_from || "inicio"} → ${auditFilters.date_to || "hoy"}`
    : "Historial completo";
  const auditSyncing = loadingLogs
    || AUDIT_FILTER_KEYS.some((key) => auditFilters[key] !== auditFiltersQuery[key]);

  return { auditDayGroups, auditFilterChips, auditRangeLabel, auditSyncing };
}
