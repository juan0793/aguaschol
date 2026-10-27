import { SERVICE_COLUMNS, sumServiceRows } from "./utils/serviceTable";
import { celda, docCount, docMoney, docPct, salidaPadron } from "./padronDocumento";

// Informes de cada consulta del padrón. Cada uno se imprime o se descarga en PDF
// (`modo`: "imprimir" | "pdf") con el mismo documento. Las consultas de servicios
// llevan los totales; los listados (barrios y abonados) no llevan cifras globales
// de la empresa.

const num = (titulo) => ({ titulo, alinear: "num" });
const conCero = (valor, texto, opciones = {}) => celda(texto, { ...opciones, cero: !Number(valor || 0) });
const servicioCelda = (servicio) => conCero(servicio.active, docCount(servicio.active), { nota: docPct(servicio.percentage) });

// 1. Todos los servicios: una fila por barrio con los cinco servicios.
export const imprimirTodosServicios = ({ rows = [], vista = "usuarios", filtro = [], padronActualizado = "" }, modo) => {
  const totales = sumServiceRows(rows);
  const deuda = vista === "deuda";
  const columnas = [
    { titulo: "Barrio" },
    num(deuda ? "Cuentas con deuda" : "Usuarios"),
    ...SERVICE_COLUMNS.map(([, etiqueta]) => num(etiqueta)),
    num("Deuda total")
  ];
  const fila = (row) => [
    row.name,
    docCount(deuda ? row.deuda.deudores : row.usuarios),
    ...SERVICE_COLUMNS.map(([campo]) => (deuda ? conCero(row.services[campo].deuda, docMoney(row.services[campo].deuda)) : servicioCelda(row.services[campo]))),
    docMoney(row.deuda.total)
  ];
  return salidaPadron({
    tipo: "Consulta de todos los servicios",
    titulo: deuda ? "Deuda por servicio y barrio" : "Usuarios por servicio y barrio",
    subtitulo: "Los cinco servicios del padrón maestro, barrio por barrio.",
    filtro,
    padronActualizado,
    orientacion: "landscape",
    cifras: [
      [docCount(totales.usuarios), "usuarios"],
      [docCount(rows.length), rows.length === 1 ? "barrio" : "barrios"],
      ...SERVICE_COLUMNS.map(([campo, , , nombre]) => [docCount(totales.services[campo].active), `con ${nombre.toLowerCase()}`, docPct(totales.services[campo].percentage)]),
      [docMoney(totales.deuda.total), "de deuda"]
    ],
    secciones: [{
      titulo: "Desglose por barrio",
      detalle: `${docCount(rows.length)} barrios`,
      columnas,
      filas: rows.map(fila),
      pie: fila({ ...totales, name: "Total" })
    }],
    nota: deuda ? "Una misma cuenta suma en cada servicio que tiene activo: el padrón no separa la deuda por concepto facturado." : ""
  }, modo);
};

// 2. Un solo servicio: ya se sabe que es la consulta individual, el título es el servicio.
export const imprimirServicio = (informe = {}, padronActualizado = "", modo) => {
  const { label = "", rows = [], totals = {}, resumen = {}, barriosSinNombres = [], filtro = "" } = informe;
  const nombre = label.toLowerCase();
  const columnas = [
    { titulo: "Barrio" }, num("Usuarios"), num("Con el servicio"), num("Sin el servicio"), num("Cuentas con deuda"),
    num("Capital"), num("Intereses"), num("Deuda"), num("Parte")
  ];
  const fila = (row) => [
    row.name,
    docCount(row.usuarios),
    conCero(row.active, docCount(row.active), { nota: docPct(row.percentage) }),
    docCount(row.sin),
    docCount(row.deudores),
    docMoney(row.capital),
    docMoney(row.intereses),
    docMoney(row.deuda),
    docPct(row.share)
  ];
  const promedio = resumen.deudores ? resumen.deuda / resumen.deudores : 0;
  return salidaPadron({
    tipo: "Consulta por servicio",
    titulo: label,
    subtitulo: `Barrios con ${nombre}, usuarios sin el servicio y deuda de esas cuentas.`,
    filtro: filtro ? [["Filtro", filtro]] : [],
    padronActualizado,
    orientacion: "landscape",
    archivo: `consulta-${nombre}`,
    cifras: [
      [docCount(resumen.active), `usuarios con ${nombre}`, docPct(resumen.percentage)],
      [docCount(resumen.barriosCon), "barrios con el servicio"],
      [docCount(resumen.deudores), "cuentas con deuda"],
      [docMoney(resumen.deuda), "de deuda"],
      [docMoney(promedio), "promedio por cuenta"]
    ],
    secciones: [
      { titulo: "Barrios", detalle: `${docCount(rows.length)} en este informe`, columnas, filas: rows.map(fila), pie: fila({ ...totals, name: "Total" }) },
      barriosSinNombres.length ? { titulo: `Barrios sin ${nombre}`, detalle: `${docCount(barriosSinNombres.length)} barrios`, texto: barriosSinNombres.join(" · ") } : null
    ],
    nota: `La deuda es la de las cuentas que tienen ${nombre}: el padrón no la separa por servicio. “Parte” es cuánto de esa deuda está en cada barrio.`
  }, modo);
};

