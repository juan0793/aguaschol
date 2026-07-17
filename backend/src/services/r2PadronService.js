import {
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { promisify } from "node:util";
import { gzip, gunzip } from "node:zlib";
import { env } from "../config/env.js";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export const ACTIVE_PADRON_KEY = "padron/activo/padron-maestro.json.gz";
export const HISTORICAL_PADRON_PREFIX = "padron/historico/";

const fail = (message, status = 503) => Object.assign(new Error(message), { status });
const cleanCode = (value = "PADRON") => String(value || "PADRON").trim().replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80) || "PADRON";
const cleanDate = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw fail("Fecha historica de R2 invalida.", 400);
  return date.toISOString().replace(/[:.]/g, "-");
};

export const buildHistoricalPadronKey = (codigoLote, date = new Date()) =>
  `${HISTORICAL_PADRON_PREFIX}${cleanDate(date)}-${cleanCode(codigoLote)}.json.gz`;

export const validatePadronRecords = (records, expectedTotal = null) => {
  if (!Array.isArray(records) || !records.length) throw fail("El snapshot del padron esta vacio o no es JSON valido.", 409);
  if (expectedTotal != null && records.length !== Number(expectedTotal)) {
    throw fail(`El snapshot del padron esta incompleto: se esperaban ${expectedTotal} registros y contiene ${records.length}.`, 409);
  }
  return records;
};

export const compressPadronRecords = async (records) =>
  gzipAsync(Buffer.from(JSON.stringify(validatePadronRecords(records)), "utf8"));

export const decompressPadronRecords = async (buffer, expectedTotal = null) => {
  let parsed;
  try {
    parsed = JSON.parse((await gunzipAsync(Buffer.from(buffer))).toString("utf8"));
  } catch {
    throw fail("El objeto R2 no contiene un padron gzip/JSON valido.", 409);
  }
  return validatePadronRecords(parsed, expectedTotal);
};

const bodyToBuffer = async (body) => {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body?.transformToByteArray === "function") return Buffer.from(await body.transformToByteArray());
  if (body?.[Symbol.asyncIterator]) {
    const chunks = [];
    for await (const chunk of body) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
  throw fail("R2 devolvio un cuerpo de objeto no compatible.");
};

export const createR2PadronService = ({ config = env, client = null } = {}) => {
  const configured = Boolean(
    config.r2AccessKeyId && config.r2SecretAccessKey && config.r2Endpoint && config.r2Bucket
  );
  let s3 = client;

  const ensureConfigured = () => {
    if (!configured) throw fail("Cloudflare R2 no esta configurado.");
    if (!s3) {
      s3 = new S3Client({
        region: config.r2Region || "auto",
        endpoint: config.r2Endpoint,
        credentials: { accessKeyId: config.r2AccessKeyId, secretAccessKey: config.r2SecretAccessKey }
      });
    }
    return s3;
  };

  const upload = async (key, records, codigoLote = "") => {
    const compressed = await compressPadronRecords(records);
    const result = await ensureConfigured().send(new PutObjectCommand({
      Bucket: config.r2Bucket,
      Key: key,
      Body: compressed,
      ContentType: "application/json",
      ContentEncoding: "gzip",
      Metadata: { "total-registros": String(records.length), "codigo-lote": cleanCode(codigoLote) }
    }));
    return { key, etag: String(result.ETag || "").replaceAll('"', ""), total_records: records.length, compressed_bytes: compressed.length };
  };

  const download = async (key, expectedTotal = null) => {
    const result = await ensureConfigured().send(new GetObjectCommand({ Bucket: config.r2Bucket, Key: key }));
    const metadataTotal = Number(result.Metadata?.["total-registros"] || 0) || null;
    if (expectedTotal == null && metadataTotal == null) throw fail("El objeto R2 no declara la cantidad esperada de registros.", 409);
    const records = await decompressPadronRecords(await bodyToBuffer(result.Body), expectedTotal ?? metadataTotal);
    return {
      key,
      etag: String(result.ETag || "").replaceAll('"', ""),
      codigo_lote: result.Metadata?.["codigo-lote"] || "",
      total_records: records.length,
      records
    };
  };

  const uploadAndVerify = async (key, records, codigoLote) => {
    const uploaded = await upload(key, records, codigoLote);
    const verified = await download(key, records.length);
    return { ...uploaded, etag: verified.etag || uploaded.etag, verified_at: new Date().toISOString() };
  };

  return {
    configured,
    checkConnection: async () => {
      await ensureConfigured().send(new HeadBucketCommand({ Bucket: config.r2Bucket }));
      return { ok: true, configured: true, checked_at: new Date().toISOString() };
    },
    loadActive: (expectedTotal = null) => download(ACTIVE_PADRON_KEY, expectedTotal),
    loadHistorical: (key, expectedTotal = null) => {
      if (!String(key || "").startsWith(HISTORICAL_PADRON_PREFIX)) throw fail("La clave historica de R2 no es valida.", 400);
      return download(key, expectedTotal);
    },
    uploadActive: (records, codigoLote) => uploadAndVerify(ACTIVE_PADRON_KEY, records, codigoLote),
    uploadVersions: async (records, codigoLote, date = new Date()) => {
      validatePadronRecords(records);
      const historical = await uploadAndVerify(buildHistoricalPadronKey(codigoLote, date), records, codigoLote);
      const active = await uploadAndVerify(ACTIVE_PADRON_KEY, records, codigoLote);
      return { historical, active, total_records: records.length };
    },
    getActiveStatus: async () => {
      const result = await ensureConfigured().send(new HeadObjectCommand({ Bucket: config.r2Bucket, Key: ACTIVE_PADRON_KEY }));
      const totalRecords = Number(result.Metadata?.["total-registros"] || 0);
      if (!totalRecords) throw fail("El padron activo de R2 no tiene un conteo valido.", 409);
      return {
        exists: true,
        key: ACTIVE_PADRON_KEY,
        etag: String(result.ETag || "").replaceAll('"', ""),
        total_records: totalRecords,
        last_modified: result.LastModified || null,
        size: Number(result.ContentLength || 0)
      };
    },
    getHistoricalStatus: async (key) => {
      if (!String(key || "").startsWith(HISTORICAL_PADRON_PREFIX)) throw fail("La clave historica de R2 no es valida.", 400);
      const result = await ensureConfigured().send(new HeadObjectCommand({ Bucket: config.r2Bucket, Key: key }));
      const totalRecords = Number(result.Metadata?.["total-registros"] || 0);
      if (!totalRecords) throw fail("La version historica de R2 no tiene un conteo valido.", 409);
      return { key, total_records: totalRecords, etag: String(result.ETag || "").replaceAll('"', "") };
    },
    listHistorical: async (limit = 50) => {
      const objects = [];
      let continuationToken;
      do {
        const result = await ensureConfigured().send(new ListObjectsV2Command({
          Bucket: config.r2Bucket,
          Prefix: HISTORICAL_PADRON_PREFIX,
          MaxKeys: 1000,
          ContinuationToken: continuationToken
        }));
        objects.push(...(result.Contents || []));
        continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
      } while (continuationToken);
      return objects
        .sort((left, right) => String(right.Key).localeCompare(String(left.Key)))
        .slice(0, Math.min(Math.max(Number(limit) || 50, 1), 100))
        .map((item) => ({ key: item.Key, size: Number(item.Size || 0), last_modified: item.LastModified || null }));
    }
  };
};

export const r2PadronService = createR2PadronService();
