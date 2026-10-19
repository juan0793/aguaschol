// Coloca las etiquetas numeradas del mapa de barrio sin que se encimen. Cada punto
// prueba su propia posición y, si está ocupada, anillos cada vez más lejanos; quien
// queda desplazado se une a su punto con una línea. Sin dependencias, para probarlo solo.

/**
 * @param {{ x: number, y: number, ancho: number }[]} puntos  posición en el lienzo y ancho de su etiqueta
 * @param {object} opciones
 * @param {number} opciones.alto  alto de cada etiqueta
 * @param {number} opciones.lienzoAncho
 * @param {number} opciones.lienzoAlto
 * @returns {{ x: number, y: number, movida: boolean }[]}  centro de cada etiqueta, en el mismo orden
 */
export const ubicarEtiquetas = (puntos = [], { alto = 26, lienzoAncho = 1400, lienzoAlto = 820, anillos = 5 } = {}) => {
  const colocadas = [];
  const separacion = 2;
  const choca = (x, y, ancho) => colocadas.some((otra) =>
    Math.abs(otra.x - x) < (otra.ancho + ancho) / 2 + separacion && Math.abs(otra.y - y) < alto + separacion);
  const dentro = (x, y, ancho) => x - ancho / 2 >= 2 && x + ancho / 2 <= lienzoAncho - 2 && y - alto / 2 >= 2 && y + alto / 2 <= lienzoAlto - 2;

  return puntos.map((punto) => {
    const candidatos = [[punto.x, punto.y]];
    for (let anillo = 1; anillo <= anillos; anillo += 1) {
      const radio = anillo * (alto + separacion + 2);
      const pasos = 8 * anillo;
      for (let paso = 0; paso < pasos; paso += 1) {
        const angulo = -Math.PI / 2 + (paso / pasos) * Math.PI * 2;
        candidatos.push([punto.x + Math.cos(angulo) * radio * 1.25, punto.y + Math.sin(angulo) * radio]);
      }
    }
    const libre = candidatos.find(([x, y]) => dentro(x, y, punto.ancho) && !choca(x, y, punto.ancho));
    const [x, y] = libre || [punto.x, punto.y];
    colocadas.push({ x, y, ancho: punto.ancho });
    return { x, y, movida: x !== punto.x || y !== punto.y };
  });
};

// Folio de cada punto en el informe: 1, 2, 3… por jornada, barrio y punto, en el mismo
// orden en que salen las tablas. El mapa del barrio usa el mismo número.
export const foliosDelInforme = (jornadas = []) => {
  const folios = new Map();
  let numero = 0;
  for (const jornada of jornadas) {
    for (const zona of jornada.data?.zones || []) {
      for (const punto of zona.items || []) {
        numero += 1;
        folios.set(punto, numero);
      }
    }
  }
  return folios;
};

export const claveMapaBarrio = (dateKey, zona) => `${dateKey}|${zona.overrideKey || zona.zone}`;

// Proyección de OpenStreetMap en píxeles del mundo a un zoom dado.
const TILE = 256;
export const mundoX = (lng, z) => ((lng + 180) / 360) * TILE * 2 ** z;
export const mundoY = (lat, z) => {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * TILE * 2 ** z;
};

