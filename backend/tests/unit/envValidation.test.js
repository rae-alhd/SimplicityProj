// Task Q1: pure unit tests for production-only startup validation. Every
// case passes a fake `env` object (never mutates the real process.env),
// which is what validateProductionEnv() accepts for exactly this reason.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { validateProductionEnv, MIN_JWT_SECRET_LENGTH } = require("../../src/config/envValidation");

const VALID_SECRET = "a".repeat(MIN_JWT_SECRET_LENGTH);

function validProdEnv(overrides = {}) {
  return {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://user:pass@db.example.com:5432/simplicity_db",
    JWT_SECRET: VALID_SECRET,
    JWT_EXPIRES_IN: "1h",
    FRONTEND_URL: "https://simplicity.example.com",
    ...overrides,
  };
}

describe("envValidation.validateProductionEnv — non-production is a no-op", () => {
  test("does nothing when NODE_ENV is development, even with everything missing", () => {
    assert.doesNotThrow(() => validateProductionEnv({ NODE_ENV: "development" }));
  });

  test("does nothing when NODE_ENV is test, even with everything missing", () => {
    assert.doesNotThrow(() => validateProductionEnv({ NODE_ENV: "test" }));
  });

  test("never requires TEST_DATABASE_URL, even in production", () => {
    const env = validProdEnv();
    delete env.TEST_DATABASE_URL;
    assert.doesNotThrow(() => validateProductionEnv(env));
  });
});

describe("envValidation.validateProductionEnv — required variables", () => {
  test("passes with every required variable set to a valid value", () => {
    assert.doesNotThrow(() => validateProductionEnv(validProdEnv()));
  });

  test("throws listing DATABASE_URL when missing", () => {
    const env = validProdEnv({ DATABASE_URL: undefined });
    assert.throws(() => validateProductionEnv(env), /DATABASE_URL/);
  });

  test("throws listing JWT_SECRET when missing", () => {
    const env = validProdEnv({ JWT_SECRET: undefined });
    assert.throws(() => validateProductionEnv(env), /JWT_SECRET/);
  });

  test("throws listing JWT_EXPIRES_IN when missing", () => {
    const env = validProdEnv({ JWT_EXPIRES_IN: undefined });
    assert.throws(() => validateProductionEnv(env), /JWT_EXPIRES_IN/);
  });

  test("throws when neither FRONTEND_URL nor ALLOWED_ORIGINS is set", () => {
    const env = validProdEnv({ FRONTEND_URL: undefined });
    assert.throws(() => validateProductionEnv(env), /FRONTEND_URL or ALLOWED_ORIGINS/);
  });

  test("passes when ALLOWED_ORIGINS is set instead of FRONTEND_URL", () => {
    const env = validProdEnv({ FRONTEND_URL: undefined, ALLOWED_ORIGINS: "https://a.example,https://b.example" });
    assert.doesNotThrow(() => validateProductionEnv(env));
  });

  test("lists every missing variable at once, not just the first", () => {
    const env = { NODE_ENV: "production" };
    assert.throws(() => validateProductionEnv(env), (err) => {
      return /DATABASE_URL/.test(err.message)
        && /JWT_SECRET/.test(err.message)
        && /JWT_EXPIRES_IN/.test(err.message);
    });
  });
});

describe("envValidation.validateProductionEnv — placeholder/weak JWT_SECRET rejection", () => {
  const placeholders = ["replace-with-a-long-random-string", "secret", "changeme", "password", "test"];

  for (const placeholder of placeholders) {
    test(`rejects the known placeholder "${placeholder}"`, () => {
      const env = validProdEnv({ JWT_SECRET: placeholder });
      assert.throws(() => validateProductionEnv(env), /placeholder|too short|shorter/i);
    });
  }

  test(`rejects a secret shorter than ${MIN_JWT_SECRET_LENGTH} characters even if not a known placeholder`, () => {
    const env = validProdEnv({ JWT_SECRET: "short-but-unique-value" });
    assert.throws(() => validateProductionEnv(env));
  });

  test("accepts a long, non-placeholder secret", () => {
    const env = validProdEnv({ JWT_SECRET: VALID_SECRET });
    assert.doesNotThrow(() => validateProductionEnv(env));
  });

  test("never includes the actual secret value in the thrown error message", () => {
    const secretValue = "this-exact-string-must-never-appear-in-error-output";
    const env = validProdEnv({ JWT_SECRET: secretValue.slice(0, 10) }); // deliberately too short
    try {
      validateProductionEnv(env);
      assert.fail("expected validateProductionEnv to throw");
    } catch (err) {
      assert.equal(err.message.includes(secretValue), false);
    }
  });
});
