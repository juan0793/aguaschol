// Reglas y calculos puros del modulo Control de Entregas.
// Este archivo NO toca la base de datos ni Express: solo transforma datos.
// Sirve como fuente unica de verdad para validaciones, KPIs y construccion del
// snapshot semanal, y es lo que cubren las pruebas de `entregasRules.test.mjs`.

export const TIPOS_DOCUMENTO = ["FACTURA", "NOTA_COBRO"];
export const ESTADOS_LOTE = ["ABIERTO", "CERRADO", "REVISADO"];
export const ESTADOS_NO_ENTREGADA = ["PENDIENTE", "REENTREGADA", "NO_LOCALIZADA", "CANCELADA"];
export const RESULTADOS_INTENTO = ["SIN_RESPUESTA", "CASA_CERRADA", "NO_LOCALIZADO", "ENTREGADO", "OTRO"];
export const TIPOS_PERSONAL = ["TECNICO", "COBRADOR", "ENTREGA_FACTURAS", "OTRO"];
export const ESTADOS_REPORTE = ["GENERADO", "CORREGIDO", "ANULADO"];

// Estados que siguen "ocupando" un documento del lote. Una fila CANCELADA se
// descarta al comparar el detalle contra el total de sobrantes.
export const ESTADOS_NO_ENTREGADA_ACTIVOS = ["PENDIENTE", "REENTREGADA", "NO_LOCALIZADA"];

export const MOTIVOS_BASE = [
  { codigo: "CASA_CERRADA", etiqueta: "Casa cerrada", requiere_observacion: false, orden: 1 },
  { codigo: "DIRECCION_NO_ENCONTRADA", etiqueta: "Dirección no encontrada", requiere_observacion: false, orden: 2 },
  { codigo: "PREDIO_DESHABITADO", etiqueta: "Predio deshabitado", requiere_observacion: false, orden: 3 },
  { codigo: "ABONADO_NO_LOCALIZADO", etiqueta: "Abonado no localizado", requiere_observacion: false, orden: 4 },
  { codigo: "DATOS_INCONSISTENTES", etiqueta: "Datos inconsistentes", requiere_observacion: false, orden: 5 },
  { codigo: "RECHAZO_RECEPCION", etiqueta: "Rechazo de recepción", requiere_observacion: false, orden: 6 },
  { codigo: "OTRO", etiqueta: "Otro", requiere_observacion: true, orden: 7 }
];

export const UMBRAL_PENDIENTE_ATENCION = 3;
export const UMBRAL_PENDIENTE_CRITICO = 7;
export const UMBRAL_EFECTIVIDAD_BAJA = 85;
export const LIMITE_PENDIENTES_PRIORITARIOS = 25;

export const fail = (message, status = 400) => Object.assign(new Error(message), { status });

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

/* -------------------------------------------------------------------------- */
/* Fechas                                                                      */
/* -------------------------------------------------------------------------- */

// Trabajamos siempre con fechas "planas" YYYY-MM-DD para evitar corrimientos de
// zona horaria entre el navegador (America/Tegucigalpa) y MySQL.
export const toIsoDate = (value) => {
  if (!value) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
};

const dateFromIso = (value) => {
  const iso = toIsoDate(value);
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

export const addDays = (value, days) => {
  const date = dateFromIso(value);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
};

export const diffInDays = (from, to) => {
  const start = dateFromIso(from);
  const end = dateFromIso(to);
  if (!start || !end) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86400000);
};

// Semana operativa por defecto: lunes a viernes de la semana que contiene `reference`.
export const semanaPorDefecto = (reference = new Date()) => {
  const iso = toIsoDate(reference) || new Date().toISOString().slice(0, 10);
  const date = dateFromIso(iso);
  const weekday = date.getUTCDay(); // 0=domingo
  const offsetToMonday = weekday === 0 ? -6 : 1 - weekday;
  const inicio = addDays(iso, offsetToMonday);
  return { fecha_inicio: inicio, fecha_fin: addDays(inicio, 4) };
};

