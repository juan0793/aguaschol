import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";

const memory = {
  barrios: [],
  asignaciones: [],
  versiones: [],
  elementos: [],
  observaciones: []
};
let nextId = 1;
let memorySeeded = false;
const planosManifestPath = path.resolve(env.dbRoot, "backend", "data", "planos-manifest.json");

const CROQUIS_STATES = new Set(["pendiente", "asignado", "en_edicion", "borrador", "enviado_revision", "devuelto", "aprobado", "publicado"]);
const REVIEW_STATES = new Set(["pendiente_revision", "aprobado", "devuelto", "publicado"]);
const ELEMENT_TYPES = new Set(["linea", "poligono", "texto", "codigo", "punto", "tapado", "foto", "observacion"]);

const fail = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};

const isAdmin = (user) => user?.role === "admin";
const normalizeText = (value, fallback = "") => String(value ?? fallback).trim();
const normalizeState = (value, fallback = "pendiente") => {
  const state = normalizeText(value, fallback);
  return CROQUIS_STATES.has(state) ? state : fallback;
};
const normalizeReviewState = (value, fallback = "pendiente_revision") => {
  const state = normalizeText(value, fallback);
  return REVIEW_STATES.has(state) ? state : fallback;
};
const safeJson = (value, fallback = {}) => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value && typeof value === "object" ? value : fallback;
};

const normalizeElement = (element = {}, user = {}) => {
  const tipo = normalizeText(element.tipo_elemento || element.tipo || "texto");
  if (!ELEMENT_TYPES.has(tipo)) fail("Tipo de elemento no valido.");
  return {
    id: element.id ? Number(element.id) : undefined,
    tipo_elemento: tipo,
    data_json: safeJson(element.data_json || element.data || {}),
    estado: normalizeState(element.estado, "borrador"),
    tecnico_id: Number(element.tecnico_id || user.id || 0) || null
  };
};

const normalizeBarrio = (payload = {}, filePath = "") => {
  const codigo = normalizeText(payload.codigo_barrio || payload.codigo || payload.code);
  const nombre = normalizeText(payload.nombre_barrio || payload.nombre || payload.name);
  if (!codigo) fail("El codigo del barrio es obligatorio.");
  if (!nombre) fail("El nombre del barrio es obligatorio.");
  return {
    codigo_barrio: codigo,
    nombre_barrio: nombre,
    archivo_pdf: filePath || normalizeText(payload.archivo_pdf || payload.pdf_url || ""),
    estado: normalizeState(payload.estado, "pendiente")
  };
};

