const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export const pushEditorHistory = (history, current, next, limit = 30) => {
  if (same(current, next)) return { history, next: current };
  return {
    history: {
      past: [...history.past.slice(-(limit - 1)), current],
      future: []
    },
    next
  };
};

export const undoEditorHistory = (history, current, limit = 30) => {
  if (!history.past.length) return { history, next: current };
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future].slice(0, limit)
    },
    next: history.past[history.past.length - 1]
  };
};

export const redoEditorHistory = (history, current, limit = 30) => {
  if (!history.future.length) return { history, next: current };
  return {
    history: {
      past: [...history.past, current].slice(-limit),
      future: history.future.slice(1)
    },
    next: history.future[0]
  };
};
