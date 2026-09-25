// Calculos puros de "Reparto por barrio": cargas por persona, meta pareja,
// colores de zona y emparejamiento de plantillas con Personal de campo.

// Ocho tonos categoricos validados (orden fijo, nunca se ciclan) y un noveno
// neutro. A partir del decimo responsable la zona se distingue por su etiqueta.
export const COLORES_ZONA = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948", "#3d3b36"];
export const COLOR_SIN_ASIGNAR = "#dfe6ee";
export const COLOR_ZONA_EXTRA = "#8b98a8";

const TIPOS_QUE_REPARTEN = new Set(["ENTREGA_FACTURAS", "TECNICO"]);

// Quienes cuentan para la meta: los que ya tienen barrios mas los activos cuyo
// tipo reparte, aunque todavia no tengan zona (una persona nueva sin barrios
// tambien debe aparecer como "sin carga").
export const participantesDelReparto = (barrios = [], personal = []) => {
  const conBarrios = new Set(barrios.filter((b) => b.responsable_id).map((b) => Number(b.responsable_id)));
  return personal
    .filter((p) => conBarrios.has(Number(p.id)) || (p.activo && TIPOS_QUE_REPARTEN.has(p.tipo_personal)))
    .sort((a, b) => Number(a.id) - Number(b.id));
};

// El color sigue a la persona (orden por id), no a su carga: filtrar o reordenar
// no debe repintar las zonas.
export const colorPorResponsable = (participantes = []) => {
  const mapa = new Map();
  participantes.forEach((persona, indice) => mapa.set(Number(persona.id), COLORES_ZONA[indice] || COLOR_ZONA_EXTRA));
  return mapa;
};

export const totalesPorResponsable = (barrios = []) => {
  const totales = new Map();
  let sinAsignar = { claves: 0, barrios: 0 };
  for (const barrio of barrios) {
    if (!barrio.responsable_id) {
      if (barrio.claves > 0) sinAsignar = { claves: sinAsignar.claves + barrio.claves, barrios: sinAsignar.barrios + 1 };
      continue;
    }
    const id = Number(barrio.responsable_id);
    const actual = totales.get(id) || { claves: 0, barrios: 0 };
    totales.set(id, { claves: actual.claves + barrio.claves, barrios: actual.barrios + 1 });
  }
  return { totales, sinAsignar };
};

export const metaPorPersona = (barrios = [], participantes = []) => {
  const total = barrios.reduce((suma, barrio) => suma + (barrio.claves || 0), 0);
  return participantes.length ? Math.round(total / participantes.length) : 0;
};

// Cinco tramos simetricos alrededor de la meta. La etiqueta siempre acompana al
// color: nunca se lee solo por tono.
export const TRAMOS_CARGA = [
  { clave: "muy-baja", etiqueta: "Muy liviano", hasta: -0.15, color: "#1c5cab" },
  { clave: "baja", etiqueta: "Liviano", hasta: -0.05, color: "#86b6ef" },
  { clave: "pareja", etiqueta: "Equilibrado", hasta: 0.05, color: "#c9c7c1" },
  { clave: "alta", etiqueta: "Cargado", hasta: 0.15, color: "#f2a19b" },
  { clave: "muy-alta", etiqueta: "Sobrecargado", hasta: Infinity, color: "#c8322f" }
];

export const desvioDeMeta = (claves, meta) => (meta ? (claves - meta) / meta : 0);

export const tramoDeCarga = (claves, meta) => {
  if (!claves) return { ...TRAMOS_CARGA[0], etiqueta: "Sin barrios" };
  const desvio = desvioDeMeta(claves, meta);
  return TRAMOS_CARGA.find((tramo) => desvio <= tramo.hasta);
};

export const formatoDesvio = (claves, meta) => {
  if (!meta) return "";
  const porcentaje = Math.round(desvioDeMeta(claves, meta) * 100);
  if (porcentaje === 0) return "en la meta";
  return `${porcentaje > 0 ? "+" : "−"}${Math.abs(porcentaje)} %`;
};

// Frase completa para textos corridos: "en la meta", "4 % sobre la meta"...
export const desvioEnFrase = (claves, meta) => {
  if (!meta) return "";
  const porcentaje = Math.round(desvioDeMeta(claves, meta) * 100);
  if (porcentaje === 0) return "en la meta";
  return `${Math.abs(porcentaje)} % ${porcentaje > 0 ? "sobre" : "bajo"} la meta`;
};

