const express = require("express");
const router = express.Router();
const pool = require("../config/db");

const DEFAULT_HOMEPAGE_SETTINGS = {
  hero_title: "Wear Less.",
  hero_highlight: "Mean More.",
  hero_subtitle:
    "Premium ready-to-wear and custom pieces designed for presence, comfort, and quiet confidence.",
  hero_image_url: null,
  primary_button_text: "Shop Collection",
  primary_button_link: "/products",
  secondary_button_text: "Open Studio",
  secondary_button_link: "/customize",
  announcement_text: null,
  men_card_image_url: null,
  men_card_title: "Men",
  women_card_image_url: null,
  women_card_title: "Women",
  studio_card_image_url: null,
  studio_card_title: "Custom Studio",
};

// GET /api/homepage-settings
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM homepage_settings WHERE id = 1"
    );

    if (result.rows.length === 0) {
      return res.status(200).json(DEFAULT_HOMEPAGE_SETTINGS);
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching homepage settings:", err.message);
    res.status(500).json({ error: "Failed to fetch homepage settings" });
  }
});

module.exports = router;
