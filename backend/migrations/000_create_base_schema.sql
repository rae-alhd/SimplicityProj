-- 000_create_base_schema.sql
-- Recovery migration: reproduces the base schema that already exists on the
-- original local development database but was never captured in a migration
-- file (it predates the backend/migrations/ convention). Migrations 001-011
-- all assume these tables already exist; a fresh database (e.g. a new Neon
-- project) needs this run first.
--
-- This intentionally reproduces the local schema exactly as introspected,
-- including its existing gaps (no FK on cart_items.product_id, users.role
-- defaulting to 'admin') rather than "improving" on it.
--
-- This is the schema as it existed BEFORE migrations 001-011, not the final
-- fully-migrated schema: columns later added by 005 (cart_items.design_id,
-- order_items.design_label), 006 (order_items.collection_name,
-- order_items.design_image_url), 008 (orders.stock_restored), and 010
-- (orders.admin_notes) are deliberately left out here so those migrations
-- remain the ones that add them, in order, on top of this base.

-- 1. users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(100) NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role VARCHAR(20) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. products
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  target_group TEXT NOT NULL,
  base_price NUMERIC NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  image_url TEXT,
  is_customizable BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  customization_extra_price NUMERIC DEFAULT 0,
  customization_note TEXT
);

-- 3. orders
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  address TEXT NOT NULL,
  notes TEXT,
  total_price NUMERIC NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT now()
);

-- 4. customization_options
CREATE TABLE IF NOT EXISTS customization_options (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  option_label VARCHAR(120) NOT NULL,
  option_type VARCHAR(40) NOT NULL,
  description TEXT,
  extra_price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);

-- 5. customizable_product_colors
CREATE TABLE IF NOT EXISTS customizable_product_colors (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color_name VARCHAR(80) NOT NULL,
  color_hex VARCHAR(7),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);

-- 6. customizable_product_sizes
CREATE TABLE IF NOT EXISTS customizable_product_sizes (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size_label VARCHAR(20) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);

-- 7. customization_examples
CREATE TABLE IF NOT EXISTS customization_examples (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption VARCHAR(200),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);

-- 8. order_items
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  size VARCHAR(20),
  color VARCHAR(50),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  is_customized BOOLEAN NOT NULL DEFAULT false,
  customization_label VARCHAR(200),
  chosen_color VARCHAR(80),
  chosen_size VARCHAR(20),
  custom_text TEXT,
  custom_note TEXT
);

-- 9. cart_items
-- product_id intentionally has no FK (matches local DB reality).
-- design_id is NOT created here — migration 005 adds it once
-- collection_designs exists, along with its FK and index.
CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  product_id INTEGER,
  color VARCHAR(50),
  size VARCHAR(10),
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_customized BOOLEAN NOT NULL DEFAULT false,
  customization_option_id INTEGER REFERENCES customization_options(id) ON DELETE SET NULL,
  custom_text TEXT,
  custom_note TEXT
);

-- Indexes (matching local DB; idx_cart_items_design_id is created by
-- migration 005 once collection_designs/the design_id FK exist)
CREATE INDEX IF NOT EXISTS idx_cust_opts_product ON customization_options(product_id);
CREATE INDEX IF NOT EXISTS idx_prod_colors_product ON customizable_product_colors(product_id);
CREATE INDEX IF NOT EXISTS idx_prod_sizes_product ON customizable_product_sizes(product_id);
CREATE INDEX IF NOT EXISTS idx_cust_examples_product ON customization_examples(product_id);
