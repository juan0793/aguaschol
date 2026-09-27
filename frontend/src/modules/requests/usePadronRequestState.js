import { useState } from "react";
import { defaultPadronRequestForm } from "../../constants/formsAndUi";

export function usePadronRequestState() {
  const [padronRequestTemplates, setPadronRequestTemplates] = useState([]);
  // Sin esto, un 500 del backend se veia igual que "no hay datos": los contadores
  // quedaban en 0 y la insignia seguia diciendo "Listo" en cuanto pasaba el aviso.
  const [padronRequestLoadError, setPadronRequestLoadError] = useState("");
  const [padronRequestForm, setPadronRequestForm] = useState(defaultPadronRequestForm);
  const [padronRequestResult, setPadronRequestResult] = useState(null);
  const [loadingPadronRequest, setLoadingPadronRequest] = useState(false);
  const [loadingPadronRequestMeta, setLoadingPadronRequestMeta] = useState(false);
  const [padronServiceReport, setPadronServiceReport] = useState(null);
  const [loadingPadronServiceReport, setLoadingPadronServiceReport] = useState(false);
  const [selectedAguasServiceField, setSelectedAguasServiceField] = useState("agua");
  const [selectedAguasServiceBarrios, setSelectedAguasServiceBarrios] = useState([]);

  return {
    padronRequestTemplates,
    setPadronRequestTemplates,
    padronRequestLoadError,
    setPadronRequestLoadError,
    padronRequestForm,
    setPadronRequestForm,
    padronRequestResult,
    setPadronRequestResult,
    loadingPadronRequest,
    setLoadingPadronRequest,
    loadingPadronRequestMeta,
    setLoadingPadronRequestMeta,
    padronServiceReport,
    setPadronServiceReport,
    loadingPadronServiceReport,
    setLoadingPadronServiceReport,
    selectedAguasServiceField,
    setSelectedAguasServiceField,
    selectedAguasServiceBarrios,
    setSelectedAguasServiceBarrios
  };
}
