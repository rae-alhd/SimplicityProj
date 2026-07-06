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
const app = express();

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