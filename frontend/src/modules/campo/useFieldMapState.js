import { useRef, useState } from "react";
import { MAP_POINT_LIST_INITIAL_LIMIT } from "../../constants/workspace";
import { defaultMapReportStaff, emptyMapDraft, emptyMapReportDraft } from "../../constants/formsAndUi";
import { getMapDiaryDateKey } from "../../utils/datesAndBusiness";
import { loadMapReportSettingsByDate, normalizeMapReportStaff } from "../../utils/mapReport";

export function useFieldMapState() {
  const [mapPoints, setMapPoints] = useState([]);
  const [showMapPrintDialog, setShowMapPrintDialog] = useState(false);
  const [mapDiaryGroupsSummary, setMapDiaryGroupsSummary] = useState([]);
  const [mapPointListLimit, setMapPointListLimit] = useState(MAP_POINT_LIST_INITIAL_LIMIT);
  const [isCompactMapView, setIsCompactMapView] = useState(false);
  const [loadingMapPoints, setLoadingMapPoints] = useState(false);
  const [loadingMapContexts, setLoadingMapContexts] = useState(false);
  const [mapPointContexts, setMapPointContexts] = useState({});
  const [mapReportPage, setMapReportPage] = useState(1);
  const [showFieldDebtModal, setShowFieldDebtModal] = useState(false);
  const [loadingFieldDebtReport, setLoadingFieldDebtReport] = useState(false);
  const [fieldDebtReport, setFieldDebtReport] = useState(null);
  const [showMapDiaryArchiveModal, setShowMapDiaryArchiveModal] = useState(false);
  const [selectedArchiveMapDiaryKey, setSelectedArchiveMapDiaryKey] = useState("");
  const [archiveMapDiaryPoints, setArchiveMapDiaryPoints] = useState([]);
  const [loadingArchiveMapDiaryPoints, setLoadingArchiveMapDiaryPoints] = useState(false);
  const [savingReportMapPoint, setSavingReportMapPoint] = useState(false);
  const [editingReportMapPointId, setEditingReportMapPointId] = useState(null);
  const [reportMapDraft, setReportMapDraft] = useState(emptyMapReportDraft);
  const [mapReportStaff, setMapReportStaff] = useState(() => normalizeMapReportStaff(defaultMapReportStaff));
  const [mapReportSettingsByDate, setMapReportSettingsByDate] = useState(() => loadMapReportSettingsByDate());
  const [regulatorReportDiaryKeys, setRegulatorReportDiaryKeys] = useState([]);
  const [generatingRegulatorReport, setGeneratingRegulatorReport] = useState(false);
  const [savingMapPoint, setSavingMapPoint] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  const [selectedMapPointId, setSelectedMapPointId] = useState(null);
  const [editingMapPointId, setEditingMapPointId] = useState(null);
  const [mapStatus, setMapStatus] = useState("Sincronizado");
  const [mapDraft, setMapDraft] = useState(emptyMapDraft);
  const [mapDescriptionLookupStatus, setMapDescriptionLookupStatus] = useState("");
  const [mapFocusRequest, setMapFocusRequest] = useState(null);
  const [mapLocationHelp, setMapLocationHelp] = useState("");
  const mapDescriptionLookupCacheRef = useRef(new Map());
  const [mapDiaryDateKey, setMapDiaryDateKey] = useState(() => getMapDiaryDateKey(new Date()));

  return {
    mapPoints,
    setMapPoints,
    showMapPrintDialog,
    setShowMapPrintDialog,
    mapDiaryGroupsSummary,
    setMapDiaryGroupsSummary,
    mapPointListLimit,
    setMapPointListLimit,
    isCompactMapView,
    setIsCompactMapView,
    loadingMapPoints,
    setLoadingMapPoints,
    loadingMapContexts,
    setLoadingMapContexts,
    mapPointContexts,
    setMapPointContexts,
    mapReportPage,
    setMapReportPage,
    showFieldDebtModal,
    setShowFieldDebtModal,
    loadingFieldDebtReport,
    setLoadingFieldDebtReport,
    fieldDebtReport,
    setFieldDebtReport,
    showMapDiaryArchiveModal,
    setShowMapDiaryArchiveModal,
    selectedArchiveMapDiaryKey,
    setSelectedArchiveMapDiaryKey,
    archiveMapDiaryPoints,
    setArchiveMapDiaryPoints,
    loadingArchiveMapDiaryPoints,
    setLoadingArchiveMapDiaryPoints,
    savingReportMapPoint,
    setSavingReportMapPoint,
    editingReportMapPointId,
    setEditingReportMapPointId,
    reportMapDraft,
    setReportMapDraft,
    mapReportStaff,
    setMapReportStaff,
    mapReportSettingsByDate,
    setMapReportSettingsByDate,
    regulatorReportDiaryKeys,
    setRegulatorReportDiaryKeys,
    generatingRegulatorReport,
    setGeneratingRegulatorReport,
    savingMapPoint,
    setSavingMapPoint,
    locatingUser,
    setLocatingUser,
    selectedMapPointId,
    setSelectedMapPointId,
    editingMapPointId,
    setEditingMapPointId,
    mapStatus,
    setMapStatus,
    mapDraft,
    setMapDraft,
    mapDescriptionLookupStatus,
    setMapDescriptionLookupStatus,
    mapFocusRequest,
    setMapFocusRequest,
    mapLocationHelp,
    setMapLocationHelp,
    mapDescriptionLookupCacheRef,
    mapDiaryDateKey,
    setMapDiaryDateKey
  };
}
