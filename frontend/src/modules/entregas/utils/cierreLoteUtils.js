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
