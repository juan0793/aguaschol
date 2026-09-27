import { useEffect } from "react";
import { MAP_AUTO_REFRESH_MS, MAP_POINT_LIST_INITIAL_LIMIT, MOBILE_MAP_AUTO_REFRESH_MS } from "../../constants/workspace";
import {
  MAP_DESCRIPTION_PADRON_BLOCK_PATTERN,
  stripMapDescriptionPadronBlock,
  stripTransientMapReportSettings
} from "../../utils/mapReport";
import { MAP_REPORT_SETTINGS_STORAGE_KEY } from "../../constants/storageKeys";
import { buildMapDescriptionPadronBlock, extractFieldDebtLookupReferences } from "../../utils/fieldDebt";

export function useFieldMapEffects({
  activeMapDiaryDateKey,
  apiFetch,
  isAdmin,
  isAuthenticated,
  isCompactMapView,
  loadMapDiaryGroups,
  loadMapPointContexts,
  loadMapPoints,
  mapDescriptionLookupCacheRef,
  mapDiaryDateKey,
  mapDraft,
  mapPointsRequestRef,
  mapReportPrintData,
  mapReportSettingsByDate,
  padronMeta,
  regulatorReportDiaryKeys,
  regulatorReportDiaryOptions,
  safeBarrioCodes,
  setMapDescriptionLookupStatus,
  setMapDiaryDateKey,
  setMapDraft,
  setMapPointListLimit,
  setMapReportPage,
  setRegulatorReportDiaryKeys,
  setSelectedMapPointId,
  visibleMapPoints,
  workspaceView
}) {
  useEffect(() => {
    if (mapDiaryDateKey !== activeMapDiaryDateKey) {
      setMapDiaryDateKey(activeMapDiaryDateKey);
    }
  }, [activeMapDiaryDateKey, mapDiaryDateKey]);

  useEffect(() => {
    if (regulatorReportDiaryKeys.length || !regulatorReportDiaryOptions.length) return;
    setRegulatorReportDiaryKeys(regulatorReportDiaryOptions.slice(0, 3).map((group) => group.key));
  }, [regulatorReportDiaryKeys.length, regulatorReportDiaryOptions]);

  useEffect(() => {
    const byDate = Object.fromEntries(
      Object.entries(mapReportSettingsByDate).map(([dateKey, settings]) => [
        dateKey,
        stripTransientMapReportSettings(settings)
      ])
    );
    window.localStorage.setItem(MAP_REPORT_SETTINGS_STORAGE_KEY, JSON.stringify({ by_date: byDate }));
  }, [mapReportSettingsByDate]);

  useEffect(() => () => {
    mapPointsRequestRef.current.controller?.abort();
  }, []);

  useEffect(() => {
    setSelectedMapPointId((current) => (visibleMapPoints.some((point) => point.id === current) ? current : null));
  }, [visibleMapPoints]);

  useEffect(() => {
    setMapReportPage(1);
    setMapPointListLimit(MAP_POINT_LIST_INITIAL_LIMIT);
  }, [activeMapDiaryDateKey]);

  useEffect(() => {
    if (isAuthenticated && ["map", "mapReports", "mapAnalytics"].includes(workspaceView)) {
        loadMapDiaryGroups({ silent: true });
        loadMapPoints({ date: workspaceView === "map" ? activeMapDiaryDateKey : "" });
      }
  }, [activeMapDiaryDateKey, isAuthenticated, workspaceView]);

  useEffect(() => {
    if (["mapReports", "mapAnalytics"].includes(workspaceView) && isAdmin) {
      loadMapPointContexts(visibleMapPoints);
    }
  }, [isAdmin, visibleMapPoints, workspaceView]);

  useEffect(() => {
    setMapReportPage(1);
  }, [workspaceView]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(mapReportPrintData.zones.length / 5));
    setMapReportPage((current) => Math.min(current, totalPages));
  }, [mapReportPrintData.zones.length]);

  useEffect(() => {
    if (!isAuthenticated || workspaceView !== "map") {
      return undefined;
    }

    const refreshMapPoints = () => {
      if (document.visibilityState === "visible") {
        loadMapDiaryGroups({ silent: true });
        loadMapPoints({ silent: true, date: activeMapDiaryDateKey });
      }
    };

    const handleWindowFocus = () => refreshMapPoints();
    const refreshInterval = isCompactMapView ? MOBILE_MAP_AUTO_REFRESH_MS : MAP_AUTO_REFRESH_MS;
    const intervalId = window.setInterval(refreshMapPoints, refreshInterval);
    document.addEventListener("visibilitychange", refreshMapPoints);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshMapPoints);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [activeMapDiaryDateKey, isAuthenticated, isCompactMapView, workspaceView]);

  useEffect(() => {
    const description = String(mapDraft.description || "");
    const descriptionWithoutPadron = stripMapDescriptionPadronBlock(description);
    const references = extractFieldDebtLookupReferences(descriptionWithoutPadron);
    const reference = references[references.length - 1] || null;

    if (!reference) {
      setMapDescriptionLookupStatus("");
      return undefined;
    }

    const currentBlock = description.match(MAP_DESCRIPTION_PADRON_BLOCK_PATTERN)?.[0] || "";
    if (currentBlock) {
      setMapDescriptionLookupStatus("Informacion del padron anexada.");
      return undefined;
    }
    setMapDescriptionLookupStatus(`Consultando padron para ${reference.label}...`);

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        let data = mapDescriptionLookupCacheRef.current.get(reference.key);
        if (!data) {
          const response = await apiFetch(
            `/claves/search?clave=${encodeURIComponent(reference.value)}&field=${encodeURIComponent(reference.field)}&_padron=${encodeURIComponent(
              padronMeta?.updated_at || ""
            )}`
          );
          data = await response.json();
          if (!response.ok) {
            throw new Error(data.message || "No fue posible consultar el padron.");
          }
          mapDescriptionLookupCacheRef.current.set(reference.key, data);
        }

        if (cancelled) return;
        const match = Array.isArray(data.matches) ? data.matches[0] : null;
        if (!match) {
          setMapDescriptionLookupStatus(`${reference.label} no aparece en el padron.`);
          return;
        }

        setMapDraft((current) => {
          const currentDescription = String(current.description || "");
          const cleanDescription = stripMapDescriptionPadronBlock(currentDescription);
          if (!extractFieldDebtLookupReferences(cleanDescription).some((item) => item.key === reference.key)) {
            return current;
          }
          const nextBlock = buildMapDescriptionPadronBlock(match);
          return {
            ...current,
            description: [cleanDescription, nextBlock].filter(Boolean).join("\n\n")
          };
        });
        setMapDescriptionLookupStatus("Datos del padron anexados automaticamente.");
      } catch (error) {
        if (!cancelled) {
          setMapDescriptionLookupStatus(error.message || "No fue posible consultar el padron.");
        }
      }
    }, 650);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mapDraft.description, padronMeta?.updated_at, safeBarrioCodes]);
}
