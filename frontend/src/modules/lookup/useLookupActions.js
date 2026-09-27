import { useEffect } from "react";
import { LOOKUP_HISTORY_STORAGE_KEY } from "../../constants/storageKeys";
import { MAX_LOOKUP_HISTORY_ITEMS } from "../../constants/formsAndUi";
import { getLookupValidationMessage, isLookupQueryReady, sanitizeLookupInput } from "../../utils/claveAndLookup";

export function useLookupActions({
  apiFetch,
  clearSession,
  isAuthenticated,
  lookupHistory,
  lookupPrefixMode,
  lookupQuery,
  lookupSearchMode,
  padronMeta,
  setLookupFeedback,
  setLookupHistory,
  setLookupLoading,
  setLookupPrefixMode,
  setLookupQuery,
  setLookupResult,
  setLookupSearchMode,
  showAlert,
  workspaceView
}) {
  const persistLookupHistory = (nextHistory) => {
    window.localStorage.setItem(LOOKUP_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
    setLookupHistory(nextHistory);
  };

  const handleRemoveLookupHistoryItem = (historyItem) => {
    const nextHistory = lookupHistory.filter(
      (item) =>
        !(
          item.mode === historyItem.mode &&
          String(item.normalized_query || item.query || "") === String(historyItem.normalized_query || historyItem.query || "") &&
          item.searched_at === historyItem.searched_at
        )
    );
    persistLookupHistory(nextHistory);
  };

  useEffect(() => {
    if (!isAuthenticated || workspaceView !== "lookup") {
      return undefined;
    }

    if (!lookupQuery.trim()) {
      setLookupFeedback("");
      setLookupResult(null);
      return undefined;
    }

    if (!isLookupQueryReady(lookupQuery, lookupSearchMode)) {
      setLookupResult(null);
      setLookupFeedback(getLookupValidationMessage(lookupSearchMode));
      return undefined;
    }

    const timer = window.setTimeout(() => {
      handleLookupSearch();
    }, 280);

    return () => window.clearTimeout(timer);
  }, [isAuthenticated, lookupQuery, lookupSearchMode, workspaceView]);

  const handleLookupInputChange = (event) => {
    const nextValue = sanitizeLookupInput(event.target.value, lookupSearchMode, lookupPrefixMode);
    setLookupQuery(nextValue);
    setLookupFeedback("");

    if (!nextValue.trim()) {
      setLookupResult(null);
    }
  };

  const handleLookupPrefixModeChange = (mode) => {
    setLookupPrefixMode(mode);
    setLookupQuery((current) => sanitizeLookupInput(current, lookupSearchMode, mode));
    setLookupFeedback("");
  };

  const handleLookupSearchModeChange = (mode) => {
    setLookupSearchMode(mode);
    setLookupQuery("");
    setLookupResult(null);
    setLookupFeedback("");
    if (mode !== "clave") {
      setLookupPrefixMode("auto");
    }
  };

  const handleLookupSearch = async (event) => {
    if (event) {
      event.preventDefault();
    }

    const normalizedLookupQuery = lookupQuery.trim();

    if (!normalizedLookupQuery) {
      setLookupResult(null);
      setLookupFeedback(
          lookupSearchMode === "clave"
            ? "Ingresa una clave catastral para consultar."
            : lookupSearchMode === "nombre"
              ? "Ingresa un nombre para consultar."
              : lookupSearchMode === "alcaldia"
                ? "Ingresa una clave, nombre o barrio para consultar en Alcaldia."
                : "Ingresa un numero de abonado para consultar."
      );
      return;
    }

    if (!isLookupQueryReady(normalizedLookupQuery, lookupSearchMode)) {
      setLookupResult(null);
      setLookupFeedback(getLookupValidationMessage(lookupSearchMode));
      return;
    }

    setLookupLoading(true);
    setLookupFeedback("");

    try {
      const padronCacheKey = encodeURIComponent(padronMeta?.updated_at || Date.now());
      const lookupUrl =
        lookupSearchMode === "alcaldia"
          ? `/claves/alcaldia/search?field=texto&clave=${encodeURIComponent(normalizedLookupQuery)}&_padron=${padronCacheKey}`
          : `/claves/search?clave=${encodeURIComponent(normalizedLookupQuery)}&field=${encodeURIComponent(lookupSearchMode)}&_padron=${padronCacheKey}`;
      const response = await apiFetch(lookupUrl);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible consultar la clave.");
      }

      setLookupResult(data);
      const historyEntry = {
        mode: lookupSearchMode,
        query: normalizedLookupQuery,
        normalized_query: data.normalized_query || normalizedLookupQuery,
        total_matches: data.total_matches ?? 0,
        exists: Boolean(data.exists),
        searched_at: new Date().toISOString()
      };
      setLookupHistory((current) => {
        const nextHistory = [
          historyEntry,
          ...current.filter(
            (item) =>
              !(
                item.mode === historyEntry.mode &&
                String(item.normalized_query || item.query) === String(historyEntry.normalized_query)
              )
          )
        ].slice(0, MAX_LOOKUP_HISTORY_ITEMS);
        window.localStorage.setItem(LOOKUP_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
        return nextHistory;
      });
    } catch (error) {
      setLookupResult(null);
      setLookupFeedback(error.message || "No fue posible consultar la clave.");
    } finally {
      setLookupLoading(false);
    }
  };

  return {
    persistLookupHistory,
    handleRemoveLookupHistoryItem,
    handleLookupInputChange,
    handleLookupPrefixModeChange,
    handleLookupSearchModeChange,
    handleLookupSearch
  };
}
