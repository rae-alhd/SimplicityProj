// Task Q1.1: pure unit tests for the shared VITE_API_URL validator used by
// both vite.config.js (build-time gate) and src/config/api.js (runtime
// normalization).
import { describe, test, expect } from "vitest";
import { normalizeApiUrl } from "./validateApiUrl";

describe("normalizeApiUrl — accepted", () => {
  test("a clean URL with a /api path is accepted unchanged", () => {
    const result = normalizeApiUrl("https://example-backend.test/api");
    expect(result.ok).toBe(true);
    expect(result.value).toBe("https://example-backend.test/api");
  });

  test("a trailing slash is normalized away", () => {
    const result = normalizeApiUrl("https://example-backend.test/api/");
    expect(result.ok).toBe(true);
    expect(result.value).toBe("https://example-backend.test/api");
  });

  test("multiple trailing slashes are all normalized away", () => {
    const result = normalizeApiUrl("https://example-backend.test/api///");
    expect(result.ok).toBe(true);
    expect(result.value).toBe("https://example-backend.test/api");
  });

  test("surrounding whitespace is trimmed", () => {
    const result = normalizeApiUrl("  https://example-backend.test/api  ");
    expect(result.ok).toBe(true);
    expect(result.value).toBe("https://example-backend.test/api");
  });

  test("plain http:// is accepted (not just https://)", () => {
    const result = normalizeApiUrl("http://localhost:5000/api");
    expect(result.ok).toBe(true);
    expect(result.value).toBe("http://localhost:5000/api");
  });
});

describe("normalizeApiUrl — rejected", () => {
  test("empty string", () => {
    expect(normalizeApiUrl("").ok).toBe(false);
  });

  test("whitespace only", () => {
    expect(normalizeApiUrl("   ").ok).toBe(false);
  });

  test("undefined / not a string at all", () => {
    expect(normalizeApiUrl(undefined).ok).toBe(false);
  });

  test("not a URL", () => {
    const result = normalizeApiUrl("not-a-url");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("malformed");
  });

  test("javascript: URL", () => {
    const result = normalizeApiUrl("javascript:alert(1)");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("protocol");
  });

  test("data: URL", () => {
    const result = normalizeApiUrl("data:text/html,test");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("protocol");
  });

  test("ftp:// URL", () => {
    const result = normalizeApiUrl("ftp://example.com/api");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("protocol");
  });

  test("bare origin with no path", () => {
    const result = normalizeApiUrl("https://example-backend.test");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("path");
  });

  test("bare origin with just a trailing slash", () => {
    const result = normalizeApiUrl("https://example-backend.test/");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("path");
  });

  test("a different, unrelated path", () => {
    const result = normalizeApiUrl("https://example-backend.test/wrong");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("path");
  });

  test("a sub-path under /api is still rejected — only exactly /api is allowed", () => {
    const result = normalizeApiUrl("https://example-backend.test/api/v2");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("path");
  });

  test("a path that merely starts with \"api\" is rejected (/apis is not /api)", () => {
    const result = normalizeApiUrl("https://example-backend.test/apis");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("path");
  });

  test("path comparison is case-sensitive — /API is rejected", () => {
    const result = normalizeApiUrl("https://example-backend.test/API");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("path");
  });

  test("embedded username/password", () => {
    const result = normalizeApiUrl("https://user:pass@example.com/api");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("credentials");
  });

  test("query string", () => {
    const result = normalizeApiUrl("https://example.com/api?x=1");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("query");
  });

  test("fragment", () => {
    const result = normalizeApiUrl("https://example.com/api#fragment");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("fragment");
  });
});
