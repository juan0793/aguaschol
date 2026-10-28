import test from "node:test";
import assert from "node:assert/strict";
import { exclusionDeDocumento, llaveExclusion, normalizarEnvioExclusiones } from "./entregasExclusionesRules.js";

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
