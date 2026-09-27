import { emptyBarrioForm } from "../../components/BarrioCodesWorkspace";
import { normalizeBarrioCode } from "../../utils/barrioCodes";

export function createBarrioCodeActions({
  apiFetch,
  barrioCodeForm,
  clearSession,
  isAuthenticated,
  setBarrioCodeForm,
  setBarrioCodes,
  setLoadingBarrioCodes,
  setSavingBarrioCode,
  showAlert
}) {
  const loadBarrioCodes = async ({ silent = false } = {}) => {
    if (!isAuthenticated) return;
    if (!silent) {
      setLoadingBarrioCodes(true);
    }

    try {
      const response = await apiFetch("/barrios");
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible cargar los codigos de barrios.");
      }

      setBarrioCodes(Array.isArray(data.barrios) ? data.barrios : []);
    } catch (error) {
      if (!silent) {
        showAlert(error.message || "No fue posible cargar los codigos de barrios.");
      }
    } finally {
      if (!silent) {
        setLoadingBarrioCodes(false);
      }
    }
  };

  const handleBarrioCodeFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setBarrioCodeForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : name === "codigo" ? normalizeBarrioCode(value) : value
    }));
  };

  const handleResetBarrioCodeForm = () => {
    setBarrioCodeForm(emptyBarrioForm);
  };

  const handlePrepareAddBarrioCode = (codigo = "") => {
    setBarrioCodeForm({
      ...emptyBarrioForm,
      codigo: normalizeBarrioCode(codigo)
    });
  };

  const handleEditBarrioCode = (item) => {
    setBarrioCodeForm({
      codigo: item.codigo || "",
      barrio: item.barrio || "",
      activo: item.activo !== false
    });
  };

  const handleSaveBarrioCode = async (event) => {
    event.preventDefault();
    setSavingBarrioCode(true);

    try {
      const response = await apiFetch("/barrios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(barrioCodeForm)
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible guardar el codigo de barrio.");
      }

      setBarrioCodes(Array.isArray(data.barrios) ? data.barrios : []);
      setBarrioCodeForm(emptyBarrioForm);
      showAlert(`Codigo ${data.item?.codigo || ""} guardado.`);
    } catch (error) {
      showAlert(error.message || "No fue posible guardar el codigo de barrio.");
    } finally {
      setSavingBarrioCode(false);
    }
  };

  const handleDeleteBarrioCode = async (codigo) => {
    if (!window.confirm(`Eliminar el codigo ${codigo}?`)) return;
    setSavingBarrioCode(true);

    try {
      const response = await apiFetch(`/barrios/${encodeURIComponent(codigo)}`, {
        method: "DELETE"
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible eliminar el codigo de barrio.");
      }

      setBarrioCodes(Array.isArray(data.barrios) ? data.barrios : []);
      setBarrioCodeForm((current) => (current.codigo === codigo ? emptyBarrioForm : current));
      showAlert(`Codigo ${codigo} eliminado.`);
    } catch (error) {
      showAlert(error.message || "No fue posible eliminar el codigo de barrio.");
    } finally {
      setSavingBarrioCode(false);
    }
  };

  return {
    loadBarrioCodes,
    handleBarrioCodeFormChange,
    handleResetBarrioCodeForm,
    handlePrepareAddBarrioCode,
    handleEditBarrioCode,
    handleSaveBarrioCode,
    handleDeleteBarrioCode
  };
}
