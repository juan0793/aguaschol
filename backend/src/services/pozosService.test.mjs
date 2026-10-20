import assert from "node:assert/strict";
import test from "node:test";
import { crearServicioPozos, resumirPozos } from "./pozosService.js";

const pozo = (codigo, extra = {}) => ({
  codigo, colonia: "Bo. Guadalupe", coordenada_valida: true, codigo_repetido: false, en_uso: true, ph: null, tds_g_l: null, ...extra
});

test("resume cuántos pozos hay, cuáles no van al mapa y cuántos códigos se repiten", () => {
  const resumen = resumirPozos([
    pozo("Pchol.-001", { codigo_repetido: true, ph: 6.3 }),
    pozo("Pchol.-001", { codigo_repetido: true, colonia: "La Libertad" }),
    pozo("Pchol.-032", { coordenada_valida: false, en_uso: null, tds_g_l: 0.5 })
  ]);
  assert.deepEqual(resumen, {
    total: 3, en_mapa: 2, coordenada_invalida: ["Pchol.-032"], codigos_repetidos: 1, en_uso: 2, con_calidad: 2, colonias: 2
  });
});

test("lee el archivo solo cuando cambia", async () => {
  let lecturas = 0;
  let fecha = Date.UTC(2026, 9, 20, 12);
  const servicio = crearServicioPozos({
    ruta: "pozos.json",
    modificado: async () => fecha,
    leer: async () => { lecturas += 1; return JSON.stringify({ fuente: "prueba", pozos: Array.from({ length: lecturas }, (_, i) => pozo(`Pchol.-00${i + 1}`)) }); }
  });
  const primero = await servicio.listar();
  await servicio.listar();
  assert.equal(lecturas, 1);
  assert.equal(primero.fuente, "prueba");
  assert.equal(primero.actualizado, "2026-10-20T12:00:00.000Z");
  assert.equal(primero.pozos[0].codigo, "Pchol.-001");
  fecha += 60000;
  const segundo = await servicio.listar();
  assert.equal(lecturas, 2, "el archivo regenerado se vuelve a leer");
  assert.equal(segundo.resumen.total, 2);
});

test("el inventario real se puede leer y todos los pozos traen código", async () => {
  const { pozos, resumen } = await crearServicioPozos().listar();
  assert.ok(resumen.total > 0);
  assert.ok(pozos.every((p) => p.codigo));
  assert.ok(pozos.filter((p) => p.coordenada_valida).every((p) => Math.abs(p.latitud - 13.3) < 0.2 && Math.abs(p.longitud + 87.19) < 0.2));
});
