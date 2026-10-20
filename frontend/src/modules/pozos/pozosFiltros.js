// Filtros, orden, páginas y métricas de la pantalla Pozos (sin React; pruebas en pozosFiltros.test.mjs).

export const normalizar = (texto = "") => String(texto ?? "")
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

const tieneValor = (valor) => valor !== null && valor !== undefined && valor !== "";

// Valores guía para agua de consumo (Norma Técnica Nacional para la Calidad del Agua Potable,
// Honduras): pH entre 6.5 y 8.5 y sólidos totales disueltos hasta 1000 mg/L (1 g/L).
export const RANGOS = {
  ph: { min: 6.5, max: 8.5, texto: "6.5 a 8.5" },
  tds_g_l: { min: null, max: 1, texto: "hasta 1 g/L" }
};

export const fueraDeRango = (campo, valor) => {
  const rango = RANGOS[campo];
  if (!rango || !tieneValor(valor)) return false;
  return (rango.min !== null && valor < rango.min) || (rango.max !== null && valor > rango.max);
};

// Un pozo "por revisar" tiene algo que corregir en la fuente: un código que comparte con
// otro pozo o una coordenada que cae fuera de Choluteca.
export const porRevisar = (pozo) => Boolean(pozo?.codigo_repetido || !pozo?.coordenada_valida);
export const conCalidad = (pozo) => ["ph", "tds_g_l", "salinidad", "temperatura_c"].some((campo) => tieneValor(pozo?.[campo]));
export const fueraDeGuia = (pozo) => fueraDeRango("ph", pozo?.ph) || fueraDeRango("tds_g_l", pozo?.tds_g_l);

// Pestañas de la bandeja (como las etapas de Clandestinos): cada una es un filtro con su conteo.
export const VISTAS = [
  { clave: "todos", label: "Todos", corto: "Todos", cumple: () => true },
  { clave: "en_uso", label: "En uso", corto: "En uso", cumple: (pozo) => pozo.en_uso === true },
  { clave: "calidad", label: "Con calidad medida", corto: "Calidad", cumple: conCalidad },
  { clave: "fuera", label: "Fuera del valor guía", corto: "Fuera guía", cumple: fueraDeGuia },
  { clave: "revisar", label: "Por revisar", corto: "Revisar", cumple: porRevisar }
];

export const contarVistas = (pozos = []) => Object.fromEntries(VISTAS.map((vista) => [vista.clave, pozos.filter(vista.cumple).length]));

export const coloniasDe = (pozos = []) => {
  const cuenta = new Map();
  pozos.forEach((pozo) => {
    const colonia = pozo.colonia || "Sin colonia";
    cuenta.set(colonia, (cuenta.get(colonia) || 0) + 1);
  });
  return [...cuenta.entries()]
    .map(([colonia, total]) => ({ colonia, total }))
    .sort((a, b) => a.colonia.localeCompare(b.colonia, "es"));
};

export const FILTROS_INICIALES = { texto: "", colonia: "", vista: "todos" };

export const filtrarPozos = (pozos = [], { texto = "", colonia = "", vista = "todos" } = {}) => {
  const buscado = normalizar(texto);
  const regla = VISTAS.find((item) => item.clave === vista)?.cumple ?? (() => true);
  const digitos = buscado.replace(/\D/g, "");
  const buscaCodigo = Boolean(digitos) && /^(?:pchol)?[\s.-]*\d+$/.test(buscado.replace(/\s/g, ""));
  return pozos.filter((pozo) => {
    if (!regla(pozo)) return false;
    if (colonia && (pozo.colonia || "Sin colonia") !== colonia) return false;
    if (!buscado) return true;
    // "032", "pchol 32" y "Pchol.-032" encuentran el mismo pozo.
    if (buscaCodigo) return Number(String(pozo.codigo || "").replace(/\D/g, "")) === Number(digitos);
    return [pozo.codigo, pozo.nombre, pozo.colonia, pozo.tipo_bomba, pozo.observaciones].some((campo) => normalizar(campo).includes(buscado));
  });
};

