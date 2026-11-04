import { celda, docCount, docMoney, docPct, salidaPadron } from "../requests/padronDocumento";
import { CRITERIOS, tipoDe, totalesBarrios } from "./barriosSinAguasData";

// Informes de "Barrios sin Aguas", con el mismo documento de las consultas del padrón
// (`modo`: "imprimir" | "pdf").

const num = (titulo) => ({ titulo, alinear: "num" });
const fechaLarga = (iso) => new Date(iso).toLocaleDateString("es-HN", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Tegucigalpa" });

export const imprimirBarriosSinAguas = ({ filas = [], criterio = "0", marcados = false, filtro = [], alcaldia = {}, aguas = {}, totalBarriosAlcaldia = 0 }, modo) => {
  const t = totalesBarrios(filas);
  const crit = CRITERIOS.find((item) => item.key === criterio) || CRITERIOS[0];
  const mayor = Math.max(1, ...filas.map((fila) => fila.claves));
  return salidaPadron({
    tipo: "Cruce de Alcaldía con Aguas",
    titulo: marcados ? "Barrios marcados que no aparecen en Aguas" : "Barrios que no aparecen en Aguas",
    subtitulo: `Barrios del padrón de Alcaldía${alcaldia.actualizado ? ` (${fechaLarga(alcaldia.actualizado)})` : ""} ${crit.corto}. La coincidencia se busca por clave catastral.`,
    filtro,
    padronActualizado: aguas.actualizado || "",
    orientacion: "landscape",
    cifras: [
      [docCount(t.barrios), t.barrios === 1 ? "barrio" : "barrios", totalBarriosAlcaldia ? `de ${docCount(totalBarriosAlcaldia)} de Alcaldía` : ""],
      [docCount(t.claves), "claves de Alcaldía"],
      [docCount(t.sin_registrar), "sin registro en Aguas"],
      [docCount(t.con_parecido), "con nombre parecido en Aguas"],
      [docMoney(t.avaluo), "de avalúo catastral"]
    ],
    secciones: [{
      titulo: "Barrios",
      detalle: `${docCount(t.barrios)} barrios · ${docCount(t.urbano)} claves urbanas y ${docCount(t.rural)} rurales`,
      columnas: [{ titulo: "Barrio" }, { titulo: "Código", alinear: "mono" }, num("Claves Alcaldía"), num("En Aguas"), num("Sin registro"), { titulo: "Tipo" }, { titulo: "Nombre parecido en Aguas" }],
      filas: filas.map((fila) => [
        fila.barrio,
        fila.codigo_caserio || "—",
        celda(docCount(fila.claves), { barra: fila.claves / mayor }),
        celda(docCount(fila.en_aguas), { nota: docPct(fila.cobertura), cero: !fila.en_aguas }),
        docCount(fila.sin_registrar),
        tipoDe(fila) === "rural" ? "Rural" : "Urbano",
        fila.parecido ? celda(fila.parecido.nombre, { nota: `${docCount(fila.parecido.usuarios)} usuarios` }) : celda("—", { cero: true })
      ]),
      pie: [celda("Total", { negrita: true }), "", docCount(t.claves), docCount(t.en_aguas), docCount(t.sin_registrar), "", `${docCount(t.con_parecido)} con nombre parecido`]
    }],
    nota: "Un barrio con nombre parecido en Aguas puede estar registrado con otras claves (por ejemplo, claves provisionales del desarrollador): conviene revisarlo antes de mandarlo a campo."
  }, modo);
};

export const imprimirClavesBarrio = ({ barrio, claves = [], soloSinRegistro = true, alcaldia = {}, aguas = {} }, modo) => {
  const filas = soloSinRegistro ? claves.filter((clave) => !clave.en_aguas) : claves;
  return salidaPadron({
    tipo: "Cruce de Alcaldía con Aguas",
    titulo: barrio.barrio,
    subtitulo: `${soloSinRegistro ? "Claves de Alcaldía de este barrio que no aparecen en Aguas" : "Todas las claves de Alcaldía de este barrio y si aparecen en Aguas"}${alcaldia.actualizado ? ` (padrón de Alcaldía del ${fechaLarga(alcaldia.actualizado)})` : ""}.`,
    padronActualizado: aguas.actualizado || "",
    orientacion: "landscape",
    cifras: [
      [docCount(barrio.claves), "claves de Alcaldía"],
      [docCount(barrio.en_aguas), "en Aguas", docPct(barrio.cobertura)],
      [docCount(barrio.sin_registrar), "sin registro"],
      ...(barrio.parecido ? [[barrio.parecido.nombre, "nombre parecido en Aguas", `${docCount(barrio.parecido.usuarios)} usuarios`]] : [])
    ],
    secciones: [{
      titulo: soloSinRegistro ? "Claves sin registro en Aguas" : "Claves de Alcaldía",
      detalle: `${docCount(filas.length)} claves`,
      columnas: [{ titulo: "Clave", alinear: "mono" }, { titulo: "Propietario" }, { titulo: "Dirección" }, { titulo: "Naturaleza" }, num("Avalúo"), { titulo: "Último pago Alcaldía" }, ...(soloSinRegistro ? [] : [{ titulo: "En Aguas", alinear: "centro" }])],
      filas: filas.map((clave) => [
        clave.clave_catastral,
        clave.nombre || "—",
        clave.direccion || "—",
        clave.naturaleza || "—",
        celda(clave.avaluo ? docMoney(clave.avaluo) : "—", { cero: !clave.avaluo }),
        clave.ultimo_periodo_pagado || "—",
        ...(soloSinRegistro ? [] : [clave.en_aguas ? "Sí" : "No"])
      ])
    }]
  }, modo);
};
