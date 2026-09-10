export const filaVacia = (motivoPorDefecto) => ({
  numero_abonado: "",
  clave_catastral: "",
  abonado_nombre: "",
  motivo: motivoPorDefecto,
  observacion: ""
});

// Interpreta el pegado masivo: "abonado  clave  motivo" por linea.
export const parsearPegado = (texto, motivos) => {
  const porEtiqueta = new Map(motivos.map((item) => [item.etiqueta.toLowerCase(), item.codigo]));
  const codigos = new Set(motivos.map((item) => item.codigo));

  return String(texto || "")
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => {
      const partes = linea.split(/\t+|\s{2,}|;|,/).map((parte) => parte.trim()).filter(Boolean);
      const [abonado = "", clave = "", motivoTexto = "", ...resto] = partes;
      const directo = motivoTexto.toUpperCase().replace(/\s+/g, "_");
      return {
        numero_abonado: abonado,
        clave_catastral: clave,
        abonado_nombre: "",
        motivo: codigos.has(directo) ? directo : porEtiqueta.get(motivoTexto.toLowerCase()) || motivos[0]?.codigo || "OTRO",
        observacion: resto.join(" ")
      };
    });
};

const llaveDocumento = (fila) =>
  `${String(fila?.numero_abonado || "").trim().toUpperCase()}|${String(fila?.clave_catastral || "").trim().toUpperCase()}`;

// Misma regla que el backend (detectarDuplicadosEnLote): un documento repite a
// otro cuando coinciden abonado y clave. Devuelve las posiciones de `filas` que
// chocan contra el detalle ya guardado o contra una fila anterior de la captura,
// para poder marcarlas antes de mandar el cierre.
export const posicionesDuplicadas = (filas = [], existentes = []) => {
  const vistos = new Set();
  existentes.forEach((fila) => {
    const llave = llaveDocumento(fila);
    if (llave !== "|") vistos.add(llave);
  });

  const posiciones = [];
  filas.forEach((fila, indice) => {
    const llave = llaveDocumento(fila);
    if (llave === "|") return;
    if (vistos.has(llave)) posiciones.push(indice);
    else vistos.add(llave);
  });
  return posiciones;
};
