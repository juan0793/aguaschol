import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const projectRoot = path.resolve(backendRoot, "..");
const isRailway =
  Boolean(process.env.RAILWAY_ENVIRONMENT) ||
  Boolean(process.env.RAILWAY_PROJECT_ID) ||
  Boolean(process.env.RAILWAY_SERVICE_ID);
const isProduction = isRailway || process.env.NODE_ENV === "production";

const parseDatabaseUrl = (value) => {
  if (!value) {
    return {};
  }

  try {
    const url = new URL(value);
    const databaseName = url.pathname.replace(/^\/+/, "");

    return {
      dbHost: url.hostname || undefined,
      dbPort: url.port ? Number(url.port) : undefined,
      dbUser: url.username ? decodeURIComponent(url.username) : undefined,
      dbPassword: url.password ? decodeURIComponent(url.password) : undefined,
      dbName: databaseName || undefined
    };
  } catch {
    return {};
  }
};

const databaseUrlConfig = parseDatabaseUrl(process.env.DATABASE_URL ?? process.env.MYSQL_URL);
const frontendUrlDefaults = isRailway ? "" : "http://localhost:5173";
const frontendUrls = (process.env.FRONTEND_URLS ?? process.env.FRONTEND_URL ?? frontendUrlDefaults)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export const env = {
  port: Number(process.env.PORT ?? 4000),
  isRailway,
  isProduction,
  frontendUrl: frontendUrls[0] ?? "",
  frontendUrls,
  dbHost: process.env.DB_HOST ?? process.env.MYSQLHOST ?? databaseUrlConfig.dbHost ?? (isRailway ? "" : "localhost"),
  dbPort: Number(process.env.DB_PORT ?? process.env.MYSQLPORT ?? databaseUrlConfig.dbPort ?? 3306),
  dbUser: process.env.DB_USER ?? process.env.MYSQLUSER ?? databaseUrlConfig.dbUser ?? (isRailway ? "" : "root"),
  dbPassword: process.env.DB_PASSWORD ?? process.env.MYSQLPASSWORD ?? databaseUrlConfig.dbPassword ?? "",
  dbName: process.env.DB_NAME ?? process.env.MYSQLDATABASE ?? databaseUrlConfig.dbName ?? (isRailway ? "" : "app_clandestinos"),
  useMemoryDb: String(process.env.USE_MEMORY_DB ?? "false").toLowerCase() === "true",
  dbAutoStart: String(process.env.DB_AUTO_START ?? (isRailway ? "false" : "true")).toLowerCase() === "true",
  dbConnectRetries: Number(process.env.DB_CONNECT_RETRIES ?? (isRailway ? 0 : 10)),
  dbConnectRetryDelayMs: Number(process.env.DB_CONNECT_RETRY_DELAY_MS ?? 5000),
  dbRoot: projectRoot,
  frontendDistDir: path.resolve(projectRoot, "frontend", "dist"),
  dbWorkspaceDir: path.resolve(projectRoot, ".db"),
  dbDataDir: path.resolve(projectRoot, ".db", "mariadb-data"),
  dbRunDir: path.resolve(projectRoot, ".db", "mariadb-run"),
  uploadDir: path.resolve(projectRoot, process.env.UPLOAD_DIR ?? "backend/uploads"),
  uploadMaxFileSizeMb: Number(process.env.UPLOAD_MAX_FILE_SIZE_MB ?? 8),
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY ?? "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  cloudinaryFolder: process.env.CLOUDINARY_FOLDER ?? "aguas-clandestinos",
  authUsername: process.env.AUTH_USERNAME ?? "admin",
  authPassword: process.env.AUTH_PASSWORD ?? (isProduction ? "" : "abcd123"),
  authSeedName: process.env.AUTH_SEED_NAME ?? "Administrador General",
  authSessionDays: Number(process.env.AUTH_SESSION_DAYS ?? 7),
  authLoginMaxAttempts: Number(process.env.AUTH_LOGIN_MAX_ATTEMPTS ?? 5),
  authLoginWindowMinutes: Number(process.env.AUTH_LOGIN_WINDOW_MINUTES ?? 15),
  emailProvider: process.env.EMAIL_PROVIDER ?? "brevo",
  emailFrom: process.env.EMAIL_FROM ?? "",
  emailFromName: process.env.EMAIL_FROM_NAME ?? "Aguas de Choluteca",
  emailApiKey: process.env.EMAIL_API_KEY ?? "",
  emailSandbox: String(process.env.EMAIL_SANDBOX ?? "true").toLowerCase() === "true",
  llmProvider: process.env.LLM_PROVIDER ?? (process.env.CEREBRAS_API_KEY ? "cerebras" : "openrouter"),
  cerebrasApiKey: process.env.CEREBRAS_API_KEY ?? "",
  cerebrasApiBaseUrl: process.env.CEREBRAS_API_BASE_URL ?? "https://api.cerebras.ai/v1",
  cerebrasModel: process.env.CEREBRAS_MODEL ?? "gpt-oss-120b",
  llmApiKey: process.env.LLM_API_KEY ?? "",
  llmApiBaseUrl: process.env.LLM_API_BASE_URL ?? "https://openrouter.ai/api/v1",
  llmModel: process.env.LLM_MODEL ?? "openai/gpt-oss-20b:free",
  llmAppName: process.env.LLM_APP_NAME ?? "Aguas de Choluteca",
  llmSiteUrl: process.env.LLM_SITE_URL ?? frontendUrls[0] ?? "",
  llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 25000),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "",
  foxProSyncApiKey: process.env.FOXPRO_SYNC_API_KEY?.trim() ?? "",
  foxProSyncBatchSize: Number(process.env.FOXPRO_SYNC_BATCH_SIZE ?? 500),
  foxProSyncMaxRecords: Number(process.env.FOXPRO_SYNC_MAX_RECORDS ?? 50000),
  foxProSyncRetainBatches: Number(process.env.FOXPRO_SYNC_RETAIN_BATCHES ?? 5),
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID?.trim() ?? "",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY?.trim() ?? "",
  r2Endpoint: process.env.R2_ENDPOINT?.trim() ?? "",
  r2Bucket: process.env.R2_BUCKET?.trim() ?? "",
  r2Region: process.env.R2_REGION?.trim() || "auto",
  telegramAllowedChatIds: new Set(
    (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  )
};

env.useCloudinary = Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret);
env.useR2 = Boolean(env.r2AccessKeyId && env.r2SecretAccessKey && env.r2Endpoint && env.r2Bucket);

export const validateRuntimeEnv = (config = env) => {
  if (config.isProduction && !String(config.authPassword || "").trim()) {
    throw new Error("AUTH_PASSWORD es obligatoria en produccion.");
  }
};
