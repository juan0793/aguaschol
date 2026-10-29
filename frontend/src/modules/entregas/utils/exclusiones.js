import { estadoDocumentoLabel, formatDate, formatNumber } from "./entregasFormatters.js";

// Textos de la pantalla de Exclusiones, la hoja impresa y el PDF. El servidor manda
// cada exclusión con `cuentas` (padrón), `saldo` (solo administración y Gerencia),
// `entrega` (qué pasó en el ciclo; ver entregaDelCiclo en el backend) y
// `sin_entregar_antes`.

// Orden de los estados en las cifras y en el filtro.
export const ESTADOS_ENTREGA = [
  { codigo: "ENTREGADA", etiqueta: "Entregada por técnico", corta: "Entregadas", tono: "is-entregada" },
  { codigo: "REENTREGADA", etiqueta: "Entregada después", corta: "Entregadas después", tono: "is-entregada" },
  { codigo: "SOBRANTE", etiqueta: "Sin entregar", corta: "Sin entregar", tono: "is-sobrante" },
  { codigo: "LOTE_ABIERTO", etiqueta: "Lote abierto", corta: "Lote abierto", tono: "is-abierto" },
  { codigo: "SIN_LOTE", etiqueta: "Sin lote en el ciclo", corta: "Sin lote", tono: "is-neutro" },
  { codigo: "SIN_BARRIO", etiqueta: "No está en el padrón", corta: "Sin padrón", tono: "is-neutro" }
];
const estadoDe = (codigo) => ESTADOS_ENTREGA.find((item) => item.codigo === codigo) || ESTADOS_ENTREGA[ESTADOS_ENTREGA.length - 1];

// Qué pasó con la cuenta en el ciclo, en una etiqueta y una línea de detalle.
export const entregaTexto = (item = {}) => {
  const entrega = item.entrega || {};
  const estado = estadoDe(entrega.estado);
  const tecnico = entrega.tecnico || "Sin responsable";
  const detalle = {
    ENTREGADA: `${tecnico} · lote del ${formatDate(entrega.fecha)}; no quedó de sobrante`,
    REENTREGADA: `${tecnico} · sobrante del ${formatDate(entrega.fecha)}${entrega.fecha_entrega_final ? `, entregada el ${formatDate(entrega.fecha_entrega_final)}` : ", entregada después"}`,
    SOBRANTE: `${tecnico} · lote del ${formatDate(entrega.fecha)} · ${estadoDocumentoLabel(entrega.documento_estado)}`,
    LOTE_ABIERTO: `${tecnico} · lote del ${formatDate(entrega.fecha)} todavía abierto`,
    SIN_LOTE: item.barrio_codigo ? `El barrio ${item.barrio_codigo} no tuvo lote en este ciclo` : "Su barrio no tuvo lote en este ciclo",
    SIN_BARRIO: "No se sabe su barrio"
  }[estado.codigo];
  const antes = Number(item.sin_entregar_antes || 0);
  return {
    codigo: estado.codigo,
    etiqueta: estado.etiqueta,
    tono: estado.tono,
    detalle,
    antes: antes ? `${formatNumber(antes)} ${antes === 1 ? "vez" : "veces"} sin entregar en ciclos anteriores` : ""
  };
};

// Cuenta del padrón en una línea: la primera y cuántas más tiene la clave.
export const cuentaTexto = (item = {}) => {
  const [primera, ...otras] = item.cuentas || [];
  if (!primera) return { nombre: "No está en el padrón", linea: "" };
  const otro = item.tipo === "ABONADO" ? `Clave ${primera.clave_catastral || "sin clave"}` : `Abonado ${primera.abonado || "sin número"}`;
  return {
    nombre: primera.nombre || "Sin nombre en el padrón",
    linea: [otro, primera.barrio, otras.length ? `y ${formatNumber(otras.length)} ${otras.length === 1 ? "cuenta más" : "cuentas más"}` : ""].filter(Boolean).join(" · ")
  };
};

const sinAcentos = (texto) => String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Búsqueda por valor, nota, nombre, abonado, clave (con o sin guiones) o técnico, y
// filtro por estado de la entrega.
export const filtrarExclusiones = (lista = [], { buscar = "", estado = "" } = {}) => {
  const texto = sinAcentos(buscar);
  const cifras = texto.replace(/\D/g, "");
  return lista.filter((item) => {
    if (estado && (item.entrega?.estado || "SIN_BARRIO") !== estado) return false;
    if (!texto) return true;
    const campos = [item.valor, item.nota, item.entrega?.tecnico, ...(item.cuentas || []).flatMap((cuenta) => [cuenta.nombre, cuenta.abonado, cuenta.clave_catastral, cuenta.barrio])];
    if (campos.some((campo) => sinAcentos(campo).includes(texto))) return true;
    return cifras.length >= 3 && [item.llave, ...(item.cuentas || []).map((cuenta) => String(cuenta.clave_catastral || "").replace(/\D/g, ""))].some((llave) => String(llave || "").includes(cifras));
  });
};

// Cifras de lo que se ve (para la pantalla filtrada, la hoja y el PDF).
export const totalesExclusiones = (lista = []) => {
  const totales = { total: lista.length, capital: 0, mora: 0, saldo: 0, por_estado: Object.fromEntries(ESTADOS_ENTREGA.map((item) => [item.codigo, 0])) };
  for (const item of lista) {
    totales.por_estado[item.entrega?.estado || "SIN_BARRIO"] += 1;
    if (item.saldo) {
      totales.capital += item.saldo.capital;
      totales.mora += item.saldo.mora;
      totales.saldo += item.saldo.total;
    }
  }
  const redondear = (valor) => Number(valor.toFixed(2));
  return { ...totales, capital: redondear(totales.capital), mora: redondear(totales.mora), saldo: redondear(totales.saldo) };
};
