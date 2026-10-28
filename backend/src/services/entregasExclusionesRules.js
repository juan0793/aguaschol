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
