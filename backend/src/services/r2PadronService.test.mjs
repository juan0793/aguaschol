import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_PADRON_KEY,
  compressPadronRecords,
  createR2PadronService,
  decompressPadronRecords
} from "./r2PadronService.js";

const config = {
  r2AccessKeyId: "test",
  r2SecretAccessKey: "test",
  r2Endpoint: "https://example.invalid",
  r2Bucket: "private-test",
  r2Region: "auto"
};

const fakeClient = () => {
  const objects = new Map();
  return {
    objects,
    send: async (command) => {
      const name = command.constructor.name;
      if (name === "PutObjectCommand") {
        objects.set(command.input.Key, { body: Buffer.from(command.input.Body), metadata: command.input.Metadata });
        return { ETag: '"etag-test"' };
      }
      if (name === "GetObjectCommand") {
        const object = objects.get(command.input.Key);
        if (!object) throw new Error("NoSuchKey");
        return { Body: object.body, Metadata: object.metadata, ETag: '"etag-test"' };
      }
      if (name === "HeadBucketCommand") return {};
      if (name === "HeadObjectCommand") {
        const object = objects.get(command.input.Key);
        if (!object) throw new Error("NoSuchKey");
        return { Metadata: object.metadata, ETag: '"etag-test"', ContentLength: object.body.length };
      }
      if (name === "ListObjectsV2Command") return { Contents: [...objects].filter(([key]) => key.startsWith(command.input.Prefix || "")).map(([Key, object]) => ({ Key, Size: object.body.length })) };
      if (name === "DeleteObjectCommand") { objects.delete(command.input.Key); return {}; }
      throw new Error(`Comando inesperado: ${name}`);
    }
  };
};

test("comprime y descomprime el padron sin perder registros", async () => {
  const records = [{ clave_catastral: "01-02-03-04", abonado: "10" }];
  assert.deepEqual(await decompressPadronRecords(await compressPadronRecords(records), 1), records);
});

test("sube y carga el padron activo validado desde R2", async () => {
  const client = fakeClient();
  const service = createR2PadronService({ config, client });
  const records = [{ clave_catastral: "01-02-03-04", abonado: "10" }];
  await service.uploadActive(records, "LOTE-TEST");
  const loaded = await service.loadActive();
  assert.equal(loaded.key, ACTIVE_PADRON_KEY);
  assert.equal(loaded.codigo_lote, "LOTE-TEST");
  assert.deepEqual(loaded.records, records);
});

test("sube un historico sin reemplazar el padron activo", async () => {
  const client = fakeClient();
  const service = createR2PadronService({ config, client });
  const active = [{ clave_catastral: "01-02-03-04", abonado: "10" }];
  const historical = [{ clave_catastral: "01-02-03-05", abonado: "11" }];
  await service.uploadActive(active, "LOTE-ACTIVO");
  await service.uploadHistorical(historical, "LOTE-ANTIGUO", new Date("2026-07-15T07:45:00Z"));

  assert.deepEqual((await service.loadActive()).records, active);
});

test("rechaza un snapshot R2 cuyo conteo esta incompleto", async () => {
  const client = fakeClient();
  const service = createR2PadronService({ config, client });
  const body = await compressPadronRecords([{ clave_catastral: "01-02-03-04" }]);
  client.objects.set(ACTIVE_PADRON_KEY, { body, metadata: { "total-registros": "2" } });
  await assert.rejects(service.loadActive(), /incompleto/i);
});

test("elimina historicos duplicados del mismo lote conservando la fecha correcta", async () => {
  const client = fakeClient();
  const service = createR2PadronService({ config, client });
  const records = [{ clave_catastral: "01-02-03-04", abonado: "10" }];
  const first = await service.uploadVersions(records, "LOTE-TEST", new Date("2026-07-10T08:00:00Z"));
  const correct = await service.uploadVersions(records, "LOTE-TEST", new Date("2026-07-09T08:00:00Z"));

  assert.equal(await service.removeHistoricalDuplicates("LOTE-TEST", correct.historical.key), 1);
  assert.equal(client.objects.has(first.historical.key), false);
  assert.equal(client.objects.has(correct.historical.key), true);
});
