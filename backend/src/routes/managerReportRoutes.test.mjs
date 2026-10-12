import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import express from "express";
import app from "../app.js";
import managerReportRoutes from "./managerReportRoutes.js";
import { requireManagerAccess } from "../middleware/managerAccess.js";

const start = async (application, t) => {
  const server = application.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, "listening");
  return `http://127.0.0.1:${server.address().port}`;
};

test("las rutas reales de informes exigen autenticación antes de consultar o exportar", async (t) => {
  const base = await start(app, t);
  for (const [method, path] of [["POST", "/api/reports/manager"], ["GET", "/api/reports/manager/RPT-20261012-120000-ABCDEF12"]]) {
    assert.equal((await fetch(base + path, { method })).status, 401);
  }
});

test("inicio y retorno del simulador exigen bearer autenticado", async (t) => {
  const base = await start(app, t);
  for (const method of ["POST", "DELETE"]) {
    const response = await fetch(`${base}/api/auth/preview`, { method, headers: { "Content-Type": "application/json" }, ...(method === "POST" ? { body: '{"role":"gerente"}' } : {}) });
    assert.equal(response.status, 401);
  }
});

test("los routers rechazan otros roles y datos arbitrarios antes de acceder a MySQL", async (t) => {
  const application = express();
  application.use(express.json());
  application.use("/api/reports", (req, _res, next) => { req.authUser = { id: 9, role: req.headers["x-test-role"] || "gerente" }; req.authToken = "token-de-prueba"; next(); }, requireManagerAccess, managerReportRoutes);
  application.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));
  const base = await start(application, t);
  for (const role of ["operator", "transport", "validadora_campo"]) {
    assert.equal((await fetch(`${base}/api/reports/manager`, { method: "POST", headers: { "x-test-role": role, "Content-Type": "application/json" }, body: "{}" })).status, 403);
  }
  for (const body of [{ type: "users" }, { rows: [["alterado", 999]] }, { body_markup: "<script>alert(1)</script>" }]) {
    assert.equal((await fetch(`${base}/api/reports/manager`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).status, 400);
  }
});
