// Task P1: preloaded via `node --test --require` before any integration
// test file (and therefore before app.js/db.js) is ever required. Setting
// NODE_ENV here — and only here — is what makes src/config/db.js redirect
// to TEST_DATABASE_URL instead of DATABASE_URL for the whole test run.
process.env.NODE_ENV = "test";
