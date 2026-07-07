const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");

// PUT /api/admin/homepage-settings
router.put("/", authMiddleware, adminOnly, async (req, res) => {
  try {
    const {
      hero_title,
      hero_highlight,
      hero_subtitle,
      hero_image_url,
      primary_button_text,
      primary_button_link,
      secondary_button_text,
      secondary_button_link,
      announcement_text,
    } = req.body;

    if (!hero_title || !hero_title.trim()) {
      return res.status(400).json({ error: "hero_title must not be empty" });
    }

    const result = await pool.query(
      `
      UPDATE homepage_settings
      SET
        hero_title = $1,
        hero_highlight = $2,
        hero_subtitle = $3,
        hero_image_url = $4,
        primary_button_text = $5,
        primary_button_link = $6,
        secondary_button_text = $7,
        secondary_button_link = $8,
        announcement_text = $9,
        updated_at = now()
      WHERE id = 1
      RETURNING *
      `,
      [
        hero_title,
        hero_highlight || null,
        hero_subtitle || null,
        hero_image_url || null,
        primary_button_text || null,
        primary_button_link || null,
        secondary_button_text || null,
        secondary_button_link || null,
        announcement_text || null,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Homepage settings row not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Error updating homepage settings:", err.message);
    res.status(500).json({ error: "Failed to update homepage settings" });
  }
});

module.exports = router;