// Barrios de una persona en el orden en que se entregan: primero los que tienen
// orden de ruta, despues el resto de mayor a menor carga.
export const barriosDeResponsable = (barrios = [], responsableId) =>
  barrios
    .filter((barrio) => Number(barrio.responsable_id) === Number(responsableId))
    .sort((a, b) => {
      const oa = a.orden_ruta || Infinity;
      const ob = b.orden_ruta || Infinity;
      if (oa !== ob) return oa - ob;
      return b.claves - a.claves || a.nombre.localeCompare(b.nombre);
    });

const normalizar = (texto) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

// Empareja un nombre de plantilla ("Luis Fernando") con Personal de campo. Gana
// quien comparte mas palabras; con empate o sin coincidencias no se adivina.
export const emparejarNombre = (nombre, personal = []) => {
  const buscadas = normalizar(nombre);
  const puntajes = personal
    .filter((persona) => persona.activo)
    .map((persona) => {
      const palabras = new Set(normalizar(persona.nombre_completo));
      return { persona, puntaje: buscadas.filter((palabra) => palabras.has(palabra)).length };
    })
    .filter((item) => item.puntaje > 0)
    .sort((a, b) => b.puntaje - a.puntaje);
  if (!puntajes.length) return null;
  if (puntajes[1] && puntajes[1].puntaje === puntajes[0].puntaje) return null;
  return puntajes[0].persona;
};

// Convierte una plantilla + el emparejamiento elegido en asignaciones para la API.
// Los barrios de la plantilla que no existen en el reparto actual se informan,
// no se inventan. Los barrios de personas sin emparejar quedan sin asignar.
export const asignacionesDePlantilla = (plantilla, emparejamiento = {}, barrios = []) => {
  const existentes = new Set(barrios.map((barrio) => barrio.codigo));
  const asignaciones = new Map();
  const desconocidos = [];
  const ordenReal = new Set(plantilla.ordenReal || []);
  for (const [nombre, codigos] of Object.entries(plantilla.zonas)) {
    const responsable = emparejamiento[nombre] ? Number(emparejamiento[nombre]) : null;
    codigos.forEach((codigo, indice) => {
      if (!existentes.has(codigo)) { desconocidos.push(codigo); return; }
      asignaciones.set(codigo, {
        barrio_codigo: codigo,
        responsable_id: responsable,
        orden_ruta: responsable && ordenReal.has(nombre) ? indice + 1 : null
      });
    });
  }
  // Lo que la plantilla no menciona queda libre: aplicar una plantilla es un
  // reparto completo, no una suma sobre el anterior.
  for (const barrio of barrios) {
    if (!asignaciones.has(barrio.codigo) && barrio.responsable_id) {
      asignaciones.set(barrio.codigo, { barrio_codigo: barrio.codigo, responsable_id: null, orden_ruta: null });
    }
  }
  return { asignaciones: [...asignaciones.values()], desconocidos };
};

// Texto plano para pegar en WhatsApp o un correo.
export const repartoComoTexto = ({ barrios = [], participantes = [], meta = 0, titulo = "Reparto de barrios" }) => {
  const { totales, sinAsignar } = totalesPorResponsable(barrios);
  const lineas = [`${titulo} (meta ${meta.toLocaleString("en-US")} claves por persona)`, ""];
  for (const persona of participantes) {
    const total = totales.get(Number(persona.id)) || { claves: 0, barrios: 0 };
    lineas.push(`${persona.nombre_completo} — ${total.claves.toLocaleString("en-US")} claves`);
    barriosDeResponsable(barrios, persona.id).forEach((barrio, indice) =>
      lineas.push(`  ${barrio.orden_ruta || indice + 1}. ${barrio.nombre} (${barrio.claves.toLocaleString("en-US")})`)
    );
    lineas.push("");
  }
  if (sinAsignar.barrios) lineas.push(`Sin asignar — ${sinAsignar.claves.toLocaleString("en-US")} claves en ${sinAsignar.barrios} barrios`);
  return lineas.join("\n").trim();
};
