import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import authRoutes from "./routes/auth.js";
import guardRoutes from "./routes/guard.js";
import adminRoutes from "./routes/admin.js";
import { initializeDatabase } from "./database/init.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 5000;

await initializeDatabase();

app.use(
  cors({
    origin: true,
    credentials: false
  })
);
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "Sentinel Grid API" });
});

app.use("/api/auth", authRoutes);
app.use("/api/guard", guardRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Sentinel Grid API listening on http://localhost:${port}`);
});
