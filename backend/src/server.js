import app from "./app.js";
import fs from "node:fs/promises";
import http from "node:http";
import { startDatabaseReconnectLoop } from "./config/db.js";
import { env, validateRuntimeEnv } from "./config/env.js";
import { initializeTransportRealtime } from "./services/transportRealtimeService.js";
import { initializeProfileRealtime } from "./services/profileRealtimeService.js";
import { startTelegramBot } from "./services/telegramBotService.js";
import { startEntregasReminders } from "./services/entregasReminderService.js";
import { startNotesPurge } from "./services/notesService.js";
import { syncAlcaldiaWithR2 } from "./services/claveLookupService.js";

try {
  validateRuntimeEnv();
  await fs.mkdir(env.uploadDir, { recursive: true });
  await startDatabaseReconnectLoop();
  // En segundo plano para no demorar el healthcheck: son ~3 MB comprimidos.
  syncAlcaldiaWithR2()
    .then((result) => console.log(`Padron de Alcaldia: ${result.total_records} registros (origen ${result.source}${result.seeded ? ", copiado a R2" : ""}).`))
    .catch((error) => console.error("No se pudo sincronizar el padron de Alcaldia con R2:", error.message));
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
  startEntregasReminders();
  startNotesPurge();
  server.listen(env.port, () => {
    console.log(`Backend ejecutandose en puerto ${env.port}`);
  });
} catch (error) {
  console.error("No fue posible iniciar el backend:", error.message);
  process.exit(1);
}
