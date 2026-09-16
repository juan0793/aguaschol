import assert from "node:assert/strict";
import test from "node:test";
import { polishInspectionText } from "./inspectionPrintText.js";

test("corrige errores frecuentes sin modificar códigos ni teléfonos", () => {
  assert.equal(
    polishInspectionText("se en contro que hay viviendas En abando. Codigos (19866 19069) Tel. 9405-0848"),
    "Se encontró que hay viviendas en abandono. Códigos (19866 19069) Tel. 9405-0848."
  );
});

test("normaliza espacios, acentos frecuentes y puntuación final", () => {
  assert.equal(
    polishInspectionText("verificar  como está la conexion al dia y dos abonados mas"),
    "Verificar cómo está la conexión al día y dos abonados más."
  );
});

test("respeta mayúsculas del técnico al corregir acentos", () => {
  assert.equal(
    polishInspectionText("VERIFICAR CONEXION DE ALCANTARILLADO Y AGUA POTABLE"),
    "VERIFICAR CONEXIÓN DE ALCANTARILLADO Y AGUA POTABLE."
  );
});

test("expande abreviaturas de mensajería sin tocar letras de referencia", () => {
  assert.equal(
    polishInspectionText("Disen los vecinos q no hay coneccion xq falta tubo en Bloque Q"),
    "Dicen los vecinos que no hay conexión porque falta tubo en Bloque Q."
  );
});
