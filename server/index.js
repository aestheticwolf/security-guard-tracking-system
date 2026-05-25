import "dotenv/config";
import cors from "cors";
import express from "express";
import authRoutes from "./routes/auth.js";
import guardRoutes from "./routes/guard.js";
import adminRoutes from "./routes/admin.js";
import { initializeDatabase } from "./database/init.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { getUploadRoot } from "./services/selfie.js";

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
app.use("/uploads", express.static(getUploadRoot()));

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "Sentinel Grid API" });
});

app.use("/api/auth", authRoutes);
app.use("/api/guard", guardRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(port, () => {
  console.log(`Sentinel Grid API listening on http://localhost:${port}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Sentinel Grid API could not start because port ${port} is already in use.`
    );
    console.error(
      "Close the other running backend process, or set a different PORT in .env and update VITE_API_URL to match."
    );
    process.exit(1);
  }

  console.error("Sentinel Grid API failed to start.", error);
  process.exit(1);
});
