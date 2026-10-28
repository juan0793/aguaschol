// Reglas de la pantalla Descartes: filtros, totales y la descripción de los filtros
// para el impreso. Trabajan sobre `items` de GET /entregas/descartes (todo lo que
// quedó sin entregar en el ciclo, ya marcado como repetido o no).

export const DESCARTES_FILTROS_INICIALES = { dia: "", q: "", barrio: "", tecnico: "", soloRepetidos: false };

const SIN_BARRIO = "Sin barrio";
const SIN_RESPONSABLE = "Sin responsable";

// Sin acentos ni mayúsculas, para que "zaldana" encuentre "Zaldaña".
export const normalizar = (texto) => String(texto ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim();

const soloDigitos = (texto) => String(texto ?? "").replace(/\D/g, "");

export const barrioDe = (item) => String(item.barrio_codigo || "").trim() || `N:${item.barrio_nombre || SIN_BARRIO}`;
export const tecnicoDe = (item) => (item.responsable_id ? String(item.responsable_id) : `N:${item.responsable_nombre || SIN_RESPONSABLE}`);
const nombreBarrio = (item) => item.barrio_nombre || SIN_BARRIO;
const nombreTecnico = (item) => item.responsable_nombre || SIN_RESPONSABLE;

// Busca por número de abonado, clave catastral (con o sin guiones) o nombre. Sin
// guiones solo desde 6 cifras: un número de abonado corto no debe caer en una clave.
export const coincideBusqueda = (item, q) => {
  const texto = normalizar(q);
  if (!texto) return true;
  if (normalizar(item.numero_abonado).includes(texto)) return true;
  if (normalizar(item.clave_catastral).includes(texto)) return true;
  if (normalizar(item.abonado_nombre).includes(texto)) return true;
  const digitos = soloDigitos(texto);
  return digitos.length >= 6 && digitos === texto.replace(/[\s-]/g, "") && soloDigitos(item.clave_catastral).includes(digitos);
};

// Todo menos el día: la franja de días cuenta con esto, así cada día dice cuántos
// le quedan con el barrio, el técnico y la búsqueda puestos.
export const filtrarSinDia = (items = [], filtros = DESCARTES_FILTROS_INICIALES) => items.filter((item) =>
  (!filtros.barrio || barrioDe(item) === filtros.barrio)
  && (!filtros.tecnico || tecnicoDe(item) === filtros.tecnico)
  && (!filtros.soloRepetidos || item.repetido)
  && coincideBusqueda(item, filtros.q));

export const filtrarDescartes = (items = [], filtros = DESCARTES_FILTROS_INICIALES) =>
  filtrarSinDia(items, filtros).filter((item) => !filtros.dia || item.fecha_lote === filtros.dia);

const contar = (items, llaveDe, nombreDe) => {
  const grupos = new Map();
  items.forEach((item) => {
    const llave = llaveDe(item);
    const grupo = grupos.get(llave) || { llave, nombre: nombreDe(item), documentos: 0, repetidos: 0 };
    grupo.documentos += 1;
    grupo.repetidos += item.repetido ? 1 : 0;
    grupos.set(llave, grupo);
  });
  return [...grupos.values()].sort((a, b) => b.documentos - a.documentos || b.repetidos - a.repetidos || a.nombre.localeCompare(b.nombre, "es"));
};

const llaveAbonado = (item) => {
  if (normalizar(item.numero_abonado)) return normalizar(item.numero_abonado);
  return normalizar(item.clave_catastral) ? `clave:${normalizar(item.clave_catastral)}` : `id:${item.id}`;
};

// Cifras de lo filtrado: documentos, repetidos, abonados distintos, documentos sin
// técnico y el reparto por técnico y por barrio (del que más tiene al que menos).
// "Sin responsable" sale en el reparto, pero no cuenta como técnico.
export const totalesDescartes = (items = []) => {
  const abonados = new Set(items.map(llaveAbonado));
  const abonadosRepetidos = new Set(items.filter((item) => item.repetido).map(llaveAbonado));
  const porTecnico = contar(items, tecnicoDe, nombreTecnico);
  return {
    documentos: items.length,
    repetidos: items.filter((item) => item.repetido).length,
    abonados: abonados.size,
    abonados_repetidos: abonadosRepetidos.size,
    sin_responsable: items.filter((item) => !item.responsable_id && !item.responsable_nombre).length,
    tecnicos: porTecnico.filter((fila) => fila.llave !== `N:${SIN_RESPONSABLE}`).length,
    por_tecnico: porTecnico,
    por_barrio: contar(items, barrioDe, nombreBarrio)
  };
};

// Los repetidos de lo filtrado agrupados por abonado: primero los que se repiten en
// más ciclos, después los que más veces quedaron sin entregar en este.
export const abonadosRepetidos = (items = []) => {
  const grupos = new Map();
  items.filter((item) => item.repetido).forEach((item) => {
    const llave = llaveAbonado(item);
    const grupo = grupos.get(llave) || { llave, documentos: [], anteriores: new Map(), ciclos_anteriores: 0 };
    grupo.documentos.push(item);
    (item.anteriores || []).forEach((previo) => grupo.anteriores.set(previo.id, previo));
    grupo.ciclos_anteriores = Math.max(grupo.ciclos_anteriores, Number(item.ciclos_anteriores) || 0);
    grupos.set(llave, grupo);
  });
  return [...grupos.values()].map((grupo) => {
    const documentos = [...grupo.documentos].sort((a, b) => (a.fecha_lote === b.fecha_lote ? b.id - a.id : a.fecha_lote < b.fecha_lote ? 1 : -1));
    const ultimo = documentos[0];
    return {
      llave: grupo.llave,
      numero_abonado: ultimo.numero_abonado,
      clave_catastral: documentos.find((item) => item.clave_catastral)?.clave_catastral || "",
      abonado_nombre: documentos.find((item) => item.abonado_nombre)?.abonado_nombre || "",
      barrio_nombre: ultimo.barrio_nombre,
      responsable_nombre: ultimo.responsable_nombre,
      ultima_fecha: ultimo.fecha_lote,
      ciclos_anteriores: grupo.ciclos_anteriores,
      veces_antes: grupo.anteriores.size,
      documentos
    };
  }).sort((a, b) => b.ciclos_anteriores - a.ciclos_anteriores
    || b.documentos.length - a.documentos.length
    || (a.ultima_fecha < b.ultima_fecha ? 1 : a.ultima_fecha > b.ultima_fecha ? -1 : 0));
};

// "mar 27/10": día de la semana con día y mes, para la franja y la lista.
export const diaCorto = (iso) => {
  const [y, m, d] = String(iso || "").slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";
  const semana = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-HN", { weekday: "short", timeZone: "UTC" }).replace(".", "");
  return `${semana} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
};

// Días con algo sin entregar, del más reciente al más viejo.
export const diasDescartes = (items = []) => {
  const dias = new Map();
  items.forEach((item) => {
    const dia = dias.get(item.fecha_lote) || { fecha: item.fecha_lote, documentos: 0, repetidos: 0, lotes: new Set() };
    dia.documentos += 1;
    dia.repetidos += item.repetido ? 1 : 0;
    dia.lotes.add(item.lote_id);
    dias.set(item.fecha_lote, dia);
  });
  return [...dias.values()].map((dia) => ({ ...dia, lotes: dia.lotes.size })).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
};

// Barrios y técnicos que aparecen en el ciclo, por nombre, para los selectores.
export const opcionesDescartes = (items = []) => {
  const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, "es");
  return {
    barrios: contar(items, barrioDe, nombreBarrio).sort(porNombre),
    tecnicos: contar(items, tecnicoDe, nombreTecnico).sort(porNombre)
  };
};

export const hayFiltros = (filtros = DESCARTES_FILTROS_INICIALES) =>
  Boolean(filtros.dia || normalizar(filtros.q) || filtros.barrio || filtros.tecnico || filtros.soloRepetidos);

const fechaCorta = (iso) => {
  const [y, m, d] = String(iso || "").slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : "—";
};

// Los filtros en palabras, en el orden en que se leen en la pantalla. Es lo que el
// impreso y el PDF ponen arriba de la lista.
export const describirFiltros = (filtros = DESCARTES_FILTROS_INICIALES, { items = [], ciclo = {} } = {}) => {
  const { barrios, tecnicos } = opcionesDescartes(items);
  const nombre = (lista, llave) => lista.find((item) => item.llave === llave)?.nombre || llave.replace(/^N:/, "");
  const periodo = filtros.dia
    ? `Día ${fechaCorta(filtros.dia)}`
    : ciclo.fecha_inicio ? `Todo el ciclo, del ${fechaCorta(ciclo.fecha_inicio)} al ${fechaCorta(ciclo.fecha_fin)}` : `Todo el ciclo, hasta el ${fechaCorta(ciclo.fecha_fin)}`;
  return [
    { rotulo: "Período", valor: periodo },
    filtros.barrio ? { rotulo: "Barrio", valor: nombre(barrios, filtros.barrio) } : null,
    filtros.tecnico ? { rotulo: "Técnico", valor: nombre(tecnicos, filtros.tecnico) } : null,
    normalizar(filtros.q) ? { rotulo: "Búsqueda", valor: `“${String(filtros.q).trim()}”` } : null,
    filtros.soloRepetidos ? { rotulo: "Antecedentes", valor: "Solo repetidos" } : null
  ].filter(Boolean);
};

// Columnas del impreso: la que tiene un solo valor por el filtro ya se lee arriba.
export const columnasImpresas = (filtros = DESCARTES_FILTROS_INICIALES) => ({
  fecha: !filtros.dia,
  barrio: !filtros.barrio,
  tecnico: !filtros.tecnico
});

// Antecedentes de un documento en una línea, para el impreso y el PDF.
export const antecedenteTexto = (item) => {
  if (!item.repetido) return "Sin antecedentes";
  const ciclos = Number(item.ciclos_anteriores) || 1;
  return `Repetido · ${ciclos === 1 ? "1 ciclo anterior" : `${ciclos} ciclos anteriores`}`;
};
