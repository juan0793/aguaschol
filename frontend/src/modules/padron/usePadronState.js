import { useState } from "react";

export function usePadronState() {
  const [padronMeta, setPadronMeta] = useState(null);
  const [padronImportSummary, setPadronImportSummary] = useState(null);
  const [padronFile, setPadronFile] = useState(null);
  const [uploadingPadron, setUploadingPadron] = useState(false);
  const [padronBatches, setPadronBatches] = useState([]);
  const [selectedPadronBatchCode, setSelectedPadronBatchCode] = useState("");
  const [confirmingPadronBatch, setConfirmingPadronBatch] = useState(null);
  const [loadingPadronBatches, setLoadingPadronBatches] = useState(false);
  const [activatingPadronBatch, setActivatingPadronBatch] = useState(false);
  const [verifyingPadronBatch, setVerifyingPadronBatch] = useState(false);
  const [downloadingPadronBatch, setDownloadingPadronBatch] = useState(false);
  const [downloadingPadron, setDownloadingPadron] = useState(false);
  const [reprocessingPadron, setReprocessingPadron] = useState(false);
  const [loadingPadronMeta, setLoadingPadronMeta] = useState(false);
  const [padronSyncState, setPadronSyncState] = useState({
    status: "idle",
    progress: 0,
    message: "Padron listo",
    verification: null
  });
  const selectedPadronBatch = padronBatches.find((batch) => batch.codigo_lote === selectedPadronBatchCode) ?? null;
  const [alcaldiaMeta, setAlcaldiaMeta] = useState(null);
  const [alcaldiaImportSummary, setAlcaldiaImportSummary] = useState(null);
  const [alcaldiaFile, setAlcaldiaFile] = useState(null);
  const [uploadingAlcaldia, setUploadingAlcaldia] = useState(false);
  const [loadingAlcaldiaMeta, setLoadingAlcaldiaMeta] = useState(false);
  const [alcaldiaSyncState, setAlcaldiaSyncState] = useState({
    status: "idle",
    progress: 0,
    message: "Padron de alcaldia listo"
  });
  const [loadingAlcaldiaComparison, setLoadingAlcaldiaComparison] = useState(false);
  const [alcaldiaComparison, setAlcaldiaComparison] = useState(null);
  const [padronChartMode, setPadronChartMode] = useState("brecha");
  const [padronChartType, setPadronChartType] = useState("barras");
  const [downloadingPadronStatsPdf, setDownloadingPadronStatsPdf] = useState(false);
  const [downloadingAguasServicePdf, setDownloadingAguasServicePdf] = useState(false);
  const [selectedPadronStatBarrio, setSelectedPadronStatBarrio] = useState("");
  const [selectedPadronServiceField, setSelectedPadronServiceField] = useState("");
  const [padronStatsBarrioFilter, setPadronStatsBarrioFilter] = useState("");
  const [padronStatsSortMetric, setPadronStatsSortMetric] = useState("brecha_registros");
  const [padronStatsSortDirection, setPadronStatsSortDirection] = useState("desc");
  const [padronStatsLimit, setPadronStatsLimit] = useState(10);

  return {
    padronMeta,
    setPadronMeta,
    padronImportSummary,
    setPadronImportSummary,
    padronFile,
    setPadronFile,
    uploadingPadron,
    setUploadingPadron,
    padronBatches,
    setPadronBatches,
    selectedPadronBatchCode,
    setSelectedPadronBatchCode,
    confirmingPadronBatch,
    setConfirmingPadronBatch,
    loadingPadronBatches,
    setLoadingPadronBatches,
    activatingPadronBatch,
    setActivatingPadronBatch,
    verifyingPadronBatch,
    setVerifyingPadronBatch,
    downloadingPadronBatch,
    setDownloadingPadronBatch,
    downloadingPadron,
    setDownloadingPadron,
    reprocessingPadron,
    setReprocessingPadron,
    loadingPadronMeta,
    setLoadingPadronMeta,
    padronSyncState,
    setPadronSyncState,
    selectedPadronBatch,
    alcaldiaMeta,
    setAlcaldiaMeta,
    alcaldiaImportSummary,
    setAlcaldiaImportSummary,
    alcaldiaFile,
    setAlcaldiaFile,
    uploadingAlcaldia,
    setUploadingAlcaldia,
    loadingAlcaldiaMeta,
    setLoadingAlcaldiaMeta,
    alcaldiaSyncState,
    setAlcaldiaSyncState,
    loadingAlcaldiaComparison,
    setLoadingAlcaldiaComparison,
    alcaldiaComparison,
    setAlcaldiaComparison,
    padronChartMode,
    setPadronChartMode,
    padronChartType,
    setPadronChartType,
    downloadingPadronStatsPdf,
    setDownloadingPadronStatsPdf,
    downloadingAguasServicePdf,
    setDownloadingAguasServicePdf,
    selectedPadronStatBarrio,
    setSelectedPadronStatBarrio,
    selectedPadronServiceField,
    setSelectedPadronServiceField,
    padronStatsBarrioFilter,
    setPadronStatsBarrioFilter,
    padronStatsSortMetric,
    setPadronStatsSortMetric,
    padronStatsSortDirection,
    setPadronStatsSortDirection,
    padronStatsLimit,
    setPadronStatsLimit
  };
}