export const listarDiasDelRango = (fechaInicio, fechaFin) => {
  const inicio = toIsoDate(fechaInicio);
  const fin = toIsoDate(fechaFin);
  if (!inicio || !fin) return [];
  const total = diffInDays(inicio, fin);
  if (total < 0 || total > 366) return [];
  return Array.from({ length: total + 1 }, (_unused, index) => addDays(inicio, index));
};

export const describirSemana = (fechaInicio, fechaFin) => {
  const inicio = dateFromIso(fechaInicio);
  const fin = dateFromIso(fechaFin);
  if (!inicio || !fin) return "";
  const mesInicio = MESES[inicio.getUTCMonth()];
  const mesFin = MESES[fin.getUTCMonth()];
  const anioInicio = inicio.getUTCFullYear();
  const anioFin = fin.getUTCFullYear();

  if (anioInicio !== anioFin) {
    return `Semana del ${inicio.getUTCDate()} de ${mesInicio} de ${anioInicio} al ${fin.getUTCDate()} de ${mesFin} de ${anioFin}`;
  }
  if (mesInicio !== mesFin) {
    return `Semana del ${inicio.getUTCDate()} de ${mesInicio} al ${fin.getUTCDate()} de ${mesFin} de ${anioFin}`;
  }
  return `Semana del ${inicio.getUTCDate()} al ${fin.getUTCDate()} de ${mesFin} de ${anioFin}`;
};

/* -------------------------------------------------------------------------- */
/* Calculos base                                                               */
/* -------------------------------------------------------------------------- */

export const toEntero = (value) => {
  const numero = Number(value);
  return Number.isFinite(numero) ? Math.trunc(numero) : 0;
};

export const calcularEntregadas = ({ total_asignadas = 0, total_sobrantes = 0 } = {}) =>
  Math.max(toEntero(total_asignadas) - toEntero(total_sobrantes), 0);

// efectividad = entregadas / asignadas * 100, protegida contra division entre cero.
export const calcularEfectividad = (entregadas = 0, asignadas = 0) => {
  const base = toEntero(asignadas);
  if (base <= 0) return 0;
  return Math.round((toEntero(entregadas) / base) * 10000) / 100;
};

/* -------------------------------------------------------------------------- */
/* Validaciones de lote                                                        */
/* -------------------------------------------------------------------------- */

export const validarTotalAsignado = (value) => {
  const total = toEntero(value);
  if (total <= 0) throw fail("El total asignado debe ser un número entero mayor que cero.");
  return total;
};

export const validarSobrantes = (sobrantes, asignadas) => {
  const total = toEntero(sobrantes);
  const base = toEntero(asignadas);
  if (!Number.isFinite(Number(sobrantes)) || String(sobrantes ?? "").trim() === "") {
    throw fail("Debes registrar el total de sobrantes para cerrar el lote.");
  }
  if (total < 0) throw fail("Los sobrantes no pueden ser negativos.");
  if (total > base) throw fail(`Los sobrantes (${total}) no pueden superar las asignadas (${base}).`);
  return total;
};

export const contarNoEntregadasActivas = (detalle = []) =>
  detalle.filter((item) => ESTADOS_NO_ENTREGADA_ACTIVOS.includes(String(item?.estado || "PENDIENTE"))).length;

// Regla critica: el detalle identificado debe cuadrar con el total de sobrantes.
export const validarConsistenciaDetalle = ({ total_sobrantes = 0, detalle = [], permitirDiferencia = false } = {}) => {
  const sobrantes = toEntero(total_sobrantes);
  const identificadas = contarNoEntregadasActivas(detalle);
  const diferencia = sobrantes - identificadas;

  if (diferencia !== 0 && !permitirDiferencia) {
    throw fail(
      diferencia > 0
        ? `Faltan ${diferencia} documento(s) por identificar: declaraste ${sobrantes} sobrantes y registraste ${identificadas}.`
        : `Identificaste ${identificadas} documentos pero solo declaraste ${sobrantes} sobrantes. Corrige la diferencia de ${Math.abs(diferencia)}.`
    );
  }

  return { sobrantes, identificadas, diferencia };
};

