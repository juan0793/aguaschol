// Datos del estado de cuenta de un abonado, comunes a la hoja impresa y al PDF.
// En el padrón el saldo (`total`) ya es capital (`tarifa`, el campo `valor`) más
// intereses: el documento lo desglosa y nunca vuelve a sumar los intereses.
import { estadoSaldo } from "../utils/abonadosBarrio.js";
import { SERVICE_COLUMNS } from "../utils/serviceTable.js";

const numero = (valor) => (Number.isFinite(Number(valor)) ? Number(valor) : 0);

export const fechaLarga = (valor, { conHora = false } = {}) => {
  const fecha = valor ? new Date(valor) : null;
  if (!fecha || Number.isNaN(fecha.getTime())) return "";
  const dia = fecha.toLocaleDateString("es-HN", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Tegucigalpa" });
  if (!conHora) return dia;
  const hora = fecha.toLocaleTimeString("es-HN", { hour: "numeric", minute: "2-digit", timeZone: "America/Tegucigalpa" });
  return `${dia}, ${hora}`;
};

export const armarEstadoCuenta = ({ row = {}, barrio = "", clave = "", padronActualizado = "", emitido = new Date(), reportId = "" } = {}) => {
  const capital = numero(row.tarifa);
  const intereses = numero(row.intereses);
  const total = numero(row.total);
  const estado = estadoSaldo(row);
  // La barra solo reparte una deuda: con saldo a favor o al día no hay proporción que mostrar.
  const positivo = Math.max(capital, 0) + Math.max(intereses, 0);
  const parteIntereses = estado === "deuda" && positivo ? Math.round((Math.max(intereses, 0) / positivo) * 100) : 0;
  const fechaPadron = fechaLarga(padronActualizado);
  return {
    nombre: String(row.nombre || "").trim() || "Sin nombre en el padrón",
    abonado: String(row.abonado ?? "").trim() || "--",
    clave: String(clave || row.clave_catastral || "").trim() || "--",
    barrio: String(barrio || "").trim() || "--",
    capital,
    intereses,
    total,
    estado,
    parteIntereses,
    parteCapital: parteIntereses ? 100 - parteIntereses : estado === "deuda" ? 100 : 0,
    rotuloSaldo: estado === "a-favor" ? "Saldo a favor" : fechaPadron ? `Saldo total al ${fechaPadron}` : "Saldo total",
    notaSaldo: estado === "a-favor" ? "La cuenta tiene saldo a favor del abonado."
      : estado === "al-dia" ? "La cuenta está al día: no tiene saldo pendiente."
        : intereses ? "El saldo total ya incluye los intereses." : "La cuenta no tiene intereses acumulados.",
    servicios: SERVICE_COLUMNS.map(([campo, , , largo]) => ({ campo, etiqueta: largo, activo: Boolean(row.servicios?.[campo]) })),
    emitido: fechaLarga(emitido, { conHora: true }),
    padron: fechaPadron,
    reportId
  };
};

export const nombreArchivo = (datos) => `estado-de-cuenta-abonado-${String(datos.abonado).replace(/[^\w-]+/g, "") || "sin-numero"}`;
