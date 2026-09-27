import { useMemo } from "react";
import { RECORDS_PAGE_SIZE } from "../../constants/workspace";
import { getMapDiaryDateKey } from "../../utils/datesAndBusiness";
import { getRecordDeadlineMeta, getRecordGroupDate } from "../../utils/records";

export function useRecordFilters({
  getRecordBarrioName,
  recordFilters,
  recordPage,
  recordQuickFilter,
  recordView,
  safeRecords,
  todayDateKey
}) {
  const recordDeadlineMetaById = useMemo(
    () =>
      Object.fromEntries(
        safeRecords.map((record) => [record.id, getRecordDeadlineMeta(record)]).filter(([, meta]) => Boolean(meta))
      ),
    [safeRecords]
  );
  const alertRecords = useMemo(
    () =>
      safeRecords.filter((record) => {
        const meta = recordDeadlineMetaById[record.id];
        return meta && ["warning", "due", "overdue"].includes(meta.statusKey);
      }),
    [recordDeadlineMetaById, safeRecords]
  );

  const advancedFilteredRecords = useMemo(() => {
    return safeRecords.filter((record) => {
      const claveFilter = String(recordFilters.clave || "").trim().toLowerCase();
      if (claveFilter) {
        const normalizedClave = String(record.clave_catastral || "").toLowerCase();
        const compactClave = normalizedClave.replace(/[^a-z0-9]/g, "");
        const compactFilter = claveFilter.replace(/[^a-z0-9]/g, "");
        if (!normalizedClave.includes(claveFilter) && (!compactFilter || !compactClave.includes(compactFilter))) {
          return false;
        }
      }

      if (recordFilters.barrio) {
        const barrio = getRecordBarrioName(record, "");
        if (barrio !== recordFilters.barrio) {
          return false;
        }
      }

      if (recordFilters.responsible) {
        const responsiblePool = [record.levantamiento_datos, record.analista_datos]
          .map((value) => String(value || "").trim())
          .filter(Boolean);
        if (!responsiblePool.includes(recordFilters.responsible)) {
          return false;
        }
      }

      const recordDateKey = getMapDiaryDateKey(getRecordGroupDate(record, recordView));
      if (recordFilters.date_from && (!recordDateKey || recordDateKey < recordFilters.date_from)) {
        return false;
      }

      if (recordFilters.date_to && (!recordDateKey || recordDateKey > recordFilters.date_to)) {
        return false;
      }

      if (recordFilters.status === "no_photo") {
        return Boolean(String(record.foto_path || "").trim()) === false;
      }

      if (recordFilters.status !== "all") {
        const meta = recordDeadlineMetaById[record.id];
        if (!meta || meta.statusKey !== recordFilters.status) {
          return false;
        }
      }

      return true;
    });
  }, [recordDeadlineMetaById, recordFilters, recordView, safeRecords]);
  const filteredRecords = useMemo(() => {
    if (recordQuickFilter === "clandestino") {
      return advancedFilteredRecords.filter((record) => (record.estado_padron || "clandestino") === "clandestino");
    }

    if (recordQuickFilter === "reportada") {
      return advancedFilteredRecords.filter((record) => record.estado_padron === "reportada");
    }

    if (recordQuickFilter === "varios_padrones") {
      return advancedFilteredRecords.filter((record) => record.estado_padron === "varios_padrones");
    }

    if (recordQuickFilter === "today") {
      return advancedFilteredRecords.filter(
        (record) => getMapDiaryDateKey(record.updated_at || record.created_at) === todayDateKey
      );
    }

    if (recordQuickFilter === "no_photo") {
      return advancedFilteredRecords.filter((record) => !String(record.foto_path || "").trim());
    }

    if (recordQuickFilter === "alert") {
      return advancedFilteredRecords.filter((record) => {
        const meta = recordDeadlineMetaById[record.id];
        return meta && ["warning", "due", "overdue"].includes(meta.statusKey);
      });
    }

    return advancedFilteredRecords;
  }, [advancedFilteredRecords, recordDeadlineMetaById, recordQuickFilter, todayDateKey]);
  const recordPagination = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(filteredRecords.length / RECORDS_PAGE_SIZE));
    const currentPage = Math.min(recordPage, totalPages);
    const start = (currentPage - 1) * RECORDS_PAGE_SIZE;

    return {
      currentPage,
      totalPages,
      start,
      end: Math.min(start + RECORDS_PAGE_SIZE, filteredRecords.length),
      records: filteredRecords.slice(start, start + RECORDS_PAGE_SIZE)
    };
  }, [filteredRecords, recordPage]);

  return { recordDeadlineMetaById, alertRecords, filteredRecords, recordPagination };
}