export const detectarDuplicadosEnLote = (detalle = []) => {
  const vistos = new Map();
  const duplicados = [];

  detalle.forEach((item) => {
    const abonado = String(item?.numero_abonado || "").trim().toUpperCase();
    const clave = String(item?.clave_catastral || "").trim().toUpperCase();
    const llave = `${abonado}|${clave}`;
    if (!abonado && !clave) return;
    if (vistos.has(llave)) {
      duplicados.push({ numero_abonado: abonado, clave_catastral: clave });
      return;
    }
    vistos.set(llave, true);
  });

  return duplicados;
};

export const requiereObservacion = (motivo, catalogo = MOTIVOS_BASE) => {
  const encontrado = catalogo.find((item) => item.codigo === String(motivo || "").trim().toUpperCase());
  return Boolean(encontrado?.requiere_observacion);
};

export const validarMotivo = ({ motivo, observacion = "", catalogo = MOTIVOS_BASE } = {}) => {
  const codigo = String(motivo || "").trim().toUpperCase();
  const encontrado = catalogo.find((item) => item.codigo === codigo && item.activo !== 0 && item.activo !== false);
  if (!encontrado) throw fail("El motivo de no entrega no es válido.");
  if (encontrado.requiere_observacion && !String(observacion || "").trim()) {
    throw fail(`El motivo "${encontrado.etiqueta}" exige una observación.`);
  }
  return codigo;
};

/* -------------------------------------------------------------------------- */
/* Parseo de pegado masivo                                                     */
/* -------------------------------------------------------------------------- */

// Acepta filas separadas por tabulador, punto y coma, coma o 2+ espacios:
//   10245    10-20-03-04    Casa cerrada
export const parsearPegadoNoEntregadas = (texto = "", catalogo = MOTIVOS_BASE) => {
  const etiquetaANormalizada = new Map(
    catalogo.map((item) => [normalizarTexto(item.etiqueta), item.codigo])
  );
  const codigos = new Set(catalogo.map((item) => item.codigo));

  return String(texto || "")
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea, index) => {
      const partes = linea.split(/\t+|\s{2,}|;|,/).map((parte) => parte.trim()).filter(Boolean);
      const [abonado = "", clave = "", motivoTexto = "", ...resto] = partes;
      const motivoDirecto = motivoTexto.toUpperCase().replace(/\s+/g, "_");
      const motivo = codigos.has(motivoDirecto)
        ? motivoDirecto
        : etiquetaANormalizada.get(normalizarTexto(motivoTexto)) || "";

      return {
        linea: index + 1,
        numero_abonado: abonado,
        clave_catastral: clave,
        motivo,
        observacion: resto.join(" ").trim()
      };
    });
};

export const normalizarTexto = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

/* -------------------------------------------------------------------------- */
/* Agregaciones del informe                                                    */
/* -------------------------------------------------------------------------- */

const acumular = (mapa, llave, base) => {
  if (!mapa.has(llave)) mapa.set(llave, { ...base });
  return mapa.get(llave);
};

const conEfectividad = (fila) => ({
  ...fila,
  efectividad: calcularEfectividad(fila.entregadas, fila.asignadas)
});

export const agruparPorResponsable = (lotes = [], noEntregadas = []) => {
  const mapa = new Map();

  lotes.forEach((lote) => {
    const fila = acumular(mapa, String(lote.responsable_id), {
      responsable_id: lote.responsable_id,
      responsable_nombre: lote.responsable_nombre || "",
      tipo_personal: lote.tipo_personal || "",
      tipo_predominante: "",
      lotes: 0,
      asignadas: 0,
      entregadas: 0,
      sobrantes: 0,
      no_entregadas: 0,
      reentregadas: 0,
      pendientes: 0,
      _tipos: {}
    });
    fila.lotes += 1;
    fila.asignadas += toEntero(lote.total_asignadas);
    fila.sobrantes += toEntero(lote.total_sobrantes);
    fila.entregadas += calcularEntregadas(lote);
    fila._tipos[lote.tipo_documento] = (fila._tipos[lote.tipo_documento] || 0) + 1;
  });

  noEntregadas.forEach((item) => {
    const fila = mapa.get(String(item.responsable_id));
    if (!fila) return;
    fila.no_entregadas += 1;
    if (item.estado === "REENTREGADA") fila.reentregadas += 1;
    if (item.estado === "PENDIENTE") fila.pendientes += 1;
  });

  return [...mapa.values()]
    .map(({ _tipos, ...fila }) => ({
      ...conEfectividad(fila),
      tipo_predominante:
        Object.entries(_tipos).sort((left, right) => right[1] - left[1])[0]?.[0] || ""
    }))
    .sort((left, right) => right.asignadas - left.asignadas);
};

