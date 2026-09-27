import { useMemo } from "react";
import { clampPrintCopies } from "../../utils/recordLabels";

export function usePrintBatchSelection({
  batchPrintCopies,
  filteredRecords,
  getRecordBarrioName,
  printBatchQuickFilter,
  printBatchSearch,
  printBatchStatusView,
  recordView,
  safeRecords
}) {
  const batchPrintSelection = useMemo(() => {
    const entries = Object.entries(batchPrintCopies)
      .map(([recordId, copies]) => {
        const ficha = clampPrintCopies(copies?.ficha ?? 0);
        const aviso = clampPrintCopies(copies?.aviso ?? 0);
        const record = safeRecords.find((item) => String(item.id) === String(recordId));
        return record && (ficha || aviso) ? { record, ficha, aviso } : null;
      })
      .filter(Boolean);

    return {
      entries,
      fichas: entries.reduce((total, item) => total + item.ficha, 0),
      avisos: entries.reduce((total, item) => total + item.aviso, 0)
    };
  }, [batchPrintCopies, safeRecords]);
  const printedSaveSelection = useMemo(() => {
    const entries = Object.entries(batchPrintCopies)
      .map(([recordId, copies]) => {
        if (!copies?.save) return null;
        const record = safeRecords.find((item) => String(item.id) === String(recordId));
        return record?.estado_padron === "reportada" ? record : null;
      })
      .filter(Boolean);

    return {
      entries,
      total: entries.length
    };
  }, [batchPrintCopies, safeRecords]);
  const manualPrintedSelection = useMemo(() => {
    const entries = Object.entries(batchPrintCopies)
      .map(([recordId, copies]) => {
        if (!copies?.printed) return null;
        const record = safeRecords.find((item) => String(item.id) === String(recordId));
        return record?.estado_padron !== "reportada" ? record : null;
      })
      .filter(Boolean);

    return {
      entries,
      total: entries.length
    };
  }, [batchPrintCopies, safeRecords]);
  const printBatchStatusCounts = useMemo(
    () => ({
      pending: filteredRecords.filter((record) => record.estado_padron !== "reportada").length,
      printed: filteredRecords.filter((record) => record.estado_padron === "reportada").length
    }),
    [filteredRecords]
  );
  const printBatchRecords = useMemo(() => {
    if (recordView === "archived") return filteredRecords;
    if (printBatchStatusView === "printed") {
      return filteredRecords.filter((record) => record.estado_padron === "reportada");
    }
    return filteredRecords.filter((record) => record.estado_padron !== "reportada");
  }, [filteredRecords, printBatchStatusView, recordView]);
  const filteredPrintBatchRecords = useMemo(() => {
    const query = printBatchSearch.trim().toLowerCase();

    return printBatchRecords.filter((record) => {
      const copies = batchPrintCopies[record.id] || {};
      const fichaCopies = clampPrintCopies(copies.ficha ?? 0);
      const avisoCopies = clampPrintCopies(copies.aviso ?? 0);
      const matchesSearch =
        !query ||
        String(record.clave_catastral || "").toLowerCase().includes(query) ||
        getRecordBarrioName(record, "").toLowerCase().includes(query);

      if (!matchesSearch) return false;
      if (printBatchQuickFilter === "clandestina") {
        return (record.estado_padron || "clandestino") === "clandestino";
      }
      if (printBatchQuickFilter === "ficha_selected") {
        return fichaCopies > 0;
      }
      if (printBatchQuickFilter === "aviso_selected") {
        return avisoCopies > 0;
      }

      return true;
    });
  }, [batchPrintCopies, printBatchQuickFilter, printBatchRecords, printBatchSearch]);

  return {
    batchPrintSelection,
    printedSaveSelection,
    manualPrintedSelection,
    printBatchStatusCounts,
    filteredPrintBatchRecords
  };
}
