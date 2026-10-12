import test from "node:test";
import assert from "node:assert/strict";
import { sessionMode, hasStoredRolePreview } from "./rolePreview.js";
import { loadStoredLookupHistory, loadStoredRecordNotifications } from "./localStorage.js";
import fs from "node:fs";
import vm from "node:vm";

test("la firma distingue perfil, modo temporal y vencimiento", () => {
  const admin = { user: { role: "admin" } };
  const preview = { user: { role: "gerente", preview: { expires_at: "2026-10-12T18:00:00Z", expired: false } } };
  assert.notEqual(sessionMode(admin), sessionMode(preview));
  assert.notEqual(sessionMode(preview), sessionMode({ user: { ...preview.user, preview: { ...preview.user.preview, expired: true } } }));
  assert.equal(sessionMode(admin), sessionMode({ user: { role: "admin", full_name: "Otro nombre" } }));
});
test("la prueba no revela ni borra historial y avisos privados guardados", () => {
  let auth = JSON.stringify({ user: { role: "operator", preview: { read_only: true } } });
  globalThis.window = { localStorage: { getItem: (key) => key === "aguaschol-auth" ? auth : key === "aguaschol-lookup-history" ? '[{"clave":"QA"}]' : '{"QA":true}' } };
  assert.equal(hasStoredRolePreview(), true); assert.deepEqual(loadStoredLookupHistory(), []); assert.deepEqual(loadStoredRecordNotifications(), {});
  auth = JSON.stringify({ user: { role: "admin" } });
  assert.deepEqual(loadStoredLookupHistory(), [{ clave: "QA" }]); assert.deepEqual(loadStoredRecordNotifications(), { QA: true });
  delete globalThis.window;
});
test("PWA nunca intercepta APIs, medios privados o bearer; no guarda navegación privada", async () => {
  const handlers = {}; let stored = 0;
  const context = vm.createContext({ URL, self: { location: { origin: "http://qa.local" }, addEventListener: (type, callback) => { handlers[type] = callback; } },
    caches: { open: async () => ({ put: async () => { stored++; } }) },
    fetch: async () => new Response("privado", { headers: { "Cache-Control": "private, no-store" } }) });
  vm.runInContext(fs.readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8"), context);
  for (const path of ["/api/auth/me", "/uploads/qa.jpg", "/planos-pdf/qa.pdf"]) {
    let intercepted = false;
    handlers.fetch({ request: new Request(`http://qa.local${path}`), respondWith() { intercepted = true; } });
    assert.equal(intercepted, false);
  }
  let authenticated = false;
  handlers.fetch({ request: new Request("http://qa.local/assets/private.png", { headers: { Authorization: "Bearer QA" } }), respondWith() { authenticated = true; } });
  assert.equal(authenticated, false);
  let navigation;
  handlers.fetch({ request: { method: "GET", url: "http://qa.local/", mode: "navigate", headers: new Headers() }, respondWith(value) { navigation = value; } });
  await navigation; assert.equal(stored, 0);
});
