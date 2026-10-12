import test from "node:test";
import assert from "node:assert/strict";
import { firstName, greetingFor, hourInHonduras } from "./greeting.js";

// Honduras es UTC-6 todo el año: 14:00 UTC son las 8:00 en Tegucigalpa.
const at = (utcHour, utcMinute = 0) => new Date(Date.UTC(2026, 9, 12, utcHour, utcMinute));

test("la hora se lee en Tegucigalpa, no en la zona del navegador", () => {
  assert.equal(hourInHonduras(at(14)), 8);
  assert.equal(hourInHonduras(at(5)), 23);
});

test("saluda según la hora, con el primer nombre", () => {
  const user = { fullName: "Ana María López", username: "alopez" };
  assert.equal(greetingFor({ ...user, now: at(11) }), "Buenos días, Ana");            // 5:00
  assert.equal(greetingFor({ ...user, now: at(17, 59) }), "Buenos días, Ana");        // 11:59
  assert.equal(greetingFor({ ...user, now: at(18) }), "Buenas tardes, Ana");          // 12:00
  assert.equal(greetingFor({ ...user, now: at(0, 59) }), "Buenas tardes, Ana");       // 18:59
  assert.equal(greetingFor({ ...user, now: at(1) }), "Buenas noches, Ana");           // 19:00
  assert.equal(greetingFor({ ...user, now: at(10, 59) }), "Buenas noches, Ana");      // 4:59
});

test("el primer ingreso da la bienvenida y sin nombre usa el usuario", () => {
  assert.equal(greetingFor({ fullName: "Ana López", firstVisit: true, now: at(14) }), "Te damos la bienvenida, Ana");
  assert.equal(firstName("", "gerencia.qa"), "gerencia.qa");
  assert.equal(greetingFor({ fullName: "  ", username: "", now: at(14) }), "Buenos días");
});
