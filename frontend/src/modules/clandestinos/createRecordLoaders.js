import { normalizeRecord } from "../../utils/datesAndBusiness";

export function createRecordLoaders({
  apiFetch,
  clearSession,
  isAdmin,
  isAuthenticated,
  recordView,
  setRecordView,
  setRecords,
  showAlert
}) {
  const loadRecords = async (query = "", view = recordView, options = {}) => {
    const { silent = false } = options;

    if (!isAuthenticated) return;
    if (!isAdmin && view === "archived") {
      setRecordView("active");
      return;
    }
    try {
      const response = await apiFetch(
        `/inmuebles?q=${encodeURIComponent(query)}&archived=${view === "archived"}`,
        { revalidate: true }
      );
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        if (response.status === 403 && view === "archived" && !isAdmin) {
          setRecordView("active");
          return;
        }

        throw new Error(data.message || "No fue posible cargar los registros.");
      }

      const list = Array.isArray(data) ? data.map(normalizeRecord) : [];
      setRecords(list);
    } catch (_error) {
      if (!silent) {
        setRecords([]);
        showAlert("No fue posible cargar los registros.");
      }
    }
  };

  const loadRecordSummary = async ({ silent = false } = {}) => {
    if (!isAuthenticated || !isAdmin) return;

    try {
      const response = await apiFetch("/inmuebles/summary");
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }
        throw new Error(data.message || "No fue posible cargar el resumen de fichas.");
      }

      setRecords(Array.isArray(data) ? data.map(normalizeRecord) : []);
    } catch (error) {
      if (!silent) showAlert(error.message || "No fue posible cargar el resumen de fichas.");
    }
  };

  return { loadRecords, loadRecordSummary };
}
