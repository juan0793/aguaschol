// Exclusiones de entrega: claves catastrales y números de abonado cuya factura la
// entrega otro departamento de la empresa. Si un técnico los anota como sobrante,
// el cierre le avisa (no lo bloquea). Reglas puras; el frontend repite `llaveExclusion`
// en utils/cierreLoteUtils.js para comparar sin pedir nada al servidor.

export const TIPOS_EXCLUSION = ["CLAVE", "ABONADO"];
export const MAX_EXCLUSIONES_POR_ENVIO = 500;
const MAX_NOTA = 120;

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

// La clave se compara por sus cifras ("25-11-08-03" = "25110803"); el abonado, sin
// espacios ni ceros a la izquierda ("0123" = "123").
export const llaveExclusion = (tipo, valor) => {
  const texto = String(valor ?? "").trim();
  if (tipo === "CLAVE") return texto.replace(/\D/g, "");
  if (tipo === "ABONADO") return texto.replace(/\s+/g, "").toUpperCase().replace(/^0+(?=.)/, "");
  return "";
};

// Valor que se guarda y se muestra: la clave tal como se escribió (sin espacios) y
// el abonado sin espacios.
const valorVisible = (valor) => String(valor ?? "").trim().replace(/\s+/g, "");

const valido = (tipo, llave) => (tipo === "CLAVE" ? llave.length >= 6 && /\d/.test(llave) && /[1-9]/.test(llave) : llave.length > 0 && llave.length <= 30);

// Un envío trae un tipo, uno o varios valores (pegados uno por línea o separados por
// coma, punto y coma o espacios) y una nota opcional que se repite en todos.
export const normalizarEnvioExclusiones = (payload = {}) => {
  const tipo = String(payload.tipo || "").trim().toUpperCase();
  if (!TIPOS_EXCLUSION.includes(tipo)) throw fail("Elige si excluyes claves catastrales o números de abonado.");
  const crudos = Array.isArray(payload.valores) ? payload.valores : String(payload.valores ?? payload.valor ?? "").split(/[\n,;\t ]+/);
  const nota = String(payload.nota ?? "").trim().replace(/\s+/g, " ");
  if (nota.length > MAX_NOTA) throw fail(`La nota admite hasta ${MAX_NOTA} caracteres.`);

  const vistos = new Set();
  const items = [];
  const invalidos = [];
  crudos.map(valorVisible).filter(Boolean).forEach((valor) => {
    const llave = llaveExclusion(tipo, valor);
    if (!valido(tipo, llave)) { invalidos.push(valor); return; }
    if (vistos.has(llave)) return;
    vistos.add(llave);
    items.push({ tipo, valor, llave, nota: nota || null });
  });
  if (!items.length) {
    throw fail(invalidos.length
      ? `No se reconoció ${tipo === "CLAVE" ? "ninguna clave catastral" : "ningún número de abonado"}: ${invalidos.slice(0, 3).join(", ")}${invalidos.length > 3 ? "…" : ""}.`
      : `Escribe al menos ${tipo === "CLAVE" ? "una clave catastral" : "un número de abonado"}.`);
  }
  if (items.length > MAX_EXCLUSIONES_POR_ENVIO) throw fail(`Se pueden agregar hasta ${MAX_EXCLUSIONES_POR_ENVIO} por vez.`);
  return { tipo, items, invalidos };
};

// La exclusión que corresponde a un documento (por abonado o por clave), o null.
export const exclusionDeDocumento = (documento = {}, exclusiones = []) => {
  const abonado = llaveExclusion("ABONADO", documento.numero_abonado);
  const clave = llaveExclusion("CLAVE", documento.clave_catastral);
  return exclusiones.find((item) => (item.tipo === "ABONADO" && abonado && item.llave === abonado)
    || (item.tipo === "CLAVE" && clave && item.llave === clave)) || null;
};

/* -------------------------------------------------------------------------- */
/* Detalle de cada exclusión: cuenta del padrón y entrega del ciclo            */
/* -------------------------------------------------------------------------- */

const redondear = (valor) => Number(Number(valor || 0).toFixed(2));

// Índice del padrón por las mismas llaves que las exclusiones. Una clave puede tener
// varias cuentas; un abonado repetido se queda con todas sus filas.
export const indexarCuentas = (registros = []) => {
  const porAbonado = new Map();
  const porClave = new Map();
  const agregar = (mapa, llave, registro) => {
    if (!llave) return;
    if (!mapa.has(llave)) mapa.set(llave, []);
    mapa.get(llave).push(registro);
  };
  for (const registro of registros) {
    agregar(porAbonado, llaveExclusion("ABONADO", registro?.abonado), registro);
    agregar(porClave, llaveExclusion("CLAVE", registro?.clave_catastral), registro);
  }
  return { porAbonado, porClave };
};

// El barrio es el primer tramo de la clave ("14-30-08-84" → "14"), como en el reparto.
export const barrioDeClave = (clave) => {
  const texto = String(clave ?? "").trim();
  return texto.includes("-") ? texto.split("-")[0].replace(/\D/g, "") : "";
};

const cuentaVisible = (registro, conSaldo) => ({
  abonado: String(registro.abonado ?? "").trim(),
  clave_catastral: String(registro.clave_catastral ?? "").trim(),
  nombre: String(registro.inquilino || registro.nombre || "").trim(),
  barrio: String(registro.barrio_colonia ?? "").trim(),
  ...(conSaldo ? {
    capital: redondear(registro.valor),
    mora: redondear(registro.intereses),
    total: redondear(registro.total ?? Number(registro.valor || 0) + Number(registro.intereses || 0))
  } : {})
});

