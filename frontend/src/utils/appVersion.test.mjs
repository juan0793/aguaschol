import test from "node:test";
import assert from "node:assert/strict";
import { canSeeUpdateNotice, entryScriptOf, hasNewVersion } from "./appVersion.js";

const html = (hash) => `<!doctype html><html><head><script type="module" crossorigin src="/assets/index-${hash}.js"></script><link rel="stylesheet" href="/assets/index-${hash}.css"></head></html>`;

test("lee el script de entrada que publica index.html", () => {
  assert.equal(entryScriptOf(html("H9gpGa5j")), "/assets/index-H9gpGa5j.js");
  assert.equal(entryScriptOf('<script src="https://cdn.example/assets/index-x.js"></script>'), "/assets/index-x.js");
  assert.equal(entryScriptOf('<script type="module" src="/src/main.jsx"></script>'), null);
  assert.equal(entryScriptOf(""), null);
});

test("solo avisa cuando las dos versiones se conocen y son distintas", () => {
  assert.equal(hasNewVersion("/assets/index-a.js", "/assets/index-b.js"), true);
  assert.equal(hasNewVersion("/assets/index-a.js", "/assets/index-a.js"), false);
  assert.equal(hasNewVersion("/assets/index-a.js", null), false);
  assert.equal(hasNewVersion(null, "/assets/index-b.js"), false);
});

test("el aviso llega a todas las cuentas con sesión", () => {
  for (const role of ["admin", "gerente", "operator", "validadora_campo", "transport"]) assert.equal(canSeeUpdateNotice({ id: 1, role }), true, role);
  assert.equal(canSeeUpdateNotice(null), false);
  assert.equal(canSeeUpdateNotice({}), false);
});
