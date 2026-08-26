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
  await startDatabaseReconnectLoop();
  const server = http.createServer(app);
  const transportRealtime = initializeTransportRealtime({ server });
  const profileRealtime = initializeProfileRealtime({ server });
  server.on("upgrade", (request, socket, head) => {
    const { pathname } = new URL(request.url, "http://localhost");
    const realtime = pathname === "/ws/profile" ? profileRealtime : pathname === "/ws/transport" ? transportRealtime : null;

    if (!realtime) {
      socket.destroy();
      return;
    }

    realtime.handleUpgrade(request, socket, head, (websocket) => {
      realtime.emit("connection", websocket, request);
    });
  });
  startTelegramBot();
  server.listen(env.port, () => {
    console.log(`Backend ejecutandose en puerto ${env.port}`);
  });
} catch (error) {
  console.error("No fue posible iniciar el backend:", error.message);
  process.exit(1);
}
