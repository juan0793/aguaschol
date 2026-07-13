import app from "./app.js";
import fs from "node:fs/promises";
import http from "node:http";
import { startDatabaseReconnectLoop } from "./config/db.js";
import { env, validateRuntimeEnv } from "./config/env.js";
import { initializeTransportRealtime } from "./services/transportRealtimeService.js";
import { initializeProfileRealtime } from "./services/profileRealtimeService.js";
import { startTelegramBot } from "./services/telegramBotService.js";

try {
  validateRuntimeEnv();
  await fs.mkdir(env.uploadDir, { recursive: true });
  void startDatabaseReconnectLoop();
  const server = http.createServer(app);
  initializeTransportRealtime({ server });
  initializeProfileRealtime({ server });
  startTelegramBot();
  server.listen(env.port, () => {
    console.log(`Backend ejecutandose en puerto ${env.port}`);
  });
} catch (error) {
  console.error("No fue posible iniciar el backend:", error.message);
  process.exit(1);
}
