import { emptyForm } from "../../constants/formsAndUi";
import { escapeHtml } from "../../utils/html";
import { formatLookupAmount, getLookupTotalMeta } from "../../utils/formatting";
import { getLookupServiceMeta } from "../../utils/claveAndLookup";
import logoAguasCholuteca from "../../assets/logo-aguas-choluteca.png";
import { normalizeRecord } from "../../utils/datesAndBusiness";
import { printDocument } from "../../utils/printDocument";
import { withBarrioFromPrefix } from "../../utils/barrioCodes";

export function createLookupRecordBridge({
  apiFetch,
  applyRecord,
  clearSession,
  focusSheet,
  safeBarrioCodes,
  setForm,
  setRecordFilters,
  setRecordQuickFilter,
  setSelectedFile,
  setWorkspaceView,
  showAlert
}) {
  const startNewRecordFromLookup = (patch = {}, alertMessage = "Ficha nueva preparada desde la consulta.") => {
    const nextForm = {
      ...emptyForm,
      ...patch,
      id: null,
      foto_path: ""
    };
    const enrichedForm = withBarrioFromPrefix(nextForm, safeBarrioCodes);

    setRecordQuickFilter("all");
    setRecordFilters({
      clave: enrichedForm.clave_catastral || "",
      barrio: "",
      responsible: "",
      date_from: "",
      date_to: "",
      status: "all"
    });
    setForm(enrichedForm);
    setSelectedFile(null);
    setWorkspaceView("records");
    showAlert(alertMessage);
    focusSheet();
  };

  const padronFlagToRecordValue = (value = "") => {
    const normalized = String(value ?? "").trim().toUpperCase();
    if (normalized === "S") return "Si";
    if (normalized === "N") return "No";
    return "";
  };

  const buildRecordPatchFromAguasMatch = (match = {}) =>
    withBarrioFromPrefix(
      {
        clave_catastral: match.clave_catastral || "",
        abonado: match.abonado || "",
        nombre_catastral: match.nombre || "",
        inquilino: match.inquilino || "",
        barrio_colonia: match.barrio_colonia || "",
        conexion_agua: padronFlagToRecordValue(match.agua),
        conexion_alcantarillado: padronFlagToRecordValue(match.alcantarillado),
        recoleccion_desechos: padronFlagToRecordValue(match.recoleccion),
        estado_padron: "varios_padrones"
      },
      safeBarrioCodes
    );

  const openLookupMatchInRecord = async (match) => {
    try {
      const response = await apiFetch(`/inmuebles/clave/${encodeURIComponent(match.clave_catastral)}`);

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        if (response.status === 404) {
          showAlert("No existe ficha guardada para esa clave. El reporte del padron si puede generarse desde este modulo.");
          return;
        }

        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "No fue posible abrir la ficha para esta clave.");
      }

      const nextRecord = normalizeRecord(await response.json());
      const nextForm = {
        ...nextRecord,
        ...buildRecordPatchFromAguasMatch(match),
        id: nextRecord.id,
        foto_path: nextRecord.foto_path || "",
        comentarios: nextRecord.comentarios || "Datos actualizados desde padron Aguas"
      };
      setWorkspaceView("records");
      setRecordQuickFilter("all");
      setRecordFilters({
        clave: nextRecord.clave_catastral || "",
        barrio: "",
        responsible: "",
        date_from: "",
        date_to: "",
        status: "all"
      });
      setSelectedFile(null);
      applyRecord(nextForm);
      showAlert(`Ficha cargada con datos actualizados del padron para ${nextForm.clave_catastral}. Guarda la ficha para conservarlos.`);
    } catch (error) {
      showAlert(error.message || "No fue posible abrir la ficha para esa clave.");
    }
  };

  const handlePrintLookupMatchReport = async (match) => {
    const totalMeta = getLookupTotalMeta(match?.total);
    const valor = Number(match?.valor ?? 0);
    const intereses = Number(match?.intereses ?? 0);
    const total = Number(match?.total ?? 0);
    const services = [
      { label: "Agua", value: match?.agua, icon: "water" },
      { label: "Alcantarillado", value: match?.alcantarillado, icon: "sewer" },
      { label: "Barrido", value: match?.barrido, icon: "broom" },
      { label: "Desechos / tren de aseo", value: match?.recoleccion, icon: "refresh" },
      { label: "Desechos peligrosos", value: match?.desechos_peligrosos, icon: "waste" }
    ];

    const serviceMarkup = services
      .map((service) => {
        const serviceMeta = getLookupServiceMeta(service.value);
        return `
          <div class="lookup-report-service ${serviceMeta.tone}">
            <strong>${escapeHtml(service.label)}</strong>
            <span>${escapeHtml(serviceMeta.label)}</span>
          </div>
        `;
      })
      .join("");

    await printDocument(
      `Reporte ${match?.clave_catastral || "consulta-padron"}`,
      `
        <div class="lookup-report-shell">
          <header class="lookup-report-header">
            <div class="lookup-report-brand">
              <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" />
              <div>
                <p class="field-report-kicker">Aguas de Choluteca, S.A. de C.V.</p>
                <h1>Reporte de consulta por clave</h1>
                <p>Resumen financiero y de servicios consultado desde el padron maestro.</p>
              </div>
            </div>
            <div class="lookup-report-key">Clave catastral: ${escapeHtml(match?.clave_catastral || "--")}</div>
          </header>

          <section class="lookup-report-section">
            <div class="lookup-report-grid">
              <div><strong>Nombre</strong><span>${escapeHtml(match?.inquilino || "Sin nombre asociado")}</span></div>
              <div><strong>Abonado</strong><span>${escapeHtml(match?.abonado || "--")}</span></div>
              <div><strong>Zona</strong><span>${escapeHtml(match?.barrio_colonia || "--")}</span></div>
              <div><strong>Estado</strong><span>${escapeHtml(totalMeta.helper)}</span></div>
            </div>
          </section>

          <section class="lookup-report-section">
            <h2>Detalle de saldo</h2>
            <div class="lookup-report-balance-grid">
              <div><strong>Sin interes</strong><span>${formatLookupAmount(valor)}</span></div>
              <div><strong>Interes</strong><span>${formatLookupAmount(intereses)}</span></div>
              <div class="is-total"><strong>Total</strong><span>${escapeHtml(totalMeta.text)}</span></div>
            </div>
            <div class="lookup-report-formula">
              <strong>Sumatoria</strong>
              <span>${formatLookupAmount(valor)} + ${formatLookupAmount(intereses)} = ${formatLookupAmount(total)}</span>
            </div>
          </section>

          <section class="lookup-report-section">
            <h2>Servicios registrados</h2>
            <div class="lookup-report-service-grid">
              ${serviceMarkup}
            </div>
          </section>
        </div>
      `,
      {
        bodyClassName: "lookup-report-body",
        pageSize: "Letter portrait",
        pageMargin: "10mm"
      }
    );

    showAlert(`Reporte de saldo y servicios generado para la clave ${match?.clave_catastral || "--"}.`);
  };

  return {
    startNewRecordFromLookup,
    buildRecordPatchFromAguasMatch,
    openLookupMatchInRecord,
    handlePrintLookupMatchReport
  };
}
