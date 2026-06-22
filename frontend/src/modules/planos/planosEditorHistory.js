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

export const nextLineDraft = (draft, point, activeLayer) => {
  if (!draft) return { draft: { points: [point], layer: activeLayer }, line: null };
  return {
    draft: { ...draft, points: [...(draft.points || []), point] },
    line: null
  };
};

export const finishLineDraft = (draft, activeLayer) => {
  const points = draft?.points || [];
  if (points.length < 2) return null;
  return {
    tipo_elemento: "linea",
    data_json: {
      capa: draft.layer || activeLayer,
      puntos: points,
      color: "#0f172a",
      grosor: 3
    }
  };
};

export const legacyTwoClickLineDraft = (draft, point, activeLayer) => {
  if (!draft) return { draft: { points: [point], layer: activeLayer }, line: null };
  return {
    draft: null,
    line: {
      tipo_elemento: "linea",
      data_json: {
        capa: draft.layer || activeLayer,
        puntos: [...(draft.points || []), point],
        color: "#0f172a",
        grosor: 3
      }
    }
  };
};

export const cloneEditorElement = (element, offset = 18) => {
  if (!element) return null;
  const data = JSON.parse(JSON.stringify(element.data_json || {}));
  if (Array.isArray(data.puntos)) {
    data.puntos = data.puntos.map((point) => ({ ...point, x: Number(point.x || 0) + offset, y: Number(point.y || 0) + offset }));
  } else {
    data.x = Number(data.x || 0) + offset;
    data.y = Number(data.y || 0) + offset;
  }
  return {
    localId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    tipo_elemento: element.tipo_elemento,
    data_json: data
  };
};

export const moveElementInStack = (elements, localId, direction) => {
  const index = elements.findIndex((item) => item.localId === localId);
  if (index < 0) return elements;
  const nextIndex = direction === "front" ? Math.min(elements.length - 1, index + 1) : Math.max(0, index - 1);
  if (index === nextIndex) return elements;
  const next = [...elements];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
};

export const patchEditorLayer = (layers, key, patch) =>
  layers.map((layer) => (layer.key === key ? { ...layer, ...patch } : layer));

export const completePlacementTool = (tool, continuous = false) => {
  const singleUseTools = new Set(["punto", "texto", "codigo", "tapado"]);
  if (!singleUseTools.has(tool)) return tool;
  return continuous ? tool : "select";
};

export const shouldPlaceFromPointerUp = ({ tool, precisionMode = false, pointers = 1, moved = false, pinched = false, cancelled = false, onCanvas = true, onUi = false } = {}) =>
  Boolean(tool && tool !== "select" && !precisionMode && pointers === 1 && !moved && !pinched && !cancelled && onCanvas && !onUi);
