import { escapeHtml } from "../../utils/html";
import { formatLookupAmount, getLookupTotalMeta } from "../../utils/formatting";
import { getLookupServiceMeta } from "../../utils/claveAndLookup";
import logoAguasCholuteca from "../../assets/logo-aguas-choluteca.png";
import { printDocument } from "../../utils/printDocument";
import { withBarrioFromPrefix } from "../../utils/barrioCodes";

// La consulta ya no llena el formulario legado de App: pide a Clandestinos
// (vista "records") que abra su propia ficha, nueva o existente, con los
// datos precargados. Nada se guarda hasta que el usuario pulse "Guardar ficha".
export function createLookupRecordBridge({
  apiFetch,
  clearSession,
  navigateWithFocus,
  safeBarrioCodes,
  showAlert
}) {
  const startNewRecordFromLookup = (patch = {}, alertMessage = "Ficha nueva preparada desde la consulta.") => {
    const values = withBarrioFromPrefix(patch, safeBarrioCodes);
    navigateWithFocus("records", {
      action: "new",
      clave_catastral: values.clave_catastral || "",
      patch: values
    });
    showAlert(alertMessage);
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
          startNewRecordFromLookup(
            {
              ...buildRecordPatchFromAguasMatch(match),
              comentarios: "Datos copiados desde padron Aguas"
            },
            `No habia ficha para ${match.clave_catastral}: se preparo una ficha nueva con los datos del padron.`
          );
          return;
        }

        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "No fue posible abrir la ficha para esta clave.");
      }

      const record = await response.json();
      navigateWithFocus("records", {
        record,
        fichaId: record.id,
        clave_catastral: record.clave_catastral || match.clave_catastral,
        patch: {
          ...buildRecordPatchFromAguasMatch(match),
          comentarios: record.comentarios || "Datos actualizados desde padron Aguas"
        }
      });
      showAlert(`Ficha cargada con datos actualizados del padron para ${record.clave_catastral || match.clave_catastral}. Guarda la ficha para conservarlos.`);
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
