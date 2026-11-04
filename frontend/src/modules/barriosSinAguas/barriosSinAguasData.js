// Filtros y totales de "Barrios sin Aguas". Un barrio entra según la parte de sus claves de
// Alcaldía que sí aparece en Aguas (la cobertura): "ninguna" es 0 %; las otras opciones
// incluyen los barrios casi fuera de Aguas.

export const CRITERIOS = [
  { key: "0", label: "Ninguna clave en Aguas", corto: "sin ninguna clave en Aguas", max: 0 },
  { key: "10", label: "Menos del 10 %", corto: "con menos del 10 % de sus claves en Aguas", max: 10 },
  { key: "25", label: "Menos del 25 %", corto: "con menos del 25 % de sus claves en Aguas", max: 25 },
  { key: "50", label: "Menos de la mitad", corto: "con menos de la mitad de sus claves en Aguas", max: 50 }
];

export const TIPOS = [["todos", "Todos"], ["urbano", "Urbanos"], ["rural", "Rurales"]];

export const ORDENES = {
  claves: (a, b) => b.claves - a.claves || a.barrio.localeCompare(b.barrio, "es"),
  sin_registrar: (a, b) => b.sin_registrar - a.sin_registrar || a.barrio.localeCompare(b.barrio, "es"),
  cobertura: (a, b) => a.cobertura - b.cobertura || b.claves - a.claves,
  barrio: (a, b) => a.barrio.localeCompare(b.barrio, "es"),
  avaluo: (a, b) => b.avaluo - a.avaluo || b.claves - a.claves
};

const sinAcentos = (texto = "") => String(texto).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const tipoDe = (barrio) => (barrio.rural > barrio.urbano ? "rural" : "urbano");

export const cumpleCriterio = (barrio, criterio) => {
  const { max } = CRITERIOS.find((item) => item.key === criterio) || CRITERIOS[0];
  return max === 0 ? Number(barrio.en_aguas) === 0 : Number(barrio.cobertura) < max;
};

export const filtrarBarrios = (barrios = [], { criterio = "0", tipo = "todos", busqueda = "", orden = "claves", soloParecido = false } = {}) => {
  const texto = sinAcentos(busqueda.trim());
  return barrios
    .filter((barrio) => cumpleCriterio(barrio, criterio))
    .filter((barrio) => tipo === "todos" || tipoDe(barrio) === tipo)
    .filter((barrio) => !soloParecido || barrio.parecido)
    .filter((barrio) => !texto || sinAcentos(`${barrio.barrio} ${barrio.codigo_caserio} ${barrio.parecido?.nombre || ""}`).includes(texto))
    .sort(ORDENES[orden] || ORDENES.claves);
};

export const totalesBarrios = (filas = []) => filas.reduce((total, fila) => ({
  barrios: total.barrios + 1,
  claves: total.claves + Number(fila.claves || 0),
  en_aguas: total.en_aguas + Number(fila.en_aguas || 0),
  sin_registrar: total.sin_registrar + Number(fila.sin_registrar || 0),
  urbano: total.urbano + Number(fila.urbano || 0),
  rural: total.rural + Number(fila.rural || 0),
  avaluo: total.avaluo + Number(fila.avaluo || 0),
  con_pago: total.con_pago + Number(fila.con_pago_alcaldia || 0),
  con_parecido: total.con_parecido + (fila.parecido ? 1 : 0)
}), { barrios: 0, claves: 0, en_aguas: 0, sin_registrar: 0, urbano: 0, rural: 0, avaluo: 0, con_pago: 0, con_parecido: 0 });
