import cors from "cors";
import express from "express";
import path from "node:path";
import { env } from "./config/env.js";
import { requireAuth } from "./middleware/authMiddleware.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/authRoutes.js";
import inmuebleRoutes from "./routes/inmuebleRoutes.js";

const app = express();
const allowedOrigins = new Set([env.frontendUrl, "http://127.0.0.1:5173", "http://localhost:5173"]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origen no permitido por CORS."));
    }
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.resolve("uploads")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, mode: env.useMemoryDb ? "memory" : "mysql" });
});

app.use("/api/auth", authRoutes);
app.use("/api/inmuebles", requireAuth, inmuebleRoutes);
app.use(errorHandler);

export default app;
