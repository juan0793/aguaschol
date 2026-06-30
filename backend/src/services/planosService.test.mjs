import test from "node:test";
import assert from "node:assert/strict";

process.env.USE_MEMORY_DB = "true";

const { listPlanoElements, savePlanoDraft, sendPlanoToReview } = await import("./planosService.js");

const admin = { id: 1, role: "admin", username: "admin" };

test("savePlanoDraft accepts tapado and preserves draft after invalid save", async () => {
  const barrioId = 9001;
  const original = [
    {
      tipo_elemento: "linea",
      data_json: { puntos: [{ x: 1, y: 2 }, { x: 3, y: 4 }], grosor: 3 }
    },
    {
      tipo_elemento: "tapado",
      data_json: { x: 10, y: 20, width: 80, height: 40 }
    }
  ];

  const saved = await savePlanoDraft(barrioId, original, admin);
  assert.equal(saved.ok, true);
  assert.equal(saved.elementCount, 2);
  assert.equal(saved.elements[1].tipo_elemento, "tapado");

  await assert.rejects(
    () => savePlanoDraft(barrioId, [{ tipo_elemento: "tapado", data_json: { x: 1, y: 2, width: 0, height: 10 } }], admin),
    /Tapado invalido/
  );

  const afterFailure = await listPlanoElements(barrioId, admin);
  assert.equal(afterFailure.elements.length, 2);
  assert.equal(afterFailure.elements[1].tipo_elemento, "tapado");

  const exactVersion = await listPlanoElements(barrioId, admin, saved.version.id);
  assert.equal(exactVersion.version.id, saved.version.id);
  assert.equal(exactVersion.elements.length, 2);

  await sendPlanoToReview(barrioId, admin);
  await assert.rejects(() => sendPlanoToReview(barrioId, admin), /ya no se puede enviar/);
  await assert.rejects(() => savePlanoDraft(barrioId, original, admin), /ya fue enviada/);
});
