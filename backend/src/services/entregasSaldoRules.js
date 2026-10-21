// Reglas puras del saldo de los documentos no entregados y de los avisos que la
// oficina manda al tecnico. El saldo sale del padron en memoria (valor = capital,
// intereses = mora) y solo lo ven administracion y Gerencia: el texto del aviso
// que llega al tecnico nunca lleva montos, igual que los reclamos.

import { fail } from "./entregasRules.js";

const clean = (value) => String(value ?? "").trim();
const soloDigitos = (value) => clean(value).replace(/\D/g, "");
const redondear = (valor) => Number(Number(valor || 0).toFixed(2));

// Indice del padron por abonado y por clave. Un abonado repetido se queda con el
// primero; una clave base solo sirve si apunta a un unico inmueble.
export const indexarPadron = (registros = []) => {
  const porAbonado = new Map();
  const porClave = new Map();
  const porBase = new Map();
  for (const registro of registros) {
    const abonado = soloDigitos(registro?.abonado);
    if (abonado && !porAbonado.has(abonado)) porAbonado.set(abonado, registro);
    if (registro?.clave_catastral && !porClave.has(registro.clave_catastral)) porClave.set(registro.clave_catastral, registro);
    if (registro?.clave_base) porBase.set(registro.clave_base, porBase.has(registro.clave_base) ? null : registro);
  }
  return { porAbonado, porClave, porBase };
};

const SIN_PADRON = Object.freeze({ encontrado: false, capital: 0, mora: 0, total: 0 });

// Primero el numero de abonado (es lo que imprime la factura); si no aparece, la clave.
export const saldoDeDocumento = (indice, documento = {}, normalizarClave = (valor) => valor) => {
  if (!indice) return SIN_PADRON;
  let registro = indice.porAbonado.get(soloDigitos(documento.numero_abonado));
  if (!registro && clean(documento.clave_catastral)) {
    let clave = "";
    try { clave = normalizarClave(documento.clave_catastral); } catch { clave = ""; }
    registro = indice.porClave.get(clave) || indice.porBase.get(clave) || null;
  }
  if (!registro) return SIN_PADRON;
  return {
    encontrado: true,
    capital: redondear(registro.valor),
    mora: redondear(registro.intereses),
    total: redondear(registro.total ?? Number(registro.valor || 0) + Number(registro.intereses || 0))
  };
};

// Suma de lo que dejo un lote. Los cancelados no cuentan; se separa lo que sigue
// pendiente de entregar para que se vea cuanto dinero queda en la calle.
export const sumarSaldos = (documentos = []) => {
  const suma = { cuentas: 0, con_saldo: 0, sin_padron: 0, capital: 0, mora: 0, total: 0, total_pendiente: 0 };
  for (const documento of documentos) {
    if (documento?.estado === "CANCELADA") continue;
    const saldo = documento?.saldo || SIN_PADRON;
    suma.cuentas += 1;
    if (!saldo.encontrado) { suma.sin_padron += 1; continue; }
    if (saldo.total > 0) suma.con_saldo += 1;
    suma.capital += saldo.capital;
    suma.mora += saldo.mora;
    suma.total += saldo.total;
    if (documento.estado === "PENDIENTE") suma.total_pendiente += saldo.total;
  }
  return { ...suma, capital: redondear(suma.capital), mora: redondear(suma.mora), total: redondear(suma.total), total_pendiente: redondear(suma.total_pendiente) };
};

export const PLANTILLAS_AVISO = [
  { codigo: "ENTREGAR_HOY", etiqueta: "Entregar hoy", texto: "Entrégala hoy y registra el resultado en la app." },
  { codigo: "EN_PERSONA", etiqueta: "Abonado con saldo pendiente", texto: "El abonado tiene saldo pendiente: entrégala en persona y deja constancia." },
  { codigo: "VERIFICAR", etiqueta: "Verificar dirección o clave", texto: "Verifica la dirección o la clave catastral y corrige el registro." },
  { codigo: "EXPLICAR", etiqueta: "Explicar por qué no se entregó", texto: "Explica en la observación por qué no se pudo entregar." },
  { codigo: "OTRO", etiqueta: "Otro mensaje", texto: "" }
];
export const MAX_NOTA_AVISO = 300;

export const normalizarAviso = (payload = {}) => {
  const plantilla = PLANTILLAS_AVISO.find((item) => item.codigo === clean(payload.plantilla).toUpperCase());
  if (!plantilla) throw fail("Elige el mensaje que quieres enviar.");
  const nota = clean(payload.nota).replace(/\s+/g, " ").slice(0, MAX_NOTA_AVISO);
  if (plantilla.codigo === "OTRO" && nota.length < 5) throw fail("Escribe el mensaje (mínimo 5 caracteres).");
  return { plantilla: plantilla.codigo, nota };
};

// Lo que el tecnico lee en la campana: que documento, de que lote y que hacer.
export const textoAviso = ({ plantilla, nota }, documento = {}) => {
  const definicion = PLANTILLAS_AVISO.find((item) => item.codigo === plantilla);
  const quien = [clean(documento.numero_abonado) && `abonado ${clean(documento.numero_abonado)}`, clean(documento.abonado_nombre)].filter(Boolean).join(" · ")
    || `clave ${clean(documento.clave_catastral) || "sin registrar"}`;
  const donde = [clean(documento.barrio_nombre), documento.lote_id ? `lote #${documento.lote_id}` : ""].filter(Boolean).join(", ");
  const indicacion = [definicion?.texto, nota].filter(Boolean).join(" ");
  return `Documento no entregado: ${quien}${donde ? ` (${donde})` : ""}. ${indicacion}`.trim();
};
