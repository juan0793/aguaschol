import app from "./app.js";
import fs from "node:fs/promises";
import { startDatabaseReconnectLoop } from "./config/db.js";
import { env } from "./config/env.js";

try {
  await fs.mkdir(env.uploadDir, { recursive: true });
  void startDatabaseReconnectLoop();
  app.listen(env.port, () => {
    console.log(`Backend ejecutandose en puerto ${env.port}`);
  });
} catch (error) {
  console.error("No fue posible iniciar el backend:", error.message);
  process.exit(1);
}
