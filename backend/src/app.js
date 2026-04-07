import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { getDatabaseStatus } from "./config/db.js";
import { env } from "./config/env.js";
import { getMapTileHandler } from "./controllers/mapTileController.js";
import { requireAdmin, requireAuth } from "./middleware/authMiddleware.js";
import claveLookupRoutes from "./routes/claveLookupRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/authRoutes.js";
import inmuebleRoutes from "./routes/inmuebleRoutes.js";
import mapPointRoutes from "./routes/mapPointRoutes.js";
import userRoutes from "./routes/userRoutes.js";

const app = express();
const localOrigins = env.isRailway ? [] : ["http://127.0.0.1:5173", "http://localhost:5173"];
const allowedOrigins = new Set([...env.frontendUrls, ...localOrigins]);
const frontendDistAvailable = fs.existsSync(env.frontendDistDir);
const frontendAssetsDir = path.join(env.frontendDistDir, "assets");
const frontendAssetsAvailable = fs.existsSync(frontendAssetsDir);

const getOriginHost = (value) => {
  if (!value) return "";

  try {
    return new URL(value).host;
  } catch {
    return "";
  }
};

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
  cors((req, callback) => {
    const origin = req.headers.origin;
    const requestHost = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "")
      .split(",")[0]
      .trim();
    const sameHost = Boolean(origin) && getOriginHost(origin) === requestHost;
    const allowByRailwayFallback = env.isRailway && (allowedOrigins.size === 0 || sameHost);

    if (!origin || allowedOrigins.has(origin) || sameHost || allowByRailwayFallback) {
      callback(null, { origin: true });
      return;
    }

    callback(new Error("Origen no permitido por CORS."));
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

app.get("/api/map-tiles/:z/:x/:y.png", getMapTileHandler);

app.use("/api/auth", authRoutes);
app.use("/api/claves", requireAuth, claveLookupRoutes);
app.use("/api/inmuebles", requireAuth, inmuebleRoutes);
app.use("/api/map-points", requireAuth, mapPointRoutes);
app.use("/api/users", requireAuth, requireAdmin, userRoutes);

app.use(errorHandler);

export default app;
