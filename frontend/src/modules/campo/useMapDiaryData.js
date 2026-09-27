import { useMemo } from "react";
import { MAP_DIARY_PRIMARY_LIMIT } from "../../constants/workspace";
import { getMapDiaryDateKey } from "../../utils/datesAndBusiness";
import { getTodayMapDiaryKey } from "../../utils/mapDiary";
import { normalizeMapReportSettings } from "../../utils/mapReport";

export function useMapDiaryData({
  mapDiaryDateKey,
  mapReportSettingsByDate,
  regulatorReportDiaryKeys,
  safeMapDiaryGroupsSummary,
  safeMapPoints,
  selectedArchiveMapDiaryKey,
  setMapReportSettingsByDate
}) {
  const mapDiaryGroups = useMemo(() => {
    const todayKey = getTodayMapDiaryKey();
    if (safeMapDiaryGroupsSummary.length) {
      const groups = safeMapDiaryGroupsSummary
        .filter((group) => group?.key)
        .map((group) => ({
          key: group.key,
          total: Number(group.total || 0)
        }))
        .sort((left, right) => right.key.localeCompare(left.key));
      return groups.some((group) => group.key === todayKey)
        ? groups
        : [{ key: todayKey, total: 0 }, ...groups].sort((left, right) => right.key.localeCompare(left.key));
    }

    const groups = safeMapPoints.reduce((accumulator, point) => {
      const key = getMapDiaryDateKey(point);
      if (!key) return accumulator;
      const current = accumulator.get(key) ?? { key, total: 0 };
      current.total += 1;
      accumulator.set(key, current);
      return accumulator;
    }, new Map());

    if (!groups.has(todayKey)) {
      groups.set(todayKey, { key: todayKey, total: 0 });
    }

    return Array.from(groups.values()).sort((left, right) => right.key.localeCompare(left.key));
  }, [safeMapDiaryGroupsSummary, safeMapPoints]);
  const mapPointsTotal = useMemo(
    () => mapDiaryGroups.reduce((total, group) => total + Number(group.total || 0), 0),
    [mapDiaryGroups]
  );
  const activeMapDiaryDateKey = useMemo(
    () => {
      return mapDiaryGroups.some((group) => group.key === mapDiaryDateKey)
        ? mapDiaryDateKey
        : mapDiaryGroups[0]?.key ?? getTodayMapDiaryKey();
    },
    [mapDiaryDateKey, mapDiaryGroups]
  );
  const primaryMapDiaryGroups = useMemo(() => {
    const recentGroups = mapDiaryGroups.slice(0, MAP_DIARY_PRIMARY_LIMIT);
    if (recentGroups.some((group) => group.key === activeMapDiaryDateKey)) {
      return recentGroups;
    }

    const activeGroup = mapDiaryGroups.find((group) => group.key === activeMapDiaryDateKey);
    return activeGroup ? [activeGroup, ...recentGroups.slice(0, MAP_DIARY_PRIMARY_LIMIT - 1)] : recentGroups;
  }, [activeMapDiaryDateKey, mapDiaryGroups]);
  const archivedMapDiaryGroups = useMemo(() => {
    const visibleKeys = new Set(primaryMapDiaryGroups.map((group) => group.key));
    return mapDiaryGroups.filter((group) => !visibleKeys.has(group.key));
  }, [mapDiaryGroups, primaryMapDiaryGroups]);
  const regulatorReportDiaryOptions = useMemo(
    () => mapDiaryGroups.filter((group) => Number(group.total || 0) > 0).slice(0, 8),
    [mapDiaryGroups]
  );
  const selectedRegulatorDiaryKeys = useMemo(() => {
    const availableKeys = new Set(regulatorReportDiaryOptions.map((group) => group.key));
    const selected = regulatorReportDiaryKeys.filter((key) => availableKeys.has(key)).slice(0, 5);
    return selected.length ? selected : regulatorReportDiaryOptions.slice(0, 3).map((group) => group.key);
  }, [regulatorReportDiaryKeys, regulatorReportDiaryOptions]);
  const selectedArchiveMapDiaryGroup = useMemo(
    () => archivedMapDiaryGroups.find((group) => group.key === selectedArchiveMapDiaryKey) ?? archivedMapDiaryGroups[0] ?? null,
    [archivedMapDiaryGroups, selectedArchiveMapDiaryKey]
  );
  const mapReportSettings = useMemo(
    () => normalizeMapReportSettings(mapReportSettingsByDate[activeMapDiaryDateKey]),
    [activeMapDiaryDateKey, mapReportSettingsByDate]
  );
  const setMapReportSettings = (updater) => {
    setMapReportSettingsByDate((current) => {
      const currentSettings = normalizeMapReportSettings(current[activeMapDiaryDateKey]);
      const nextSettings = typeof updater === "function" ? updater(currentSettings) : updater;

      return {
        ...current,
        [activeMapDiaryDateKey]: normalizeMapReportSettings(nextSettings)
      };
    });
  };

  return {
    mapDiaryGroups,
    mapPointsTotal,
    activeMapDiaryDateKey,
    primaryMapDiaryGroups,
    archivedMapDiaryGroups,
    regulatorReportDiaryOptions,
    selectedRegulatorDiaryKeys,
    selectedArchiveMapDiaryGroup,
    mapReportSettings,
    setMapReportSettings
  };
}
