// Resumen ejecutivo del informe semanal: las frases que alguien leería en voz
// alta en una reunión, armadas desde el snapshot. Es una funcion pura para que
// la impresion, la vista previa y el PDF digan exactamente lo mismo.

import { formatDate, formatNumber, formatPercent } from "../utils/entregasFormatters.js";

const plural = (cantidad, singular, pluralTexto) => (Math.abs(Number(cantidad) || 0) === 1 ? singular : pluralTexto);

const contarIndicador = (snapshot, codigo) =>
  Number(snapshot?.indicadores_atencion?.find((item) => item.codigo === codigo)?.total) || 0;

const frasePeriodo = (snapshot) => {
  const { totales, periodo } = snapshot;
  const responsables = snapshot.por_responsable?.length || 0;
  const etiqueta = periodo?.etiqueta ? periodo.etiqueta.toLowerCase() : "el período";
  if (!totales.asignadas) return `Durante ${etiqueta} no se registró reparto de documentos.`;
  return (
    `Durante ${etiqueta} se repartieron ${formatNumber(totales.asignadas)} documentos ` +
    `en ${formatNumber(totales.lotes)} ${plural(totales.lotes, "lote", "lotes")} ` +
    `a cargo de ${formatNumber(responsables)} ${plural(responsables, "responsable", "responsables")}, ` +
    `con una efectividad de ${formatPercent(totales.efectividad)}.`
  );
};

// Los informes archivados antes de la v2 del snapshot no traen comparativo:
// en ese caso la frase simplemente no se escribe, no se inventa una base.
const fraseComparativo = (snapshot) => {
  const comparativo = snapshot.comparativo;
  if (!comparativo) return "";
  if (!comparativo.con_datos) return "No hay un período anterior con datos para comparar este resultado.";

  const entregadas = comparativo.indicadores.find((item) => item.clave === "entregadas");
  const efectividad = comparativo.indicadores.find((item) => item.clave === "efectividad");
  const rango = comparativo.periodo?.fecha_inicio
    ? `${formatDate(comparativo.periodo.fecha_inicio)} al ${formatDate(comparativo.periodo.fecha_fin)}`
    : "el período anterior";

  const movimiento = entregadas?.diferencia
    ? `las entregas ${entregadas.diferencia > 0 ? "subieron" : "bajaron"} en ${formatNumber(Math.abs(entregadas.diferencia))} ${plural(entregadas.diferencia, "documento", "documentos")}`
    : "el volumen entregado se mantuvo igual";
  const tendencia = efectividad?.diferencia
    ? `la efectividad ${efectividad.diferencia > 0 ? "subió" : "bajó"} ${formatNumber(Math.abs(efectividad.diferencia))} ${plural(efectividad.diferencia, "punto", "puntos")}`
    : "la efectividad se mantuvo sin cambio";

  return `Frente al período del ${rango}, ${movimiento} y ${tendencia}.`;
};

const frasePendientes = (snapshot) => {
  const { totales, destacados } = snapshot;
  if (!totales.pendientes) {
    return totales.no_entregadas
      ? "No quedaron documentos pendientes de seguimiento al cierre del período."
      : "";
  }
  const criticos = contarIndicador(snapshot, "PENDIENTES_MAS_7_DIAS");
  const concentracion = destacados?.concentracion_pendientes;
  const partes = [
    `Quedan ${formatNumber(totales.pendientes)} ${plural(totales.pendientes, "documento pendiente", "documentos pendientes")} de entrega`
  ];
  if (criticos) partes.push(`${formatNumber(criticos)} con más de 7 días`);
  const frase = `${partes.join(", ")}.`;
  return concentracion
    ? `${frase} El ${formatPercent(concentracion.porcentaje)} se concentra en ${concentracion.barrio_nombre}.`
    : frase;
};

const fraseCierre = (snapshot) => {
  const abiertos = Number(snapshot.totales?.lotes_abiertos) || 0;
  if (!abiertos) return "";
  return (
    `${formatNumber(abiertos)} ${plural(abiertos, "lote quedó abierto", "lotes quedaron abiertos")} dentro del período, ` +
    "por lo que las cifras de entrega son parciales hasta su cierre."
  );
};

const fraseDesempeno = (snapshot) => {
  const destacados = snapshot.destacados;
  if (!destacados?.mejor_responsable) return "";
  const mejor = destacados.mejor_responsable;
  const reforzar = destacados.responsable_a_reforzar;
  const base = `${mejor.responsable_nombre} alcanzó la efectividad más alta (${formatPercent(mejor.efectividad)})`;
  return reforzar
    ? `${base}; ${reforzar.responsable_nombre} cerró en ${formatPercent(reforzar.efectividad)} y necesita apoyo.`
    : `${base}.`;
};

export const construirResumenEjecutivo = (snapshot) => {
  if (!snapshot?.totales) return [];
  return [frasePeriodo, fraseComparativo, frasePendientes, fraseCierre, fraseDesempeno]
    .map((armar) => armar(snapshot))
    .filter(Boolean);
};
