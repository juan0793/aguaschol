const PREFIX = "aguaschol-clandestinos-ficha-draft";

const keyFor = (userId, recordId) => `${PREFIX}:${userId}:${recordId || "new"}`;

export const readFichaDraft = (userId, record, storage = globalThis.localStorage) => {
  if (!userId || !storage) return null;
  try {
    const raw = storage.getItem(keyFor(userId, record?.id));
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved?.form || (record?.updated_at && saved.baseUpdatedAt !== record.updated_at)) return null;
    return saved.form;
  } catch {
    return null;
  }
};

export const saveFichaDraft = (userId, record, form, storage = globalThis.localStorage) => {
  if (!userId || !storage) return;
  try {
    storage.setItem(keyFor(userId, record?.id), JSON.stringify({ baseUpdatedAt: record?.updated_at || null, form }));
  } catch { /* sin almacenamiento local */ }
};

export const clearFichaDraft = (userId, record, storage = globalThis.localStorage) => {
  if (!userId || !storage) return;
  try { storage.removeItem(keyFor(userId, record?.id)); } catch { /* sin almacenamiento local */ }
};
