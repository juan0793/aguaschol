import test from "node:test";
import assert from "node:assert/strict";
import { barrioDeClave, detallarExclusiones, entregaDelCiclo, exclusionDeDocumento, indexarCuentas, llaveExclusion, normalizarEnvioExclusiones, resumenExclusiones } from "./entregasExclusionesRules.js";

test("exclusiones: la clave se compara por sus cifras y el abonado sin ceros a la izquierda", () => {
  assert.equal(llaveExclusion("CLAVE", " 25-11-08-03 "), "25110803");
  assert.equal(llaveExclusion("CLAVE", "25110803"), "25110803");
  assert.equal(llaveExclusion("ABONADO", " 0123 "), "123");
  assert.equal(llaveExclusion("ABONADO", "0"), "0");
  assert.equal(llaveExclusion("OTRO", "123"), "");
});

test("exclusiones: un envío pegado se separa, se deduplica y avisa lo que no reconoce", () => {
  const envio = normalizarEnvioExclusiones({ tipo: "clave", valores: "25-11-08-03\n25110803, 18-21-04-01; 12-3\n00-00-00-00", nota: "  Grandes   clientes " });
  assert.equal(envio.tipo, "CLAVE");
  assert.deepEqual(envio.items.map((item) => [item.valor, item.llave, item.nota]), [
    ["25-11-08-03", "25110803", "Grandes clientes"],
    ["18-21-04-01", "18210401", "Grandes clientes"]
  ]);
  assert.deepEqual(envio.invalidos, ["12-3", "00-00-00-00"]);

  const abonados = normalizarEnvioExclusiones({ tipo: "ABONADO", valores: ["5838", " 05838 ", "9417"] });
  assert.deepEqual(abonados.items.map((item) => item.llave), ["5838", "9417"]);
  assert.equal(abonados.items[0].nota, null);
});

test("exclusiones: rechaza tipo desconocido, vacío y nota larga", () => {
  assert.throws(() => normalizarEnvioExclusiones({ tipo: "BARRIO", valores: "113" }), /Elige si excluyes/);
  assert.throws(() => normalizarEnvioExclusiones({ tipo: "ABONADO", valores: "  " }), /al menos un número de abonado/);
  assert.throws(() => normalizarEnvioExclusiones({ tipo: "CLAVE", valores: "12" }), /No se reconoció ninguna clave catastral: 12/);
  assert.throws(() => normalizarEnvioExclusiones({ tipo: "ABONADO", valores: "1", nota: "x".repeat(121) }), /hasta 120/);
});

test("exclusiones: un documento coincide por abonado o por clave", () => {
  const exclusiones = [
    { id: 1, tipo: "ABONADO", llave: "5838", nota: null },
    { id: 2, tipo: "CLAVE", llave: "28380903", nota: "Grandes clientes" }
  ];
  assert.equal(exclusionDeDocumento({ numero_abonado: "05838", clave_catastral: "" }, exclusiones).id, 1);
  assert.equal(exclusionDeDocumento({ numero_abonado: "", clave_catastral: "28-38-09-03" }, exclusiones).id, 2);
  assert.equal(exclusionDeDocumento({ numero_abonado: "9491", clave_catastral: "28-38-09-01" }, exclusiones), null);
  // Un número de abonado no cae en una clave con las mismas cifras.
  assert.equal(exclusionDeDocumento({ numero_abonado: "28380903" }, exclusiones), null);
  assert.equal(exclusionDeDocumento({}, exclusiones), null);
});

const padron = [
  { abonado: "2945", clave_catastral: "03-21-01-03", inquilino: "SUPERVISION DEPARTAMENTAL", barrio_colonia: "BO. NUEVA ESPERANZA", valor: 10000, intereses: 6342.18, total: 16342.18 },
  { abonado: "22351", clave_catastral: "03-21-01-03", inquilino: "SUPERVISION # 02 DEPARTAMENTAL", barrio_colonia: "BO. NUEVA ESPERANZA", valor: 8000, intereses: 511.36, total: 8511.36 },
  { abonado: "4492", clave_catastral: "14-30-08-84", inquilino: "ESCUELA TOMASA P. DE BENEDETTO", barrio_colonia: "BO. EL CENTRO", valor: 20000, intereses: 5765.82, total: 25765.82 }
];

test("exclusiones: el barrio sale del primer tramo de la clave", () => {
  assert.equal(barrioDeClave("14-30-08-84"), "14");
  assert.equal(barrioDeClave("140-01-02-03"), "140");
  assert.equal(barrioDeClave("14300884"), "");
  assert.equal(barrioDeClave(""), "");
});