export const agruparPorBarrio = (lotes = [], noEntregadas = []) => {
  const mapa = new Map();

  lotes.forEach((lote) => {
    const llave = String(lote.barrio_codigo || lote.barrio_nombre || "");
    const fila = acumular(mapa, llave, {
      barrio_codigo: lote.barrio_codigo || "",
      barrio_nombre: lote.barrio_nombre || "Sin barrio",
      lotes: 0,
      asignadas: 0,
      entregadas: 0,
      no_entregadas: 0,
      reentregadas: 0,
      pendientes: 0
    });
    fila.lotes += 1;
    fila.asignadas += toEntero(lote.total_asignadas);
    fila.entregadas += calcularEntregadas(lote);
  });

  noEntregadas.forEach((item) => {
    const llave = String(item.barrio_codigo || item.barrio_nombre || "");
    const fila = mapa.get(llave);
    if (!fila) return;
    fila.no_entregadas += 1;
    if (item.estado === "REENTREGADA") fila.reentregadas += 1;
    if (item.estado === "PENDIENTE") fila.pendientes += 1;
  });

  return [...mapa.values()].map(conEfectividad).sort((left, right) => right.asignadas - left.asignadas);
};

export const agruparPorTipoDocumento = (lotes = [], noEntregadas = []) => {
  const mapa = new Map(
    TIPOS_DOCUMENTO.map((tipo) => [
      tipo,
      { tipo_documento: tipo, lotes: 0, asignadas: 0, entregadas: 0, no_entregadas: 0, reentregadas: 0, pendientes: 0 }
    ])
  );

  lotes.forEach((lote) => {
    const fila = mapa.get(lote.tipo_documento);
    if (!fila) return;
    fila.lotes += 1;
    fila.asignadas += toEntero(lote.total_asignadas);
    fila.entregadas += calcularEntregadas(lote);
  });

  noEntregadas.forEach((item) => {
    const fila = mapa.get(item.tipo_documento);
    if (!fila) return;
    fila.no_entregadas += 1;
    if (item.estado === "REENTREGADA") fila.reentregadas += 1;
    if (item.estado === "PENDIENTE") fila.pendientes += 1;
  });

  return [...mapa.values()].filter((fila) => fila.lotes > 0).map(conEfectividad);
};

export const agruparPorMotivo = (noEntregadas = [], catalogo = MOTIVOS_BASE) => {
  const etiquetas = new Map(catalogo.map((item) => [item.codigo, item.etiqueta]));
  const mapa = new Map();

  noEntregadas.forEach((item) => {
    const codigo = String(item.motivo || "OTRO");
    const fila = acumular(mapa, codigo, {
      motivo: codigo,
      motivo_etiqueta: etiquetas.get(codigo) || codigo,
      total: 0
    });
    fila.total += 1;
  });

  const total = noEntregadas.length;
  return [...mapa.values()]
    .map((fila) => ({ ...fila, porcentaje: total ? Math.round((fila.total / total) * 1000) / 10 : 0 }))
    .sort((left, right) => right.total - left.total);
};

export const agruparPorDia = (lotes = [], noEntregadas = [], fechaInicio, fechaFin) => {
  const dias = listarDiasDelRango(fechaInicio, fechaFin);
  const mapa = new Map(
    dias.map((fecha) => [fecha, { fecha, asignadas: 0, entregadas: 0, no_entregadas: 0, lotes: 0 }])
  );

  lotes.forEach((lote) => {
    const fila = mapa.get(toIsoDate(lote.fecha));
    if (!fila) return;
    fila.lotes += 1;
    fila.asignadas += toEntero(lote.total_asignadas);
    fila.entregadas += calcularEntregadas(lote);
  });

  noEntregadas.forEach((item) => {
    const fila = mapa.get(toIsoDate(item.fecha_lote));
    if (!fila) return;
    fila.no_entregadas += 1;
  });

  return [...mapa.values()].map(conEfectividad);
};

