import assert from "node:assert/strict";
import test from "node:test";
import { armarEstadoCuenta, nombreArchivo } from "./estadoCuentaDatos.js";

const servicios = { agua: false, alcantarillado: false, barrido: true, recoleccion: true, desechos_peligrosos: false };

test("una deuda se desglosa en capital e intereses sin volver a sumarlos", () => {
  const datos = armarEstadoCuenta({
    row: { nombre: " ELIO AVILA ", abonado: "19935", clave_catastral: "22-16-02-03", tarifa: 136406.25, intereses: 330751.3, total: 467157.55, servicios },
    barrio: "BO. CABAÑAS", padronActualizado: "2026-10-27T21:20:00Z", emitido: "2026-10-27T21:22:00Z", reportId: "RPT-1"
  });
  assert.equal(datos.nombre, "ELIO AVILA");
  assert.equal(datos.total, 467157.55);
  assert.equal(datos.estado, "deuda");
  assert.equal(datos.parteIntereses, 71);
  assert.equal(datos.parteCapital, 29);
  assert.equal(datos.rotuloSaldo, "Saldo total al 27 de octubre de 2026");
  assert.equal(datos.notaSaldo, "El saldo total ya incluye los intereses.");
  assert.deepEqual(datos.servicios.filter((s) => s.activo).map((s) => s.etiqueta), ["Barrido", "Recolección de desechos"]);
  assert.equal(nombreArchivo(datos), "estado-de-cuenta-abonado-19935");
});

test("saldo a favor y al día no reparten una barra", () => {
  const aFavor = armarEstadoCuenta({ row: { tarifa: -165.6, intereses: 5.4, total: -160.2 } });
  assert.equal(aFavor.estado, "a-favor");
  assert.equal(aFavor.parteIntereses, 0);
  assert.equal(aFavor.parteCapital, 0);
  assert.equal(aFavor.rotuloSaldo, "Saldo a favor");
  const alDia = armarEstadoCuenta({ row: { tarifa: 0, intereses: 0, total: 0 } });
  assert.equal(alDia.estado, "al-dia");
  assert.match(alDia.notaSaldo, /al día/);
  assert.equal(alDia.nombre, "Sin nombre en el padrón");
  assert.equal(alDia.abonado, "--");
});