// Columnas que se pueden ordenar. Los vacíos van siempre al final.
export const COLUMNAS_ORDEN = {
  codigo: (pozo) => Number(String(pozo.codigo || "").replace(/\D/g, "")) || null,
  nombre: (pozo) => normalizar(pozo.nombre) || null,
  colonia: (pozo) => normalizar(pozo.colonia) || null,
  en_uso: (pozo) => (pozo.en_uso ? 1 : null),
  profundidad_m: (pozo) => pozo.profundidad_m,
  nivel_freatico_m: (pozo) => pozo.nivel_freatico_m,
  diametro_pulg: (pozo) => pozo.diametro_pulg,
  ph: (pozo) => pozo.ph,
  tds_g_l: (pozo) => pozo.tds_g_l,
  salinidad: (pozo) => pozo.salinidad,
  temperatura_c: (pozo) => pozo.temperatura_c,
  oxigeno_disuelto: (pozo) => pozo.oxigeno_disuelto,
  cloro_residual: (pozo) => pozo.cloro_residual
};

export const ordenarPozos = (pozos = [], { campo = "codigo", dir = "asc" } = {}) => {
  const valor = COLUMNAS_ORDEN[campo] ?? COLUMNAS_ORDEN.codigo;
  const signo = dir === "desc" ? -1 : 1;
  return [...pozos].sort((a, b) => {
    const va = valor(a);
    const vb = valor(b);
    if (!tieneValor(va) && !tieneValor(vb)) return (a.id ?? 0) - (b.id ?? 0);
    if (!tieneValor(va)) return 1;
    if (!tieneValor(vb)) return -1;
    const comparacion = typeof va === "string" ? va.localeCompare(vb, "es") : va - vb;
    return comparacion * signo || (a.id ?? 0) - (b.id ?? 0);
  });
};

export const paginar = (lista = [], pagina = 1, porPagina = 20) => {
  const totalPaginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const actual = Math.min(Math.max(1, pagina), totalPaginas);
  const inicio = (actual - 1) * porPagina;
  const items = lista.slice(inicio, inicio + porPagina);
  return { items, pagina: actual, totalPaginas, desde: items.length ? inicio + 1 : 0, hasta: inicio + items.length, total: lista.length };
};

// Métricas de las mediciones de cada pozo, sobre los pozos que tienen el dato.
export const METRICAS = [
  { campo: "profundidad_m", label: "Profundidad", unidad: "m", decimales: 1, icono: "arrowRight" },
  { campo: "nivel_freatico_m", label: "Nivel freático", unidad: "m", decimales: 1, icono: "water" },
  { campo: "ph", label: "pH", unidad: "", decimales: 2, icono: "activity" },
  { campo: "tds_g_l", label: "Sólidos disueltos (TDS)", unidad: "g/L", decimales: 3, icono: "barChart" },
  { campo: "salinidad", label: "Salinidad", unidad: "", decimales: 2, icono: "sewer" },
  { campo: "temperatura_c", label: "Temperatura", unidad: "°C", decimales: 1, icono: "trendUp" }
];

export const resumenMetricas = (pozos = []) => METRICAS.map((metrica) => {
  const valores = pozos.map((pozo) => pozo[metrica.campo]).filter((valor) => tieneValor(valor) && Number.isFinite(Number(valor))).map(Number);
  const n = valores.length;
  return {
    ...metrica,
    n,
    promedio: n ? valores.reduce((suma, valor) => suma + valor, 0) / n : null,
    min: n ? Math.min(...valores) : null,
    max: n ? Math.max(...valores) : null,
    fuera: RANGOS[metrica.campo] ? valores.filter((valor) => fueraDeRango(metrica.campo, valor)).length : null
  };
});

// `fijo` deja siempre los mismos decimales (en una columna de la tabla los puntos quedan alineados).
export const formatoNumero = (valor, decimales = 2, fijo = false) => {
  if (!tieneValor(valor)) return "—";
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return String(valor);
  return numero.toLocaleString("es-HN", { maximumFractionDigits: decimales, minimumFractionDigits: fijo ? decimales : 0 });
};

export const haceCuanto = (fecha, ahora = Date.now()) => {
  if (!fecha) return "";
  const minutos = Math.round((ahora - new Date(fecha).getTime()) / 60000);
  if (minutos < 1) return "hace un momento";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return new Date(fecha).toLocaleDateString("es-HN", { day: "numeric", month: "short" });
};
