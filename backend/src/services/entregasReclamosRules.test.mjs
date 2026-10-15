import assert from "node:assert/strict";
import test from "node:test";
import { buscarEnPadron, elegirResponsable, normalizarReclamo, normalizarRespuesta, resumirAbonado } from "./entregasReclamosRules.js";

const padron = [
  { clave_catastral: "05-12-003-01", clave_base: "05-12-003", abonado: "10234", inquilino: "MARIA LOPEZ", barrio_colonia: "BO. EL CENTRO" },
  { clave_catastral: "05-12-003-02", clave_base: "05-12-003", abonado: "10235", nombre: "JUAN PEREZ", barrio_colonia: "BO. EL CENTRO" },
  { clave_catastral: "07-01-010-01", clave_base: "07-01-010", abonado: "88001", inquilino: "ANA CRUZ", barrio_colonia: "COL. LAS PALMAS" }
];
const normalizar = (valor) => {
  const partes = String(valor).split("-").filter(Boolean);
  if (![3, 4].includes(partes.length)) throw new Error("clave no válida");
  return partes.join("-");
};

test("un número sin guiones se busca primero como abonado", () => {
  const resultado = buscarEnPadron(padron, " 10235 ", normalizar);
  assert.equal(resultado.campo, "abonado");
  assert.deepEqual(resultado.coincidencias.map((item) => item.clave_catastral), ["05-12-003-02"]);
});

test("una clave completa encuentra su inmueble y una clave base todos los del predio", () => {
  assert.equal(buscarEnPadron(padron, "07-01-010-01", normalizar).coincidencias.length, 1);
  const base = buscarEnPadron(padron, "05-12-003", normalizar);
  assert.equal(base.campo, "clave");
  assert.equal(base.coincidencias.length, 2);
});

test("lo que no está en el padrón vuelve sin coincidencias y lo corto se rechaza", () => {
  assert.equal(buscarEnPadron(padron, "99-99-999-99", normalizar).coincidencias.length, 0);
  assert.throws(() => buscarEnPadron(padron, "abc", normalizar), /números/);
  assert.equal(buscarEnPadron(padron, "84", normalizar).coincidencias.length, 0);
  assert.throws(() => buscarEnPadron(padron, "", normalizar), /clave catastral/);
});

test("el resumen del abonado lleva el barrio de la clave y nunca la deuda", () => {
  const resumen = resumirAbonado({ ...padron[0], valor: 500, total: 700 });
  assert.equal(resumen.barrio_codigo, "05");
  assert.equal(resumen.abonado_nombre, "MARIA LOPEZ");
  assert.equal("total" in resumen, false);
});

test("responde quien entregó el barrio en el ciclo, primero los lotes cerrados y el más reciente", () => {
  const lotes = [
    { id: 40, fecha: "2026-10-03", estado: "CERRADO", responsable_id: 7, tipo_documento: "FACTURA" },
    { id: 52, fecha: "2026-10-09", estado: "ABIERTO", responsable_id: 9, tipo_documento: "FACTURA" },
    { id: 47, fecha: "2026-10-06", estado: "CERRADO", responsable_id: 8, tipo_documento: "FACTURA" }
  ];
  assert.deepEqual(elegirResponsable({ lotes, repartoResponsableId: 3 }), { origen: "LOTE", responsable_id: 8, lote_id: 47 });
});

test("con el tipo de documento prefiere los lotes de ese tipo", () => {
  const lotes = [
    { id: 1, fecha: "2026-10-09", estado: "CERRADO", responsable_id: 7, tipo_documento: "NOTA_COBRO" },
    { id: 2, fecha: "2026-10-02", estado: "CERRADO", responsable_id: 8, tipo_documento: "FACTURA" }
  ];
  assert.equal(elegirResponsable({ lotes, tipoDocumento: "FACTURA" }).responsable_id, 8);
  assert.equal(elegirResponsable({ lotes, tipoDocumento: "NOTA_COBRO" }).responsable_id, 7);
});

test("sin lote en el ciclo responde quien tiene el barrio en el reparto", () => {
  assert.deepEqual(elegirResponsable({ lotes: [], repartoResponsableId: "5" }), { origen: "REPARTO", responsable_id: 5, lote_id: null });
  assert.deepEqual(elegirResponsable({}), { origen: "NINGUNO", responsable_id: null, lote_id: null });
});

test("el reclamo pide clave o abonado, motivo y una cantidad razonable", () => {
  assert.throws(() => normalizarReclamo({ motivo: "NO_LLEGO" }), /clave catastral o el número de abonado/);
  assert.throws(() => normalizarReclamo({ numero_abonado: "10234" }), /motivo/);
  assert.throws(() => normalizarReclamo({ numero_abonado: "10234", motivo: "OTRO", detalle: "x" }), /Otro/);
  assert.throws(() => normalizarReclamo({ numero_abonado: "10234", motivo: "NO_LLEGO", cantidad: 0 }), /cantidad/);
  const reclamo = normalizarReclamo({ numero_abonado: " 10234 ", motivo: "no_llego", cantidad: "2" });
  assert.deepEqual(
    { abonado: reclamo.numero_abonado, motivo: reclamo.motivo, cantidad: reclamo.cantidad, tipo: reclamo.tipo_documento, responsable: reclamo.responsable_id },
    { abonado: "10234", motivo: "NO_LLEGO", cantidad: 2, tipo: "FACTURA", responsable: null }
  );
});

test("la respuesta del técnico no puede quedar vacía", () => {
  assert.throws(() => normalizarRespuesta({ respuesta: "  ok " }), /mínimo 5/);
  assert.equal(normalizarRespuesta({ respuesta: "  La dejé con la vecina.  " }), "La dejé con la vecina.");
});

test("el aviso va al responsable y a todo el equipo, una vez y sin el autor", async () => {
  const { armarAvisosReclamo } = await import("./entregasReclamosRules.js");
  const reclamo = { numero_abonado: "17752", clave_catastral: "42-12-10-01", barrio_nombre: "Barrio El Estruendo", motivo_etiqueta: "Otro", tipo_documento: "FACTURA", cantidad: 1, responsable: { nombre: "Elmer Gómez" } };
  const avisos = armarAvisosReclamo({ reclamo, responsableUserId: 9, tecnicos: [{ id: 9 }, { id: 4 }, { id: 1 }], autorId: 1 });
  assert.deepEqual(avisos.map((aviso) => aviso.recipient_user_id), [9, 4]);
  assert.match(avisos[0].body, /^Reclamo de entrega para ti: abonado 17752 \(42-12-10-01\), Barrio El Estruendo · Otro · 1 factura\./);
  assert.match(avisos[1].body, /^Nuevo reclamo de entrega para Elmer Gómez: /);
  const sinUsuario = armarAvisosReclamo({ reclamo, tecnicos: [{ id: 4 }] });
  assert.match(sinUsuario[0].body, /Elmer Gómez \(no tiene usuario en la app\)/);
});
