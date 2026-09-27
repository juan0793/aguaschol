import { useEffect } from "react";
import { DASHBOARD_REFRESH_INTERVAL_MS } from "../constants/workspace";

export function useAdminDataEffects({
  alcaldiaComparison,
  apiFetch,
  auditFilters,
  auditFiltersQuery,
  isAdmin,
  isAuthenticated,
  loadAlcaldiaComparison,
  loadAlcaldiaMeta,
  loadAuditLogs,
  loadBarrioCodes,
  loadMapDiaryGroups,
  loadMapPoints,
  loadPadronBatches,
  loadPadronMeta,
  loadPadronRequestMeta,
  loadPadronServiceReport,
  loadRecords,
  loadUsers,
  refreshDashboard,
  setAuditFiltersQuery,
  workspaceView
}) {
  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      return;
    }

    if (workspaceView === "users") {
      loadUsers();
    }

    if (workspaceView === "padron") {
      loadPadronMeta();
      loadPadronBatches();
      loadAlcaldiaMeta();
      loadBarrioCodes({ silent: true });
    }

    if (workspaceView === "barrioCodes") {
      loadBarrioCodes();
    }

    if (["dashboard", "requests"].includes(workspaceView)) {
      loadPadronServiceReport({ silent: true });
    }

    if (workspaceView === "requests") {
      loadPadronRequestMeta();
      loadPadronMeta();
      loadAlcaldiaMeta();
      loadBarrioCodes({ silent: true });
      if (!alcaldiaComparison?.summary) {
        loadAlcaldiaComparison({ silent: true });
      }
    }

    if (workspaceView === "logs") {
      loadAuditLogs();
    }
  }, [auditFiltersQuery, isAuthenticated, isAdmin, workspaceView]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setAuditFiltersQuery(auditFilters), 320);
    return () => window.clearTimeout(timeoutId);
  }, [auditFilters]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin || !["dashboard", "requests"].includes(workspaceView)) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      loadPadronServiceReport({ silent: true });
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, [isAuthenticated, isAdmin, workspaceView]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return undefined;

    const handleReportGenerated = async (event) => {
      const detail = event.detail || {};
      if (!detail.reportId) return;

      try {
        const response = await apiFetch("/users/audit-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            report_id: detail.reportId,
            title: detail.title || detail.reportId,
            report_type: detail.reportType || "print-report",
            page_size: detail.pageSize || "Letter portrait",
            page_margin: detail.pageMargin || "10mm",
            body_class_name: detail.bodyClassName || "",
            body_markup: detail.bodyMarkup || "",
            summary: `Reporte generado: ${detail.title || detail.reportId}`,
            details: {
              title: detail.title || "Reporte",
              report_type: detail.reportType || "print-report",
              generated_at: detail.createdAt || new Date().toISOString(),
              archive_available: Boolean(detail.bodyMarkup)
            }
          })
        });

        if (response.ok && workspaceView === "logs") {
          loadAuditLogs({ silent: true });
        }
      } catch {
        // La auditoria no debe interrumpir la vista previa ni la impresion.
      }
    };

    window.addEventListener("aguaschol:report-generated", handleReportGenerated);
    return () => window.removeEventListener("aguaschol:report-generated", handleReportGenerated);
  }, [apiFetch, isAuthenticated, isAdmin, workspaceView]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      return undefined;
    }

    loadUsers({ silent: true });

    const refreshOnlineUsers = () => {
      if (document.visibilityState === "visible") {
        loadUsers({ silent: true });
      }
    };

    const intervalId = window.setInterval(refreshOnlineUsers, 20000);
    document.addEventListener("visibilitychange", refreshOnlineUsers);
    window.addEventListener("focus", refreshOnlineUsers);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshOnlineUsers);
      window.removeEventListener("focus", refreshOnlineUsers);
    };
  }, [isAuthenticated, isAdmin]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin || workspaceView !== "dashboard") {
      return undefined;
    }

    refreshDashboard();
    loadPadronMeta({ silent: true });
    loadAlcaldiaMeta({ silent: true });

    const intervalId = window.setInterval(refreshDashboard, DASHBOARD_REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshDashboard);
    window.addEventListener("focus", refreshDashboard);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshDashboard);
      window.removeEventListener("focus", refreshDashboard);
    };
  }, [isAuthenticated, isAdmin, refreshDashboard, workspaceView]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin || workspaceView !== "executiveReport") {
      return undefined;
    }

    loadRecords("", "active", { silent: true });
    loadMapDiaryGroups({ silent: true });
    loadMapPoints({ silent: true });
    return undefined;
  }, [isAuthenticated, isAdmin, workspaceView]);
}
