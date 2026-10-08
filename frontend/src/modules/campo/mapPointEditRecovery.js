const recoveryKey = (userId, pointId) => `aguaschol.campo.edicionMapa.${userId ?? "anon"}.${pointId}`;

export const saveMapPointEditDraft = (storage, userId, pointId, draft) => {
  try {
    storage.setItem(recoveryKey(userId, pointId), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
};

export const loadMapPointEditDraft = (storage, userId, pointId) => {
  try {
    const draft = JSON.parse(storage.getItem(recoveryKey(userId, pointId)) || "null");
    return draft && typeof draft === "object" && !Array.isArray(draft) ? draft : null;
  } catch {
    return null;
  }
};

export const clearMapPointEditDraft = (storage, userId, pointId) => {
  try {
    storage.removeItem(recoveryKey(userId, pointId));
  } catch {}
};
