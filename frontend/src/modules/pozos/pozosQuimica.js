// Lectura química de las mediciones de un pozo (sin React; pruebas en pozosQuimica.test.mjs).
// Fuentes, revisadas el 2026-10-21:
// - Norma Técnica Nacional para la Calidad del Agua Potable de Honduras (Acuerdo 084/1995,
//   Anexo 1, cuadro 3): pH 6.5–8.5 recomendado; temperatura 18–30 °C recomendada; conductividad
//   400 µS/cm recomendada; sólidos totales disueltos 1000 mg/L máximo admisible; cloro residual
//   libre 0.5–1.0 mg/L recomendado y 5 mg/L máximo. No regula salinidad ni oxígeno disuelto.
//   https://faolex.fao.org/docs/pdf/hon175672.pdf
// - OMS, Guías para la calidad del agua de consumo humano, 4.ª ed., cap. 10 (aceptabilidad).
// - Equipo de campo: el TDS y la salinidad salen de la conductividad (factor 0.65 y compensación
//   de 1.91 %/°C, los valores por defecto de los multiparámetros YSI). La conductividad viene como
//   "a/b": una es la conductancia específica a 25 °C (SPC = TDS × 1000 / 0.65) y la otra la
//   conductividad a la temperatura de la muestra. El orden no es fijo.
// Lo único que se calcula aquí es lo que se deduce de lo medido: el reparto del carbono
// inorgánico según el pH. No se muestran iones, metales ni bacterias, porque no se midieron.

const hay = (valor) => valor !== null && valor !== undefined && valor !== "" && Number.isFinite(Number(valor));
const redondeo = (valor, decimales = 0) => Number(Number(valor).toFixed(decimales));
const FACTOR_TDS = 0.65;
const COMPENSACION = 0.0191;

