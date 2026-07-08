const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");

const DEFAULT_STORE_SETTINGS = {
  low_stock_threshold: 5,
};

// GET /api/admin/settings
router.get("/", authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM store_settings WHERE id = 1"
    );

    if (result.rows.length === 0) {
      return res.status(200).json(DEFAULT_STORE_SETTINGS);
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching store settings:", err.message);
    res.status(500).json({ error: "Failed to fetch store settings" });
  }
});

// PUT /api/admin/settings
router.put("/", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { low_stock_threshold } = req.body;
    const parsedThreshold = Number(low_stock_threshold);

    if (!Number.isInteger(parsedThreshold) || parsedThreshold < 1) {
      return res.status(400).json({
        error: "low_stock_threshold must be a positive integer",
      });
    }

    const result = await pool.query(
      `
      UPDATE store_settings
      SET low_stock_threshold = $1, updated_at = now()
      WHERE id = 1
      RETURNING *
      `,
      [parsedThreshold]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Store settings row not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Error updating store settings:", err.message);
    res.status(500).json({ error: "Failed to update store settings" });
  }
});

module.exports = router;
