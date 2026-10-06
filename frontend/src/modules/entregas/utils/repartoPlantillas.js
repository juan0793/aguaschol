// Repartos de referencia para cargar de una vez en "Reparto por barrio". Cada
// nombre se empareja con Personal de campo al aplicarlo; los codigos son los de
// barrio (primer segmento de la clave catastral).
//
// - hojas: lo que entregaba cada tecnico segun las hojas a mano de septiembre 2026.
// - octubre-2026: el reparto acordado en octubre 2026 (docs/reparto-barrios-octubre-2026.pdf).
//   Sindy toma una zona en el sur con barrios de Carlos y Luis, el resto se nivela con
//   cambios entre vecinos, y las tecnicas quedan con un poco menos de carga que los
//   tecnicos. Santa Lucia queda con Carlos y Campo Sol con Diego. Iztoca, Montelimar y
//   los residenciales del noreste quedan fuera (sin contrato o sin tecnico en las hojas).
//
// Solo Sayma tenia un orden de entrega real; en los demas el orden de la hoja no
// es una ruta, asi que no se guarda como orden_ruta. En octubre sus 8 barrios
// conservan el orden y los nuevos van donde ya pasa: Morazan y La Esperanza despues
// de Los Mangos; San Pedro del Norte y Lomas de Casipulu despues de Isidro Pineda.

export const PLANTILLAS_REPARTO = [
  {
    clave: "octubre-2026",
    titulo: "Reparto de octubre 2026",
    descripcion: "Sindy en el sur; las técnicas con un poco menos de carga que los técnicos.",
    ordenReal: ["Sayma"],
    zonas: {
      "Carlos Osorto": ["24", "14", "09", "48"],
      "Luis Fernando": ["22", "35", "52", "136", "70", "106", "88"],
      Alfredo: ["46", "04", "03", "01", "67", "51"],
      "Diego Zaldaña": ["25", "06", "26", "18", "05", "33", "36", "44"],
      "Oscar Álvarez": ["56", "29", "50", "55", "110", "62", "47", "89", "49", "31", "114"],
      Melissa: ["19", "08", "23", "02", "81", "21", "07"],
      Sayma: ["12", "13", "39", "16", "17", "27", "11", "15", "37", "64", "115", "147"],
      "Elmer Gómez": ["30", "43", "42", "60", "59", "38", "57", "117", "141", "96", "140"],
      Sindy: ["28", "45", "10", "20", "34", "40", "90", "107", "66"]
    }
  },
  {
    clave: "hojas",
    titulo: "Hojas de septiembre 2026",
    descripcion: "Lo que cada técnico entregaba según las hojas escritas a mano.",
    ordenReal: ["Sayma"],
    zonas: {
      "Carlos Osorto": ["14", "24", "10", "09", "19", "45", "38", "40", "34", "66"],
      "Luis Fernando": ["35", "115", "147", "28", "48", "70", "88", "52", "90", "136", "107", "106", "22"],
      Alfredo: ["01", "46", "04", "03", "47", "07", "81", "51", "44"],
      "Diego Zaldaña": ["05", "06", "33", "36", "18", "26", "25", "27", "20"],
      "Oscar Álvarez": ["17", "110", "50", "114", "56", "89", "62", "55", "29", "31"],
      Melissa: ["23", "08", "02", "21", "67", "43"],
      Sayma: ["12", "13", "39", "16", "11", "15", "37", "64"],
      "Elmer Gómez": ["49", "30", "60", "96", "59", "117", "42", "57", "141", "140"]
    }
  }
];
