export const createInspectionAutosave = (save) => {
  let pending = {};
  let inFlight = {};
  let active = null;

  const enqueue = (patch) => {
    pending = { ...pending, ...patch };
  };

  const flush = () => {
    if (active) return active;
    active = (async () => {
      while (Object.keys(pending).length) {
        const patch = pending;
        pending = {};
        inFlight = patch;
        try {
          await save(patch, () => pending);
        } catch (error) {
          pending = { ...patch, ...pending };
          throw error;
        } finally {
          inFlight = {};
        }
      }
    })().finally(() => {
      active = null;
    });
    return active;
  };

  return { enqueue, flush, getPending: () => ({ ...inFlight, ...pending }) };
};