// Conductancia específica (25 °C) y conductividad a la temperatura de la muestra. `cuadra` dice
// si los números son coherentes con el TDS y la temperatura del mismo pozo.
export const conductividadDe = (pozo = {}) => {
  const numeros = String(pozo.conductividad ?? "").split(/[^\d.]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (!numeros.length) return null;
  const esperadaSpc = hay(pozo.tds_g_l) ? (Number(pozo.tds_g_l) * 1000) / FACTOR_TDS : null;
  const spc = esperadaSpc ? numeros.reduce((mejor, n) => (Math.abs(n - esperadaSpc) < Math.abs(mejor - esperadaSpc) ? n : mejor)) : numeros[0];
  const otra = numeros.length > 1 ? numeros.find((n, i) => i !== numeros.indexOf(spc)) : null;
  const esperadaC = hay(pozo.temperatura_c) ? spc * (1 + COMPENSACION * (Number(pozo.temperatura_c) - 25)) : null;
  const cuadraSpc = esperadaSpc ? Math.abs(spc - esperadaSpc) / esperadaSpc <= 0.02 : null;
  const cuadraC = otra != null && esperadaC ? Math.abs(otra - esperadaC) / esperadaC <= 0.03 : null;
  return { spc, temperatura: otra, cuadra: cuadraSpc !== false && cuadraC !== false, esperadaSpc: esperadaSpc && redondeo(esperadaSpc) };
};

// Constantes del sistema carbonato (Plummer y Busenberg, 1982): 6.35 y 10.33 a 25 °C, 6.32 y
// 10.27 a 33 °C; entre medias se interpola en línea recta.
const pKa = (temperatura = 25) => {
  const t = hay(temperatura) ? Number(temperatura) : 25;
  return { pk1: 6.35 - 0.00375 * (t - 25), pk2: 10.33 - 0.0075 * (t - 25) };
};

// Reparto del carbono inorgánico disuelto: CO2 (ácido carbónico), bicarbonato y carbonato, en %.
// Son proporciones, no concentraciones: sin la alcalinidad no hay mg/L.
export const especiacionCarbonato = (ph, temperatura = 25) => {
  if (!hay(ph)) return null;
  const { pk1, pk2 } = pKa(temperatura);
  const h = 10 ** -Number(ph);
  const k1 = 10 ** -pk1;
  const k2 = 10 ** -pk2;
  const total = h * h + h * k1 + k1 * k2;
  return {
    co2: (h * h) / total * 100,
    bicarbonato: (h * k1) / total * 100,
    carbonato: (k1 * k2) / total * 100
  };
};

// Curva de especiación para el gráfico: un punto cada 0.1 de pH.
export const curvaCarbonato = (temperatura = 25, desde = 4, hasta = 10) => {
  const puntos = [];
  for (let ph = desde; ph <= hasta + 1e-9; ph += 0.1) puntos.push({ ph: redondeo(ph, 1), ...especiacionCarbonato(ph, temperatura) });
  return puntos;
};

// Revisiones de plausibilidad del dato (no de potabilidad): lo que conviene verificar en campo.
export const revisionesDelDato = (pozo = {}) => {
  const avisos = [];
  const conductividad = conductividadDe(pozo);
  if (conductividad && !conductividad.cuadra) {
    avisos.push({ campo: "conductividad", texto: `La conductividad anotada (${pozo.conductividad}) no cuadra con el TDS del mismo pozo${conductividad.esperadaSpc ? ` (se esperaba cerca de ${conductividad.esperadaSpc} µS/cm a 25 °C)` : ""}. Puede ser un error de captura.` });
  }
  if (hay(pozo.salinidad) && conductividad?.spc) {
    const razon = Number(pozo.salinidad) / conductividad.spc;
    if (razon < 0.0004 || razon > 0.00056) avisos.push({ campo: "salinidad", texto: "La salinidad no corresponde a la conductividad del mismo pozo; el equipo la calcula de ella, así que deberían cuadrar." });
  }
  if (hay(pozo.ph) && (Number(pozo.ph) < 5.5 || Number(pozo.ph) > 9)) {
    avisos.push({ campo: "ph", texto: `pH ${Number(pozo.ph).toFixed(2)}: poco común en pozos. Conviene confirmarlo con el electrodo recién calibrado o en laboratorio.` });
  }
  if (hay(pozo.temperatura_c) && Number(pozo.temperatura_c) > 35) {
    avisos.push({ campo: "temperatura_c", texto: `${Number(pozo.temperatura_c).toFixed(1)} °C es alto para agua de pozo: quizá se midió en un tanque o en una tubería al sol.` });
  }
  if (hay(pozo.oxigeno_disuelto) && Number(pozo.oxigeno_disuelto) > 110) {
    avisos.push({ campo: "oxigeno_disuelto", texto: "Oxígeno disuelto por encima de 110 % de saturación: fuera de lo posible en agua de pozo." });
  }
  return avisos;
};

// Lectura de cada parámetro: veredicto honesto, la regla aplicada y qué significa.
// estado: "dentro" | "fuera" | "atencion" | "info" | "no_detectado"
export const PARAMETROS = {
  ph: {
    titulo: "pH",
    queMide: "Qué tan ácida o básica es el agua (7 es neutra; menos de 7, ácida).",
    regla: "Norma hondureña: recomendado de 6.5 a 8.5 (es un valor recomendado, no un máximo). La OMS no fija un límite de salud.",
    leer: (valor) => {
      if (valor < 6.5) return { estado: "fuera", resumen: "Agua ácida, por debajo de lo recomendado.", frases: ["El agua ácida tiende a corroer tuberías, accesorios y bombas, y puede disolver hierro, cobre, zinc o plomo de las instalaciones.", "En pozos suele deberse a CO₂ disuelto (ácido carbónico) que viene del suelo y la materia orgánica.", "Por sí solo no es un riesgo directo para la salud, pero no basta para decir que el agua es potable."] };
      if (valor > 8.5) return { estado: "fuera", resumen: "Agua básica, por encima de lo recomendado.", frases: ["Un pH alto hace menos eficaz la desinfección con cloro (conviene menos de 8) y favorece incrustaciones."] };
      return { estado: "dentro", resumen: "Dentro de lo recomendado.", frases: [valor < 7 ? "Aun así, la OMS advierte que el agua de pH 7 o menos es más probable que sea corrosiva." : "Es un rango adecuado para la desinfección con cloro."] };
    },
    confirmar: "Para confirmar en laboratorio: pH, alcalinidad total, CO₂ libre, hierro, manganeso, cobre y plomo (en el grifo, primer chorro) y coliformes.",
    tratamiento: "Si se confirma, lo usual es airear el agua para sacar el CO₂ o pasarla por un filtro neutralizante de calcita, o de óxido de magnesio si el pH es menor de 6."
  },
  tds_g_l: {
    titulo: "Sólidos totales disueltos (TDS)",
    queMide: "La cantidad total de sales y minerales disueltos.",
    regla: "Norma hondureña: máximo admisible 1000 mg/L (1 g/L). La OMS considera bueno el sabor por debajo de unos 600 mg/L.",
    leer: (valor) => {
      const mg = valor * 1000;
      if (mg > 1000) return { estado: "fuera", resumen: "Por encima del máximo admisible.", frases: ["Con más de 1000 mg/L el sabor es cada vez menos agradable y aparecen incrustaciones en tuberías y equipos."] };
      if (mg > 600) return { estado: "atencion", resumen: "Bajo el máximo, pero con sabor perceptible.", frases: ["Está por debajo del límite de la norma; la OMS lo considera de sabor aceptable, no bueno."] };
      return { estado: "dentro", resumen: "Bajo el máximo admisible, con sabor bueno según la OMS.", frases: [] };
    },
    nota: "El equipo calcula el TDS a partir de la conductividad (× 0.65); no se pesó en laboratorio. Tampoco dice qué sales son."
  },
  conductividad: {
    titulo: "Conductividad",
    queMide: "Qué tanto conduce la electricidad el agua; sube con las sales disueltas.",
    regla: "Norma hondureña: recomendado hasta 400 µS/cm (valor recomendado, sin máximo).",
    leer: (spc) => {
      if (spc > 400) return { estado: "atencion", resumen: "Por encima de lo recomendado, pero es agua dulce.", frases: ["El agua de mar ronda 50 000 µS/cm; esto sigue siendo agua dulce.", "Por sí sola no prueba que entre agua salada al acuífero: para eso hay que medir cloruro y sodio."] };
      return { estado: "dentro", resumen: "Dentro de lo recomendado.", frases: [] };
    }
  },
  salinidad: {
    titulo: "Salinidad",
    queMide: "Sales disueltas expresadas como salinidad (ppt).",
    regla: "Ni la norma hondureña ni la OMS la regulan.",
    leer: (valor) => ({ estado: "info", resumen: valor < 1 ? "Agua dulce (menos de 1 ppt)." : "Agua salobre (1 ppt o más).", frases: [] }),
    nota: "El equipo la calcula a partir de la conductividad: no es un dato independiente."
  },
  temperatura_c: {
    titulo: "Temperatura",
    queMide: "Temperatura del agua al medirla.",
    regla: "Norma hondureña: recomendado de 18 a 30 °C. La OMS no fija límite.",
    leer: (valor) => {
      if (valor > 35) return { estado: "atencion", resumen: "Muy alta para agua de pozo.", frases: ["Puede indicar que se midió en un tanque o en una tubería expuesta al sol."] };
      if (valor > 30) return { estado: "atencion", resumen: "Sobre lo recomendado, algo esperable por el clima de Choluteca.", frases: ["El agua caliente favorece microorganismos y la corrosión."] };
      return { estado: "dentro", resumen: "Dentro de lo recomendado.", frases: [] };
    }
  },
  oxigeno_disuelto: {
    titulo: "Oxígeno disuelto",
    queMide: "Cuánto oxígeno lleva el agua, en % de saturación.",
    regla: "Ni la norma hondureña ni la OMS fijan un límite.",
    leer: (valor) => {
      if (valor < 20) return { estado: "info", resumen: "Agua casi sin oxígeno, común en pozos.", frases: ["Sin oxígeno pueden quedar hierro o manganeso disueltos, que manchan al airearse."] };
      if (valor > 60) return { estado: "info", resumen: "Alto para agua subterránea.", frases: ["Probablemente el agua se aireó al tomar la muestra (chorro, tanque)."] };
      return { estado: "info", resumen: "Nivel intermedio.", frases: [] };
    }
  },
  cloro_residual: {
    titulo: "Cloro residual",
    queMide: "Cloro libre que queda en el agua tras desinfectarla.",
    regla: "Norma hondureña: recomendado de 0.5 a 1.0 mg/L en agua desinfectada; máximo 5 mg/L (también el valor de salud de la OMS).",
    leer: (valor) => {
      if (valor <= 0.1) return { estado: "no_detectado", resumen: "Equivale a «no detectado».", frases: ["En agua de pozo sin clorar, un valor así está en el límite de detección del método y puede deberse a hierro o manganeso.", "No indica que el pozo esté desinfectado."] };
      if (valor < 0.5) return { estado: "atencion", resumen: "Por debajo de lo recomendado para agua desinfectada.", frases: [] };
      if (valor > 5) return { estado: "fuera", resumen: "Por encima del máximo.", frases: [] };
      return { estado: "dentro", resumen: "Dentro de lo recomendado.", frases: [] };
    }
  }
};

// Lectura lista para mostrar de un parámetro de un pozo.
export const lecturaDe = (campo, pozo = {}) => {
  const definicion = PARAMETROS[campo];
  if (!definicion) return null;
  const valor = campo === "conductividad" ? conductividadDe(pozo)?.spc : pozo[campo];
  if (!hay(valor)) return { ...definicion, campo, valor: null, estado: "sin", resumen: "No se midió en este pozo.", frases: [] };
  const lectura = definicion.leer(Number(valor));
  return { ...definicion, campo, valor: Number(valor), ...lectura, revisiones: revisionesDelDato(pozo).filter((aviso) => aviso.campo === campo) };
};
