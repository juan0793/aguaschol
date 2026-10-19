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
