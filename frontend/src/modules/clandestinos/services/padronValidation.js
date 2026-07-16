const serviceValue = (value) => String(value || "").trim().toUpperCase() === "S" ? "Si" : "No";

export const buildPadronValidation = (form, alcaldiaMatch, aguasMatch) => {
  const appearsInAguas = Boolean(aguasMatch || alcaldiaMatch?.exists_in_aguas);
  const conclusion = alcaldiaMatch
    ? appearsInAguas
      ? "Aparece en Alcaldia y Aguas."
      : "Aparece en Alcaldia pero no en Aguas. Posible clandestino."
    : appearsInAguas
      ? "Aparece en Aguas y no en Alcaldia."
      : "No aparece en Alcaldia ni en Aguas. Posible clandestino.";
  return {
    ...form,
    estado_padron: appearsInAguas ? "varios_padrones" : "clandestino",
    clave_catastral: aguasMatch?.clave_catastral || form.clave_catastral,
    abonado: aguasMatch?.abonado || form.abonado,
    clave_alcaldia: alcaldiaMatch?.clave_catastral || "",
    nombre_alcaldia: alcaldiaMatch?.nombre || form.nombre_alcaldia || "",
    barrio_alcaldia: alcaldiaMatch?.caserio || alcaldiaMatch?.direccion || form.barrio_alcaldia || "",
    nombre_catastral: alcaldiaMatch?.nombre || aguasMatch?.nombre || form.nombre_catastral,
    inquilino: aguasMatch?.inquilino || form.inquilino,
    barrio_colonia: form.barrio_colonia || aguasMatch?.barrio_colonia || alcaldiaMatch?.caserio || alcaldiaMatch?.direccion || "",
    identidad: form.identidad || alcaldiaMatch?.identificador || "",
    conexion_agua: aguasMatch ? serviceValue(aguasMatch.agua) : form.conexion_agua,
    conexion_alcantarillado: aguasMatch ? serviceValue(aguasMatch.alcantarillado) : form.conexion_alcantarillado,
    recoleccion_desechos: aguasMatch ? serviceValue(aguasMatch.recoleccion) : form.recoleccion_desechos,
    comentarios: conclusion
  };
};