test("exclusiones: entrega del ciclo según sobrantes y lotes del barrio", () => {
  const lotes = [
    { id: 7, fecha: "2026-10-20", estado: "CERRADO", tecnico: "Elmer Gómez", tipo_documento: "FACTURA" },
    { id: 9, fecha: "2026-10-25", estado: "ABIERTO", tecnico: "Elmer Gómez", tipo_documento: "NOTA_COBRO" }
  ];
  assert.deepEqual(entregaDelCiclo({ lotes, barrio: "14" }), { estado: "ENTREGADA", tecnico: "Elmer Gómez", fecha: "2026-10-20", lote_id: 7, tipo_documento: "FACTURA" });
  assert.equal(entregaDelCiclo({ lotes: [lotes[1]], barrio: "14" }).estado, "LOTE_ABIERTO");
  assert.equal(entregaDelCiclo({ barrio: "14" }).estado, "SIN_LOTE");
  assert.equal(entregaDelCiclo({}).estado, "SIN_BARRIO");

  const sobrante = { id: 3, lote_id: 7, fecha: "2026-10-20", estado: "PENDIENTE", tecnico: "Elmer Gómez", tipo_documento: "FACTURA" };
  assert.equal(entregaDelCiclo({ documentos: [sobrante], lotes, barrio: "14" }).estado, "SOBRANTE");
  const despues = entregaDelCiclo({ documentos: [sobrante, { ...sobrante, id: 4, fecha: "2026-10-22", estado: "REENTREGADA", fecha_entrega_final: "2026-10-23" }], lotes, barrio: "14" });
  assert.equal(despues.estado, "REENTREGADA");
  assert.equal(despues.fecha_entrega_final, "2026-10-23");
});

test("exclusiones: cada exclusión con su cuenta, saldo y entrega; la misma clave no mezcla abonados", () => {
  const indice = indexarCuentas(padron);
  const exclusiones = [
    { id: 1, tipo: "ABONADO", valor: "2945", llave: "2945" },
    { id: 2, tipo: "CLAVE", valor: "03-21-01-03", llave: "03210103" },
    { id: 3, tipo: "ABONADO", valor: "4492", llave: "4492" },
    { id: 4, tipo: "ABONADO", valor: "999999", llave: "999999" }
  ];
  const documentos = [
    // Sobrante del 22351 en el ciclo: es de la clave, no del abonado 2945.
    { id: 10, lote_id: 5, numero_abonado: "22351", clave_catastral: "03-21-01-03", estado: "PENDIENTE", fecha: "2026-10-15", tecnico: "Sayma Lorena" },
    // Del ciclo anterior, anotado solo con la clave del 4492.
    { id: 11, lote_id: 2, numero_abonado: "", clave_catastral: "14-30-08-84", estado: "VENCIDA", fecha: "2026-09-10", tecnico: "Elmer Gómez" }
  ];
  const lotes = [
    { id: 5, fecha: "2026-10-15", estado: "CERRADO", barrio_codigo: "03", tecnico: "Sayma Lorena" },
    { id: 8, fecha: "2026-10-18", estado: "CERRADO", barrio_codigo: "14", tecnico: "Elmer Gómez" }
  ];
  const detalle = detallarExclusiones({ exclusiones, indice, documentos, lotes, desde: "2026-10-01", conSaldo: true });

  assert.equal(detalle[0].cuentas.length, 1);
  assert.equal(detalle[0].entrega.estado, "ENTREGADA");
  assert.equal(detalle[0].entrega.tecnico, "Sayma Lorena");
  assert.deepEqual(detalle[1].cuentas.map((cuenta) => cuenta.abonado), ["2945", "22351"]);
  assert.deepEqual(detalle[1].saldo, { capital: 18000, mora: 6853.54, total: 24853.54 });
  assert.equal(detalle[1].entrega.estado, "SOBRANTE");
  assert.equal(detalle[2].entrega.estado, "ENTREGADA");
  assert.equal(detalle[2].sin_entregar_antes, 1);
  assert.equal(detalle[3].cuentas.length, 0);
  assert.equal(detalle[3].entrega.estado, "SIN_BARRIO");

  const resumen = resumenExclusiones(detalle);
  assert.equal(resumen.total, 4);
  assert.equal(resumen.sin_padron, 1);
  assert.deepEqual(resumen.por_estado, { ENTREGADA: 2, SOBRANTE: 1, SIN_BARRIO: 1 });
  assert.equal(resumen.saldo, 66961.54);

  // Sin permiso de saldo no viajan montos.
  const sinSaldo = detallarExclusiones({ exclusiones, indice, documentos, lotes, desde: "2026-10-01" });
  assert.equal(sinSaldo[0].saldo, undefined);
  assert.equal(sinSaldo[0].cuentas[0].total, undefined);
});
