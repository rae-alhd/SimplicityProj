// Task Q1: pure unit tests for the centralized error handler, using fake
// req/res/next objects — no HTTP server or database needed. Covers item 4
// of Task Q1's testing list: unexpected errors never expose a stack trace
// or the raw internal error message in the response.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { errorHandler } = require("../../src/middleware/errorHandler");

function fakeRes() {
  const res = {
    statusCode: null,
    body: null,
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  return res;
}

describe("errorHandler — unexpected errors never leak internals", () => {
  test("a plain thrown Error becomes a generic 500 with no stack trace or raw message", () => {
    const err = new Error("column \"nonexistent_column\" does not exist in relation orders");
    const res = fakeRes();

    errorHandler(err, {}, res, () => {});

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, "Internal server error");
    assert.equal("stack" in res.body, false);
    assert.equal(res.body.error.includes("nonexistent_column"), false);
  });

  test("an error with a numeric status but no `expose` flag still returns the generic message, not err.message", () => {
    const err = new Error("some internal detail");
    err.status = 500;
    const res = fakeRes();

    errorHandler(err, {}, res, () => {});

    assert.equal(res.body.error, "Internal server error");
  });

  test("a database connection error (no special shape) is treated as a safe generic 500", () => {
    const err = new Error("ECONNREFUSED 127.0.0.1:5432");
    const res = fakeRes();

    errorHandler(err, {}, res, () => {});

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, "Internal server error");
  });
});

describe("errorHandler — known, safe error shapes keep their own clear messages", () => {
  test("a CORS rejection returns 403 with a customer-safe message", () => {
    const err = new Error('Origin "https://evil.example" is not allowed by CORS.');
    err.corsRejection = true;
    const res = fakeRes();

    errorHandler(err, {}, res, () => {});

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, "This origin is not allowed to access the API.");
  });

  test("an oversized-body error (entity.too.large) returns 413", () => {
    const err = new Error("request entity too large");
    err.type = "entity.too.large";
    const res = fakeRes();

    errorHandler(err, {}, res, () => {});

    assert.equal(res.statusCode, 413);
    assert.equal(res.body.error, "Request body is too large.");
  });

  test("a malformed-JSON error (entity.parse.failed) returns 400", () => {
    const err = new SyntaxError("Unexpected token in JSON");
    err.type = "entity.parse.failed";
    const res = fakeRes();

    errorHandler(err, {}, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, "Malformed JSON in request body.");
  });

  test("an explicitly expose:true 4xx error keeps its own message", () => {
    const err = new Error("A specific, safe, customer-facing validation message.");
    err.status = 422;
    err.expose = true;
    const res = fakeRes();

    errorHandler(err, {}, res, () => {});

    assert.equal(res.statusCode, 422);
    assert.equal(res.body.error, "A specific, safe, customer-facing validation message.");
  });

  test("does nothing (delegates to next) if headers were already sent", () => {
    const err = new Error("too late");
    const res = fakeRes();
    res.headersSent = true;
    let nextCalledWith = null;

    errorHandler(err, {}, res, (e) => {
      nextCalledWith = e;
    });

    assert.equal(res.body, null);
    assert.equal(nextCalledWith, err);
  });
});
