const bcrypt = require("bcrypt");
const pool = require("./src/config/db");

async function createUser() {
  const email = "user@simplicity.com";
  const password = "123456";

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    await pool.query(
      `INSERT INTO users (email, password, role)
       VALUES ($1, $2, $3)`,
      [email, hashedPassword, "user"]
    );

    console.log("✅ User created successfully");
  } catch (err) {
    console.error("❌ Error creating user:", err.message);
  } finally {
    process.exit();
  }
}

createUser();