import { AUTH_STORAGE_KEY } from "../constants/storageKeys.js";
export const sessionMode = (session) => JSON.stringify([session?.user?.role, session?.user?.preview?.expires_at, Boolean(session?.user?.preview?.expired)]);
export function hasStoredRolePreview() {
  try { return Boolean(JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEY))?.user?.preview); }
  catch { return false; }
}