export const savePlanoPdf = async (file) => {
  if (!file?.buffer?.length) return "";
  if (file.mimetype && file.mimetype !== "application/pdf") fail("Solo se permiten planos en PDF.");
  await fs.mkdir(env.uploadDir, { recursive: true });
  const baseName = normalizeText(file.originalname, "plano")
    .replace(/\.pdf$/i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "plano";
  const fileName = `${Date.now()}-${baseName}.pdf`;
  await fs.writeFile(path.join(env.uploadDir, fileName), file.buffer);
  return `/uploads/${fileName}`;
};

const getLatestVersionMemory = (barrioId) =>
  [...memory.versiones]
    .filter((version) => Number(version.barrio_id) === Number(barrioId))
    .sort((a, b) => b.numero_version - a.numero_version)[0] || null;

const ensureDraftVersionMemory = (barrioId, user) => {
  const latest = getLatestVersionMemory(barrioId);
  if (latest && !["aprobado", "publicado"].includes(latest.estado)) return latest;
  const nextVersion = {
    id: nextId++,
    barrio_id: Number(barrioId),
    numero_version: latest ? Number(latest.numero_version) + 1 : 1,
    estado: "borrador",
    creado_por: user?.id || null,
    aprobado_por: null,
    observacion_revision: "",
    fecha_envio_revision: null,
    fecha_aprobacion: null,
    archivo_pdf_final: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  memory.versiones.push(nextVersion);
  return nextVersion;
};

const assertCanEditMemory = (barrioId, user) => {
  if (isAdmin(user)) return;
  const assigned = memory.asignaciones.some((item) => Number(item.barrio_id) === Number(barrioId) && Number(item.tecnico_id) === Number(user?.id));
  const draftOwner = memory.versiones.some((item) => Number(item.barrio_id) === Number(barrioId) && Number(item.creado_por) === Number(user?.id) && !["aprobado", "publicado"].includes(item.estado));
  if (!assigned && !draftOwner) fail("Solo puedes editar croquis asignados a tu usuario.", 403);
};

const mapVersionRow = (row = {}) => ({
  ...row,
  numero_version: Number(row.numero_version || 0)
});

const mapElementRow = (row = {}) => ({
  ...row,
  data_json: safeJson(row.data_json, {})
});

const seedMemoryPlanos = async () => {
  if (memorySeeded || memory.barrios.length) return;
  memorySeeded = true;

  try {
    const planos = JSON.parse(await fs.readFile(planosManifestPath, "utf8"));
    if (!Array.isArray(planos)) return;
    planos.forEach((item) => {
      const barrio = normalizeBarrio(item);
      memory.barrios.push({ id: nextId++, ...barrio, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    });
  } catch {
    // Sin manifiesto, el modulo queda listo para carga manual.
  }
};

export const listPlanosBarrios = async (user) => {
  if (env.useMemoryDb) {
    await seedMemoryPlanos();
    return memory.barrios.map((barrio) => {
      const version = getLatestVersionMemory(barrio.id);
      const asignacion = [...memory.asignaciones].reverse().find((item) => item.barrio_id === barrio.id);
      return { ...barrio, latest_version_id: version?.id || null, latest_version_estado: version?.estado || "", tecnico_asignado_id: asignacion?.tecnico_id || null };
    });
  }
  const [rows] = await getPool().query(
    `
      SELECT
        b.*,
        v.id AS latest_version_id,
        v.numero_version AS latest_version_number,
        v.estado AS latest_version_estado,
        a.tecnico_id AS tecnico_asignado_id,
        u.full_name AS tecnico_asignado_nombre
      FROM planos_barrios b
      LEFT JOIN planos_versiones v ON v.id = (
        SELECT pv.id FROM planos_versiones pv WHERE pv.barrio_id = b.id ORDER BY pv.numero_version DESC LIMIT 1
      )
      LEFT JOIN planos_asignaciones a ON a.id = (
        SELECT pa.id FROM planos_asignaciones pa WHERE pa.barrio_id = b.id ORDER BY pa.created_at DESC LIMIT 1
      )
      LEFT JOIN app_users u ON u.id = a.tecnico_id
      ORDER BY b.codigo_barrio, b.nombre_barrio
    `
  );
  return rows;
};

export const createPlanoBarrio = async (payload, filePath, user) => {
  if (!isAdmin(user)) fail("Solo administradores pueden crear barrios.", 403);
  const barrio = normalizeBarrio(payload, filePath);
  if (env.useMemoryDb) {
    const row = { id: nextId++, ...barrio, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    memory.barrios.push(row);
    return row;
  }
  const [result] = await getPool().query(
    `
      INSERT INTO planos_barrios (codigo_barrio, nombre_barrio, archivo_pdf, estado)
      VALUES (?, ?, ?, ?)
    `,
    [barrio.codigo_barrio, barrio.nombre_barrio, barrio.archivo_pdf, barrio.estado]
  );
  await createAuditLog({
    actorUserId: user.id,
    actorName: user.full_name || user.username || "",
    actorEmail: user.email || "",
    action: "plano.barrio_created",
    entityType: "planos_barrios",
    entityId: result.insertId,
    summary: `Barrio ${barrio.nombre_barrio} agregado a planos.`
  });
  return { id: result.insertId, ...barrio };
};

export const updatePlanoBarrio = async (id, payload, filePath, user) => {
  if (!isAdmin(user)) fail("Solo administradores pueden editar barrios.", 403);
  const current = (await listPlanosBarrios(user)).find((barrio) => Number(barrio.id) === Number(id));
  if (!current) fail("Barrio no encontrado.", 404);
  const next = normalizeBarrio({ ...current, ...payload, archivo_pdf: filePath || payload.archivo_pdf || current.archivo_pdf }, filePath || "");
  if (env.useMemoryDb) {
    const stored = memory.barrios.find((barrio) => Number(barrio.id) === Number(id));
    Object.assign(stored, next, { updated_at: new Date().toISOString() });
    return stored;
  }
  await getPool().query(
    `
      UPDATE planos_barrios
      SET codigo_barrio = ?, nombre_barrio = ?, archivo_pdf = ?, estado = ?
      WHERE id = ?
    `,
    [next.codigo_barrio, next.nombre_barrio, next.archivo_pdf, next.estado, id]
  );
  return { ...current, ...next };
};

export const assignPlanoBarrio = async (payload, user) => {
  if (!isAdmin(user)) fail("Solo administradores pueden asignar croquis.", 403);
  const barrioId = Number(payload.barrio_id);
  const tecnicoId = Number(payload.tecnico_id);
  if (!barrioId || !tecnicoId) fail("Barrio y tecnico son obligatorios.");
  const estado = normalizeState(payload.estado, "asignado");
  if (env.useMemoryDb) {
    const row = { id: nextId++, barrio_id: barrioId, tecnico_id: tecnicoId, asignado_por: user.id, estado, fecha_limite: payload.fecha_limite || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    memory.asignaciones.push(row);
    return row;
  }
  const [result] = await getPool().query(
    `
      INSERT INTO planos_asignaciones (barrio_id, tecnico_id, asignado_por, estado, fecha_limite)
      VALUES (?, ?, ?, ?, ?)
    `,
    [barrioId, tecnicoId, user.id, estado, payload.fecha_limite || null]
  );
  await getPool().query("UPDATE planos_barrios SET estado = 'asignado' WHERE id = ?", [barrioId]);
  return { id: result.insertId, barrio_id: barrioId, tecnico_id: tecnicoId, estado };
};

export const listMyPlanoAssignments = async (user) => {
  if (isAdmin(user)) return listPlanosBarrios(user);
  if (env.useMemoryDb) {
    const assignedIds = new Set(memory.asignaciones.filter((item) => Number(item.tecnico_id) === Number(user.id)).map((item) => item.barrio_id));
    return memory.barrios.filter((barrio) => assignedIds.has(barrio.id)).map((barrio) => {
      const version = getLatestVersionMemory(barrio.id);
      return { ...barrio, latest_version_id: version?.id || null, latest_version_estado: version?.estado || "" };
    });
  }
  const [rows] = await getPool().query(
    `
      SELECT
        b.*,
        a.estado AS asignacion_estado,
        a.fecha_limite,
        a.updated_at AS asignacion_updated_at,
        v.id AS latest_version_id,
        v.numero_version AS latest_version_number,
        v.estado AS latest_version_estado
      FROM planos_asignaciones a
      JOIN planos_barrios b ON b.id = a.barrio_id
      LEFT JOIN planos_versiones v ON v.id = (
        SELECT pv.id FROM planos_versiones pv WHERE pv.barrio_id = b.id ORDER BY pv.numero_version DESC LIMIT 1
      )
      WHERE a.tecnico_id = ?
      ORDER BY FIELD(COALESCE(v.estado, b.estado), 'borrador', 'en_edicion', 'devuelto', 'enviado_revision', 'asignado', 'pendiente', 'aprobado', 'publicado'), a.updated_at DESC
    `,
    [user.id]
  );
  return rows;
};

const ensureDraftVersion = async (barrioId, user) => {
  if (env.useMemoryDb) return ensureDraftVersionMemory(barrioId, user);
  const pool = getPool();
  const [[latest]] = await pool.query(
    "SELECT * FROM planos_versiones WHERE barrio_id = ? ORDER BY numero_version DESC LIMIT 1",
    [barrioId]
  );
  if (latest && !["aprobado", "publicado"].includes(latest.estado)) return mapVersionRow(latest);
  const nextNumber = latest ? Number(latest.numero_version) + 1 : 1;
  const [result] = await pool.query(
    "INSERT INTO planos_versiones (barrio_id, numero_version, estado, creado_por) VALUES (?, ?, 'borrador', ?)",
    [barrioId, nextNumber, user.id]
  );
  return { id: result.insertId, barrio_id: barrioId, numero_version: nextNumber, estado: "borrador", creado_por: user.id };
};

const assertCanEdit = async (barrioId, user) => {
  if (env.useMemoryDb) return assertCanEditMemory(barrioId, user);
  if (isAdmin(user)) return;
  const [[row]] = await getPool().query(
    `
      SELECT a.id
      FROM planos_asignaciones a
      WHERE a.barrio_id = ? AND a.tecnico_id = ?
      UNION
      SELECT v.id
      FROM planos_versiones v
      WHERE v.barrio_id = ? AND v.creado_por = ? AND v.estado NOT IN ('aprobado', 'publicado')
      LIMIT 1
    `,
    [barrioId, user.id, barrioId, user.id]
  );
  if (!row) fail("Solo puedes editar croquis asignados a tu usuario.", 403);
};

export const listPlanoElements = async (barrioId, user) => {
  if (env.useMemoryDb) {
    const version = getLatestVersionMemory(barrioId);
    const elements = version ? memory.elementos.filter((item) => item.version_id === version.id) : [];
    return { version, elements };
  }
  const [[version]] = await getPool().query(
    "SELECT * FROM planos_versiones WHERE barrio_id = ? ORDER BY numero_version DESC LIMIT 1",
    [barrioId]
  );
  if (!version) return { version: null, elements: [] };
  const [elements] = await getPool().query(
    "SELECT * FROM planos_elementos WHERE version_id = ? ORDER BY id ASC",
    [version.id]
  );
  return { version: mapVersionRow(version), elements: elements.map(mapElementRow) };
};

export const savePlanoDraft = async (barrioId, elements = [], user) => {
  await assertCanEdit(barrioId, user);
  const version = await ensureDraftVersion(barrioId, user);
  const normalized = elements.map((element) => normalizeElement(element, user));
  if (env.useMemoryDb) {
    memory.elementos = memory.elementos.filter((item) => item.version_id !== version.id);
    normalized.forEach((element) => memory.elementos.push({ ...element, id: nextId++, barrio_id: Number(barrioId), version_id: version.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }));
    version.estado = "borrador";
    return { version, elements: memory.elementos.filter((item) => item.version_id === version.id) };
  }
  const pool = getPool();
  await pool.query("DELETE FROM planos_elementos WHERE version_id = ?", [version.id]);
  for (const element of normalized) {
    await pool.query(
      `
        INSERT INTO planos_elementos (barrio_id, version_id, tecnico_id, tipo_elemento, data_json, estado)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [barrioId, version.id, element.tecnico_id || user.id, element.tipo_elemento, JSON.stringify(element.data_json), element.estado]
    );
  }
  await pool.query("UPDATE planos_versiones SET estado = 'borrador' WHERE id = ?", [version.id]);
  await pool.query("UPDATE planos_barrios SET estado = 'borrador' WHERE id = ?", [barrioId]);
  return listPlanoElements(barrioId, user);
};

export const createPlanoElement = async (barrioId, payload, user) => {
  await assertCanEdit(barrioId, user);
  const version = await ensureDraftVersion(barrioId, user);
  const element = normalizeElement(payload, user);
  if (env.useMemoryDb) {
    const row = { ...element, id: nextId++, barrio_id: Number(barrioId), version_id: version.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    memory.elementos.push(row);
    return row;
  }
  const [result] = await getPool().query(
    `
      INSERT INTO planos_elementos (barrio_id, version_id, tecnico_id, tipo_elemento, data_json, estado)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [barrioId, version.id, element.tecnico_id || user.id, element.tipo_elemento, JSON.stringify(element.data_json), element.estado]
  );
  return { id: result.insertId, barrio_id: Number(barrioId), version_id: version.id, ...element };
};

export const updatePlanoElement = async (id, payload, user) => {
  const element = normalizeElement({ ...payload, id }, user);
  if (env.useMemoryDb) {
    const row = memory.elementos.find((item) => Number(item.id) === Number(id));
    if (!row) fail("Elemento no encontrado.", 404);
    await assertCanEdit(row.barrio_id, user);
    Object.assign(row, element, { updated_at: new Date().toISOString() });
    return row;
  }
  const [[row]] = await getPool().query("SELECT * FROM planos_elementos WHERE id = ? LIMIT 1", [id]);
  if (!row) fail("Elemento no encontrado.", 404);
  await assertCanEdit(row.barrio_id, user);
  await getPool().query(
    "UPDATE planos_elementos SET tipo_elemento = ?, data_json = ?, estado = ? WHERE id = ?",
    [element.tipo_elemento, JSON.stringify(element.data_json), element.estado, id]
  );
  return { ...row, ...element };
};

export const deletePlanoElement = async (id, user) => {
  if (env.useMemoryDb) {
    const row = memory.elementos.find((item) => Number(item.id) === Number(id));
    if (!row) fail("Elemento no encontrado.", 404);
    await assertCanEdit(row.barrio_id, user);
    memory.elementos = memory.elementos.filter((item) => Number(item.id) !== Number(id));
    return row;
  }
  const [[row]] = await getPool().query("SELECT * FROM planos_elementos WHERE id = ? LIMIT 1", [id]);
  if (!row) fail("Elemento no encontrado.", 404);
  await assertCanEdit(row.barrio_id, user);
  await getPool().query("DELETE FROM planos_elementos WHERE id = ?", [id]);
  return mapElementRow(row);
};

export const sendPlanoToReview = async (barrioId, user) => {
  await assertCanEdit(barrioId, user);
  const current = await listPlanoElements(barrioId, user);
  if (!current.version || !current.elements.length) fail("No puedes enviar a revision un croquis sin cambios.");
  if (env.useMemoryDb) {
    current.version.estado = "enviado_revision";
    current.version.fecha_envio_revision = new Date().toISOString();
    return current.version;
  }
  await getPool().query(
    "UPDATE planos_versiones SET estado = 'enviado_revision', fecha_envio_revision = CURRENT_TIMESTAMP WHERE id = ?",
    [current.version.id]
  );
  await getPool().query("UPDATE planos_barrios SET estado = 'enviado_revision' WHERE id = ?", [barrioId]);
  return { ...current.version, estado: "enviado_revision" };
};

export const listPendingPlanoReviews = async (user) => {
  if (!isAdmin(user)) fail("Solo supervisores pueden revisar croquis.", 403);
  if (env.useMemoryDb) return memory.versiones.filter((version) => version.estado === "enviado_revision");
  const [rows] = await getPool().query(
    `
      SELECT v.*, b.codigo_barrio, b.nombre_barrio, b.archivo_pdf, u.full_name AS creado_por_nombre
      FROM planos_versiones v
      JOIN planos_barrios b ON b.id = v.barrio_id
      LEFT JOIN app_users u ON u.id = v.creado_por
      WHERE v.estado = 'enviado_revision'
      ORDER BY v.fecha_envio_revision DESC, v.updated_at DESC
    `
  );
  return rows.map(mapVersionRow);
};

export const reviewPlanoVersion = async (versionId, action, payload, user) => {
  if (!isAdmin(user)) fail("Solo supervisores pueden revisar croquis.", 403);
  const estado = normalizeReviewState(action === "aprobar" ? "aprobado" : action === "publicar" ? "publicado" : "devuelto");
  const observacion = normalizeText(payload.observacion || payload.observacion_revision || "");
  if (env.useMemoryDb) {
    const version = memory.versiones.find((item) => Number(item.id) === Number(versionId));
    if (!version) fail("Version no encontrada.", 404);
    if (estado === "publicado" && version.estado !== "aprobado") fail("Solo una version aprobada puede publicarse.");
    Object.assign(version, { estado, aprobado_por: user.id, observacion_revision: observacion, fecha_aprobacion: estado === "aprobado" ? new Date().toISOString() : version.fecha_aprobacion });
    memory.observaciones.push({ id: nextId++, version_id: version.id, supervisor_id: user.id, observacion, estado, created_at: new Date().toISOString() });
    return version;
  }
  const pool = getPool();
  const [[version]] = await pool.query("SELECT * FROM planos_versiones WHERE id = ? LIMIT 1", [versionId]);
  if (!version) fail("Version no encontrada.", 404);
  if (estado === "publicado" && version.estado !== "aprobado") fail("Solo una version aprobada puede publicarse.");
  await pool.query(
    `
      UPDATE planos_versiones
      SET estado = ?, aprobado_por = ?, observacion_revision = ?, fecha_aprobacion = CASE WHEN ? = 'aprobado' THEN CURRENT_TIMESTAMP ELSE fecha_aprobacion END
      WHERE id = ?
    `,
    [estado, user.id, observacion, estado, versionId]
  );
  await pool.query("UPDATE planos_barrios SET estado = ? WHERE id = ?", [estado, version.barrio_id]);
  await pool.query(
    "INSERT INTO planos_observaciones_revision (version_id, supervisor_id, observacion, estado) VALUES (?, ?, ?, ?)",
    [versionId, user.id, observacion, estado]
  );
  return { ...version, estado, observacion_revision: observacion };
};

export const listPlanoVersions = async (barrioId, user) => {
  if (env.useMemoryDb) return memory.versiones.filter((version) => !barrioId || Number(version.barrio_id) === Number(barrioId));
  const params = [];
  const where = barrioId ? "WHERE v.barrio_id = ?" : "";
  if (barrioId) params.push(barrioId);
  const [rows] = await getPool().query(
    `
      SELECT v.*, b.codigo_barrio, b.nombre_barrio, u.full_name AS creado_por_nombre
      FROM planos_versiones v
      JOIN planos_barrios b ON b.id = v.barrio_id
      LEFT JOIN app_users u ON u.id = v.creado_por
      ${where}
      ORDER BY v.created_at DESC
    `,
    params
  );
  return rows.map(mapVersionRow);
};
