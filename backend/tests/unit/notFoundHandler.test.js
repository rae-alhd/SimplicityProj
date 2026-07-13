// Task Q1: pure unit test for the unknown-API-route JSON 404 handler.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { notFoundHandler } = require("../../src/middleware/notFoundHandler");

describe("notFoundHandler", () => {
  test("responds 404 with a small, safe JSON body", () => {
    const res = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };

    notFoundHandler({}, res);

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { error: "Not found" });
  });
});
