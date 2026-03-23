import app from "./app.js";
import { ensureDatabaseReady } from "./config/db.js";
import { env } from "./config/env.js";

try {
  const mode = await ensureDatabaseReady();

  app.listen(env.port, () => {
    console.log(`Backend ejecutandose en http://localhost:${env.port} (${mode})`);
  });
} catch (error) {
  console.error("No fue posible preparar la base de datos:", error.message);
  process.exit(1);
}
