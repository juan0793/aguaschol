import assert from "node:assert/strict";
import test from "node:test";
import { requireManagerAccess } from "./managerAccess.js";

const invoke = (baseUrl, method, path, role = "gerente") => {
  const result = { continued: false, status: null, headers: {} };
  const res = {
    setHeader(key, value) { result.headers[key] = value; },
    status(code) { result.status = code; return this; },
    json() { return this; }
  };
  requireManagerAccess({ authUser: { role }, baseUrl, method, path }, res, () => { result.continued = true; });
  return result;
};

test("Gerencia consulta módulos autorizados con respuestas no almacenables", () => {
  for (const [base, path] of [
    ["/api/inmuebles", "/"], ["/api/inmuebles", "/clave/01-02-03"],
    ["/api/clandestinos", "/fichas"], ["/api/clandestinos", "/fichas/ritmo"],
    ["/api/inspecciones", "/stats/tablero"], ["/api/inspecciones", "/7/gps"],
    ["/api/entregas", "/lotes/4"], ["/api/entregas", "/avance-mes"], ["/api/entregas", "/reportes/semanales/preview"],
    ["/api/claves", "/services/report"], ["/api/field-validation", "/findings"],
    ["/api/gis", "/lotes/12"], ["/api/gis", "/health"], ["/api/gis", "/barrios/report"], ["/api/gis", "/catastro/report"], ["/api/map-points", "/"],
    ["/api/planos", "/versiones"], ["/api/transport", "/"],
    ["/api/admin/team-activity", "/"], ["/api/barrios", "/lookup"], ["/api/railway", "/summary"], ["/api/fallas", "/"], ["/api/pozos", "/"]
  ]) {
    for (const method of ["GET", "HEAD"]) {
      const result = invoke(base, method, path);
      assert.equal(result.continued, true, `${method} ${base}${path}`);
      assert.equal(result.headers["Cache-Control"], "private, no-store");
    }
  }
});

test("Gerencia no modifica datos ni accede a administración o exportaciones masivas", () => {
  for (const base of ["/api/inspecciones", "/api/entregas", "/api/clandestinos", "/api/inmuebles", "/api/claves", "/api/planos", "/api/map-points", "/api/transport", "/api/field-validation", "/api/pozos"]) {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      assert.equal(invoke(base, method, "/").status, 403, `${method} ${base}`);
    }
    assert.equal(invoke(base, "GET", "/ruta-nueva").status, 403);
  }
  for (const [base, method, path] of [
    ["/api/users", "GET", "/"], ["/api/admin/railway", "GET", "/"],
    ["/api/admin/notes", "GET", "/"], ["/api/profile", "POST", "/messages"],
    ["/api/claves", "GET", "/download"], ["/api/claves", "POST", "/sync"],
    ["/api/planos", "GET", "/revision/pendientes"], ["/api/planos", "POST", "/barrios"],
    ["/api/entregas", "POST", "/reportes/semanales"],
    ["/api/inspecciones", "POST", "/4/print-events"],
    ["/api/clandestinos", "POST", "/fichas/avisos-impresos"]
  ]) assert.equal(invoke(base, method, path).status, 403, `${method} ${base}${path}`);
});

test("las consultas POST son excepciones explícitas y las acciones de cuenta siguen disponibles", () => {
  for (const [base, path] of [
    ["/api/claves", "/requests/run"], ["/api/field-validation", "/analytics"],
    ["/api/map-points", "/context"], ["/api/clandestinos", "/fichas/por-ids"],
    ["/api/clandestinos", "/fichas/compare-padrones"],
    ["/api/auth", "/logout"], ["/api/auth", "/change-password"]
  ]) assert.equal(invoke(base, "POST", path).continued, true);
  assert.equal(invoke("/api/auth", "GET", "/me").continued, true);
  assert.equal(invoke("/api/auth", "POST", "/logout-all").status, 403);
});

test("la política gerencial no cambia el flujo de los cuatro roles actuales", () => {
  for (const role of ["admin", "operator", "transport", "validadora_campo"]) {
    const result = invoke("/api/inmuebles", "POST", "/", role);
    assert.equal(result.continued, true);
    assert.deepEqual(result.headers, {});
  }
});

test("Gerencia accede a informes y eventos delimitados, sin habilitar rutas de escritura nuevas", () => {
  assert.equal(invoke("/api/reports", "POST", "/manager").continued, true);
  assert.equal(invoke("/api/reports", "POST", "/manager/RPT-20261012-120000-ABCDEF12/events").continued, true);
  assert.equal(invoke("/api/reports", "GET", "/manager/RPT-20261012-120000-ABCDEF12").continued, true);
  assert.equal(invoke("/api/reports", "POST", "/manager/nuevo/events").status, 403);
  assert.equal(invoke("/api/reports", "DELETE", "/manager/RPT-20261012-120000-ABCDEF12").status, 403);
});

test("Gerencia marca como vista su campana, pero no escribe otra cosa en la actividad del equipo", () => {
  assert.equal(invoke("/api/admin/team-activity", "POST", "/seen").continued, true);
  for (const [method, path] of [["POST", "/"], ["DELETE", "/seen"], ["PUT", "/seen"], ["POST", "/otra"]]) {
    const result = invoke("/api/admin/team-activity", method, path);
    assert.equal(result.continued, false, `${method} ${path}`);
    assert.equal(result.status, 403);
  }
});

test("Gerencia avisa al técnico de un documento no entregado y nada más de entregas", () => {
  assert.equal(invoke("/api/entregas", "POST", "/no-entregadas/31/avisos").continued, true);
  for (const [method, path] of [["PATCH", "/no-entregadas/31"], ["POST", "/no-entregadas/31/intentos"], ["POST", "/no-entregadas/x/avisos"], ["DELETE", "/no-entregadas/31/avisos"]]) {
    assert.equal(invoke("/api/entregas", method, path).status, 403, `${method} ${path}`);
  }
});
