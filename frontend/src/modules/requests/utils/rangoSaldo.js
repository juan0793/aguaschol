// Listado por categorías: rango de saldo (límites, escala del deslizador), filtros y
// orden. Todo se aplica en el navegador sobre el listado ya generado, así deslizar,
// buscar u ordenar no vuelve a consultar el padrón.

const numero = (value) => Number(value) || 0;
const dosDecimales = (value) => Number(value.toFixed(2));

// Posiciones del deslizador. La deuda está muy cargada hacia abajo (casi todos deben
// poco y unos pocos deben muchísimo): con una escala pareja, todo lo útil quedaría en
// el primer milímetro. La curva cúbica le da recorrido a los montos chicos.
export const POSICIONES = 1000;
const CURVA = 3;

export const limitesDeSaldo = (result) => {
  const totales = (result?.rows || []).map((row) => numero(row.total));
  if (!totales.length) return { min: 0, max: 0 };
  return { min: Math.floor(Math.min(0, ...totales)), max: Math.ceil(Math.max(0, ...totales)) };
};

const redondear = (value) => {
  const abs = Math.abs(value);
  const paso = abs < 1000 ? 10 : abs < 10000 ? 50 : abs < 100000 ? 500 : 1000;
  return Math.round(value / paso) * paso;
};

export const posicionAValor = (posicion, { min, max }) => {
  if (posicion <= 0) return min;
  if (posicion >= POSICIONES) return max;
  const valor = min + (max - min) * (posicion / POSICIONES) ** CURVA;
  return Math.min(max, Math.max(min, redondear(valor)));
};

export const valorAPosicion = (valor, { min, max }) => {
  if (max <= min) return 0;
  const fraccion = Math.min(1, Math.max(0, (valor - min) / (max - min)));
  return Math.round(POSICIONES * Math.cbrt(fraccion));
};

// Varias posiciones seguidas dan el mismo monto redondeado (sobre todo cerca de cero).
// Con las flechas del teclado se salta a la primera posición que sí cambia el monto;
// si no, la flecha parecería no hacer nada.
export const posicionVecina = (posicion, direccion, limites) => {
  const actual = posicionAValor(posicion, limites);
  let siguiente = posicion;
  do { siguiente += direccion; } while (siguiente > 0 && siguiente < POSICIONES && posicionAValor(siguiente, limites) === actual);
  return Math.min(POSICIONES, Math.max(0, siguiente));
};

export const cubreTodo = (desde, hasta, limites) => desde <= limites.min && hasta >= limites.max;

const sumar = (rows, campo) => dosDecimales(rows.reduce((suma, row) => suma + numero(row[campo]), 0));

const rearmar = (result, rows, barrios, extra) => ({
  ...result,
  request: { ...result.request, ...extra },
  rows,
  summary: {
    ...result.summary,
    total_registros: rows.length,
    total_barrios: barrios.length,
    tarifa_total: sumar(rows, "tarifa"),
    total_con_interes: sumar(rows, "total"),
    barrios
  }
});

// Devuelve el mismo resultado de /claves/requests/run solo con los abonados que cumplen
// `cumple`, y los totales recalculados. `extra` se anota en `request` para que el
// documento diga con qué se acotó. Lo que se ve, se imprime: la salida a papel y a PDF
// usa este mismo objeto.
export const filtrarFilas = (result, cumple, extra = {}) => {
  if (!result) return result;
  const rows = (result.rows || []).filter(cumple);
  const barrios = (result.summary?.barrios || [])
    .map((barrio) => {
      const filas = (barrio.rows || []).filter(cumple);
      return { ...barrio, rows: filas, total_registros: filas.length, tarifa_total: sumar(filas, "tarifa"), total_con_interes: sumar(filas, "total") };
    })
    .filter((barrio) => barrio.rows.length);
  return rearmar(result, rows, barrios, extra);
};

// Saldo = total con intereses de cada abonado.
export const filtrarPorSaldo = (result, desde, hasta) => {
  if (!result || cubreTodo(desde, hasta, limitesDeSaldo(result))) return result;
  return filtrarFilas(result, (row) => { const total = numero(row.total); return total >= desde && total <= hasta; }, { rango_saldo: { desde, hasta } });
};

const sinAcentos = (value) => String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Búsqueda por nombre, abonado o clave, sin importar acentos ni mayúsculas.
export const filtrarPorTexto = (result, texto) => {
  const buscado = sinAcentos(texto).trim();
  if (!result || !buscado) return result;
  return filtrarFilas(result, (row) => [row.nombre, row.abonado, row.clave_catastral].some((value) => sinAcentos(value).includes(buscado)), { busqueda: String(texto).trim() });
};

// Mayor saldo primero: dentro de cada barrio, y los barrios por lo que deben.
export const ordenarPorSaldo = (result) => {
  if (!result) return result;
  const porSaldo = (a, b) => numero(b.total) - numero(a.total);
  const barrios = (result.summary?.barrios || [])
    .map((barrio) => ({ ...barrio, rows: [...(barrio.rows || [])].sort(porSaldo) }))
    .sort((a, b) => numero(b.total_con_interes) - numero(a.total_con_interes));
  return { ...result, request: { ...result.request, orden: "saldo" }, rows: [...(result.rows || [])].sort(porSaldo), summary: { ...result.summary, barrios } };
};
