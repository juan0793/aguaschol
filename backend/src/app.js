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
import transportRoutes from "./routes/transportRoutes.js";
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

app.get("/", (_req, res) => {
  if (env.frontendUrl) {
    res.redirect(302, env.frontendUrl);
    return;
  }

  res.type("html").send(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Aguas de Choluteca API</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            font-family: Arial, sans-serif;
            background: #f3f8fd;
            color: #14344f;
          }
          main {
            width: min(620px, calc(100% - 32px));
            padding: 28px;
            border: 1px solid rgba(21, 118, 209, 0.18);
            border-radius: 18px;
            background: #fff;
            box-shadow: 0 18px 42px rgba(16, 55, 91, 0.08);
          }
          h1 { margin: 0 0 10px; font-size: 24px; }
          p { line-height: 1.5; }
          code {
            padding: 2px 6px;
            border-radius: 6px;
            background: #edf5fc;
          }
        </style>
      </head>
      <body>
        <main>
          <h1>Backend de Aguas de Choluteca activo</h1>
          <p>Este dominio corresponde al servicio API. Para abrir la aplicacion web, configura la variable <code>FRONTEND_URL</code> del backend con el dominio del servicio frontend en Railway.</p>
          <p>Estado tecnico: <a href="/api/health">/api/health</a></p>
        </main>
      </body>
    </html>
  `);
});

app.get("/api/map-tiles/:z/:x/:y.png", getMapTileHandler);

app.use("/api/auth", authRoutes);
app.use("/api/claves", requireAuth, claveLookupRoutes);
app.use("/api/inmuebles", requireAuth, inmuebleRoutes);
app.use("/api/map-points", requireAuth, mapPointRoutes);
app.use("/api/transport", requireAuth, transportRoutes);
app.use("/api/users", requireAuth, requireAdmin, userRoutes);

app.use(errorHandler);

export default app;
