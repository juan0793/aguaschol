// Textos y nombres del informe de varias jornadas. Sin dependencias, para probarlo solo.
const ZONA = "America/Tegucigalpa";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fechaDeClave = (clave) => {
  const [anio, mes, dia] = String(clave).split("-").map(Number);
  return { anio, mes, dia };
};
export const fechaLarga = (clave) => {
  const { anio, mes, dia } = fechaDeClave(clave);
  return anio ? `${dia} de ${MESES[mes - 1]} de ${anio}` : String(clave || "");
};
export const fechaConDia = (clave) => {
  const fecha = new Date(`${clave}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) return String(clave || "");
  const dia = new Intl.DateTimeFormat("es-HN", { timeZone: ZONA, weekday: "long" }).format(fecha);
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${fechaLarga(clave)}`;
};

// "15 de octubre de 2026" · "13, 14 y 15 de octubre de 2026" · "30 de septiembre y 1 de octubre de 2026"
export const textoJornadas = (claves = []) => {
  const ordenadas = [...claves].sort();
  if (!ordenadas.length) return "Sin jornada";
  if (ordenadas.length === 1) return fechaLarga(ordenadas[0]);
  const partes = ordenadas.map(fechaDeClave);
  const unir = (lista) => (lista.length > 1 ? `${lista.slice(0, -1).join(", ")} y ${lista[lista.length - 1]}` : lista[0]);
  const mismoMes = partes.every((p) => p.anio === partes[0].anio && p.mes === partes[0].mes);
  if (mismoMes) return `${unir(partes.map((p) => p.dia))} de ${MESES[partes[0].mes - 1]} de ${partes[0].anio}`;
  const mismoAnio = partes.every((p) => p.anio === partes[0].anio);
  if (mismoAnio) return `${unir(partes.map((p) => `${p.dia} de ${MESES[p.mes - 1]}`))} de ${partes[0].anio}`;
  return unir(ordenadas.map(fechaLarga));
};

export const nombreArchivoInforme = (prefijo, claves = []) => {
  const ordenadas = [...claves].sort();
  if (!ordenadas.length) return `${prefijo}.pdf`;
  return ordenadas.length === 1 ? `${prefijo}-${ordenadas[0]}.pdf` : `${prefijo}-${ordenadas[0]}-al-${ordenadas[ordenadas.length - 1]}.pdf`;
};

// Barrios de varias jornadas en una sola lista, para elegir cuáles entran al informe.
export const unirBarriosDeJornadas = (jornadas = []) => {
  const porClave = new Map();
  for (const jornada of jornadas) {
    for (const zone of jornada.data?.zones || []) {
      const actual = porClave.get(zone.overrideKey) || { overrideKey: zone.overrideKey, displayName: zone.displayName || zone.zone, zone: zone.zone, total: 0, dias: 0 };
      actual.total += zone.items.length;
      actual.dias += 1;
      porClave.set(zone.overrideKey, actual);
    }
  }
  return [...porClave.values()].sort((a, b) => String(a.displayName).localeCompare(String(b.displayName), "es"));
};
