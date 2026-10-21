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

// Estado de calidad de un pozo: sin pH ni TDS no se puede juzgar contra el valor guía.
export const CALIDADES = [
  { clave: "dentro", label: "Dentro del valor guía" },
  { clave: "fuera", label: "Fuera del valor guía" },
  { clave: "sin", label: "Sin medición" }
];
export const calidadDe = (pozo) => {
  if (!tieneValor(pozo?.ph) && !tieneValor(pozo?.tds_g_l)) return "sin";
  return fueraDeGuia(pozo) ? "fuera" : "dentro";
};

// Datos que la encuesta debía levantar en cada pozo. "Le falta" filtra los que no lo tienen,
// para planificar la próxima visita de campo.
export const DATOS = [
  { clave: "profundidad_m", label: "Profundidad", tiene: (pozo) => tieneValor(pozo.profundidad_m) },
  { clave: "nivel_freatico_m", label: "Nivel freático", tiene: (pozo) => tieneValor(pozo.nivel_freatico_m) },
  { clave: "diametro_pulg", label: "Diámetro", tiene: (pozo) => tieneValor(pozo.diametro_pulg) },
  { clave: "ph", label: "pH", tiene: (pozo) => tieneValor(pozo.ph) },
  { clave: "tds_g_l", label: "TDS", tiene: (pozo) => tieneValor(pozo.tds_g_l) },
  { clave: "temperatura_c", label: "Temperatura", tiene: (pozo) => tieneValor(pozo.temperatura_c) },
  { clave: "en_uso", label: "Estado de uso", tiene: (pozo) => pozo.en_uso === true || pozo.en_uso === false },
  { clave: "coordenada", label: "Coordenada válida", tiene: (pozo) => Boolean(pozo.coordenada_valida) }
];
export const faltantesDe = (pozo) => DATOS.filter((dato) => !dato.tiene(pozo)).map((dato) => dato.label);

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

export const FILTROS_INICIALES = { texto: "", colonia: "", vista: "todos", calidad: "", falta: "" };

