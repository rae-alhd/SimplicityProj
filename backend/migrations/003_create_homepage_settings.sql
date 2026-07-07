-- 003_create_homepage_settings.sql
-- Adds a single-row homepage_settings table so the admin dashboard can control
-- homepage hero/button/announcement content without editing frontend code.
-- Single row by convention: the application always reads/writes id = 1.

CREATE TABLE homepage_settings (
  id SERIAL PRIMARY KEY,
  hero_title TEXT NOT NULL,
  hero_highlight TEXT,
  hero_subtitle TEXT,
  hero_image_url TEXT,
  primary_button_text TEXT,
  primary_button_link TEXT,
  secondary_button_text TEXT,
  secondary_button_link TEXT,
  announcement_text TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO homepage_settings (
  hero_title,
  hero_highlight,
  hero_subtitle,
  hero_image_url,
  primary_button_text,
  primary_button_link,
  secondary_button_text,
  secondary_button_link,
  announcement_text
) VALUES (
  'Wear Less.',
  'Mean More.',
  'Premium ready-to-wear and custom pieces designed for presence, comfort, and quiet confidence.',
  NULL,
  'Shop Collection',
  '/products',
  'Open Studio',
  '/customize',
  NULL
);
