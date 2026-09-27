import { useState } from "react";
import { LOOKUP_SEARCH_MODES } from "../../constants/formsAndUi";
import { loadStoredLookupHistory } from "../../utils/localStorage";

export function useLookupState() {
  const [showLookupClassicModal, setShowLookupClassicModal] = useState(false);
  const [lookupSearchMode, setLookupSearchMode] = useState("clave");
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupPrefixMode, setLookupPrefixMode] = useState("auto");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupFeedback, setLookupFeedback] = useState("");
  const [lookupHistory, setLookupHistory] = useState(() => loadStoredLookupHistory());

  const lookupModeConfig =
    LOOKUP_SEARCH_MODES.find((mode) => mode.value === lookupSearchMode) ?? LOOKUP_SEARCH_MODES[0];

  const lookupInputLabel =
    lookupSearchMode === "clave"
      ? "Clave catastral"
      : lookupSearchMode === "nombre"
        ? "Nombre o inquilino"
        : lookupSearchMode === "alcaldia"
          ? "Clave, nombre o barrio de Alcaldía"
          : "Numero de abonado";

  const lookupInputPlaceholder =
    lookupSearchMode === "clave"
      ? lookupPrefixMode === "three"
        ? "000-00-00 o 000-00-00-00"
        : "00-00-00, 000-00-00 o clave completa"
      : lookupSearchMode === "nombre"
        ? "Ej. Juan Aguilera Estrada"
        : lookupSearchMode === "alcaldia"
          ? "Ej. 01-01-01, Suyapa o Sandra"
        : "Ej. 16523";

  return {
    showLookupClassicModal,
    setShowLookupClassicModal,
    lookupSearchMode,
    setLookupSearchMode,
    lookupQuery,
    setLookupQuery,
    lookupPrefixMode,
    setLookupPrefixMode,
    lookupLoading,
    setLookupLoading,
    lookupResult,
    setLookupResult,
    lookupFeedback,
    setLookupFeedback,
    lookupHistory,
    setLookupHistory,
    lookupModeConfig,
    lookupInputLabel,
    lookupInputPlaceholder
  };
}
