import test from "node:test";
import assert from "node:assert/strict";
import { cuentaTexto, entregaTexto, filtrarExclusiones, totalesExclusiones } from "./exclusiones.js";

const lista = [
  {
    id: 1, tipo: "ABONADO", valor: "4492", llave: "4492", nota: "",
    cuentas: [{ abonado: "4492", clave_catastral: "14-30-08-84", nombre: "ESCUELA TOMASA P. DE BENEDETTO", barrio: "BO. EL CENTRO" }],
    saldo: { capital: 20000, mora: 5765.82, total: 25765.82 },
    entrega: { estado: "ENTREGADA", tecnico: "Elmer Gómez", fecha: "2026-10-20", lote_id: 7 },
    sin_entregar_antes: 2
  },
  {
    id: 2, tipo: "CLAVE", valor: "03-21-01-03", llave: "03210103", nota: "Educación",
    cuentas: [
      { abonado: "2945", clave_catastral: "03-21-01-03", nombre: "SUPERVISION DEPARTAMENTAL", barrio: "BO. NUEVA ESPERANZA" },
      { abonado: "22351", clave_catastral: "03-21-01-03", nombre: "SUPERVISION # 02", barrio: "BO. NUEVA ESPERANZA" }
    ],
    saldo: { capital: 18000, mora: 6853.54, total: 24853.54 },
    entrega: { estado: "SOBRANTE", tecnico: "Sayma Lorena", fecha: "2026-10-15", documento_estado: "PENDIENTE" },
    sin_entregar_antes: 0
  },
  { id: 3, tipo: "ABONADO", valor: "999999", llave: "999999", cuentas: [], entrega: { estado: "SIN_BARRIO" } }
];

test("exclusiones: textos de la entrega y de la cuenta", () => {
  const entregada = entregaTexto(lista[0]);
  assert.equal(entregada.etiqueta, "Entregada por técnico");
  assert.equal(entregada.detalle, "Elmer Gómez · lote del 20/10/2026; no quedó de sobrante");
  assert.equal(entregada.antes, "2 veces sin entregar en ciclos anteriores");
  assert.equal(entregaTexto(lista[1]).detalle, "Sayma Lorena · lote del 15/10/2026 · Pendiente");
  assert.equal(entregaTexto(lista[2]).etiqueta, "No está en el padrón");

  assert.deepEqual(cuentaTexto(lista[0]), { nombre: "ESCUELA TOMASA P. DE BENEDETTO", linea: "Clave 14-30-08-84 · BO. EL CENTRO" });
  assert.equal(cuentaTexto(lista[1]).linea, "Abonado 2945 · BO. NUEVA ESPERANZA · y 1 cuenta más");
  assert.equal(cuentaTexto(lista[2]).nombre, "No está en el padrón");
});

test("exclusiones: búsqueda, filtro por estado y totales", () => {
  assert.deepEqual(filtrarExclusiones(lista, { buscar: "tomasa" }).map((item) => item.id), [1]);
  assert.deepEqual(filtrarExclusiones(lista, { buscar: "elmer gomez" }).map((item) => item.id), [1]);
  assert.deepEqual(filtrarExclusiones(lista, { buscar: "143008" }).map((item) => item.id), [1]);
  assert.deepEqual(filtrarExclusiones(lista, { buscar: "22351" }).map((item) => item.id), [2]);
  assert.deepEqual(filtrarExclusiones(lista, { estado: "SOBRANTE" }).map((item) => item.id), [2]);

  const totales = totalesExclusiones(lista);
  assert.equal(totales.total, 3);
  assert.equal(totales.saldo, 50619.36);
  assert.equal(totales.mora, 12619.36);
  assert.equal(totales.por_estado.ENTREGADA, 1);
  assert.equal(totales.por_estado.SIN_BARRIO, 1);
});