export const filtrarPozos = (pozos = [], { texto = "", colonia = "", vista = "todos", calidad = "", falta = "" } = {}) => {
  const buscado = normalizar(texto);
  const regla = VISTAS.find((item) => item.clave === vista)?.cumple ?? (() => true);
  const digitos = buscado.replace(/\D/g, "");
  const buscaCodigo = Boolean(digitos) && /^(?:pchol)?[\s.-]*\d+$/.test(buscado.replace(/\s/g, ""));
  return pozos.filter((pozo) => {
    if (!regla(pozo)) return false;
    if (colonia && (pozo.colonia || "Sin colonia") !== colonia) return false;
    if (calidad && calidadDe(pozo) !== calidad) return false;
    if (falta && DATOS.find((dato) => dato.clave === falta)?.tiene(pozo) !== false) return false;
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
  calidad: (pozo) => ({ fuera: 1, dentro: 2 })[calidadDe(pozo)] ?? null,
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

// ---- Resumen y análisis -------------------------------------------------------------

// Pozos por colonia, de más a menos; las que no entran en `tope` se juntan en "Otras".
export const pozosPorColonia = (pozos = [], tope = 6) => {
  const filas = coloniasDe(pozos).sort((a, b) => b.total - a.total || a.colonia.localeCompare(b.colonia, "es"));
  if (filas.length <= tope) return filas;
  const resto = filas.slice(tope - 1);
  return [...filas.slice(0, tope - 1), { colonia: "Otras", total: resto.reduce((suma, fila) => suma + fila.total, 0), otras: resto.length }];
};

export const conteoUso = (pozos = []) => ({
  en_uso: pozos.filter((pozo) => pozo.en_uso === true).length,
  fuera_de_uso: pozos.filter((pozo) => pozo.en_uso === false).length,
  sin_dato: pozos.filter((pozo) => pozo.en_uso !== true && pozo.en_uso !== false).length
});

export const coberturaDatos = (pozos = []) => DATOS.map((dato) => ({ ...dato, n: pozos.filter(dato.tiene).length, total: pozos.length }));

// Cortes fijos para que dos filtros distintos se puedan comparar a simple vista.
export const CORTES = {
  ph: [4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5],
  tds_g_l: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
};

// Histograma: cada barra cuenta los valores en [desde, hasta). Lo que cae fuera de los
// cortes entra en la primera o la última barra, que quedan abiertas.
export const histograma = (pozos = [], campo) => {
  const cortes = CORTES[campo];
  const barras = cortes.slice(0, -1).map((desde, i) => ({
    desde, hasta: cortes[i + 1], n: 0,
    abiertaAbajo: i === 0, abiertaArriba: i === cortes.length - 2,
    fuera: fueraDeRango(campo, (desde + cortes[i + 1]) / 2)
  }));
  pozos.forEach((pozo) => {
    const valor = pozo[campo];
    if (!tieneValor(valor) || !Number.isFinite(Number(valor))) return;
    const siguiente = cortes.findIndex((corte) => Number(valor) < corte);
    const i = siguiente < 0 ? barras.length - 1 : Math.max(0, siguiente - 1);
    barras[i].n += 1;
  });
  return barras;
};

export const calidadPorColonia = (pozos = [], tope = 6) => {
  const grupos = new Map();
  pozos.forEach((pozo) => {
    const colonia = pozo.colonia || "Sin colonia";
    const fila = grupos.get(colonia) || { colonia, dentro: 0, fuera: 0, sin: 0, total: 0 };
    fila[calidadDe(pozo)] += 1;
    fila.total += 1;
    grupos.set(colonia, fila);
  });
  const filas = [...grupos.values()].sort((a, b) => b.total - a.total || a.colonia.localeCompare(b.colonia, "es"));
  if (filas.length <= tope) return filas;
  const otras = filas.slice(tope - 1).reduce((suma, fila) => ({
    ...suma, dentro: suma.dentro + fila.dentro, fuera: suma.fuera + fila.fuera, sin: suma.sin + fila.sin, total: suma.total + fila.total
  }), { colonia: "Otras", dentro: 0, fuera: 0, sin: 0, total: 0, otras: filas.length - tope + 1 });
  return [...filas.slice(0, tope - 1), otras];
};

// Lo que conviene atender, con el filtro que lleva a esos pozos. Solo aparece lo que existe.
export const hallazgos = (pozos = []) => {
  const cuenta = (regla) => pozos.filter(regla).length;
  const lista = [
    { clave: "ph", tono: "peligro", n: cuenta((pozo) => fueraDeRango("ph", pozo.ph)), texto: (n) => `${n === 1 ? "pozo" : "pozos"} con pH fuera de 6.5 a 8.5`, filtro: { calidad: "fuera" } },
    { clave: "tds", tono: "peligro", n: cuenta((pozo) => fueraDeRango("tds_g_l", pozo.tds_g_l)), texto: (n) => `${n === 1 ? "pozo" : "pozos"} con TDS mayor a 1 g/L`, filtro: { calidad: "fuera" } },
    { clave: "sin_calidad", tono: "atencion", n: cuenta((pozo) => calidadDe(pozo) === "sin"), texto: () => "sin medición de calidad", filtro: { calidad: "sin" } },
    { clave: "profundidad", tono: "atencion", n: cuenta((pozo) => !tieneValor(pozo.profundidad_m)), texto: () => "sin profundidad registrada", filtro: { falta: "profundidad_m" } },
    { clave: "uso", tono: "atencion", n: cuenta((pozo) => pozo.en_uso !== true && pozo.en_uso !== false), texto: () => "sin dato de uso", filtro: { falta: "en_uso" } },
    { clave: "coordenada", tono: "revisar", n: cuenta((pozo) => !pozo.coordenada_valida), texto: (n) => `${n === 1 ? "coordenada" : "coordenadas"} fuera de Choluteca`, filtro: { falta: "coordenada" } },
    { clave: "repetido", tono: "revisar", n: cuenta((pozo) => pozo.codigo_repetido), texto: (n) => `${n === 1 ? "pozo comparte" : "pozos comparten"} código con otro`, filtro: { vista: "revisar" } }
  ];
  return lista.filter((item) => item.n > 0).map((item) => ({ ...item, texto: item.texto(item.n) }));
};

// CSV para abrir en Excel: BOM para que respete tildes, coma como separador y punto decimal.
const COLUMNAS_CSV = [
  ["Código", (pozo) => pozo.codigo], ["Nombre", (pozo) => pozo.nombre], ["Colonia", (pozo) => pozo.colonia],
  ["En uso", (pozo) => (pozo.en_uso === true ? "Sí" : pozo.en_uso === false ? "No" : "")],
  ["Calidad", (pozo) => CALIDADES.find((item) => item.clave === calidadDe(pozo))?.label],
  ["Profundidad (m)", (pozo) => pozo.profundidad_m], ["Nivel freático (m)", (pozo) => pozo.nivel_freatico_m],
  ["Diámetro (pulg)", (pozo) => pozo.diametro_pulg], ["Bomba", (pozo) => pozo.tipo_bomba],
  ["pH", (pozo) => pozo.ph], ["TDS (g/L)", (pozo) => pozo.tds_g_l], ["Salinidad", (pozo) => pozo.salinidad],
  ["Temperatura (°C)", (pozo) => pozo.temperatura_c], ["Oxígeno disuelto (%)", (pozo) => pozo.oxigeno_disuelto],
  ["Conductividad", (pozo) => pozo.conductividad], ["Cloro residual", (pozo) => pozo.cloro_residual],
  ["Latitud", (pozo) => (pozo.coordenada_valida ? pozo.latitud : "")], ["Longitud", (pozo) => (pozo.coordenada_valida ? pozo.longitud : "")],
  ["UTM X", (pozo) => pozo.utm_x], ["UTM Y", (pozo) => pozo.utm_y], ["Elevación (m)", (pozo) => pozo.elevacion_m],
  ["Datos que faltan", (pozo) => faltantesDe(pozo).join("; ")], ["Observaciones", (pozo) => pozo.observaciones]
];
const celdaCsv = (valor) => {
  if (!tieneValor(valor)) return "";
  const texto = String(valor);
  return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};
export const pozosCsv = (pozos = []) => "﻿" + [COLUMNAS_CSV.map(([titulo]) => titulo), ...pozos.map((pozo) => COLUMNAS_CSV.map(([, valor]) => valor(pozo)))]
  .map((fila) => fila.map(celdaCsv).join(","))
  .join("\r\n");
