// Task Q1: pure unit tests for the upload-filename sanitization helper.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { sanitizeIdForFilename } = require("../../src/utils/safeFilename");

describe("safeFilename.sanitizeIdForFilename", () => {
  test("leaves a normal numeric id unchanged", () => {
    assert.equal(sanitizeIdForFilename(42), "42");
  });

  test("strips path-traversal characters entirely", () => {
    assert.equal(sanitizeIdForFilename("../../../etc/passwd"), "etcpasswd");
  });

  test("strips URL-decoded slash injection attempts", () => {
    assert.equal(sanitizeIdForFilename("1/../../evil"), "1evil");
  });

  test("strips shell metacharacters and whitespace", () => {
    assert.equal(sanitizeIdForFilename("1; rm -rf /"), "1rm-rf");
  });

  test("keeps underscores and hyphens, which are safe", () => {
    assert.equal(sanitizeIdForFilename("abc-123_xyz"), "abc-123_xyz");
  });

  test("returns an empty string for an entirely unsafe input, never throws", () => {
    assert.equal(sanitizeIdForFilename("../../"), "");
  });
});
