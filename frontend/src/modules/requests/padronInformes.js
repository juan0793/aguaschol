import { SERVICE_COLUMNS, sumServiceRows } from "./utils/serviceTable";
import { docCount, docMoney, docPct, docSeccion, docTabla, docText, imprimirDocumentoPadron } from "./padronDocumento";

// Informes impresos de cada consulta del padrón. Las consultas de servicios llevan los
// totales; los listados (barrios y abonados) no llevan cifras globales de la empresa.

const cero = (valor, texto) => (Number(valor || 0) ? texto : `<span class="is-cero">${texto}</span>`);
const servicioCelda = (servicio) => cero(servicio.active, `${docCount(servicio.active)}<small>${docPct(servicio.percentage)}</small>`);

// 1. Todos los servicios: una fila por barrio con los cinco servicios.
export const imprimirTodosServicios = ({ rows = [], vista = "usuarios", filtro = "", padronActualizado = "" }) => {
  const totales = sumServiceRows(rows);
  const deuda = vista === "deuda";
  const columnas = [
    { titulo: "Barrio" },
    ...(deuda
      ? [{ titulo: "Cuentas con deuda", clase: "is-num" }]
      : [{ titulo: "Usuarios", clase: "is-num" }]),
    ...SERVICE_COLUMNS.map(([, etiqueta]) => ({ titulo: etiqueta, clase: "is-num" })),
    { titulo: "Deuda total", clase: "is-num" }
  ];
  const fila = (row) => [
    docText(row.name),
    deuda ? docCount(row.deuda.deudores) : docCount(row.usuarios),
    ...SERVICE_COLUMNS.map(([campo]) => (deuda ? cero(row.services[campo].deuda, docMoney(row.services[campo].deuda)) : servicioCelda(row.services[campo]))),
    docMoney(row.deuda.total)
  ];
  return imprimirDocumentoPadron({
    tipo: "Consulta de todos los servicios",
    titulo: deuda ? "Deuda por servicio y barrio" : "Usuarios por servicio y barrio",
    subtitulo: "Los cinco servicios del padrón maestro, barrio por barrio.",
    filtro,
    padronActualizado,
    orientacion: "landscape",
    cifras: [
      [docCount(totales.usuarios), "usuarios"],
      [docCount(rows.length), rows.length === 1 ? "barrio" : "barrios"],
      ...SERVICE_COLUMNS.map(([campo, , , nombre]) => [`${docCount(totales.services[campo].active)} <small style="font-size:9px;font-weight:600">${docPct(totales.services[campo].percentage)}</small>`, `con ${nombre.toLowerCase()}`]),
      [docMoney(totales.deuda.total), "de deuda"]
    ],
    secciones: [docSeccion({
      titulo: "Desglose por barrio",
      detalle: `${docCount(rows.length)} barrios`,
      cuerpo: docTabla({ columnas, filas: rows.map(fila), pie: fila({ ...totales, name: "Total" }).map((valor, indice) => (indice === 0 ? "Total" : valor)) })
    })],
    nota: deuda ? "Una misma cuenta suma en cada servicio que tiene activo: el padrón no separa la deuda por concepto facturado." : ""
  });
};

// 2. Un solo servicio: ya se sabe que es la consulta individual, el título es el servicio.
export const imprimirServicio = (informe = {}, padronActualizado = "") => {
  const { label = "", rows = [], totals = {}, resumen = {}, barriosSinNombres = [], filtro = "" } = informe;
  const nombre = label.toLowerCase();
  const columnas = [
    { titulo: "Barrio" },
    { titulo: "Usuarios", clase: "is-num" },
    { titulo: "Con el servicio", clase: "is-num" },
    { titulo: "Sin el servicio", clase: "is-num" },
    { titulo: "Cuentas con deuda", clase: "is-num" },
    { titulo: "Capital", clase: "is-num" },
    { titulo: "Intereses", clase: "is-num" },
    { titulo: "Deuda", clase: "is-num" },
    { titulo: "Parte", clase: "is-num" }
  ];
  const fila = (row) => [
    docText(row.name),
    docCount(row.usuarios),
    cero(row.active, `${docCount(row.active)}<small>${docPct(row.percentage)}</small>`),
    docCount(row.sin),
    docCount(row.deudores),
    docMoney(row.capital),
    docMoney(row.intereses),
    docMoney(row.deuda),
    docPct(row.share)
  ];
  const promedio = resumen.deudores ? resumen.deuda / resumen.deudores : 0;
  return imprimirDocumentoPadron({
    tipo: "Consulta por servicio",
    titulo: label,
    subtitulo: `Barrios con ${nombre}, usuarios sin el servicio y deuda de esas cuentas.`,
    filtro: filtro ? `<b>Filtro:</b> ${docText(filtro)}` : "",
    padronActualizado,
    orientacion: "landscape",
    cifras: [
      [docCount(resumen.active), `usuarios con ${nombre} (${docPct(resumen.percentage)})`],
      [`${docCount(resumen.barriosCon)}`, "barrios con el servicio"],
      [docCount(resumen.deudores), "cuentas con deuda"],
      [docMoney(resumen.deuda), "de deuda"],
      [docMoney(promedio), "promedio por cuenta"]
    ],
    secciones: [
      docSeccion({ titulo: "Barrios", detalle: `${docCount(rows.length)} en este informe`, cuerpo: docTabla({ columnas, filas: rows.map(fila), pie: ["Total", ...fila({ ...totals, name: "" }).slice(1)] }) }),
      barriosSinNombres.length ? docSeccion({ titulo: `Barrios sin ${nombre}`, detalle: `${docCount(barriosSinNombres.length)} barrios`, cuerpo: `<p>${barriosSinNombres.map((barrio) => docText(barrio)).join(" · ")}</p>` }) : ""
    ],
    nota: `La deuda es la de las cuentas que tienen ${nombre}: el padrón no la separa por servicio. “Parte” es cuánto de esa deuda está en cada barrio.`
  });
};

