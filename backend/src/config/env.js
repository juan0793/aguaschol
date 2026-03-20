import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  dbHost: process.env.DB_HOST ?? "localhost",
  dbPort: Number(process.env.DB_PORT ?? 3306),
  dbUser: process.env.DB_USER ?? "root",
  dbPassword: process.env.DB_PASSWORD ?? "",
  dbName: process.env.DB_NAME ?? "app_clandestinos",
  useMemoryDb: String(process.env.USE_MEMORY_DB ?? "false").toLowerCase() === "true",
  authUsername: process.env.AUTH_USERNAME ?? "admin",
  authPassword: process.env.AUTH_PASSWORD ?? "abcd123",
  authToken: process.env.AUTH_TOKEN ?? "aguaschol-admin-token"
};
