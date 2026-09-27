import { useCallback, useMemo } from "react";
import { formatCurrency } from "../../utils/formatting";

export function usePadronReportData({
  alcaldiaComparison,
  padronChartMode,
  padronRequestResult,
  padronServiceReport,
  padronStatsBarrioFilter,
  padronStatsLimit,
  padronStatsSortDirection,
  padronStatsSortMetric,
  selectedAguasServiceBarrios,
  selectedAguasServiceField,
  selectedPadronServiceField,
  selectedPadronStatBarrio,
  setSelectedAguasServiceBarrios
}) {
  const padronStatisticsData = useMemo(() => {
    const barrioStats = Array.isArray(alcaldiaComparison?.barrio_stats) ? alcaldiaComparison.barrio_stats : [];
    const requestBarrios = Array.isArray(padronRequestResult?.summary?.barrios) ? padronRequestResult.summary.barrios : [];
    const serviceLabels = {
      agua: "Agua potable",
      alcantarillado: "Alcantarillado",
      barrido: "Barrido",
      recoleccion: "Desechos / tren de aseo",
      desechos_peligrosos: "Desechos peligrosos"
    };
    const normalizedBarrioFilter = padronStatsBarrioFilter.trim().toLowerCase();
    const matchesBarrioFilter = (item = {}) =>
      !normalizedBarrioFilter || String(item.barrio_colonia || "").toLowerCase().includes(normalizedBarrioFilter);
    const limit = Number(padronStatsLimit || 10);
    const metricLabels = {
      brecha_registros: "Brecha",
      cobertura_aguas_pct: "Cobertura",
      candidatas_clandestinas: "Candidatas",
      alcaldia_total: "Claves Alcaldia",
      aguas_registradas: "Usuarios Aguas",
      servicio_dominante_total: "Servicio dominante"
    };
    const sortBySelectedMetric = (items = []) =>
      [...items].sort((left, right) => {
        const direction = padronStatsSortDirection === "asc" ? 1 : -1;
        const leftValue = Number(left?.[padronStatsSortMetric] || 0);
        const rightValue = Number(right?.[padronStatsSortMetric] || 0);
        return (
          (leftValue - rightValue) * direction ||
          String(left?.barrio_colonia || "").localeCompare(String(right?.barrio_colonia || ""), "es")
        );
      });
    const clandestineByBarrio = barrioStats
      .filter((item) => Number(item.candidatas_clandestinas || 0) > 0)
      .filter(matchesBarrioFilter)
      .slice(0, limit);
    const coverageHighByBarrio = [...barrioStats]
      .filter((item) => Number(item.alcaldia_total || 0) >= 2 && Number(item.aguas_registradas || 0) > 0)
      .filter(matchesBarrioFilter)
      .sort((left, right) =>
        Number(right.cobertura_aguas_pct || 0) - Number(left.cobertura_aguas_pct || 0) ||
        Number(right.aguas_registradas || 0) - Number(left.aguas_registradas || 0)
      )
      .slice(0, limit);
    const lowCoverageByBarrio = [...barrioStats]
      .filter((item) => Number(item.alcaldia_total || 0) >= 2 && Number(item.brecha_registros || 0) > 0)
      .filter(matchesBarrioFilter)
      .sort((left, right) =>
        Number(left.cobertura_aguas_pct || 0) - Number(right.cobertura_aguas_pct || 0) ||
        Number(right.brecha_registros || 0) - Number(left.brecha_registros || 0)
      )
      .slice(0, limit);
    const serviceMajorityByBarrio = [...barrioStats]
      .filter((item) => Number(item.servicio_dominante_total || 0) > 0)
      .filter(matchesBarrioFilter)
      .sort((left, right) =>
        Number(right.servicio_dominante_total || 0) - Number(left.servicio_dominante_total || 0) ||
        Number(right.aguas_registradas || 0) - Number(left.aguas_registradas || 0)
      )
      .slice(0, limit);
    const comparativeByBarrio = sortBySelectedMetric(
      barrioStats.filter(matchesBarrioFilter).filter((item) => Number(item.alcaldia_total || 0) > 0)
    ).slice(0, limit);
    const serviceSplitTotals = Object.entries(
      barrioStats.reduce((accumulator, item) => {
        Object.keys(serviceLabels).forEach((field) => {
          accumulator[field] = (accumulator[field] || 0) + Number(item.servicios?.[field] || 0);
        });
        return accumulator;
      }, {})
    )
      .map(([field, total]) => ({ field, label: serviceLabels[field] || field, total }))
      .sort((left, right) => Number(right.total || 0) - Number(left.total || 0));
    const serviceBarrioRows = Object.fromEntries(
      Object.entries(serviceLabels).map(([field, label]) => [
        field,
        [...barrioStats]
          .filter(matchesBarrioFilter)
          .map((item) => {
            const total = Number(item.servicios?.[field] || 0);
            const aguasRegistradas = Number(item.aguas_registradas || 0);
            const pct = aguasRegistradas ? Number(((total / aguasRegistradas) * 100).toFixed(1)) : 0;
            return {
              ...item,
              field,
              service_label: label,
              service_total: total,
              value: pct,
              detail: `${total} de ${aguasRegistradas} usuarios con ${label} - ${pct}% del barrio`
            };
          })
          .filter((item) => Number(item.service_total || 0) > 0)
          .sort((left, right) =>
            Number(right.value || 0) - Number(left.value || 0) ||
            Number(right.service_total || 0) - Number(left.service_total || 0) ||
            left.barrio_colonia.localeCompare(right.barrio_colonia, "es")
          )
          .slice(0, limit)
      ])
    );
    const requestBarriosTop = [...requestBarrios]
      .sort((left, right) => Number(right.total_registros || 0) - Number(left.total_registros || 0))
      .slice(0, 10);
    const selectedBarrio =
      barrioStats.find((item) => item.barrio_colonia === selectedPadronStatBarrio) ||
      clandestineByBarrio[0] ||
      lowCoverageByBarrio[0] ||
      coverageHighByBarrio[0] ||
      null;
    const dynamicRowsByMode = {
      brecha: clandestineByBarrio.map((item) => ({
        ...item,
        value: Number(item.candidatas_clandestinas || 0),
        detail: `${item.candidatas_clandestinas} sin coincidencia de ${item.alcaldia_total} claves Alcaldia`
      })),
      cobertura_alta: coverageHighByBarrio.map((item) => ({
        ...item,
        value: Number(item.cobertura_aguas_pct || 0),
        detail: `${item.cobertura_aguas_pct}% cobertura - ${item.aguas_registradas}/${item.alcaldia_total} registradas`
      })),
      cobertura_baja: lowCoverageByBarrio.map((item) => ({
        ...item,
        value: Number(item.brecha_registros || 0),
        detail: `${item.cobertura_aguas_pct}% cobertura - brecha ${item.brecha_registros}`
      })),
      servicio_dominante: serviceMajorityByBarrio.map((item) => ({
        ...item,
        value: Number(item.servicio_dominante_total || 0),
        detail: `${item.servicio_dominante}: ${item.servicio_dominante_total} usuarios`
      })),
      comparativa: comparativeByBarrio.map((item) => ({
        ...item,
        value: Number(item[padronStatsSortMetric] || 0),
        detail: `Cobertura ${item.cobertura_aguas_pct}% - brecha ${item.brecha_registros} - Aguas ${item.aguas_registradas}/${item.alcaldia_total} - candidatas ${item.candidatas_clandestinas}`
      })),
      servicios: selectedPadronServiceField
        ? (serviceBarrioRows[selectedPadronServiceField] || [])
        : serviceSplitTotals.map((item) => ({
            ...item,
            barrio_colonia: item.label,
            value: Number(item.total || 0),
            detail: `${item.total} usuarios registrados con este servicio`
          }))
    };
    const dynamicRows = dynamicRowsByMode[padronChartMode] || dynamicRowsByMode.brecha;

    return {
      barrioStats,
      metricLabels,
      comparativeByBarrio,
      serviceLabels,
      clandestineByBarrio,
      coverageHighByBarrio,
      lowCoverageByBarrio,
      serviceMajorityByBarrio,
      serviceSplitTotals,
      serviceBarrioRows,
      selectedServiceLabel: selectedPadronServiceField ? serviceLabels[selectedPadronServiceField] : "",
      requestBarriosTop,
      selectedBarrio,
      dynamicRows,
      maxDynamicRows:
        padronChartMode.includes("cobertura") || (padronChartMode === "servicios" && selectedPadronServiceField)
          ? 100
          : Math.max(1, ...dynamicRows.map((item) => Number(item.value || 0))),
      maxClandestine: Math.max(1, ...clandestineByBarrio.map((item) => Number(item.candidatas_clandestinas || 0))),
      maxLowCoverageGap: Math.max(1, ...lowCoverageByBarrio.map((item) => Number(item.brecha_registros || 0))),
      maxRequestRows: Math.max(1, ...requestBarriosTop.map((item) => Number(item.total_registros || 0)))
    };
  }, [
    alcaldiaComparison,
    padronChartMode,
    padronRequestResult,
    padronStatsBarrioFilter,
    padronStatsLimit,
    padronStatsSortDirection,
    padronStatsSortMetric,
    selectedPadronServiceField,
    selectedPadronStatBarrio
  ]);
  const aguasServiceReportData = useMemo(() => {
    const services = Array.isArray(padronServiceReport?.summary?.services) ? padronServiceReport.summary.services : [];
    const barrios = Array.isArray(padronServiceReport?.barrios) ? padronServiceReport.barrios : [];
    const totalRecords = Number(padronServiceReport?.summary?.total_records || 0);
    const selectedService = services.find((service) => service.field === selectedAguasServiceField) || services[0] || null;
    const maxServiceTotal = Math.max(1, ...services.map((service) => Number(service.active || 0)));
    const serviceRows = services.map((service) => ({
      ...service,
      detail: `${Number(service.active || 0)} con servicio activo, deuda asociada ${formatCurrency(service.deuda?.total || 0)}`
    }));
    const barrioRows = barrios
      .map((barrio) => {
        const service = (barrio.servicios || []).find((item) => item.field === selectedService?.field) || null;
        return {
          barrio_colonia: barrio.barrio_colonia,
          total_registros: Number(barrio.total_registros || 0),
          active: Number(service?.active || 0),
          inactive: Number(service?.inactive || 0),
          percentage: Number(service?.percentage || 0),
          deuda: barrio.deuda || {},
          deuda_servicio: service?.deuda || {}
        };
      })
      .filter((item) => item.total_registros > 0)
      .sort((left, right) =>
        right.active - left.active ||
        right.total_registros - left.total_registros ||
        left.barrio_colonia.localeCompare(right.barrio_colonia, "es")
      );
    const maxBarrioServiceTotal = Math.max(1, ...barrioRows.map((item) => item.active));
    const profiles = padronServiceReport?.summary?.profiles || {};

    return {
      services,
      serviceRows,
      barrios,
      barrioRows,
      selectedService,
      deuda: padronServiceReport?.summary?.deuda || {},
      totalRecords,
      maxServiceTotal,
      maxBarrioServiceTotal,
      profiles,
      hasData: totalRecords > 0
    };
  }, [padronServiceReport, selectedAguasServiceField]);
  const getAguasServiceBarrioName = useCallback((barrio = {}) => {
    const name = String(barrio.barrio_colonia || "").trim();
    return name || "Sin barrio";
  }, []);
  const selectedAguasServiceBarrioSet = useMemo(
    () => new Set(selectedAguasServiceBarrios.map((name) => String(name || "").trim()).filter(Boolean)),
    [selectedAguasServiceBarrios]
  );
  const selectedAguasServiceBarrioRows = useMemo(
    () =>
      aguasServiceReportData.barrios.filter((barrio) =>
        selectedAguasServiceBarrioSet.has(getAguasServiceBarrioName(barrio))
      ),
    [aguasServiceReportData.barrios, getAguasServiceBarrioName, selectedAguasServiceBarrioSet]
  );

  const toggleAguasServiceBarrioSelection = useCallback((barrioName) => {
    const normalizedName = String(barrioName || "").trim() || "Sin barrio";
    setSelectedAguasServiceBarrios((current) =>
      current.includes(normalizedName)
        ? current.filter((name) => name !== normalizedName)
        : [...current, normalizedName]
    );
  }, []);

  return {
    padronStatisticsData,
    aguasServiceReportData,
    getAguasServiceBarrioName,
    selectedAguasServiceBarrioRows,
    toggleAguasServiceBarrioSelection
  };
}
