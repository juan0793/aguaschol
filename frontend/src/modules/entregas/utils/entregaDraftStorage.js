const draftStorageKey = (userId, draftId) =>
  userId && draftId ? `aguas.entregas.draft.v1.${userId}.${draftId}` : null;

export const falloEntregaAmbiguo = (error) =>
  !error?.avisado && (!error?.status || error.status >= 500);

export const readEntregaDraft = (userId, draftId, storage) => {
  try {
    const key = draftStorageKey(userId, draftId);
    if (!key) return null;
    const value = JSON.parse((storage || globalThis.sessionStorage).getItem(key) || "null");
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
};

export const saveEntregaDraft = (userId, draftId, value, storage) => {
  try {
    const key = draftStorageKey(userId, draftId);
    if (!key) return false;
    (storage || globalThis.sessionStorage).setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

export const clearEntregaDraft = (userId, draftId, storage) => {
  try {
    const key = draftStorageKey(userId, draftId);
    if (!key) return;
    (storage || globalThis.sessionStorage).removeItem(key);
  } catch {
    // El almacenamiento puede estar bloqueado.
  }
};

export const cierreTieneCambiosPendientes = ({ sobrantes, observacion, observacionInicial, nuevas, pegado }) =>
  sobrantes !== "" || observacion !== observacionInicial || nuevas.length > 0 || Boolean(pegado.trim());
