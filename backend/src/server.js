require("dotenv").config();

const app = require("./app");
const pool = require("./config/db");

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  try {
    await pool.query("SELECT 1");
    console.log("PostgreSQL connected"); // 👈 THIS SHOULD APPEAR
    console.log(`Server running on port ${PORT}`);
  } catch (err) {
    console.error("Database connection failed:", err.message);
  }
});