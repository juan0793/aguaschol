import { LOOKUP_HISTORY_STORAGE_KEY, RECORD_ALERT_NOTIFICATION_STORAGE_KEY } from "../constants/storageKeys.js";
import { hasStoredRolePreview } from "./rolePreview.js";

export const loadStoredLookupHistory = () => {
  if (hasStoredRolePreview()) return [];
  const saved = window.localStorage.getItem(LOOKUP_HISTORY_STORAGE_KEY);
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const loadStoredRecordNotifications = () => {
  if (hasStoredRolePreview()) return {};
  const saved = window.localStorage.getItem(RECORD_ALERT_NOTIFICATION_STORAGE_KEY);
  if (!saved) return {};

  try {
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};