// 3. Resumen de servicios: solo los totales de cada servicio.
export const imprimirResumenServicios = ({ servicios = [], totalUsuarios = 0, totalBarrios = 0, deuda = {}, perfiles = {}, padronActualizado = "" }) => {
  const columnas = [
    { titulo: "Servicio" },
    { titulo: "Con el servicio", clase: "is-num" },
    { titulo: "% del padrón", clase: "is-num" },
    { titulo: "Sin el servicio", clase: "is-num" },
    { titulo: "Sin dato", clase: "is-num" },
    { titulo: "Cuentas con deuda", clase: "is-num" },
    { titulo: "Capital", clase: "is-num" },
    { titulo: "Intereses", clase: "is-num" },
    { titulo: "Deuda asociada", clase: "is-num" }
  ];
  const filas = servicios.map((servicio) => [
    docText(servicio.label),
    `<b>${docCount(servicio.active)}</b>`,
    docPct(servicio.percentage),
    docCount(servicio.inactive),
    cero(servicio.unknown, docCount(servicio.unknown)),
    docCount(servicio.deuda?.deudores),
    docMoney(servicio.deuda?.capital),
    docMoney(servicio.deuda?.intereses),
    docMoney(servicio.deuda?.total)
  ]);
  const perfilesFilas = [
    ["Con agua, alcantarillado, barrido y recolección", perfiles.all_core_services],
    ["Con agua y sin alcantarillado", perfiles.water_without_sewer],
    ["Con alcantarillado y sin agua", perfiles.sewer_without_water],
    ["Sin ninguno de los cuatro servicios básicos", perfiles.no_core_services]
  ].map(([texto, valor]) => [docText(texto), docCount(valor), docPct(totalUsuarios ? (Number(valor || 0) / totalUsuarios) * 100 : 0)]);
  return imprimirDocumentoPadron({
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
      docSeccion({ titulo: "Servicios", detalle: `${servicios.length} servicios`, cuerpo: docTabla({ columnas, filas }) }),
      docSeccion({ titulo: "Combinaciones de servicios", cuerpo: docTabla({ columnas: [{ titulo: "Usuarios" }, { titulo: "Cantidad", clase: "is-num" }, { titulo: "% del padrón", clase: "is-num" }], filas: perfilesFilas }) })
    ],
    nota: "La deuda asociada a un servicio es la de las cuentas que lo tienen activo; una misma cuenta aparece en cada servicio que tiene."
  });
};

// 4. Listado general de barrios: sin totales de la empresa ni deuda.
export const imprimirListadoBarrios = ({ rows = [], filtro = "", padronActualizado = "" }) => {
  const columnas = [
    { titulo: "#", clase: "is-suave" },
    { titulo: "Barrio" },
    { titulo: "Usuarios", clase: "is-num" },
    ...SERVICE_COLUMNS.map(([, etiqueta]) => ({ titulo: etiqueta, clase: "is-num" }))
  ];
  const filas = rows.map((row, indice) => [
    String(indice + 1),
    docText(row.name),
    docCount(row.usuarios),
    ...SERVICE_COLUMNS.map(([campo]) => cero(row.services[campo].active, docCount(row.services[campo].active)))
  ]);
  return imprimirDocumentoPadron({
    tipo: "Listado de barrios",
    titulo: "Listado de barrios",
    subtitulo: "Barrios del padrón maestro con sus usuarios por servicio.",
    filtro: filtro ? `<b>Filtro:</b> ${docText(filtro)}` : "",
    padronActualizado,
    secciones: [docSeccion({ titulo: "Barrios", detalle: `${docCount(rows.length)} barrios`, cuerpo: docTabla({ columnas, filas, vacio: "Ningún barrio en este listado." }) })]
  });
};