export const recolectarObservaciones = (lotes = []) =>
  lotes
    .filter((lote) => String(lote.observacion_responsable || "").trim())
    .map((lote) => ({
      lote_id: lote.id,
      fecha: toIsoDate(lote.fecha),
      responsable_id: lote.responsable_id,
      responsable_nombre: lote.responsable_nombre || "",
      barrio_nombre: lote.barrio_nombre || "",
      tipo_documento: lote.tipo_documento,
      texto: String(lote.observacion_responsable).trim()
    }))
    .sort((left, right) => (left.fecha < right.fecha ? -1 : left.fecha > right.fecha ? 1 : 0));

export const calcularPendientesPrioritarios = (noEntregadas = [], fechaCorte, catalogo = MOTIVOS_BASE) => {
  const etiquetas = new Map(catalogo.map((item) => [item.codigo, item.etiqueta]));

  return noEntregadas
    .filter((item) => item.estado === "PENDIENTE")
    .map((item) => ({
      id: item.id,
      numero_abonado: item.numero_abonado || "",
      clave_catastral: item.clave_catastral || "",
      barrio_nombre: item.barrio_nombre || "",
      responsable_nombre: item.responsable_nombre || "",
      tipo_documento: item.tipo_documento || "",
      motivo: item.motivo || "",
      motivo_etiqueta: etiquetas.get(item.motivo) || item.motivo || "",
      dias_pendiente: Math.max(diffInDays(item.fecha_lote, fechaCorte), 0),
      intentos: toEntero(item.intentos)
    }))
    .filter((item) => item.dias_pendiente >= UMBRAL_PENDIENTE_ATENCION || item.intentos >= 2)
    .sort((left, right) => right.dias_pendiente - left.dias_pendiente || right.intentos - left.intentos);
};

export const calcularIndicadoresAtencion = ({
  lotes = [],
  noEntregadas = [],
  porBarrio = [],
  fechaCorte
} = {}) => {
  const pendientes = noEntregadas.filter((item) => item.estado === "PENDIENTE");
  const conDias = pendientes.map((item) => Math.max(diffInDays(item.fecha_lote, fechaCorte), 0));

  return [
    {
      codigo: "PENDIENTES_MAS_3_DIAS",
      etiqueta: `Pendientes con más de ${UMBRAL_PENDIENTE_ATENCION} días`,
      total: conDias.filter((dias) => dias > UMBRAL_PENDIENTE_ATENCION).length,
      tono: "warning"
    },
    {
      codigo: "PENDIENTES_MAS_7_DIAS",
      etiqueta: `Pendientes con más de ${UMBRAL_PENDIENTE_CRITICO} días`,
      total: conDias.filter((dias) => dias > UMBRAL_PENDIENTE_CRITICO).length,
      tono: "danger"
    },
    {
      codigo: "MULTIPLES_INTENTOS",
      etiqueta: "Abonados con múltiples intentos",
      total: pendientes.filter((item) => toEntero(item.intentos) >= 2).length,
      tono: "warning"
    },
    {
      codigo: "LOTES_ABIERTOS",
      etiqueta: "Lotes sin cerrar en la semana",
      total: lotes.filter((lote) => lote.estado === "ABIERTO").length,
      tono: "info"
    },
    {
      codigo: "BARRIOS_EFECTIVIDAD_BAJA",
      etiqueta: `Barrios con efectividad menor a ${UMBRAL_EFECTIVIDAD_BAJA}%`,
      total: porBarrio.filter((fila) => fila.asignadas > 0 && fila.efectividad < UMBRAL_EFECTIVIDAD_BAJA).length,
      tono: "danger"
    }
  ];
};

