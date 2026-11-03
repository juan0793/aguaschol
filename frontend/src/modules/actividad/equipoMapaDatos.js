// Reglas del mapa del equipo (puras, con pruebas): estado de cada técnico según
// su última ubicación, colores y las capas GeoJSON del mapa.

// Colores que encienden sobre el fondo oscuro; cada técnico conserva el suyo por orden.
export const COLORES = ["#38bdf8", "#f472b6", "#facc15", "#4ade80", "#fb923c", "#a78bfa", "#2dd4bf", "#f87171", "#e879f9", "#a3e635", "#60a5fa", "#fbbf24"];
export const colorDe = (index) => COLORES[((index % COLORES.length) + COLORES.length) % COLORES.length];

export const EN_LINEA_MIN = 4; // el teléfono quieto manda una señal cada 2 min
export const RECIENTE_MIN = 30;

/** en_linea (≤ 4 min), reciente (≤ 30 min), inactivo (más) o sin_gps (nada en el día). */
export const estadoTecnico = (ubicacion, ahora = Date.now()) => {
  if (!ubicacion?.at) return "sin_gps";
  const minutos = (ahora - new Date(ubicacion.at).getTime()) / 60000;
  if (minutos <= EN_LINEA_MIN) return "en_linea";
  if (minutos <= RECIENTE_MIN) return "reciente";
  return "inactivo";
};

const punto = (lng, lat, properties) => ({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties });

/** Técnicos con color, conteos y estado; los que tienen trabajo o GPS van primero. */
export const tecnicosDelMapa = (data = {}, ahora = Date.now()) => {
  const conteo = new Map();
  for (const item of data.candidatos || []) {
    const actual = conteo.get(item.tecnico_id) || { pendientes: 0, revisados: 0, enviados: 0 };
    if (item.estado === "pendiente") actual.pendientes += 1;
    else { actual.revisados += 1; if (item.estado === "enviado") actual.enviados += 1; }
    conteo.set(item.tecnico_id, actual);
  }
  const orden = { en_linea: 0, reciente: 1, inactivo: 2, sin_gps: 3 };
  return (data.tecnicos || [])
    .map((tecnico, index) => ({ ...tecnico, color: colorDe(index), estado: estadoTecnico(tecnico.ubicacion, ahora), ...(conteo.get(tecnico.id) || { pendientes: 0, revisados: 0, enviados: 0 }) }))
    .filter((tecnico) => tecnico.ubicacion || tecnico.pendientes || tecnico.revisados)
    .sort((a, b) => orden[a.estado] - orden[b.estado] || b.pendientes + b.revisados - (a.pendientes + a.revisados) || String(a.nombre).localeCompare(String(b.nombre), "es"));
};

/** Capas: candidatos (color de su técnico) y recorridos del día. `soloId` deja uno solo. */
export const capasDelMapa = (data = {}, tecnicos = [], soloId = null) => {
  const colores = new Map(tecnicos.map((tecnico) => [tecnico.id, tecnico.color]));
  const nombres = new Map(tecnicos.map((tecnico) => [tecnico.id, tecnico.nombre]));
  const vale = (id) => soloId == null || Number(id) === Number(soloId);
  const candidatos = (data.candidatos || [])
    .filter((item) => vale(item.tecnico_id) && Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
    .map((item) => punto(item.longitude, item.latitude, {
      id: item.id, clave: item.clave || "", barrio: item.barrio || "", dictamen: item.dictamen || "", estado: item.estado,
      tecnico: nombres.get(item.tecnico_id) || "", color: colores.get(item.tecnico_id) || "#94a3b8"
    }));
  const rastros = tecnicos
    .filter((tecnico) => vale(tecnico.id) && (tecnico.rastro || []).length > 1)
    .map((tecnico) => ({ type: "Feature", geometry: { type: "LineString", coordinates: tecnico.rastro.map((p) => [p.longitude, p.latitude]) }, properties: { id: tecnico.id, color: tecnico.color } }));
  const precision = tecnicos
    .filter((tecnico) => vale(tecnico.id) && tecnico.ubicacion && tecnico.estado !== "sin_gps")
    .map((tecnico) => punto(tecnico.ubicacion.longitude, tecnico.ubicacion.latitude, { id: tecnico.id, color: tecnico.color, acc: Math.max(5, Number(tecnico.ubicacion.accuracy) || 0), lat: tecnico.ubicacion.latitude }));
  return {
    candidatos: { type: "FeatureCollection", features: candidatos },
    rastros: { type: "FeatureCollection", features: rastros },
    precision: { type: "FeatureCollection", features: precision }
  };
};

/** Recuadro [[oeste, sur], [este, norte]] de lo visible, o null si no hay nada. */
export const encuadre = (capas, tecnicos = []) => {
  const coords = [
    ...capas.candidatos.features.map((f) => f.geometry.coordinates),
    ...tecnicos.filter((t) => t.ubicacion).map((t) => [t.ubicacion.longitude, t.ubicacion.latitude])
  ];
  if (!coords.length) return null;
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
};

/** Suma una lectura en vivo al técnico: nueva ubicación y punto al final del recorrido. */
export const conLectura = (data, lectura) => {
  if (!data || !lectura?.user_id) return data;
  const nueva = { latitude: lectura.latitude, longitude: lectura.longitude, accuracy: lectura.accuracy, at: lectura.at };
  const existe = (data.tecnicos || []).some((t) => t.id === lectura.user_id);
  const tecnicos = existe
    ? data.tecnicos.map((t) => (t.id === lectura.user_id ? { ...t, ubicacion: nueva, rastro: [...(t.rastro || []), nueva].slice(-600) } : t))
    : [...(data.tecnicos || []), { id: lectura.user_id, nombre: lectura.nombre || "Técnico", ubicacion: nueva, rastro: [nueva] }];
  return { ...data, tecnicos };
};
