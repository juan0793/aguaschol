import app from "./app.js";
import fs from "node:fs/promises";
import { ensureDatabaseReady } from "./config/db.js";
import { env } from "./config/env.js";

try {
  await fs.mkdir(env.uploadDir, { recursive: true });
  const mode = await ensureDatabaseReady();

  app.listen(env.port, () => {
    console.log(`Backend ejecutandose en puerto ${env.port} (${mode})`);
  });
} catch (error) {
  console.error("No fue posible preparar la base de datos:", error.message);
  process.exit(1);
}