// 5. Abonados de uno o varios barrios: cada barrio en su sección, sin totales de la empresa.
export const imprimirAbonadosBarrios = ({ barrios = [], formatClave = (row) => row.clave_catastral, conSaldo = true, padronActualizado = "" }) => {
  const marca = (activo) => (activo ? "Sí" : '<span class="is-cero">—</span>');
  const columnas = [
    { titulo: "#", clase: "is-suave" },
    { titulo: "Clave catastral", clase: "is-mono" },
    { titulo: "Abonado", clase: "is-mono" },
    { titulo: "Nombre" },
    ...SERVICE_COLUMNS.map(([, etiqueta]) => ({ titulo: etiqueta, clase: "is-centro" })),
    ...(conSaldo ? [{ titulo: "Saldo", clase: "is-num" }] : [])
  ];
  const solo = barrios.length === 1;
  return imprimirDocumentoPadron({
    tipo: "Listado de abonados por barrio",
    titulo: solo ? `Abonados de ${barrios[0].barrio_colonia}` : "Abonados por barrio",
    subtitulo: solo ? "Cuentas del barrio con sus servicios." : `Cuentas de ${barrios.length} barrios con sus servicios.`,
    filtro: solo ? "" : `<b>Barrios:</b> ${barrios.map((barrio) => docText(barrio.barrio_colonia)).join(" · ")}`,
    padronActualizado,
    orientacion: "landscape",
    secciones: barrios.map((barrio, indice) => docSeccion({
      titulo: barrio.barrio_colonia,
      detalle: `${docCount(barrio.rows.length)} ${barrio.rows.length === 1 ? "abonado" : "abonados"}`,
      clase: indice ? "is-salto" : "",
      cuerpo: docTabla({
        columnas,
        vacio: "El barrio no tiene abonados en el padrón.",
        filas: barrio.rows.map((row, fila) => [
          String(fila + 1),
          docText(formatClave({ ...row, barrio_colonia: barrio.barrio_colonia })),
          docText(row.abonado),
          docText(row.nombre, "Sin nombre"),
          ...SERVICE_COLUMNS.map(([campo]) => marca(row.servicios?.[campo])),
          ...(conSaldo ? [cero(row.total, docMoney(row.total))] : [])
        ])
      })
    }))
  });
};

// 6. Consulta de abonados por palabras clave: agrupada por barrio, sin totales de la empresa.
export const imprimirListadoAbonados = (resultado = {}, formatClave = (row) => row.clave_catastral, padronActualizado = "") => {
  const barrios = resultado.summary?.barrios || [];
  const include = resultado.request?.criteria?.include || resultado.request?.keywords || [];
  const exclude = resultado.request?.criteria?.exclude || [];
  const criterios = [...include.map((item) => docText(item)), ...exclude.map((item) => `sin “${docText(item)}”`)].join(" · ");
  const columnas = [
    { titulo: "#", clase: "is-suave" },
    { titulo: "Clave catastral", clase: "is-mono" },
    { titulo: "Abonado", clase: "is-mono" },
    { titulo: "Nombre" },
    { titulo: "Tarifa", clase: "is-num" },
    { titulo: "Saldo", clase: "is-num" }
  ];
  return imprimirDocumentoPadron({
    tipo: "Consulta de abonados",
    titulo: resultado.request?.title || "Listado de abonados",
    subtitulo: resultado.request?.description || "",
    filtro: criterios ? `<b>Criterios:</b> ${criterios} · <b>${docCount(resultado.summary?.total_registros)}</b> abonados en ${docCount(barrios.length)} barrios` : "",
    padronActualizado,
    secciones: barrios.map((barrio) => docSeccion({
      titulo: barrio.barrio_colonia,
      detalle: `${docCount(barrio.rows.length)} ${barrio.rows.length === 1 ? "abonado" : "abonados"}`,
      cuerpo: docTabla({
        columnas,
        filas: barrio.rows.map((row, fila) => [
          String(fila + 1),
          docText(formatClave(row)),
          docText(row.abonado),
          docText(row.nombre, "Sin nombre"),
          docMoney(row.tarifa),
          cero(row.total, docMoney(row.total))
        ])
      })
    }))
  });
};