// 3. Resumen de servicios: solo los totales de cada servicio.
export const imprimirResumenServicios = ({ servicios = [], totalUsuarios = 0, totalBarrios = 0, deuda = {}, perfiles = {}, padronActualizado = "" }, modo) => {
  const columnas = [
    { titulo: "Servicio" }, num("Con el servicio"), num("% del padrón"), num("Sin el servicio"), num("Sin dato"),
    num("Cuentas con deuda"), num("Capital"), num("Intereses"), num("Deuda asociada")
  ];
  const filas = servicios.map((servicio) => [
    servicio.label,
    celda(docCount(servicio.active), { negrita: true }),
    docPct(servicio.percentage),
    docCount(servicio.inactive),
    conCero(servicio.unknown, docCount(servicio.unknown)),
    docCount(servicio.deuda?.deudores),
    docMoney(servicio.deuda?.capital),
    docMoney(servicio.deuda?.intereses),
    docMoney(servicio.deuda?.total)
  ]);
  const combinaciones = [
    ["Con agua, alcantarillado, barrido y recolección", perfiles.all_core_services],
    ["Con agua y sin alcantarillado", perfiles.water_without_sewer],
    ["Con alcantarillado y sin agua", perfiles.sewer_without_water],
    ["Sin ninguno de los cuatro servicios básicos", perfiles.no_core_services]
  ].map(([texto, valor]) => [texto, docCount(valor), docPct(totalUsuarios ? (Number(valor || 0) / totalUsuarios) * 100 : 0)]);
  return salidaPadron({
    tipo: "Resumen de servicios",
    titulo: "Resumen de servicios del padrón",
    subtitulo: "Totales de cada servicio y de la cartera asociada.",
    padronActualizado,
    orientacion: "landscape",
    cifras: [
      [docCount(totalUsuarios), "usuarios en el padrón"],
      [docCount(totalBarrios), "barrios con usuarios"],
      [docCount(deuda.deudores), "cuentas con deuda"],
      [docMoney(deuda.capital), "de capital"],
      [docMoney(deuda.intereses), "de intereses"],
      [docMoney(deuda.total), "de deuda total"]
    ],
    secciones: [
      { titulo: "Servicios", detalle: `${servicios.length} servicios`, columnas, filas },
      { titulo: "Combinaciones de servicios", columnas: [{ titulo: "Usuarios" }, num("Cantidad"), num("% del padrón")], filas: combinaciones }
    ],
    nota: "La deuda asociada a un servicio es la de las cuentas que lo tienen activo; una misma cuenta aparece en cada servicio que tiene."
  }, modo);
};

// 4. Listado general de barrios: sin totales de la empresa ni deuda.
export const imprimirListadoBarrios = ({ rows = [], filtro = "", padronActualizado = "" }, modo) => salidaPadron({
  tipo: "Listado de barrios",
  titulo: "Listado de barrios",
  subtitulo: "Barrios del padrón maestro con sus usuarios por servicio.",
  filtro: filtro ? [["Filtro", filtro]] : [],
  padronActualizado,
  secciones: [{
    titulo: "Barrios",
    detalle: `${docCount(rows.length)} barrios`,
    vacio: "Ningún barrio en este listado.",
    columnas: [{ titulo: "#", alinear: "suave" }, { titulo: "Barrio" }, num("Usuarios"), ...SERVICE_COLUMNS.map(([, etiqueta]) => num(etiqueta))],
    filas: rows.map((row, indice) => [
      String(indice + 1),
      row.name,
      docCount(row.usuarios),
      ...SERVICE_COLUMNS.map(([campo]) => conCero(row.services[campo].active, docCount(row.services[campo].active)))
    ])
  }]
}, modo);

