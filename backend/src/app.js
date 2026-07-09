const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

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

// Render (and most PaaS hosts) terminate HTTPS at their edge proxy and
// forward requests over plain HTTP internally. Without this, req.protocol
// would report "http" even on a live HTTPS request, causing upload routes
// that build absolute URLs from req.protocol to save broken http:// links.
app.set("trust proxy", true);

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
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

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", ordersRoutes);

module.exports = app;