// Mapa de operaciones: cada proceso de la app como una cadena de pasos con lo que
// hay hoy en cada uno y lo que está atrasado, y la lista de lo que traba el
// trabajo, lo más grave primero. Funciones puras para poder probarlas sin React.

// Días que una inspección puede esperar en el mismo estado antes de contar como atrasada.
export const DIAS_INSPECCION = 7;

const num = (value) => Number(value || 0);
const plural = (n, uno, varios) => `${n.toLocaleString("es-HN")} ${n === 1 ? uno : varios}`;

/**
 * fichas: { counts: {estado: n}, vencidasPorEtapa: {estado: n}, maxDiasVencida }
 * banco: { counts, sin_asignar }
 * inspecciones: respuesta de /inspecciones/resumen
 * entregas: respuesta de /entregas/resumen (la semana en curso)
 * Cada parte puede faltar (null) si su módulo no respondió: ese carril se marca sin datos.
 */
export const armarMapa = ({ fichas = null, banco = null, inspecciones = null, entregas = null } = {}) => {
  const carriles = [];
  const cuellos = [];

  if (fichas || banco) {
    const counts = fichas?.counts || {};
    const vencidas = fichas?.vencidasPorEtapa || {};
    const bancoPendiente = num(banco?.counts?.clandestino) + num(banco?.counts?.sin_determinar);
    const sinAsignar = num(banco?.sin_asignar);
    const enVisita = ["draft", "pending", "visit"];
    const vencidasVisita = enVisita.reduce((sum, key) => sum + num(vencidas[key]), 0);
    const paso = (key, etapas, label, flecha, extra = {}) => {
      const atrasadas = etapas.reduce((sum, etapa) => sum + num(vencidas[etapa]), 0);
      return {
        key,
        label,
        value: etapas.reduce((sum, etapa) => sum + num(counts[etapa]), 0),
        flecha,
        nota: atrasadas ? plural(atrasadas, "vencida", "vencidas") : "",
        tono: atrasadas ? "critico" : "",
        destino: { view: "records", fichas: etapas.length === 1 ? etapas[0] : "" },
        ...extra
      };
    };
    carriles.push({
      key: "clandestinos",
      label: "Clandestinos",
      detalle: "Del punto levantado en campo a la ficha cerrada",
      pasos: [
        { key: "banco", label: "Banco de campo", value: bancoPendiente, flecha: "se visita", nota: sinAsignar ? `${sinAsignar.toLocaleString("es-HN")} sin técnico` : "todo repartido", tono: sinAsignar ? "atencion" : "", destino: { view: "records", banco: sinAsignar ? "none" : "" } },
        paso("visita", enVisita, "Por visitar", "se confirma"),
        paso("aviso", ["confirmed"], "Aviso pendiente", "se notifica"),
        paso("seguimiento", ["regularization"], "En seguimiento", "se regulariza"),
        { key: "cerradas", label: "Cerradas", value: num(counts.regularized), nota: num(counts.discarded) ? `${num(counts.discarded).toLocaleString("es-HN")} descartadas aparte` : "", tono: "hecho", destino: { view: "records", fichas: "regularized" } }
      ]
    });
    if (sinAsignar) cuellos.push({ key: "banco", grado: 2, peso: sinAsignar, texto: `${plural(sinAsignar, "candidato del banco no tiene", "candidatos del banco no tienen")} técnico asignado.`, accion: "Repartir", destino: { view: "records", banco: "none" } });
    const totalVencidas = Object.values(vencidas).reduce((sum, value) => sum + num(value), 0);
    if (totalVencidas) {
      const dias = num(fichas?.maxDiasVencida);
      cuellos.push({ key: "fichas", grado: 3, peso: totalVencidas, texto: `${plural(totalVencidas, "ficha tiene", "fichas tienen")} el plazo vencido${dias ? `; la más atrasada, por ${plural(dias, "día hábil", "días hábiles")}` : ""}.`, accion: "Ver fichas", destino: { view: "records", fichas: vencidasVisita >= totalVencidas / 2 ? "pending" : "" } });
    }
  }

  if (inspecciones) {
    const bandeja = inspecciones.bandeja || [];
    const atrasadas = (estado) => bandeja.filter((item) => item.estado === estado && num(item.antiguedad_dias) > DIAS_INSPECCION);
    const nota = (estado) => {
      const lista = atrasadas(estado);
      if (!lista.length) return "";
      const max = Math.max(...lista.map((item) => num(item.antiguedad_dias)));
      return `${plural(lista.length, "atrasada", "atrasadas")} · máx. ${plural(max, "día", "días")}`;
    };
    const finMes = num(inspecciones.finalizadas_mes);
    const finAnterior = num(inspecciones.finalizadas_mes_anterior);
    carriles.push({
      key: "inspecciones",
      label: "Inspecciones",
      detalle: "De la asignación al cierre del mes",
      pasos: [
        { key: "asignadas", label: "Asignadas", value: num(inspecciones.asignadas), flecha: "se inicia", nota: nota("ASIGNADA"), tono: atrasadas("ASIGNADA").length ? "critico" : "", destino: { view: "inspecciones", hash: "inspecciones/ver?estado=asignadas" } },
        { key: "proceso", label: "En proceso", value: num(inspecciones.en_proceso), flecha: "pasa a seguimiento", nota: nota("EN_PROCESO"), tono: atrasadas("EN_PROCESO").length ? "atencion" : "", destino: { view: "inspecciones", hash: "inspecciones/ver?estado=proceso" } },
        { key: "seguimiento", label: "Seguimiento", value: num(inspecciones.seguimiento), flecha: "se finaliza", nota: nota("SEGUIMIENTO"), tono: atrasadas("SEGUIMIENTO").length ? "atencion" : "", destino: { view: "inspecciones", hash: "inspecciones/ver?estado=seguimiento" } },
        { key: "finalizadas", label: "Finalizadas", value: finMes, nota: `este mes · ${finAnterior.toLocaleString("es-HN")} el anterior`, tono: "hecho", destino: { view: "inspecciones", hash: "inspecciones/resumen" } }
      ]
    });
    const viejas = atrasadas("ASIGNADA");
    if (viejas.length) {
      const max = Math.max(...viejas.map((item) => num(item.antiguedad_dias)));
      cuellos.push({ key: "inspecciones", grado: 3, peso: viejas.length, texto: viejas.length === 1 ? `1 inspección asignada lleva ${plural(max, "día", "días")} sin empezar.` : `${viejas.length.toLocaleString("es-HN")} inspecciones asignadas llevan más de ${DIAS_INSPECCION} días sin empezar; la más antigua, ${plural(max, "día", "días")}.`, accion: "Ver inspecciones", destino: { view: "inspecciones", hash: "inspecciones/ver?estado=asignadas" } });
    }
  }

  if (entregas) {
    const pendientes = num(entregas.pendientes);
    const viejos = num(entregas.pendientes_mas_7_dias);
    const abiertos = num(entregas.lotes_abiertos);
    carriles.push({
      key: "entregas",
      label: "Entregas",
      detalle: "Facturas y notas de cobro de esta semana",
      pasos: [
        { key: "asignadas", label: "Asignadas", value: num(entregas.asignadas), flecha: "se reparten", nota: abiertos ? `${plural(abiertos, "lote abierto", "lotes abiertos")}` : "todos los lotes cerrados", tono: "", destino: { view: "entregas", hash: "entregas/lotes" } },
        { key: "entregadas", label: "Entregadas", value: num(entregas.entregadas), flecha: "sobran", nota: `${num(entregas.efectividad).toLocaleString("es-HN", { maximumFractionDigits: 1 })}% de efectividad`, tono: "", destino: { view: "entregas", hash: "entregas/resumen" } },
        { key: "pendientes", label: "Sin entregar", value: pendientes, flecha: "se reentregan", nota: viejos ? `${viejos.toLocaleString("es-HN")} con más de 7 días` : "", tono: viejos ? "critico" : "", destino: { view: "entregas", hash: "entregas/pendientes" } },
        { key: "reentregadas", label: "Reentregadas", value: num(entregas.reentregadas), nota: num(entregas.no_localizadas) ? `${num(entregas.no_localizadas).toLocaleString("es-HN")} no localizadas` : "", tono: "hecho", destino: { view: "entregas", hash: "entregas/pendientes" } }
      ]
    });
    if (viejos) cuellos.push({ key: "entregas", grado: 3, peso: viejos, texto: `${plural(viejos, "documento sigue", "documentos siguen")} sin entregar después de 7 días.`, accion: "Ver no entregadas", destino: { view: "entregas", hash: "entregas/pendientes" } });
  }

  // Lo vencido primero (grado 3), luego lo que solo pide atención; dentro, lo que más pesa.
  cuellos.sort((a, b) => b.grado - a.grado || b.peso - a.peso);
  return { carriles, cuellos };
};
