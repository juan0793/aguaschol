import test from "node:test";
import assert from "node:assert/strict";
import { POSICIONES, filtrarPorSaldo, limitesDeSaldo, posicionAValor, valorAPosicion } from "./rangoSaldo.js";

const fila = (nombre, barrio, tarifa, total) => ({ nombre, barrio_colonia: barrio, tarifa, total });
const armar = (rows) => {
  const barrios = [...new Set(rows.map((row) => row.barrio_colonia))].map((barrio_colonia) => {
    const propias = rows.filter((row) => row.barrio_colonia === barrio_colonia);
    return { barrio_colonia, rows: propias, total_registros: propias.length, tarifa_total: 0, total_con_interes: 0 };
  });
  return { request: { title: "Prueba" }, rows, summary: { total_registros: rows.length, total_barrios: barrios.length, barrios } };
};
const resultado = armar([
  fila("A", "Uno", 100, 0),
  fila("B", "Uno", 200, 1500.5),
  fila("C", "Dos", 300, 82000),
  fila("D", "Tres", 50, 400)
]);

test("los límites van de 0 al saldo más alto", () => {
  assert.deepEqual(limitesDeSaldo(resultado), { min: 0, max: 82000 });
  assert.deepEqual(limitesDeSaldo(null), { min: 0, max: 0 });
});

test("el rango completo devuelve el resultado sin tocar", () => {
  assert.equal(filtrarPorSaldo(resultado, 0, 82000), resultado);
});

test("filtra abonados, quita barrios vacíos y recalcula los totales", () => {
  const filtrado = filtrarPorSaldo(resultado, 300, 2000);
  assert.deepEqual(filtrado.rows.map((row) => row.nombre), ["B", "D"]);
  assert.deepEqual(filtrado.summary.barrios.map((barrio) => barrio.barrio_colonia), ["Uno", "Tres"]);
  assert.equal(filtrado.summary.total_registros, 2);
  assert.equal(filtrado.summary.total_barrios, 2);
  assert.equal(filtrado.summary.tarifa_total, 250);
  assert.equal(filtrado.summary.total_con_interes, 1900.5);
  assert.equal(filtrado.summary.barrios[0].total_con_interes, 1500.5);
  assert.deepEqual(filtrado.request.rango_saldo, { desde: 300, hasta: 2000 });
  assert.equal(resultado.rows.length, 4);
});

test("el deslizador llega a los extremos exactos y es creciente", () => {
  const limites = { min: 0, max: 82037 };
  assert.equal(posicionAValor(0, limites), 0);
  assert.equal(posicionAValor(POSICIONES, limites), 82037);
  let anterior = -1;
  for (let posicion = 0; posicion <= POSICIONES; posicion += 25) {
    const valor = posicionAValor(posicion, limites);
    assert.ok(valor >= anterior);
    anterior = valor;
  }
  // La mitad del recorrido queda en montos chicos, no en la mitad del máximo.
  assert.ok(posicionAValor(POSICIONES / 2, limites) < limites.max / 4);
  assert.equal(valorAPosicion(limites.max, limites), POSICIONES);
  assert.equal(valorAPosicion(0, limites), 0);
});

test("las flechas saltan a la primera posición que cambia el monto", async () => {
  const { posicionVecina } = await import("./rangoSaldo.js");
  const limites = { min: 0, max: 180095 };
  let posicion = 0;
  for (let i = 0; i < 5; i += 1) {
    const siguiente = posicionVecina(posicion, 1, limites);
    assert.ok(posicionAValor(siguiente, limites) > posicionAValor(posicion, limites));
    posicion = siguiente;
  }
  assert.ok(posicionAValor(posicionVecina(posicion, -1, limites), limites) < posicionAValor(posicion, limites));
  assert.equal(posicionVecina(0, -1, limites), 0);
  assert.equal(posicionVecina(POSICIONES, 1, limites), POSICIONES);
});

test("la búsqueda ignora acentos y el orden pone el mayor saldo primero", async () => {
  const { filtrarPorTexto, ordenarPorSaldo } = await import("./rangoSaldo.js");
  const datos = armar([fila("FARMACIA SAN JOSÉ", "Uno", 10, 5), fila("Hotel", "Uno", 10, 900), fila("Farmacia Norte", "Dos", 10, 7000)]);
  const hallados = filtrarPorTexto(datos, "jose");
  assert.deepEqual(hallados.rows.map((row) => row.nombre), ["FARMACIA SAN JOSÉ"]);
  assert.equal(hallados.request.busqueda, "jose");
  assert.equal(filtrarPorTexto(datos, "  "), datos);
  const conTotales = { ...datos, summary: { ...datos.summary, barrios: datos.summary.barrios.map((b) => ({ ...b, total_con_interes: b.rows.reduce((t, r) => t + r.total, 0) })) } };
  const ordenado = ordenarPorSaldo(conTotales);
  assert.deepEqual(ordenado.summary.barrios.map((b) => b.barrio_colonia), ["Dos", "Uno"]);
  assert.deepEqual(ordenado.summary.barrios[1].rows.map((row) => row.nombre), ["Hotel", "FARMACIA SAN JOSÉ"]);
  assert.equal(ordenado.request.orden, "saldo");
});
