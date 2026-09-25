// Repartos de referencia para cargar de una vez en "Reparto por barrio". Cada
// nombre se empareja con Personal de campo al aplicarlo; los codigos son los de
// barrio (primer segmento de la clave catastral).
//
// - hojas: lo que entregaba cada tecnico segun las hojas a mano de septiembre 2026.
// - propuesta: reparto equilibrado armado con el padron y los poligonos del SIG
//   (docs/reparto-entregas.html): Sindy toma el noreste y se reacomodan los bordes.
//
// Solo Sayma tenia un orden de entrega real; en los demas el orden de la hoja no
// es una ruta, asi que no se guarda como orden_ruta.

export const PLANTILLAS_REPARTO = [
  {
    clave: "propuesta",
    titulo: "Propuesta equilibrada",
    descripcion: "Incluye a Sindy en el noreste y deja a todos cerca de la misma carga.",
    ordenReal: ["Sayma"],
    zonas: {
      "Carlos Osorto": ["14", "24", "10", "09"],
      "Luis Fernando": ["23", "35", "115", "147", "28", "48", "70", "88", "52", "90", "136", "107", "106", "65", "68", "69", "109", "119", "134", "183", "185"],
      Alfredo: ["04", "03", "45", "07", "38", "81", "40", "51", "34", "44", "66", "53", "54"],
      "Diego Saldaña": ["05", "06", "33", "36", "18", "26", "25", "27", "20"],
      "Oscar Álvarez": ["17", "01", "46", "110", "50", "47", "114", "62", "55", "29", "31", "124"],
      Melissa: ["08", "21", "19", "67", "22", "91"],
      Sayma: ["12", "13", "39", "16", "11", "15", "37", "64", "41", "61"],
      "Elmer Gómez": ["49", "30", "60", "02", "96", "59", "43", "117", "42", "141", "140", "63", "128", "132", "156"],
      Sindy: ["56", "89", "57", "58", "84", "87", "113", "177", "190", "195", "197"]
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
      "Diego Saldaña": ["05", "06", "33", "36", "18", "26", "25", "27", "20"],
      "Oscar Álvarez": ["17", "110", "50", "114", "56", "89", "62", "55", "29", "31"],
      Melissa: ["23", "08", "02", "21", "67", "43"],
      Sayma: ["12", "13", "39", "16", "11", "15", "37", "64"],
      "Elmer Gómez": ["49", "30", "60", "96", "59", "117", "42", "57", "141", "140"]
    }
  }
];
