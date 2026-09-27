import { useState } from "react";
import { DRAFT_STORAGE_KEY } from "../../constants/storageKeys";
import { emptyForm } from "../../constants/formsAndUi";
import { hasDraftContent } from "../../utils/records";
import { loadStoredRecordNotifications } from "../../utils/localStorage";

export function useRecordsState() {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [draftForm, setDraftForm] = useState(() => {
    const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!saved) return null;

    try {
      const parsed = JSON.parse(saved);
      return hasDraftContent(parsed) ? { ...emptyForm, ...parsed, id: null } : null;
    } catch {
      return null;
    }
  });
  const [search, setSearch] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [recordView, setRecordView] = useState("active");
  const [recordQuickFilter, setRecordQuickFilter] = useState("all");
  const [recordPage, setRecordPage] = useState(1);
  const [recordFilters, setRecordFilters] = useState({
    clave: "",
    barrio: "",
    responsible: "",
    date_from: "",
    date_to: "",
    status: "all"
  });
  const [processingRecordId, setProcessingRecordId] = useState(null);
  const [showPrintBatchModal, setShowPrintBatchModal] = useState(false);
  const [showDashboardAlertsModal, setShowDashboardAlertsModal] = useState(false);
  const [showPrintComparisonModal, setShowPrintComparisonModal] = useState(false);

  const [printingComparison, setPrintingComparison] = useState(false);
  const [printComparisonHeader, setPrintComparisonHeader] = useState({
    kicker: "Lista de fichas vencidas",
    title: "Comparacion contra Aguas",
    note: "Claves vencidas comparadas con el padron de Aguas de Choluteca"
  });
  const [batchPrintCopies, setBatchPrintCopies] = useState({});
  const [printBatchSearch, setPrintBatchSearch] = useState("");
  const [printBatchQuickFilter, setPrintBatchQuickFilter] = useState("all");
  const [printBatchStatusView, setPrintBatchStatusView] = useState("pending");
  const [batchPrinting, setBatchPrinting] = useState(false);
  const [notifiedRecordAlerts, setNotifiedRecordAlerts] = useState(() => loadStoredRecordNotifications());

  return {
    records,
    setRecords,
    form,
    setForm,
    draftForm,
    setDraftForm,
    search,
    setSearch,
    selectedFile,
    setSelectedFile,
    recordView,
    setRecordView,
    recordQuickFilter,
    setRecordQuickFilter,
    recordPage,
    setRecordPage,
    recordFilters,
    setRecordFilters,
    processingRecordId,
    setProcessingRecordId,
    showPrintBatchModal,
    setShowPrintBatchModal,
    showDashboardAlertsModal,
    setShowDashboardAlertsModal,
    showPrintComparisonModal,
    setShowPrintComparisonModal,
    printingComparison,
    setPrintingComparison,
    printComparisonHeader,
    setPrintComparisonHeader,
    batchPrintCopies,
    setBatchPrintCopies,
    printBatchSearch,
    setPrintBatchSearch,
    printBatchQuickFilter,
    setPrintBatchQuickFilter,
    printBatchStatusView,
    setPrintBatchStatusView,
    batchPrinting,
    setBatchPrinting,
    notifiedRecordAlerts,
    setNotifiedRecordAlerts
  };
}
