import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { env } from "../config/env.js";
import {
  clearLoginFailures,
  limitLoginAttempts,
  recordLoginFailure,
  resetLoginRateLimits
} from "./loginRateLimit.js";

const originalMaxAttempts = env.authLoginMaxAttempts;
const originalWindowMinutes = env.authLoginWindowMinutes;

const createResponse = () => ({
  headers: {},
  statusCode: 200,
  body: null,
  set(name, value) {
    this.headers[name] = value;
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

afterEach(() => {
  env.authLoginMaxAttempts = originalMaxAttempts;
  env.authLoginWindowMinutes = originalWindowMinutes;
  resetLoginRateLimits();
});

test("login limiter blocks an IP after repeated failures", () => {
  env.authLoginMaxAttempts = 2;
  env.authLoginWindowMinutes = 1;
  const request = { ip: "127.0.0.9" };

  recordLoginFailure(request);
  recordLoginFailure(request);

  const response = createResponse();
  let nextCalled = false;
  limitLoginAttempts({ ip: "127.0.0.9" }, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 429);
  assert.match(response.body.message, /Demasiados intentos/);
  assert.ok(Number(response.headers["Retry-After"]) > 0);
});

test("clearing failures allows the next login", () => {
  const request = { ip: "127.0.0.8" };
  recordLoginFailure(request);
  clearLoginFailures(request);

  let nextCalled = false;
  limitLoginAttempts({ ip: "127.0.0.8" }, createResponse(), () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
});
