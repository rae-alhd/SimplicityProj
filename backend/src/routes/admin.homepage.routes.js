const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "homepage");

const MIME_EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = MIME_EXTENSIONS[file.mimetype] || "";
    const uniqueName = `hero-${Date.now()}-${crypto
      .randomBytes(6)
      .toString("hex")}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!MIME_EXTENSIONS[file.mimetype]) {
      return cb(new Error("Only JPEG, PNG, and WEBP images are allowed"));
    }
    cb(null, true);
  },
});

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

// POST /api/admin/homepage-settings/hero-image
router.post(
  "/hero-image",
  authMiddleware,
  adminOnly,
  (req, res, next) => {
    upload.single("image")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "image file is required" });
      }

      const baseUrl = process.env.BACKEND_PUBLIC_URL || "http://localhost:5000";
      const imageUrl = `${baseUrl}/uploads/homepage/${req.file.filename}`;

      const result = await pool.query(
        `
        UPDATE homepage_settings
        SET hero_image_url = $1, updated_at = now()
        WHERE id = 1
        RETURNING *
        `,
        [imageUrl]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Homepage settings row not found" });
      }

      res.status(200).json(result.rows[0]);
    } catch (err) {
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      console.error("Error uploading hero image:", err.message);
      res.status(500).json({ error: "Failed to upload hero image" });
    }
  }
);

module.exports = router;
