import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { getDatabaseStatus } from "./config/db.js";
import { env } from "./config/env.js";
import { requireAdmin, requireAuth } from "./middleware/authMiddleware.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/authRoutes.js";
import inmuebleRoutes from "./routes/inmuebleRoutes.js";
import userRoutes from "./routes/userRoutes.js";

const app = express();
const localOrigins = env.isRailway ? [] : ["http://127.0.0.1:5173", "http://localhost:5173"];
const allowedOrigins = new Set([...env.frontendUrls, ...localOrigins]);
const frontendDistAvailable = fs.existsSync(env.frontendDistDir);
const frontendAssetsDir = path.join(env.frontendDistDir, "assets");
const frontendAssetsAvailable = fs.existsSync(frontendAssetsDir);

if (frontendDistAvailable) {
  if (frontendAssetsAvailable) {
    app.use("/assets", express.static(frontendAssetsDir));
  }

  app.use(express.static(env.frontendDistDir));

  app.get(/^\/(?!api(?:\/|$)|uploads(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(env.frontendDistDir, "index.html"));
  });
}

app.use(
  cors({
    origin: (origin, callback) => {
      const allowByRailwayFallback = env.isRailway && allowedOrigins.size === 0;

      if (!origin || allowedOrigins.has(origin) || allowByRailwayFallback) {
        callback(null, true);
        return;
      }

      callback(new Error("Origen no permitido por CORS."));
    }
  })
);
app.use(express.json());
app.use("/uploads", express.static(env.uploadDir));

app.get("/api/health", (_req, res) => {
  const db = getDatabaseStatus();
  res.json({
    ok: true,
    mode: db.mode,
    dbReady: db.ready,
    dbError: db.lastError
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/inmuebles", requireAuth, inmuebleRoutes);
app.use("/api/users", requireAuth, requireAdmin, userRoutes);

app.use(errorHandler);

export default app;
