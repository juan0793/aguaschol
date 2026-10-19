import assert from "node:assert/strict";
import test from "node:test";
import { crearServicioContextos } from "./mapPointContextService.js";

const respuesta = (latitude) => ({ zone: `Zona ${latitude}`, reference: "Calle", display_name: "" });

test("consulta una sola vez por celda y responde con la clave de cada punto", async () => {
  const consultas = [];
  const guardadas = new Map();
  const servicio = crearServicioContextos({
    geocodificar: async (latitude, longitude) => { consultas.push([latitude, longitude]); return respuesta(latitude); },
    leer: async () => [],
    guardar: async (celda, contexto) => { guardadas.set(celda, contexto); },
    intervaloMs: 0
  });
  // Dos puntos a menos de 11 m comparten celda; el tercero no.
  const puntos = [
    { latitude: 13.300012, longitude: -87.190011 },
    { latitude: 13.300018, longitude: -87.190014 },
    { latitude: 13.301000, longitude: -87.190000 }
  ];
  const contextos = await servicio.obtener(puntos);
  assert.equal(consultas.length, 2);
  assert.equal(guardadas.size, 2);
  assert.deepEqual(contextos.map((contexto) => contexto.key), ["13.300012,-87.190011", "13.300018,-87.190014", "13.301000,-87.190000"]);
  await servicio.obtener(puntos);
  assert.equal(consultas.length, 2, "lo ya consultado sale de la caché");
});

test("usa lo guardado en la base sin consultar Nominatim", async () => {
  let consultas = 0;
  const servicio = crearServicioContextos({
    geocodificar: async () => { consultas += 1; return respuesta(0); },
    leer: async (celdas) => celdas.map((cell_key) => ({ cell_key, zone: "Guardada", reference: "Ref", display_name: "" })),
    guardar: async () => {},
    intervaloMs: 0
  });
  const [contexto] = await servicio.obtener([{ latitude: 13.3, longitude: -87.19 }]);
  assert.equal(consultas, 0);
  assert.equal(contexto.zone, "Guardada");
});

test("no espera más del límite: omite lo pendiente y lo sigue buscando", async () => {
  let consultas = 0;
  const servicio = crearServicioContextos({
    geocodificar: async (latitude) => { consultas += 1; return respuesta(latitude); },
    leer: async () => [],
    guardar: async () => {},
    intervaloMs: 40,
    esperaMs: 60
  });
  const puntos = Array.from({ length: 6 }, (_, indice) => ({ latitude: 13.3 + indice * 0.001, longitude: -87.19 }));
  const inicio = Date.now();
  const primera = await servicio.obtener(puntos);
  assert.ok(Date.now() - inicio < 200);
  assert.ok(primera.length < puntos.length);
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.equal(servicio.pendientes(), 0);
  const segunda = await servicio.obtener(puntos, { espera: 0 });
  assert.equal(segunda.length, puntos.length);
  assert.equal(consultas, puntos.length);
});

test("una consulta fallida no detiene la cola", async () => {
  const servicio = crearServicioContextos({
    geocodificar: async (latitude) => { if (latitude < 13.3005) throw new Error("caída"); return respuesta(latitude); },
    leer: async () => [],
    guardar: async () => {},
    intervaloMs: 0
  });
  const contextos = await servicio.obtener([{ latitude: 13.3, longitude: -87.19 }, { latitude: 13.301, longitude: -87.19 }]);
  assert.deepEqual(contextos.map((contexto) => contexto.latitude), [13.301]);
});
