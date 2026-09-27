import { escapeHtml } from "./html";
import { extractPadronLookupReferences } from "./claveAndLookup";
import { formatCurrency } from "./formatting";

export const FIELD_DEBT_SERVICE_DEFINITIONS = [
  { field: "agua", label: "Agua potable", shortLabel: "Agua", aliases: ["agua", "potable"] },
  { field: "alcantarillado", label: "Alcantarillado", shortLabel: "Alcant.", aliases: ["alcantarillado", "alca"] },
  { field: "barrido", label: "Barrido", shortLabel: "Barrido", aliases: ["barrido", "barr"] },
  {
    field: "recoleccion",
    label: "Recoleccion de desechos",
    shortLabel: "Desechos",
    legacyShortLabels: ["Recolec."],
    aliases: ["desechos", "recoleccion", "tren", "basura", "aseo"]
  },
  {
    field: "desechos_peligrosos",
    label: "Desechos peligrosos",
    shortLabel: "Peligrosos",
    aliases: ["peligrosos", "bomb"]
  }
];

export const getFieldDebtServiceShortLabels = (service = {}) =>
  [service.shortLabel, service.label, ...(service.legacyShortLabels || [])].filter(Boolean);

export const extractFieldDebtLookupReferences = (value = "") => extractPadronLookupReferences(value);

export const getFieldDebtRequestedServices = (value = "") => {
  const normalized = String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return FIELD_DEBT_SERVICE_DEFINITIONS.filter((service) =>
    service.aliases.some((alias) => normalized.includes(alias))
  ).map((service) => service.label);
};

export const getFieldDebtServiceStatus = (match = {}, serviceField = "") => {
  const value = String(match?.[serviceField] ?? "").trim().toUpperCase();
  if (value === "S") return "Sí";
  if (value === "N") return "No";
  return "--";
};

export const buildMapDescriptionPadronBlock = (match = {}) => {
  const identityLines = [
    match.abonado ? `Abonado: ${match.abonado}` : "",
    match.inquilino || match.nombre ? `Nombre: ${match.inquilino || match.nombre}` : "",
    match.barrio_colonia ? `Barrio/colonia: ${match.barrio_colonia}` : "",
    match.direccion ? `Direccion: ${match.direccion}` : ""
  ].filter(Boolean);
  const serviceLine = FIELD_DEBT_SERVICE_DEFINITIONS.map(
    (service) => `${service.shortLabel}: ${getFieldDebtServiceStatus(match, service.field)}`
  ).join(" | ");

  return [
    ...identityLines,
    `Servicios: ${serviceLine}`
  ].join("\n");
};

export const getActiveServiceShortLabels = (match = {}) =>
  FIELD_DEBT_SERVICE_DEFINITIONS.filter((service) => String(match?.[service.field] || "").trim().toUpperCase() === "S")
    .map((service) => service.shortLabel);

export const formatLookupAssistantMoney = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? formatCurrency(numeric) : "";
};

export const buildLookupAssistantDetails = (match = {}) => {
  const detailRows = [
    ["Clave", match.clave_catastral || match.clave_aguas_formato],
    ["Abonado", match.abonado],
    ["Nombre", match.inquilino || match.nombre],
    ["Titular", match.nombre && match.nombre !== match.inquilino ? match.nombre : ""],
    ["Barrio/colonia", match.barrio_colonia || match.caserio],
    ["Direccion", match.direccion],
    ["Agua potable", getFieldDebtServiceStatus(match, "agua")],
    ["Alcantarillado", getFieldDebtServiceStatus(match, "alcantarillado")],
    ["Barrido", getFieldDebtServiceStatus(match, "barrido")],
    ["Desechos / tren de aseo", getFieldDebtServiceStatus(match, "recoleccion")],
    ["Desechos peligrosos", getFieldDebtServiceStatus(match, "desechos_peligrosos")],
    ["Valor", formatLookupAssistantMoney(match.valor)],
    ["Intereses", formatLookupAssistantMoney(match.intereses)],
    ["Total", formatLookupAssistantMoney(match.total)]
  ];

  return detailRows
    .filter(([, value]) => String(value ?? "").trim() && String(value ?? "").trim() !== "--")
    .map(([label, value]) => ({ label, value }));
};

export const buildFieldDebtServicesMarkup = (match = {}) =>
  FIELD_DEBT_SERVICE_DEFINITIONS.map((service) => {
    const isActive = getFieldDebtServiceStatus(match, service.field) === "Sí";
    return `
      <span class="field-debt-service-mark ${isActive ? "is-on" : "is-off"}">
        <b>${isActive ? "✓" : "×"}</b>${escapeHtml(service.shortLabel)}
      </span>
    `;
  }).join("");

export const buildFieldDebtPointRows = (points = []) =>
  points
    .map((point, index) => {
      const sourceText = [point.reference_note, point.description].filter(Boolean).join(" ");
      const references = extractFieldDebtLookupReferences(sourceText).map((reference) => {
        if (reference.field !== "clave") return reference;
        const value = reference.value.split("-").slice(0, 3).join("-");
        return { ...reference, value, key: `clave:${value}`, label: value };
      });
      return {
        point,
        index,
        sourceText,
        keys: references.map((reference) => reference.key),
        references,
        requestedServices: getFieldDebtRequestedServices(sourceText)
      };
    })
    .filter((row) => row.keys.length);

export const getFieldDebtResultLabel = (result = {}) => result.label || result.key || "--";
