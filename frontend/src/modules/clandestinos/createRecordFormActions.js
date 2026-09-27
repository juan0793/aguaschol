import { DRAFT_SAVED_AT_STORAGE_KEY, DRAFT_STORAGE_KEY } from "../../constants/storageKeys";
import { emptyForm } from "../../constants/formsAndUi";
import { normalizeRecord } from "../../utils/datesAndBusiness";
import { withBarrioFromPrefix } from "../../utils/barrioCodes";

export function createRecordFormActions({
  apiFetch,
  form,
  getRecordBarrioName,
  loadRecords,
  safeBarrioCodes,
  search,
  setDraftForm,
  setForm,
  setPendingDeleteRecord,
  setProcessingRecordId,
  setRecordFilters,
  setRecordQuickFilter,
  setRecords,
  setSelectedFile,
  sheetRef,
  showAlert
}) {
  const applyRecord = (record) => {
    setForm(withBarrioFromPrefix({ ...emptyForm, ...normalizeRecord(record) }, safeBarrioCodes));
    setSelectedFile(null);
  };

  const findAlcaldiaMatchForForm = async (candidateForm = form, options = {}) => {
    const { allowTextFallback = true } = options;
    const keyQuery = String(candidateForm.clave_catastral || "").trim();
    const textQueries = [
      candidateForm.nombre_catastral,
      candidateForm.inquilino,
      candidateForm.identidad,
      candidateForm.barrio_colonia
    ]
      .map((value) => String(value || "").trim())
      .filter((value) => value.length >= 3);

    const tryQuery = async (query, field) => {
      const response = await apiFetch(`/claves/alcaldia/search?field=${field}&clave=${encodeURIComponent(query)}`);
      if (!response.ok) return null;
      const data = await response.json();
      const matches = Array.isArray(data.matches) ? data.matches : [];
      return matches[0] ?? null;
    };

    if (keyQuery) {
      const match = await tryQuery(keyQuery, "clave");
      if (match) return match;
    }

    if (allowTextFallback) {
      for (const query of textQueries) {
        const match = await tryQuery(query, "texto");
        if (match) return match;
      }
    }

    return null;
  };

  const getAlcaldiaValidationComment = (match, record) => {
    if (!match) return "No concuerda con clave de Alcaldia. Clandestino";
    if (match.exists_in_aguas) return "Aparece en varios padrones";
    return record?.comentarios || "Concuerda con Alcaldia y no aparece en Aguas. Clandestino";
  };

  const buildAlcaldiaValidationPayload = (record, match) => {
    const nextState = match?.exists_in_aguas ? "varios_padrones" : "clandestino";
    return {
      ...record,
      estado_padron: nextState,
      clave_alcaldia: match?.clave_catastral || "",
      nombre_alcaldia: match?.nombre || record.nombre_alcaldia || "",
      barrio_alcaldia: match?.caserio || match?.direccion || record.barrio_alcaldia || "",
      nombre_catastral: match?.nombre || record.nombre_catastral,
      barrio_colonia: getRecordBarrioName(record, "") || match?.caserio || match?.direccion || "",
      identidad: record.identidad || match?.identificador || "",
      comentarios: getAlcaldiaValidationComment(match, record)
    };
  };

  const handleValidatePrintRecord = async (record) => {
    if (!record?.id) return;

    setProcessingRecordId(record.id);
    try {
      const match = await findAlcaldiaMatchForForm(record, { allowTextFallback: false });
      const payload = buildAlcaldiaValidationPayload(record, match);

      const response = await apiFetch(`/inmuebles/${record.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No fue posible actualizar la validacion.");
      }

      const normalized = normalizeRecord(data);
      setRecords((current) => current.map((item) => (item.id === normalized.id ? normalized : item)));
      if (form.id === normalized.id) {
        setForm({ ...emptyForm, ...normalized });
      }
      showAlert(
        !match
          ? `Ficha ${normalized.clave_catastral} no concuerda con Alcaldia. Quedo clandestina.`
          : match.exists_in_aguas
          ? `Ficha ${normalized.clave_catastral} validada: aparece en varios padrones.`
          : `Ficha ${normalized.clave_catastral} validada como clandestina.`
      );
    } catch (error) {
      showAlert(error.message || "No fue posible validar la ficha desde impresion.");
    } finally {
      setProcessingRecordId(null);
    }
  };

  const focusSheet = () => {
    window.requestAnimationFrame(() => {
      sheetRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  };

  const handleSelectRecord = (record) => {
    applyRecord(record);
    focusSheet();
  };

  const resetForm = () => {
    setRecordQuickFilter("all");
    setRecordFilters({
      clave: "",
      barrio: "",
      responsible: "",
      date_from: "",
      date_to: "",
      status: "all"
    });
    setForm(emptyForm);
    setDraftForm(null);
    setSelectedFile(null);
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    window.localStorage.removeItem(DRAFT_SAVED_AT_STORAGE_KEY);
    focusSheet();
  };

  const handleDeleteArchivedRecord = async (record) => {
    if (!record?.id) return;

    try {
      const response = await apiFetch(`/inmuebles/${record.id}`, {
        method: "DELETE"
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo eliminar la ficha archivada.");
      }

      if (form.id === record.id) {
        resetForm();
      }

      setPendingDeleteRecord(null);
      showAlert(`Ficha ${data.inmueble?.clave_catastral || record.clave_catastral} eliminada del registro archivado.`);
      loadRecords(search, "archived");
    } catch (error) {
      showAlert(error.message || "No se pudo eliminar la ficha archivada.");
    }
  };

  return {
    applyRecord,
    handleValidatePrintRecord,
    focusSheet,
    handleSelectRecord,
    resetForm,
    handleDeleteArchivedRecord
  };
}
