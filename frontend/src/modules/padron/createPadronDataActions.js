import { LOOKUP_HISTORY_STORAGE_KEY } from "../../constants/storageKeys";
import { readJsonResponse } from "../../utils/appShell";

export function createPadronDataActions({
  apiFetch,
  clearSession,
  isAdmin,
  isAuthenticated,
  padronRequestForm,
  padronRequestTemplates,
  persistLookupHistory,
  setAlcaldiaComparison,
  setAlcaldiaImportSummary,
  setAlcaldiaMeta,
  setAlcaldiaSyncState,
  setDashboardLastUpdatedAt,
  setFieldDebtReport,
  setLoadingAlcaldiaComparison,
  setLoadingAlcaldiaMeta,
  setLoadingPadronBatches,
  setLoadingPadronMeta,
  setLoadingPadronRequest,
  setLoadingPadronRequestMeta,
  setLoadingPadronServiceReport,
  setLookupFeedback,
  setLookupQuery,
  setLookupResult,
  setPadronBatches,
  setPadronChartMode,
  setPadronChartType,
  setPadronImportSummary,
  setPadronMeta,
  setPadronRequestForm,
  setPadronRequestLoadError,
  setPadronRequestResult,
  setPadronRequestTemplates,
  setPadronServiceReport,
  setPadronStatsBarrioFilter,
  setPadronStatsSortDirection,
  setPadronStatsSortMetric,
  setPadronSyncState,
  setSelectedAguasServiceField,
  setSelectedPadronBatchCode,
  setSelectedPadronServiceField,
  setSelectedPadronStatBarrio,
  setShowFieldDebtModal,
  showAlert,
  workspaceView
}) {
  const clearPadronDerivedState = () => {
    setLookupResult(null);
    setLookupFeedback("");
    setPadronRequestResult(null);
    setPadronServiceReport(null);
    setAlcaldiaComparison(null);
    setFieldDebtReport(null);
    setShowFieldDebtModal(false);
    setSelectedAguasServiceField("agua");
    setSelectedPadronStatBarrio("");
    setSelectedPadronServiceField("");
    setPadronStatsBarrioFilter("");
    setPadronStatsSortMetric("brecha_registros");
    setPadronStatsSortDirection("desc");
    setPadronChartMode("brecha");
    setPadronChartType("barras");
  };

  const clearClientPadronCaches = () => {
    persistLookupHistory([]);
    window.sessionStorage?.removeItem?.(LOOKUP_HISTORY_STORAGE_KEY);
    setLookupQuery("");
    clearPadronDerivedState();
  };

  const updatePadronSyncState = (patch) => {
    setPadronSyncState((current) => ({ ...current, ...patch }));
  };

  const updateAlcaldiaSyncState = (patch) => {
    setAlcaldiaSyncState((current) => ({ ...current, ...patch }));
  };

  const applyPadronSyncResult = (data = {}) => {
    setPadronMeta(data.meta ?? null);
    setPadronImportSummary(data.import_summary ?? data.meta?.last_import_summary ?? null);
    updatePadronSyncState({
      status: "complete",
      progress: 100,
      message: "Padron verificado y listo para consultas",
      verification: data.verification ?? null
    });
    if (workspaceView === "requests") {
      loadPadronServiceReport({ silent: true });
    }
  };

  const applyAlcaldiaSyncResult = (data = {}) => {
    setAlcaldiaMeta(data.meta ?? null);
    setAlcaldiaImportSummary(data.import_summary ?? data.meta?.last_import_summary ?? null);
    updateAlcaldiaSyncState({
      status: "complete",
      progress: 100,
      message: "Padron de alcaldia sincronizado"
    });
  };

  const runPadronSyncSteps = async (request, successMessage, sourceLabel = "Excel") => {
    let progressTimer = null;
    updatePadronSyncState({
      status: "running",
      progress: 8,
      message: "Iniciando reemplazo del padron maestro",
      verification: null
    });
    clearClientPadronCaches();
    updatePadronSyncState({ progress: 24, message: "Cache local y resultados anteriores borrados" });
    progressTimer = window.setInterval(() => {
      setPadronSyncState((current) => {
        if (current.status !== "running" || current.progress >= 68) return current;
        return {
          ...current,
          progress: Math.min(68, current.progress + 4),
          message: current.progress >= 48 ? `Verificando ${sourceLabel} completo contra el sistema` : "Reemplazando data de padron en todos los modulos"
        };
      });
    }, 420);

    try {
      const response = await request();
      const data = await readJsonResponse(
        response,
        "La API no devolvio JSON. Revisa que el backend este disponible y que la base de datos este lista."
      );

      if (!response.ok) {
        if (response.status >= 500 && !data.message) {
          throw new Error("No se pudo conectar correctamente con la API. Revisa que el backend este disponible.");
        }
        if (response.status === 401) {
          clearSession();
        }
        throw new Error(data.message || "No se pudo sincronizar el padron maestro.");
      }

      updatePadronSyncState({ progress: 72, message: "Data del padron reemplazada en el sistema" });
      applyPadronSyncResult(data);
      setDashboardLastUpdatedAt(Date.now());
      showAlert(successMessage(data));
      return data;
    } finally {
      if (progressTimer) window.clearInterval(progressTimer);
    }
  };

  const loadPadronMeta = async ({ silent = false } = {}) => {
    if (!isAuthenticated || !isAdmin) return;
    if (!silent) {
      setLoadingPadronMeta(true);
    }

    try {
      const response = await apiFetch("/claves/meta");
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible cargar la información del padrón.");
      }

      setPadronMeta(data.meta ?? null);
      setPadronImportSummary(data.meta?.last_import_summary ?? null);
    } catch (error) {
      if (!silent) {
        showAlert(error.message || "No fue posible cargar la información del padrón.");
      }
    } finally {
      if (!silent) {
        setLoadingPadronMeta(false);
      }
    }
  };

  const loadPadronBatches = async ({ silent = false } = {}) => {
    if (!isAuthenticated || !isAdmin) return;
    if (!silent) setLoadingPadronBatches(true);
    try {
      const response = await apiFetch("/integracion/foxpro/lotes?limit=500");
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No fue posible cargar los lotes FoxPro.");
      const rows = Array.isArray(data.rows) ? data.rows : [];
      setPadronBatches(rows);
      setSelectedPadronBatchCode((current) => rows.some((row) => row.codigo_lote === current) ? current : rows[0]?.codigo_lote || "");
    } catch (error) {
      if (!silent) showAlert(error.message || "No fue posible cargar los lotes FoxPro.");
    } finally {
      if (!silent) setLoadingPadronBatches(false);
    }
  };

  const loadAlcaldiaMeta = async ({ silent = false } = {}) => {
    if (!isAuthenticated || !isAdmin) return;
    if (!silent) {
      setLoadingAlcaldiaMeta(true);
    }

    try {
      const response = await apiFetch("/claves/alcaldia/meta");
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesión venció. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible cargar el padrón de alcaldía.");
      }

      setAlcaldiaMeta(data.meta ?? null);
      setAlcaldiaImportSummary(data.meta?.last_import_summary ?? null);
    } catch (error) {
      if (!silent) {
        showAlert(error.message || "No fue posible cargar el padrón de alcaldía.");
      }
    } finally {
      if (!silent) {
        setLoadingAlcaldiaMeta(false);
      }
    }
  };

  const loadAlcaldiaComparison = async ({ silent = false } = {}) => {
    if (!isAuthenticated || !isAdmin) return;
    setLoadingAlcaldiaComparison(true);

    try {
      const response = await apiFetch("/claves/alcaldia/compare");
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesión venció. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible comparar los padrones.");
      }

      setAlcaldiaComparison(data);
      if (!silent) {
        showAlert(`Comparacion lista: ${data.summary?.candidate_clandestine ?? 0} claves de alcaldia no aparecen en Aguas.`);
      }
      return data;
    } catch (error) {
      if (!silent) {
        showAlert(error.message || "No fue posible comparar los padrones.");
      }
      return null;
    } finally {
      setLoadingAlcaldiaComparison(false);
    }
  };

  const loadPadronRequestMeta = async ({ silent = false } = {}) => {
    if (!isAuthenticated || !isAdmin) return;
    if (!silent) {
      setLoadingPadronRequestMeta(true);
    }

    try {
      const response = await apiFetch("/claves/requests/meta");
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible cargar las plantillas de peticiones.");
      }

      const templates = Array.isArray(data.templates) ? data.templates : [];
      setPadronRequestLoadError("");
      setPadronRequestTemplates(templates);
      if (templates.length) {
        const currentTemplate =
          templates.find((template) => template.id === padronRequestForm.preset_id) ?? templates[0];

        setPadronRequestForm((current) => ({
          ...current,
          preset_id: currentTemplate.id,
          title: current.title || currentTemplate.title || "",
          description: current.description || currentTemplate.description || "",
          keywords: current.keywords || (currentTemplate.keywords || []).join(", ")
        }));
      }
    } catch (error) {
      setPadronRequestLoadError(error.message || "No fue posible cargar las plantillas de peticiones.");
      if (!silent) {
        showAlert(error.message || "No fue posible cargar las plantillas de peticiones.");
      }
    } finally {
      if (!silent) {
        setLoadingPadronRequestMeta(false);
      }
    }
  };

  const loadPadronServiceReport = async ({ silent = false } = {}) => {
    if (!isAuthenticated || !isAdmin) return;
    setLoadingPadronServiceReport(true);

    try {
      const response = await apiFetch("/claves/services/report");
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible cargar el informe de servicios del padron.");
      }

      setPadronServiceReport(data);
      setPadronRequestLoadError("");
      if (!silent) {
        showAlert(`Informe actualizado: ${data.summary?.total_records ?? 0} registros del padron maestro.`);
      }
    } catch (error) {
      setPadronRequestLoadError(error.message || "No fue posible cargar el informe de servicios del padron.");
      if (!silent) {
        showAlert(error.message || "No fue posible cargar el informe de servicios del padron.");
      }
    } finally {
      setLoadingPadronServiceReport(false);
    }
  };

  const handlePadronRequestFormChange = (event) => {
    const { name, value } = event.target;
    setPadronRequestForm((current) => ({ ...current, [name]: value }));
  };

  const handlePadronRequestPresetChange = (event) => {
    const nextPresetId = event.target.value;
    const selectedTemplate = padronRequestTemplates.find((template) => template.id === nextPresetId);

    setPadronRequestForm((current) => ({
      ...current,
      preset_id: nextPresetId,
      title: selectedTemplate?.title || current.title,
      description: selectedTemplate?.description || current.description,
      keywords: (selectedTemplate?.keywords || []).join(", ") || current.keywords
    }));
  };

  const handleRunPadronRequest = async (event) => {
    if (event) {
      event.preventDefault();
    }

    const keywords = String(padronRequestForm.keywords || "")
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean);

    if (!keywords.length) {
      showAlert("Debes indicar al menos una palabra clave para generar la peticion.");
      return;
    }

    setLoadingPadronRequest(true);

    try {
      const response = await apiFetch("/claves/requests/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          preset_id: padronRequestForm.preset_id,
          title: padronRequestForm.title,
          description: padronRequestForm.description,
          keywords
        })
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible generar la peticion.");
      }

      setPadronRequestResult(data);
      showAlert(`Peticion generada con ${data.summary?.total_registros ?? 0} registros.`);
    } catch (error) {
      showAlert(error.message || "No fue posible generar la peticion.");
    } finally {
      setLoadingPadronRequest(false);
    }
  };

  return {
    clearPadronDerivedState,
    clearClientPadronCaches,
    updatePadronSyncState,
    updateAlcaldiaSyncState,
    applyAlcaldiaSyncResult,
    runPadronSyncSteps,
    loadPadronMeta,
    loadPadronBatches,
    loadAlcaldiaMeta,
    loadAlcaldiaComparison,
    loadPadronRequestMeta,
    loadPadronServiceReport,
    handlePadronRequestFormChange,
    handlePadronRequestPresetChange,
    handleRunPadronRequest
  };
}
