import { useEffect } from "react";
import {
  DRAFT_SAVED_AT_STORAGE_KEY,
  DRAFT_STORAGE_KEY,
  NOTIFICATION_REQUEST_STORAGE_KEY,
  RECORD_ALERT_NOTIFICATION_STORAGE_KEY
} from "../../constants/storageKeys";
import { emptyForm } from "../../constants/formsAndUi";
import { getBarrioNameFromClave } from "../../utils/barrioCodes";
import { hasDraftContent } from "../../utils/records";

export function useRecordEffects({
  alertRecords,
  form,
  getRecordBarrioName,
  isAdmin,
  isAuthenticated,
  loadBarrioCodes,
  loadRecords,
  localSelectedPhotoUrl,
  notifiedRecordAlerts,
  recordDeadlineMetaById,
  recordFilters,
  recordPagination,
  recordQuickFilter,
  recordView,
  safeBarrioCodes,
  search,
  setDashboardNow,
  setDraftForm,
  setForm,
  setNotifiedRecordAlerts,
  setRecordPage,
  setRecordView,
  workspaceView
}) {
  useEffect(() => {
    setRecordPage(1);
  }, [search, recordView, recordQuickFilter, recordFilters]);

  useEffect(() => {
    setRecordPage((current) => Math.min(current, recordPagination.totalPages));
  }, [recordPagination.totalPages]);

  useEffect(() => {
    return () => {
      if (localSelectedPhotoUrl) {
        URL.revokeObjectURL(localSelectedPhotoUrl);
      }
    };
  }, [localSelectedPhotoUrl]);

  useEffect(() => {
    if (workspaceView === "records") return undefined;
    const timer = window.setInterval(() => {
      setDashboardNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [workspaceView]);

  useEffect(() => {
    if (isAuthenticated && workspaceView === "records") {
      loadRecords(search, recordView);
      loadBarrioCodes({ silent: true });
    }
  }, [isAuthenticated, recordView, workspaceView]);

  useEffect(() => {
    if (!String(form.clave_catastral || "").trim() || String(form.barrio_colonia || "").trim()) {
      return;
    }

    const barrio = getBarrioNameFromClave(form.clave_catastral, safeBarrioCodes);
    if (barrio) {
      setForm((current) => (
        String(current.barrio_colonia || "").trim()
          ? current
          : { ...current, barrio_colonia: barrio }
      ));
    }
  }, [form.clave_catastral, form.barrio_colonia, safeBarrioCodes]);

  useEffect(() => {
    if (!isAuthenticated || !alertRecords.length || !["records", "dashboard"].includes(workspaceView)) {
      return;
    }

    if (!("Notification" in window)) {
      return;
    }

    const shouldRequestPermission =
      Notification.permission === "default" &&
      !window.localStorage.getItem(NOTIFICATION_REQUEST_STORAGE_KEY);

    if (shouldRequestPermission) {
      window.localStorage.setItem(NOTIFICATION_REQUEST_STORAGE_KEY, "1");
      Notification.requestPermission().catch(() => {});
      return;
    }

    if (Notification.permission !== "granted") {
      return;
    }

    const nextNotified = { ...notifiedRecordAlerts };
    let changed = false;

    alertRecords.slice(0, 4).forEach((record) => {
      const meta = recordDeadlineMetaById[record.id];
      if (!meta) return;

      const key = `${record.id}:${meta.statusKey}`;
      if (nextNotified[key]) return;

      try {
        new Notification(`Ficha ${meta.label.toLowerCase()}`, {
          body: `${record.clave_catastral} · ${getRecordBarrioName(record, "Sin ubicacion")} · ${meta.helper}`,
          tag: `record-alert-${record.id}-${meta.statusKey}`
        });
      } catch {
        return;
      }

      nextNotified[key] = new Date().toISOString();
      changed = true;
    });

    if (changed) {
      window.localStorage.setItem(RECORD_ALERT_NOTIFICATION_STORAGE_KEY, JSON.stringify(nextNotified));
      setNotifiedRecordAlerts(nextNotified);
    }
  }, [alertRecords, isAuthenticated, notifiedRecordAlerts, recordDeadlineMetaById, workspaceView]);

  useEffect(() => {
    if (!isAuthenticated || workspaceView !== "records") {
      return undefined;
    }

    const refreshRecords = () => {
      if (document.visibilityState === "visible") {
        loadRecords(search, recordView, { silent: true });
      }
    };

    const handleWindowFocus = () => refreshRecords();
    const intervalId = window.setInterval(refreshRecords, 8000);
    document.addEventListener("visibilitychange", refreshRecords);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshRecords);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [isAuthenticated, recordView, search, workspaceView]);

  useEffect(() => {
    if (!isAdmin && recordView === "archived") {
      setRecordView("active");
    }
  }, [isAdmin, recordView]);

  useEffect(() => {
    if (form.id || !hasDraftContent(form)) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const nextDraft = { ...emptyForm, ...form, id: null };
      const savedAt = new Date().toISOString();
      setDraftForm(nextDraft);
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(nextDraft));
      window.localStorage.setItem(DRAFT_SAVED_AT_STORAGE_KEY, savedAt);
    }, 420);

    return () => window.clearTimeout(timer);
  }, [form]);
}