export const calcularTotales = (lotes = [], noEntregadas = []) => {
  const asignadas = lotes.reduce((total, lote) => total + toEntero(lote.total_asignadas), 0);
  const sobrantes = lotes.reduce((total, lote) => total + toEntero(lote.total_sobrantes), 0);
  const entregadas = lotes.reduce((total, lote) => total + calcularEntregadas(lote), 0);

  return {
    lotes: lotes.length,
    lotes_abiertos: lotes.filter((lote) => lote.estado === "ABIERTO").length,
    lotes_cerrados: lotes.filter((lote) => lote.estado !== "ABIERTO").length,
    asignadas,
    entregadas,
    sobrantes,
    no_entregadas: noEntregadas.length,
    reentregadas: noEntregadas.filter((item) => item.estado === "REENTREGADA").length,
    pendientes: noEntregadas.filter((item) => item.estado === "PENDIENTE").length,
    no_localizadas: noEntregadas.filter((item) => item.estado === "NO_LOCALIZADA").length,
    canceladas: noEntregadas.filter((item) => item.estado === "CANCELADA").length,
    efectividad: calcularEfectividad(entregadas, asignadas)
  };
};

/* -------------------------------------------------------------------------- */
/* Snapshot semanal                                                            */
/* -------------------------------------------------------------------------- */

export const SNAPSHOT_VERSION = 1;

// Construye la "foto cerrada" de la semana. Guarda nombres ademas de IDs para que
// un cambio posterior de responsable o barrio no altere el historico.
export const construirSnapshotSemanal = ({
  fecha_inicio,
  fecha_fin,
  tipo_documento = "",
  lotes = [],
  noEntregadas = [],
  catalogoMotivos = MOTIVOS_BASE,
  generado_por = null,
  generado_por_nombre = "",
  generado_en = "",
  incluir_anexo_pendientes = false
} = {}) => {
  const fechaCorte = toIsoDate(fecha_fin);
  const totales = calcularTotales(lotes, noEntregadas);
  const por_barrio = agruparPorBarrio(lotes, noEntregadas);
  const pendientesPrioritarios = calcularPendientesPrioritarios(noEntregadas, fechaCorte, catalogoMotivos);

  return {
    snapshot_version: SNAPSHOT_VERSION,
    periodo: {
      fecha_inicio: toIsoDate(fecha_inicio),
      fecha_fin: fechaCorte,
      etiqueta: describirSemana(fecha_inicio, fecha_fin),
      tipo_documento: tipo_documento || "TODOS"
    },
    generacion: {
      generado_por,
      generado_por_nombre,
      generado_en: generado_en || new Date().toISOString()
    },
    totales,
    por_tipo_documento: agruparPorTipoDocumento(lotes, noEntregadas),
    por_responsable: agruparPorResponsable(lotes, noEntregadas),
    por_barrio,
    por_motivo: agruparPorMotivo(noEntregadas, catalogoMotivos),
    por_dia: agruparPorDia(lotes, noEntregadas, fecha_inicio, fecha_fin),
    observaciones: recolectarObservaciones(lotes),
    indicadores_atencion: calcularIndicadoresAtencion({
      lotes,
      noEntregadas,
      porBarrio: por_barrio,
      fechaCorte
    }),
    pendientes_prioritarios: pendientesPrioritarios.slice(0, LIMITE_PENDIENTES_PRIORITARIOS),
    anexo_pendientes: incluir_anexo_pendientes ? pendientesPrioritarios : [],
    pendientes_prioritarios_omitidos: Math.max(pendientesPrioritarios.length - LIMITE_PENDIENTES_PRIORITARIOS, 0)
  };
};

// Una correccion nunca sobrescribe: crea una version nueva encadenada al original.
export const construirCorreccion = (reporteOrigen = {}) => {
  if (!reporteOrigen?.id) throw fail("No se encontró el informe original.", 404);
  if (reporteOrigen.estado === "ANULADO") throw fail("Un informe anulado no puede corregirse.");

  return {
    version: toEntero(reporteOrigen.version || 1) + 1,
    reporte_origen_id: toEntero(reporteOrigen.reporte_origen_id) || toEntero(reporteOrigen.id),
    estado: "CORREGIDO"
  };
};

export const etiquetarVersion = (reporte = {}) =>
  toEntero(reporte.version) > 1 ? `Versión ${reporte.version} - corregida` : "Versión 1";
