import assert from "node:assert/strict";
import test from "node:test";
import { filaVacia, parsearPegado, posicionesDuplicadas } from "./cierreLoteUtils.js";

const motivos = [
  { codigo: "CASA_CERRADA", etiqueta: "Casa cerrada" },
  { codigo: "NO_LOCALIZADA", etiqueta: "Direccion no encontrada" },
  { codigo: "OTRO", etiqueta: "Otro" }
];

test("parsea pegado separado por comas o tabulaciones", () => {
  assert.deepEqual(parsearPegado("10245,10-20-03-04,Casa cerrada\n10287\t10-20-03-18\tNO_LOCALIZADA", motivos), [
    {
      numero_abonado: "10245",
      clave_catastral: "10-20-03-04",
      abonado_nombre: "",
      motivo: "CASA_CERRADA",
      observacion: ""
    },
    {
      numero_abonado: "10287",
      clave_catastral: "10-20-03-18",
      abonado_nombre: "",
      motivo: "NO_LOCALIZADA",
      observacion: ""
    }
  ]);
});

test("crea filas vacias con el motivo por defecto", () => {
  assert.equal(filaVacia("CASA_CERRADA").motivo, "CASA_CERRADA");
});

test("marca la segunda aparicion de un abonado+clave repetido", () => {
  const filas = [
    { numero_abonado: "2046", clave_catastral: "05-17-01-83" },
    { numero_abonado: "2046", clave_catastral: "05-17-01-83" },
    { numero_abonado: "2016", clave_catastral: "05-13-01-01" }
  ];
  assert.deepEqual(posicionesDuplicadas(filas, []), [1]);
});

test("detecta choques contra el detalle ya guardado sin distinguir mayusculas ni espacios", () => {
  const guardadas = [{ numero_abonado: "2016", clave_catastral: "05-13-01-01" }];
  assert.deepEqual(posicionesDuplicadas([{ numero_abonado: " 2016 ", clave_catastral: "05-13-01-01" }], guardadas), [0]);
});

test("ignora filas todavia vacias", () => {
  const vacias = [filaVacia("CASA_CERRADA"), filaVacia("CASA_CERRADA")];
  assert.deepEqual(posicionesDuplicadas(vacias, []), []);
});