const coordenadas = (punto) => {
  if (punto.latitude == null || punto.longitude == null || punto.latitude === "" || punto.longitude === "") return null;
  const lat = Number(punto.latitude);
  const lng = Number(punto.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 85 ? { lat, lng } : null;
};

// Dentro de una hoja: primero por clave (manzana y lote seguidos), luego de norte a sur.
const ordenarHoja = (puntos, claveDe) => [...puntos].sort((a, b) => {
  const claveA = claveDe(a);
  const claveB = claveDe(b);
  if (claveA && claveB && claveA !== claveB) return claveA.localeCompare(claveB, "es", { numeric: true });
  if (Boolean(claveA) !== Boolean(claveB)) return claveA ? -1 : 1;
  const posA = coordenadas(a);
  const posB = coordenadas(b);
  if (posA && posB) return posB.lat - posA.lat || posA.lng - posB.lng;
  return 0;
});

/**
 * Divide los puntos de un barrio en hojas del mapa: cada hoja es lo que cabe en el lienzo
 * a zoom 19, la escala en que se leen los números casa por casa. Las hojas van de norte a
 * sur y de oeste a este; los puntos sin coordenadas quedan en la última.
 * @returns {object[][]}  puntos de cada hoja, ya ordenados
 */
export const dividirEnHojas = (puntos = [], { ancho = 1500, alto = 860, margen = 70, zoom = 19, minimo = 12, claveDe = () => "" } = {}) => {
  const conPosicion = puntos.filter(coordenadas);
  const sinPosicion = puntos.filter((punto) => !coordenadas(punto));
  if (!conPosicion.length) return puntos.length ? [ordenarHoja(puntos, claveDe)] : [];
  const xs = conPosicion.map((punto) => mundoX(Number(punto.longitude), zoom));
  const ys = conPosicion.map((punto) => mundoY(Number(punto.latitude), zoom));
  const anchoCelda = ancho - margen * 2;
  const altoCelda = alto - margen * 2;
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  if (Math.max(...xs) - minX <= anchoCelda && Math.max(...ys) - minY <= altoCelda) return [ordenarHoja(puntos, claveDe)];

  const celdas = new Map();
  conPosicion.forEach((punto, indice) => {
    const fila = Math.floor((ys[indice] - minY) / altoCelda);
    const columna = Math.floor((xs[indice] - minX) / anchoCelda);
    const clave = `${fila}:${columna}`;
    if (!celdas.has(clave)) celdas.set(clave, { fila, columna, puntos: [] });
    celdas.get(clave).puntos.push(punto);
  });
  // Una celda con pocos puntos se une a la vecina más cercana si juntas caben en una
  // hoja a un zoom menos: así no salen hojas con tres puntos.
  const posicion = new Map(conPosicion.map((punto, indice) => [punto, { x: xs[indice], y: ys[indice] }]));
  const limites = (lista) => {
    const px = lista.map((punto) => posicion.get(punto));
    return { x0: Math.min(...px.map((p) => p.x)), x1: Math.max(...px.map((p) => p.x)), y0: Math.min(...px.map((p) => p.y)), y1: Math.max(...px.map((p) => p.y)) };
  };
  const centro = (lista) => { const l = limites(lista); return { x: (l.x0 + l.x1) / 2, y: (l.y0 + l.y1) / 2 }; };
  let grupos = [...celdas.values()];
  for (;;) {
    const chica = grupos.filter((grupo) => grupo.puntos.length < minimo && !grupo.fija).sort((a, b) => a.puntos.length - b.puntos.length)[0];
    if (!chica || grupos.length < 2) break;
    const c = centro(chica.puntos);
    const candidatas = grupos
      .filter((grupo) => grupo !== chica)
      .map((grupo) => {
        const unidos = limites([...grupo.puntos, ...chica.puntos]);
        const cabe = unidos.x1 - unidos.x0 <= anchoCelda * 2 && unidos.y1 - unidos.y0 <= altoCelda * 2;
        const otro = centro(grupo.puntos);
        return { grupo, cabe, distancia: Math.hypot(otro.x - c.x, otro.y - c.y) };
      })
      .filter((item) => item.cabe)
      .sort((a, b) => a.distancia - b.distancia);
    if (!candidatas.length) { chica.fija = true; continue; }
    const destino = candidatas[0].grupo;
    destino.puntos.push(...chica.puntos);
    destino.fila = Math.min(destino.fila, chica.fila);
    destino.columna = Math.min(destino.columna, chica.columna);
    grupos = grupos.filter((grupo) => grupo !== chica);
  }
  const hojas = grupos
    .sort((a, b) => a.fila - b.fila || a.columna - b.columna)
    .map((celda) => celda.puntos);
  if (sinPosicion.length) hojas[hojas.length - 1].push(...sinPosicion);
  return hojas.map((hoja) => ordenarHoja(hoja, claveDe));
};

// Un barrio que aparece en varias jornadas se une en uno solo: el informe se ordena por
// zona y el día pasa a ser un dato de cada punto (`__dia`).
export const unirBarrios = (jornadas = []) => {
  const barrios = new Map();
  for (const jornada of jornadas) {
    for (const zona of jornada.data?.zones || []) {
      const clave = zona.overrideKey || zona.zone;
      if (!barrios.has(clave)) barrios.set(clave, { ...zona, items: [], dias: [] });
      const barrio = barrios.get(clave);
      barrio.items.push(...(zona.items || []).map((punto) => ({ ...punto, __dia: jornada.dateKey })));
      if (!barrio.dias.includes(jornada.dateKey)) barrio.dias.push(jornada.dateKey);
    }
  }
  return [...barrios.values()].map((barrio) => {
    const precisiones = barrio.items.map((punto) => Number(punto.accuracy_meters)).filter((valor) => Number.isFinite(valor) && valor > 0);
    return {
      ...barrio,
      clavesTotal: new Set(barrio.items.map((punto) => punto.report_key).filter(Boolean)).size,
      averageAccuracy: precisiones.length ? Number((precisiones.reduce((t, v) => t + v, 0) / precisiones.length).toFixed(1)) : null
    };
  });
};

/**
 * Láminas del informe de catastro: cada barrio se parte en hojas del mapa y cada hoja es
 * una lámina con número único (L1, L2…). Los folios siguen el orden barrio → lámina →
 * punto, y es el mismo orden de las tablas.
 * @returns {{ barrios: object[], laminas: object[], folios: Map }}
 */
export const armarLaminas = (barrios = [], { conMapa = true, claveDe = () => "", ancho = 1800, alto = 800 } = {}) => {
  const folios = new Map();
  const laminas = [];
  let folio = 0;
  const resultado = barrios.map((barrio) => {
    const hojas = conMapa ? dividirEnHojas(barrio.items, { claveDe, ancho, alto }) : [ordenarHoja(barrio.items, claveDe)];
    const propias = hojas.map((puntos) => {
      const desde = folio + 1;
      puntos.forEach((punto) => { folio += 1; folios.set(punto, folio); });
      const lamina = { numero: laminas.length + 1, barrio: barrio.overrideKey || barrio.zone, puntos, desde, hasta: folio };
      laminas.push(lamina);
      return lamina;
    });
    return { ...barrio, items: hojas.flat(), laminas: propias };
  });
  return { barrios: resultado, laminas, folios };
};
