import { readJsonResponse } from "../../utils/appShell";

export function createPadronAdminActions({
  alcaldiaFile,
  apiFetch,
  applyAlcaldiaSyncResult,
  clearClientPadronCaches,
  clearPadronDerivedState,
  clearSession,
  confirmingPadronBatch,
  loadPadronBatches,
  padronFile,
  runPadronSyncSteps,
  selectedPadronBatch,
  setActivatingPadronBatch,
  setAlcaldiaFile,
  setAlcaldiaSyncState,
  setConfirmingPadronBatch,
  setDashboardLastUpdatedAt,
  setDownloadingPadron,
  setDownloadingPadronBatch,
  setPadronFile,
  setReprocessingPadron,
  setUploadingAlcaldia,
  setUploadingPadron,
  setVerifyingPadronBatch,
  showAlert,
  updateAlcaldiaSyncState,
  updatePadronSyncState
}) {
  const handlePadronFileChange = (event) => {
    setPadronFile(event.target.files?.[0] ?? null);
  };

  const handleAlcaldiaFileChange = (event) => {
    setAlcaldiaFile(event.target.files?.[0] ?? null);
  };

  const handleUploadPadron = async (event) => {
    event.preventDefault();

    if (!padronFile) {
      showAlert("Selecciona un archivo Excel del padron maestro.");
      return;
    }

    setUploadingPadron(true);

    try {
      const payload = new FormData();
      payload.append("padron", padronFile);

      await runPadronSyncSteps(
        () =>
          apiFetch(`/claves/upload?_padron=${Date.now()}`, {
            method: "POST",
            body: payload
          }),
        (data) => `Padron maestro actualizado con ${data.meta?.total_records ?? 0} claves. Excel verificado al ${data.verification?.verified_percent ?? 0}%.`
      );
      setPadronFile(null);
    } catch (error) {
      updatePadronSyncState({
        status: "error",
        progress: 100,
        message: error.message || "No se pudo actualizar el padron maestro."
      });
      showAlert(error.message || "No se pudo actualizar el padron maestro.");
    } finally {
      setUploadingPadron(false);
    }
  };

  const handleActivatePadronBatch = async () => {
    if (!selectedPadronBatch) {
      showAlert("Selecciona un lote FoxPro.");
      return;
    }
    if (!["LISTO", "PARCIALMENTE_APLICADO", "APLICADO"].includes(selectedPadronBatch.estado)) {
      showAlert(`El lote esta en estado ${selectedPadronBatch.estado} y todavia no puede activarse.`);
      return;
    }
    setConfirmingPadronBatch(selectedPadronBatch);
  };

  const confirmActivatePadronBatch = async () => {
    if (!confirmingPadronBatch) return;

    const batch = confirmingPadronBatch;
    setConfirmingPadronBatch(null);

    setActivatingPadronBatch(true);
    try {
      await runPadronSyncSteps(
        () => apiFetch(`/integracion/foxpro/lotes/${encodeURIComponent(batch.codigo_lote)}/activar`, { method: "POST" }),
        (data) => `Lote ${batch.codigo_lote} activado con ${data.meta?.total_records ?? 0} claves. Cache y consultas anteriores limpiadas.`,
        "lote FoxPro"
      );
      await loadPadronBatches({ silent: true });
    } catch (error) {
      updatePadronSyncState({ status: "error", progress: 100, message: error.message || "No se pudo activar el lote FoxPro." });
      showAlert(error.message || "No se pudo activar el lote FoxPro.");
    } finally {
      setActivatingPadronBatch(false);
    }
  };

  const handleVerifyPadronBatch = async () => {
    if (!selectedPadronBatch) return;
    setVerifyingPadronBatch(true);
    try {
      const response = await apiFetch(`/integracion/foxpro/lotes/${encodeURIComponent(selectedPadronBatch.codigo_lote)}/verificar`);
      const data = await readJsonResponse(response, "La API no devolvio el resultado de la verificacion.");
      if (!response.ok) throw new Error(data.message || "No fue posible verificar el lote.");
      const verification = data.verification;
      updatePadronSyncState({
        status: verification.ok ? "complete" : "error",
        progress: verification.verified_percent,
        message: verification.ok
          ? `Verificado: ${verification.selected_lot} es el padron activo`
          : `No coincide: el padron activo es ${verification.active_lot || "desconocido"}`,
        verification
      });
      showAlert(verification.ok
        ? `Verificacion 100% correcta. El lote ${verification.selected_lot} esta activo con ${verification.active_records.toLocaleString("es-HN")} registros${verification.excluded_invalid_keys ? `; ${verification.excluded_invalid_keys.toLocaleString("es-HN")} filas sin clave valida fueron excluidas` : ""}.`
        : `El lote seleccionado no coincide completamente con el padron activo. Coincidencia: ${verification.verified_percent}%.`);
    } catch (error) {
      showAlert(error.message || "No fue posible verificar el lote.");
    } finally {
      setVerifyingPadronBatch(false);
    }
  };

  const handleUploadAlcaldia = async (event) => {
    event.preventDefault();

    if (!alcaldiaFile) {
      showAlert("Selecciona un archivo Excel del padron de alcaldia.");
      return;
    }

    setUploadingAlcaldia(true);
    let progressTimer = null;
    updateAlcaldiaSyncState({
      status: "running",
      progress: 8,
      message: "Iniciando reemplazo del padron de alcaldia"
    });
    clearClientPadronCaches();
    updateAlcaldiaSyncState({ progress: 24, message: "Cache local y comparativas anteriores borradas" });
    progressTimer = window.setInterval(() => {
      setAlcaldiaSyncState((current) => {
        if (current.status !== "running" || current.progress >= 68) return current;
        return {
          ...current,
          progress: Math.min(68, current.progress + 4),
          message: current.progress >= 48 ? "Verificando columnas y claves catastrales" : "Reemplazando data de alcaldia en consultas"
        };
      });
    }, 420);

    try {
      const payload = new FormData();
      payload.append("padron", alcaldiaFile);

      const response = await apiFetch("/claves/alcaldia/upload", {
        method: "POST",
        body: payload
      });
      const data = await readJsonResponse(
        response,
        "La API no devolvio JSON. Revisa que el backend este disponible y que la base de datos este lista."
      );

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No se pudo actualizar el padron de alcaldia.");
      }

      updateAlcaldiaSyncState({ progress: 72, message: "Data de alcaldia reemplazada en el sistema" });
      applyAlcaldiaSyncResult(data);
      setAlcaldiaFile(null);
      clearPadronDerivedState();
      setDashboardLastUpdatedAt(Date.now());
      showAlert(`Padron de alcaldia actualizado con ${data.meta?.total_records ?? 0} claves.`);
    } catch (error) {
      updateAlcaldiaSyncState({
        status: "error",
        progress: 100,
        message: error.message || "No se pudo actualizar el padron de alcaldia."
      });
      showAlert(error.message || "No se pudo actualizar el padron de alcaldia.");
    } finally {
      if (progressTimer) window.clearInterval(progressTimer);
      setUploadingAlcaldia(false);
    }
  };

  const handleReprocessPadron = async () => {
    setReprocessingPadron(true);

    try {
      await runPadronSyncSteps(
        () =>
          apiFetch(`/claves/sync?_padron=${Date.now()}`, {
            method: "POST"
          }),
        (data) => `Padron maestro sincronizado con ${data.meta?.total_records ?? 0} claves. Verificacion global ${data.verification?.verified_percent ?? 0}%.`
      );
    } catch (error) {
      updatePadronSyncState({
        status: "error",
        progress: 100,
        message: error.message || "No se pudo reprocesar el padron maestro."
      });
      showAlert(error.message || "No se pudo reprocesar el padron maestro.");
    } finally {
      setReprocessingPadron(false);
    }
  };

  // Baja un Excel del API respetando el nombre que manda el servidor.
  const downloadExcelFile = async (path, { fallbackName, errorMessage }) => {
    const response = await apiFetch(path);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || errorMessage);
    }

    const blob = await response.blob();
    const contentType = response.headers.get("Content-Type") || blob.type || "";
    const isExcelResponse =
      contentType.includes("spreadsheet") ||
      contentType.includes("vnd.ms-excel") ||
      contentType.includes("octet-stream");

    if (!isExcelResponse) {
      const message = await blob.text().catch(() => "");
      throw new Error(
        message.includes("<!doctype") || message.includes("<html")
          ? "El servidor devolvio una pagina web en lugar del padron. Revisa la URL del API configurada."
          : "El servidor no devolvio un archivo Excel valido."
      );
    }

    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const contentDisposition = response.headers.get("Content-Disposition") || "";
    const fileNameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i);

    link.href = downloadUrl;
    link.download = decodeURIComponent(fileNameMatch?.[1] || fileNameMatch?.[2] || fallbackName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  };

  const handleDownloadPadron = async () => {
    setDownloadingPadron(true);
    try {
      await downloadExcelFile("/claves/download", {
        fallbackName: `padron-maestro-${new Date().toISOString().slice(0, 10)}.xlsx`,
        errorMessage: "No se pudo descargar el padron maestro."
      });
      showAlert("Descarga del padron iniciada.");
    } catch (error) {
      showAlert(error.message || "No se pudo descargar el padron maestro.");
    } finally {
      setDownloadingPadron(false);
    }
  };

  const handleDownloadPadronBatch = async () => {
    if (!selectedPadronBatch) return;
    setDownloadingPadronBatch(true);
    try {
      await downloadExcelFile(`/integracion/foxpro/lotes/${encodeURIComponent(selectedPadronBatch.codigo_lote)}/excel`, {
        fallbackName: `padron-${selectedPadronBatch.codigo_lote}.xlsx`,
        errorMessage: "No se pudo descargar el lote en Excel."
      });
      showAlert(`Descarga del lote ${selectedPadronBatch.codigo_lote} en Excel iniciada.`);
    } catch (error) {
      showAlert(error.message || "No se pudo descargar el lote en Excel.");
    } finally {
      setDownloadingPadronBatch(false);
    }
  };

  return {
    handlePadronFileChange,
    handleAlcaldiaFileChange,
    handleUploadPadron,
    handleActivatePadronBatch,
    confirmActivatePadronBatch,
    handleVerifyPadronBatch,
    handleUploadAlcaldia,
    handleReprocessPadron,
    handleDownloadPadron,
    handleDownloadPadronBatch
  };
}
