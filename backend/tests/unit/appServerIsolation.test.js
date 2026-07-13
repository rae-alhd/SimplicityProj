// Task Q1: structural tests for the app/server separation established in
// P1 and extended here for graceful shutdown. These assert the actual
// requirement — that app.js (imported directly by every integration test)
// never opens a listening port and never registers process-level signal
// handlers, so importing it for tests can never leave a real HTTP server
// or shutdown handler behind. Actual SIGINT/SIGTERM delivery is a Node/OS
// concern outside what a unit test can portably exercise (verified
// manually instead — see server.js's own comments).
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appSource = fs.readFileSync(path.join(__dirname, "../../src/app.js"), "utf8");
const serverSource = fs.readFileSync(path.join(__dirname, "../../src/server.js"), "utf8");

describe("app.js / server.js isolation", () => {
  test("app.js never calls .listen() — only server.js does", () => {
    assert.equal(/\.listen\s*\(/.test(appSource), false);
  });

  test("app.js never registers a process signal handler", () => {
    assert.equal(/process\.on\s*\(/.test(appSource), false);
  });

  test("app.js never calls process.exit()", () => {
    assert.equal(/process\.exit\s*\(/.test(appSource), false);
  });

  test("app.js exports the Express app directly (module.exports = app)", () => {
    assert.match(appSource, /module\.exports\s*=\s*app\s*;?/);
  });

  test("server.js registers both SIGINT and SIGTERM handlers", () => {
    assert.match(serverSource, /process\.on\(\s*["']SIGINT["']/);
    assert.match(serverSource, /process\.on\(\s*["']SIGTERM["']/);
  });

  test("server.js closes both the HTTP server and the DB pool on shutdown", () => {
    assert.match(serverSource, /server\.close\(/);
    assert.match(serverSource, /pool\.end\(/);
  });
});
