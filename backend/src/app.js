const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const pool = require("./config/db");
const { corsOptions } = require("./config/cors");
const { checkDatabaseHealth } = require("./utils/health");
const { notFoundHandler } = require("./middleware/notFoundHandler");
const { errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/products.routes");
const cartRoutes = require("./routes/cart.routes");
const ordersRoutes = require("./routes/orders.routes");
const customizationRoutes = require("./routes/customization.routes");
const adminCustomizationRoutes = require("./routes/admin.customization.routes");
const adminProductsRoutes = require("./routes/admin.products.routes");
const homepageRoutes = require("./routes/homepage.routes");
const adminHomepageRoutes = require("./routes/admin.homepage.routes");
const adminSettingsRoutes = require("./routes/admin.settings.routes");
const app = express();

// Task Q1: Render (and most PaaS hosts) sit the app behind exactly ONE
// reverse-proxy hop that terminates HTTPS and forwards over plain HTTP
// internally, setting X-Forwarded-For/-Proto on the way in. `trust proxy:
// 1` tells Express to trust exactly that one hop, so req.protocol/
// req.secure stay correct (upload routes building absolute URLs from
// req.protocol still won't save broken http:// links — same fix as
// before) while a direct client can no longer spoof its own IP by sending
// a fake X-Forwarded-For header itself, which the previous `trust proxy:
// true` (trust ALL hops, from anyone) allowed. This also makes the
// IP-based rate limiting below trustworthy — express-rate-limit v8
// actively refuses to start with `trust proxy: true` for that reason.
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors(corsOptions));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "1mb" }));
app.use(
  "/uploads",
  express.static(path.join(__dirname, "../uploads"), {
    setHeaders: (res) => {
      res.set("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);
app.use("/api/customization", customizationRoutes);
app.use("/api/admin/customization", adminCustomizationRoutes);
app.use("/api/admin/products", adminProductsRoutes);
app.use("/api/homepage-settings", homepageRoutes);
app.use("/api/admin/homepage-settings", adminHomepageRoutes);
app.use("/api/admin/settings", adminSettingsRoutes);
app.get("/", (req, res) => {
  res.send("Simplicity Backend Running 🚀");
});

// Task Q1: customer-safe health check — no auth required, performs a real
// (lightweight) DB round trip so a genuinely down database is detectable,
// and never leaks connection strings, table names, row counts, or stack
// traces in the response.
app.get("/api/health", async (req, res) => {
  const health = await checkDatabaseHealth(pool);

  if (health.ok) {
    return res.status(200).json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  }

  res.status(503).json({
    status: "error",
    database: "unavailable",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", ordersRoutes);

// Task Q1: unknown API routes get a small, safe JSON 404 instead of
// Express's default HTML "Cannot GET /x" page. Scoped to /api so it never
// interferes with any route registered above it.
app.use("/api", notFoundHandler);

// Task Q1: centralized error handler — MUST stay the last app.use().
app.use(errorHandler);

module.exports = app;