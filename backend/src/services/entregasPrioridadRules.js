// Reglas puras de "Barrios por prioridad": lo que falta entregar en el ciclo, del
// más urgente al menos. Sale del avance del mes (estado, carga, plan y técnico de
// cada barrio), de la fecha del último lote cerrado de cada barrio y de la mora del
// padrón. La mora solo la ven administración y Gerencia.

import { codigoBarrioDeClave } from "./entregasRepartoRules.js";
import { diffInDays } from "./entregasRules.js";

export const CRITERIOS_PRIORIDAD = Object.freeze(["combinado", "dias", "mora", "carga", "ruta"]);
// Un ciclo dura un mes: más de 30 días sin entrega ya es atraso.
export const DIAS_ALTA = 31;
export const DIAS_MEDIA = 27;
const PESO = { alta: 0, media: 1, baja: 2 };

const numero = (valor) => (Number.isFinite(Number(valor)) ? Number(valor) : 0);

// Mora (intereses) del padrón por barrio: suma de lo atrasado y cuántas cuentas
// tienen mora. Un interés negativo (saldo a favor) no resta.
export const moraPorBarrio = (registros = []) => {
  const porBarrio = new Map();
  for (const registro of registros) {
    const codigo = codigoBarrioDeClave(registro?.clave_catastral);
    if (!codigo) continue;
    const mora = numero(registro?.intereses);
    if (mora <= 0) continue;
    const fila = porBarrio.get(codigo) || { mora: 0, cuentas: 0 };
    fila.mora += mora;
    fila.cuentas += 1;
    porBarrio.set(codigo, fila);
  }
  for (const fila of porBarrio.values()) fila.mora = Math.round(fila.mora * 100) / 100;
  return porBarrio;
};

// Alta: lote abierto, anotado para la próxima jornada, sin entregas registradas o
// 31 días o más desde la última. Media: de 27 a 30 días. Baja: el resto.
export const nivelPrioridad = (barrio) => {
  if (barrio.estado === "en_curso" || barrio.plan) return "alta";
  if (barrio.dias_sin_entrega == null || barrio.dias_sin_entrega >= DIAS_ALTA) return "alta";
  if (barrio.dias_sin_entrega >= DIAS_MEDIA) return "media";
  return "baja";
};

export const motivosPrioridad = (barrio, { textoPlan = () => "Anotado para mañana" } = {}) => {
  const motivos = [];
  if (barrio.estado === "en_curso") motivos.push("Lote abierto");
  if (barrio.plan) motivos.push(textoPlan(barrio.plan));
  if (barrio.dias_sin_entrega == null) motivos.push("Sin entregas registradas");
  else if (barrio.estado !== "en_curso") motivos.push(`${barrio.dias_sin_entrega} ${barrio.dias_sin_entrega === 1 ? "día" : "días"} sin entrega`);
  return motivos;
};

// Sin días (nunca entregado) cuenta como el más atrasado.
const dias = (barrio) => (barrio.dias_sin_entrega == null ? Number.MAX_SAFE_INTEGER : barrio.dias_sin_entrega);
const ruta = (barrio) => barrio.orden_ruta ?? 9999;
const desempate = (a, b) => ruta(a) - ruta(b) || a.nombre.localeCompare(b.nombre, "es");

const ORDENES = {
  combinado: (a, b) => PESO[a.nivel] - PESO[b.nivel]
    || Number(b.estado === "en_curso") - Number(a.estado === "en_curso")
    || Number(Boolean(b.plan)) - Number(Boolean(a.plan))
    || dias(b) - dias(a)
    || numero(b.mora?.mora) - numero(a.mora?.mora)
    || desempate(a, b),
  dias: (a, b) => dias(b) - dias(a) || desempate(a, b),
  mora: (a, b) => numero(b.mora?.mora) - numero(a.mora?.mora) || desempate(a, b),
  carga: (a, b) => numero(b.carga?.documentos) - numero(a.carga?.documentos) || desempate(a, b),
  ruta: (a, b) => a.responsable_nombre.localeCompare(b.responsable_nombre, "es") || desempate(a, b)
};

export const criterioValido = (criterio, { conMora = true } = {}) => {
  const limpio = String(criterio || "").trim();
  if (!CRITERIOS_PRIORIDAD.includes(limpio) || (limpio === "mora" && !conMora)) return "combinado";
  return limpio;
};

// barrios: los del avance del mes. ultimas: Map codigo → fecha (YYYY-MM-DD) del
// último lote cerrado. Solo entra lo que falta (pendiente o con lote abierto).
export const armarPrioridad = ({ barrios = [], ultimas = new Map(), mora = null, hoy, criterio = "combinado", textoPlan } = {}) => {
  const filas = barrios
    .filter((barrio) => barrio.estado !== "entregado")
    .map((barrio) => {
      const ultima = ultimas.get(String(barrio.codigo)) || null;
      const fila = {
        codigo: String(barrio.codigo),
        nombre: barrio.nombre,
        responsable_id: barrio.responsable_id,
        responsable_nombre: barrio.responsable_nombre || "Sin nombre",
        orden_ruta: barrio.orden_ruta ?? null,
        estado: barrio.estado,
        carga: barrio.carga || null,
        plan: barrio.plan || null,
        ultima_entrega: ultima,
        dias_sin_entrega: ultima && hoy ? Math.max(diffInDays(ultima, hoy), 0) : null
      };
      if (mora) fila.mora = mora.get(String(barrio.codigo)) || { mora: 0, cuentas: 0 };
      fila.nivel = nivelPrioridad(fila);
      fila.motivos = motivosPrioridad(fila, textoPlan ? { textoPlan } : undefined);
      return fila;
    });
  filas.sort(ORDENES[criterioValido(criterio, { conMora: Boolean(mora) })]);
  return filas.map((fila, indice) => ({ ...fila, posicion: indice + 1 }));
};