// Un documento es de la exclusión por su propia llave. Si el técnico lo anotó sin esa
// llave (sin abonado o sin clave), vale la otra del padrón: así una cuenta excluida
// por abonado no arrastra a otra cuenta con la misma clave.
const esDeLaExclusion = (documento, exclusion, cuentas) => {
  const abonado = llaveExclusion("ABONADO", documento.numero_abonado);
  const clave = llaveExclusion("CLAVE", documento.clave_catastral);
  if (exclusion.tipo === "ABONADO") {
    if (abonado) return abonado === exclusion.llave;
    return Boolean(clave) && cuentas.some((cuenta) => llaveExclusion("CLAVE", cuenta.clave_catastral) === clave);
  }
  if (clave) return clave === exclusion.llave;
  return Boolean(abonado) && cuentas.some((cuenta) => llaveExclusion("ABONADO", cuenta.abonado) === abonado);
};

const masReciente = (a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")) || Number(b.id || 0) - Number(a.id || 0);

// Qué pasó con la cuenta en el ciclo vigente. Una factura entregada no deja registro
// propio: el lote guarda cuántas se repartieron y anota solo las que sobraron. Por
// eso, si el barrio tuvo un lote cerrado y la cuenta no quedó de sobrante, el técnico
// la contó como entregada.
//   SOBRANTE     anotada como no entregada (sigue pendiente, no localizada o vencida)
//   REENTREGADA  anotada como no entregada y entregada después
//   ENTREGADA    el barrio tuvo un lote cerrado y la cuenta no quedó de sobrante
//   LOTE_ABIERTO el barrio tiene un lote todavía abierto
//   SIN_LOTE     el barrio no tuvo lote en el ciclo
//   SIN_BARRIO   no se sabe el barrio (la cuenta no está en el padrón)
export const entregaDelCiclo = ({ documentos = [], lotes = [], barrio = "" }) => {
  const documento = [...documentos].sort(masReciente)[0];
  if (documento) {
    return {
      estado: documento.estado === "REENTREGADA" ? "REENTREGADA" : "SOBRANTE",
      documento_estado: documento.estado,
      tecnico: documento.tecnico || "",
      fecha: documento.fecha || "",
      fecha_entrega_final: documento.fecha_entrega_final || "",
      lote_id: documento.lote_id ?? null,
      tipo_documento: documento.tipo_documento || ""
    };
  }
  const ordenados = [...lotes].sort(masReciente);
  const cerrado = ordenados.find((lote) => lote.estado !== "ABIERTO");
  const lote = cerrado || ordenados[0];
  if (lote) {
    return {
      estado: cerrado ? "ENTREGADA" : "LOTE_ABIERTO",
      tecnico: lote.tecnico || "",
      fecha: lote.fecha || "",
      lote_id: lote.id ?? null,
      tipo_documento: lote.tipo_documento || ""
    };
  }
  return { estado: barrio ? "SIN_LOTE" : "SIN_BARRIO" };
};

// Junta todo por exclusión: sus cuentas del padrón (con saldo solo si el usuario lo
// ve), la entrega del ciclo y cuántas veces quedó sin entregar en ciclos anteriores.
// `documentos` trae lo anotado como no entregado (sin cancelados) con `fecha` del
// lote; `lotes`, los del ciclo con su `barrio_codigo`.
export const detallarExclusiones = ({ exclusiones = [], indice, documentos = [], lotes = [], desde = "", conSaldo = false }) => {
  const lotesPorBarrio = new Map();
  for (const lote of lotes) {
    const codigo = String(lote.barrio_codigo || "");
    if (!lotesPorBarrio.has(codigo)) lotesPorBarrio.set(codigo, []);
    lotesPorBarrio.get(codigo).push(lote);
  }
  return exclusiones.map((exclusion) => {
    const registros = (exclusion.tipo === "ABONADO" ? indice?.porAbonado : indice?.porClave)?.get(exclusion.llave) || [];
    const cuentas = registros.map((registro) => cuentaVisible(registro, conSaldo));
    const barrio = barrioDeClave(cuentas[0]?.clave_catastral) || (exclusion.tipo === "CLAVE" ? barrioDeClave(exclusion.valor) : "");
    const suyos = documentos.filter((documento) => esDeLaExclusion(documento, exclusion, cuentas));
    const delCiclo = suyos.filter((documento) => !desde || String(documento.fecha || "") >= desde);
    const saldo = conSaldo
      ? cuentas.reduce((suma, cuenta) => ({ capital: redondear(suma.capital + cuenta.capital), mora: redondear(suma.mora + cuenta.mora), total: redondear(suma.total + cuenta.total) }), { capital: 0, mora: 0, total: 0 })
      : null;
    return {
      ...exclusion,
      cuentas,
      barrio_codigo: barrio,
      ...(saldo ? { saldo } : {}),
      entrega: entregaDelCiclo({ documentos: delCiclo, lotes: lotesPorBarrio.get(barrio) || [], barrio }),
      sin_entregar_antes: suyos.length - delCiclo.length
    };
  });
};

// Cifras de la lista: cuántas están en el padrón, cómo van en el ciclo y su saldo.
export const resumenExclusiones = (detalle = []) => {
  const resumen = { total: detalle.length, sin_padron: 0, por_estado: {}, capital: 0, mora: 0, saldo: 0 };
  for (const item of detalle) {
    if (!item.cuentas?.length) resumen.sin_padron += 1;
    const estado = item.entrega?.estado || "SIN_BARRIO";
    resumen.por_estado[estado] = (resumen.por_estado[estado] || 0) + 1;
    if (item.saldo) {
      resumen.capital += item.saldo.capital;
      resumen.mora += item.saldo.mora;
      resumen.saldo += item.saldo.total;
    }
  }
  return { ...resumen, capital: redondear(resumen.capital), mora: redondear(resumen.mora), saldo: redondear(resumen.saldo) };
};
