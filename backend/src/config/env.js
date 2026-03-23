import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const projectRoot = path.resolve(backendRoot, "..");

export const env = {
  port: Number(process.env.PORT ?? 4000),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  dbHost: process.env.DB_HOST ?? "localhost",
  dbPort: Number(process.env.DB_PORT ?? 3306),
  dbUser: process.env.DB_USER ?? "root",
  dbPassword: process.env.DB_PASSWORD ?? "",
  dbName: process.env.DB_NAME ?? "app_clandestinos",
  useMemoryDb: String(process.env.USE_MEMORY_DB ?? "false").toLowerCase() === "true",
  dbAutoStart: String(process.env.DB_AUTO_START ?? "true").toLowerCase() === "true",
  dbRoot: projectRoot,
  dbWorkspaceDir: path.resolve(projectRoot, ".db"),
  dbDataDir: path.resolve(projectRoot, ".db", "mariadb-data"),
  dbRunDir: path.resolve(projectRoot, ".db", "mariadb-run"),
  authUsername: process.env.AUTH_USERNAME ?? "admin",
  authPassword: process.env.AUTH_PASSWORD ?? "abcd123",
  authSeedName: process.env.AUTH_SEED_NAME ?? "Administrador General",
  authSessionDays: Number(process.env.AUTH_SESSION_DAYS ?? 7),
  emailProvider: process.env.EMAIL_PROVIDER ?? "brevo",
  emailFrom: process.env.EMAIL_FROM ?? "",
  emailFromName: process.env.EMAIL_FROM_NAME ?? "Aguas de Choluteca",
  emailApiKey: process.env.EMAIL_API_KEY ?? "",
  emailSandbox: String(process.env.EMAIL_SANDBOX ?? "true").toLowerCase() === "true"
};