// 5. Abonados de uno o varios barrios: cada barrio en su hoja, sin totales de la empresa.
export const imprimirAbonadosBarrios = ({ barrios = [], formatClave = (row) => row.clave_catastral, conSaldo = true, conDesglose = false, padronActualizado = "" }, modo) => {
  const marca = (activo) => (activo ? celda("Sí") : celda("—", { cero: true }));
  const columnas = [
    { titulo: "#", alinear: "suave" },
    { titulo: "Clave catastral", alinear: "mono" },
    { titulo: "Abonado", alinear: "mono" },
    { titulo: "Nombre" },
    ...SERVICE_COLUMNS.map(([, etiqueta]) => ({ titulo: etiqueta, alinear: "centro" })),
    // El saldo del padrón ya incluye los intereses: el desglose va antes, sin sumarse otra vez.
    ...(conSaldo && conDesglose ? [num("Capital"), num("Intereses")] : []),
    ...(conSaldo ? [num(conDesglose ? "Saldo total" : "Saldo")] : [])
  ];
  const solo = barrios.length === 1;
  return salidaPadron({
    tipo: "Listado de abonados por barrio",
    titulo: solo ? `Abonados de ${barrios[0].barrio_colonia}` : "Abonados por barrio",
    subtitulo: solo ? "Cuentas del barrio con sus servicios." : `Cuentas de ${barrios.length} barrios con sus servicios.`,
    filtro: solo ? [] : [["Barrios", barrios.map((barrio) => barrio.barrio_colonia).join(" · ")]],
    padronActualizado,
    orientacion: "landscape",
    secciones: barrios.map((barrio, indice) => ({
      titulo: barrio.barrio_colonia,
      detalle: `${docCount(barrio.rows.length)} ${barrio.rows.length === 1 ? "abonado" : "abonados"}`,
      salto: indice > 0,
      vacio: "El barrio no tiene abonados en el padrón.",
      columnas,
      filas: barrio.rows.map((row, fila) => [
        String(fila + 1),
        formatClave({ ...row, barrio_colonia: barrio.barrio_colonia }) || "--",
        row.abonado || "--",
        row.nombre || "Sin nombre",
        ...SERVICE_COLUMNS.map(([campo]) => marca(row.servicios?.[campo])),
        ...(conSaldo && conDesglose ? [conCero(row.tarifa, docMoney(row.tarifa)), conCero(row.intereses, docMoney(row.intereses))] : []),
        ...(conSaldo ? [conCero(row.total, docMoney(row.total))] : [])
      ])
    }))
  }, modo);
};

// 6. Consulta de abonados por palabras clave: agrupada por barrio, sin totales de la empresa.
export const imprimirListadoAbonados = (resultado = {}, formatClave = (row) => row.clave_catastral, padronActualizado = "", modo) => {
  const barrios = resultado.summary?.barrios || [];
  const include = resultado.request?.criteria?.include || resultado.request?.keywords || [];
  const exclude = resultado.request?.criteria?.exclude || [];
  const criterios = [...include, ...exclude.map((item) => `sin “${item}”`)].join(" · ");
  const columnas = [
    { titulo: "#", alinear: "suave" }, { titulo: "Clave catastral", alinear: "mono" }, { titulo: "Abonado", alinear: "mono" },
    { titulo: "Nombre" }, num("Tarifa"), num("Saldo")
  ];
  return salidaPadron({
    tipo: "Consulta de abonados",
    titulo: resultado.request?.title || "Listado de abonados",
    subtitulo: resultado.request?.description || "",
    filtro: criterios ? [["Criterios", criterios], ["Resultado", `${docCount(resultado.summary?.total_registros)} abonados en ${docCount(barrios.length)} barrios`]] : [],
    padronActualizado,
    secciones: barrios.map((barrio) => ({
      titulo: barrio.barrio_colonia,
      detalle: `${docCount(barrio.rows.length)} ${barrio.rows.length === 1 ? "abonado" : "abonados"}`,
      columnas,
      filas: barrio.rows.map((row, fila) => [
        String(fila + 1),
        formatClave(row) || "--",
        row.abonado || "--",
        row.nombre || "Sin nombre",
        docMoney(row.tarifa),
        conCero(row.total, docMoney(row.total))
      ])
    }))
  }, modo);
};
