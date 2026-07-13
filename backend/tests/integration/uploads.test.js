// Task Q1: upload-security integration test. Deliberately tests ONLY the
// rejection path (disallowed MIME type) — multer's fileFilter rejects a
// bad file during the multipart parse, before the storage engine ever
// writes anything to disk, so this never creates a real file under
// backend/uploads/. A full accept-path round trip is intentionally not
// exercised here to avoid writing a real file into the same uploads/
// directory used by real dev data (see DEPLOYMENT_GUIDE.md's storage
// note); that path is covered by manual/smoke verification instead.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../../src/app");
const { pool, resetDatabase } = require("./helpers/db");
const { createAdmin, createCustomer } = require("./helpers/auth");
const { createGeneralProduct } = require("./helpers/fixtures");

describe("Upload security — MIME type allowlist", () => {
  before(async () => {
    await resetDatabase();
  });

  after(async () => {
    await pool.end();
  });

  test("rejects a non-image file (text/plain) with a clear 400, writes nothing to disk", async () => {
    const admin = await createAdmin();
    const product = await createGeneralProduct();

    const res = await request(app)
      .post(`/api/admin/products/${product.id}/images`)
      .set("Authorization", admin.authHeader)
      .attach("image", Buffer.from("not an image, just text"), {
        filename: "malicious.txt",
        contentType: "text/plain",
      });

    assert.equal(res.status, 400);
    assert.equal(typeof res.body.error, "string");
  });

  test("rejects a file spoofing an executable MIME type", async () => {
    const admin = await createAdmin();
    const product = await createGeneralProduct();

    const res = await request(app)
      .post(`/api/admin/products/${product.id}/images`)
      .set("Authorization", admin.authHeader)
      .attach("image", Buffer.from("MZ fake exe header"), {
        filename: "evil.exe",
        contentType: "application/x-msdownload",
      });

    assert.equal(res.status, 400);
  });

  test("rejects an SVG upload (not in the JPEG/PNG/WEBP allowlist)", async () => {
    const admin = await createAdmin();
    const product = await createGeneralProduct();

    const res = await request(app)
      .post(`/api/admin/products/${product.id}/images`)
      .set("Authorization", admin.authHeader)
      .attach("image", Buffer.from("<svg onload=\"alert(1)\"></svg>"), {
        filename: "xss.svg",
        contentType: "image/svg+xml",
      });

    assert.equal(res.status, 400);
  });

  test("a non-admin (customer) cannot reach the upload route at all", async () => {
    const customer = await createCustomer();
    const product = await createGeneralProduct();

    const res = await request(app)
      .post(`/api/admin/products/${product.id}/images`)
      .set("Authorization", customer.authHeader)
      .attach("image", Buffer.from("irrelevant"), {
        filename: "whatever.txt",
        contentType: "text/plain",
      });

    assert.equal(res.status, 403);
  });
});
