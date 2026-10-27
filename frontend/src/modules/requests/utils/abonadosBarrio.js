// Reglas del panel de abonados de un barrio, sin React para poder probarlas.
// En el padrón el saldo (`total`) ya es capital (`tarifa`) más intereses.

export const ESTADOS_SALDO = [
  ["todos", "Todos"],
  ["deuda", "Con deuda"],
  ["al-dia", "Al día"],
  ["a-favor", "A favor"]
];

export const ORDENES = [
  ["saldo", "Mayor saldo"],
  ["nombre", "Nombre"],
  ["clave", "Clave"]
];

// Menos de un centavo cuenta como al día: el padrón trae residuos de redondeo.
export const estadoSaldo = (row = {}) => {
  const total = Number(row.total || 0);
  if (total >= 0.005) return "deuda";
  if (total <= -0.005) return "a-favor";
  return "al-dia";
};

const sinAcentos = (value) => String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const soloDigitos = (value) => String(value ?? "").replace(/\D/g, "");

// Busca por nombre sin acentos, y por clave o abonado aunque falten los guiones:
// "160202" encuentra la clave 16-02-02-01.
export const coincide = (row = {}, consulta = "") => {
  const texto = sinAcentos(consulta.trim());
  if (!texto) return true;
  if ([row.nombre, row.abonado, row.clave_catastral].some((valor) => sinAcentos(valor).includes(texto))) return true;
  const digitos = soloDigitos(texto);
  return digitos.length >= 3 && digitos === texto.replace(/[\s.-]/g, "")
    && [row.clave_catastral, row.abonado].some((valor) => soloDigitos(valor).includes(digitos));
};

const porClave = (a, b) => String(a.clave_catastral || "").localeCompare(String(b.clave_catastral || ""), "es", { numeric: true });

export const ordenarAbonados = (rows = [], orden = "saldo") => [...rows].sort((a, b) => {
  if (orden === "nombre") return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es") || porClave(a, b);
  if (orden === "clave") return porClave(a, b);
  return Number(b.total || 0) - Number(a.total || 0) || porClave(a, b);
});

export const resumirAbonados = (rows = []) => rows.reduce((suma, row) => {
  suma.saldo += Number(row.total || 0);
  suma.capital += Number(row.tarifa || 0);
  suma.intereses += Number(row.intereses || 0);
  suma[estadoSaldo(row)] += 1;
  return suma;
}, { saldo: 0, capital: 0, intereses: 0, deuda: 0, "al-dia": 0, "a-favor": 0 });
