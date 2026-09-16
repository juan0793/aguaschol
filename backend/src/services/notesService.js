import { env } from "../config/env.js";
import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";

// Apuntes: tablero personal del administrador. Todas las consultas se filtran por el
// user_id del usuario autenticado; una nota ajena responde 404 para no confirmar que existe.

export const NOTE_COLORS = ["default", "azul", "crema", "verde", "violeta", "gris"];
export const NOTE_SORTS = ["manual", "updated", "created"];
export const NOTE_LINK_TARGETS = ["inspeccion"];

const SORT_STEP = 1000;
// Por debajo de esta distancia entre vecinos se renumera la lista del usuario.
const MIN_GAP = 0.0000001;
const PURGE_AFTER_DAYS = 30;
const PAGE_DEFAULT = 40;
const PAGE_MAX = 100;
const TITLE_MAX = 200;
const CONTENT_MAX = 20000;
const CATEGORY_MAX = 60;

const fail = (message, status = 400, body) => Object.assign(new Error(message), { status, body });
const clean = (value) => String(value ?? "").trim();
const toIso = (value) => (value ? new Date(value).toISOString() : null);

// --- Almacen en memoria (USE_MEMORY_DB=true / pruebas) -----------------------------------
let memoryId = 1;
let memoryLinkId = 1;
const memoryNotes = [];
const memoryLinks = [];
let memoryWrites = 0;

export const __resetNotesMemoryForTests = () => {
  memoryNotes.length = 0;
  memoryLinks.length = 0;
  memoryId = 1;
  memoryLinkId = 1;
  memoryWrites = 0;
};
export const __notesMemoryWrites = () => memoryWrites;
export const __setNoteDeletedAtForTests = (id, value) => {
  const note = memoryNotes.find((item) => item.id === Number(id));
  if (note) note.deleted_at = value;
};

const nowIso = () => new Date().toISOString();
const fold = (value) => String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// --- Normalizacion ---------------------------------------------------------------------------

const normalizeContent = (value) => {
  const content = String(value ?? "").replace(/\r\n?/g, "\n");
  if (!content.trim()) throw fail("Escribe el contenido del apunte.");
  if (content.length > CONTENT_MAX) throw fail(`El apunte supera ${CONTENT_MAX} caracteres.`, 413);
  return content;
};

const normalizeTitle = (value) => {
  const title = clean(value).replace(/\s+/g, " ");
  if (title.length > TITLE_MAX) throw fail(`El título supera ${TITLE_MAX} caracteres.`);
  return title || null;
};

const normalizeColor = (value) => {
  const color = clean(value) || "default";
  if (!NOTE_COLORS.includes(color)) throw fail("Color no válido.");
  return color;
};

const mapLink = (row) => ({
  id: Number(row.id),
  target_type: row.target_type,
  target_id: String(row.target_id),
  target_label: row.target_label || "",
  created_at: toIso(row.created_at)
});

const mapNote = (row, links = []) => ({
  id: Number(row.id),
  title: row.title || "",
  content: row.content,
  color: row.color || "default",
  category: row.category || "",
  is_pinned: Boolean(Number(row.is_pinned)),
  is_archived: Boolean(Number(row.is_archived)),
  sort_order: Number(row.sort_order),
  deleted_at: toIso(row.deleted_at),
  created_at: toIso(row.created_at),
  updated_at: toIso(row.updated_at),
  links: links.map(mapLink)
});

const audit = async (user, action, noteId, summary, details = null) => {
  if (env.useMemoryDb) return;
  try {
    await createAuditLog({ actorUserId: user.id, action, entityType: "admin_note", entityId: noteId, summary, details });
  } catch {
    // La auditoria no debe bloquear una operacion del tablero.
  }
};

// --- Acceso a datos --------------------------------------------------------------------------

const loadLinks = async (noteIds) => {
  if (!noteIds.length) return new Map();
  const rows = env.useMemoryDb
    ? memoryLinks.filter((link) => noteIds.includes(link.note_id))
    : (await getPool().query("SELECT * FROM note_links WHERE note_id IN (?) ORDER BY created_at ASC, id ASC", [noteIds]))[0];
  const byNote = new Map();
  for (const row of rows) {
    const key = Number(row.note_id);
    byNote.set(key, [...(byNote.get(key) || []), row]);
  }
  return byNote;
};

const withLinks = async (rows) => {
  const links = await loadLinks(rows.map((row) => Number(row.id)));
  return rows.map((row) => mapNote(row, links.get(Number(row.id)) || []));
};

// Devuelve la fila cruda de una nota propia. Una nota ajena, inexistente o borrada (salvo
// includeDeleted) es 404.
const findOwnRow = async (user, id, { includeDeleted = false } = {}) => {
  const noteId = Number(id);
  if (!Number.isInteger(noteId) || noteId <= 0) throw fail("Apunte no encontrado.", 404);
  let row;
  if (env.useMemoryDb) {
    row = memoryNotes.find((note) => note.id === noteId && note.user_id === Number(user.id));
  } else {
    [[row]] = await getPool().query("SELECT * FROM admin_notes WHERE id = ? AND user_id = ? LIMIT 1", [noteId, user.id]);
  }
  if (!row || (row.deleted_at && !includeDeleted)) throw fail("Apunte no encontrado.", 404);
  return row;
};

const getOwnNote = async (user, id, options) => (await withLinks([await findOwnRow(user, id, options)]))[0];

const normalizeCategory = async (user, value) => {
  const category = clean(value).replace(/\s+/g, " ").slice(0, CATEGORY_MAX);
  if (!category) return null;
  // Reutiliza la escritura de una categoria existente ("proveedores" -> "Proveedores").
  let existing;
  if (env.useMemoryDb) {
    existing = memoryNotes.find((note) => note.user_id === Number(user.id) && !note.deleted_at && note.category && fold(note.category) === fold(category))?.category;
  } else {
    [[existing]] = await getPool().query(
      "SELECT category FROM admin_notes WHERE user_id = ? AND deleted_at IS NULL AND category = ? LIMIT 1",
      [user.id, category]
    );
    existing = existing?.category;
  }
  return existing || category;
};

const activeOrders = async (user) => {
  if (env.useMemoryDb) {
    return memoryNotes
      .filter((note) => note.user_id === Number(user.id) && !note.deleted_at)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
      .map((note) => ({ id: note.id, sort_order: note.sort_order }));
  }
  const [rows] = await getPool().query(
    "SELECT id, sort_order FROM admin_notes WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC, id ASC",
    [user.id]
  );
  return rows.map((row) => ({ id: Number(row.id), sort_order: Number(row.sort_order) }));
};

// Renumeracion de emergencia cuando dos vecinos quedan demasiado juntos. En la practica casi
// nunca ocurre: cada insercion al inicio o al final usa un paso de 1000.
const renumber = async (user) => {
  const ordered = await activeOrders(user);
  for (const [index, item] of ordered.entries()) {
    const value = (index + 1) * SORT_STEP;
    if (env.useMemoryDb) {
      memoryNotes.find((note) => note.id === item.id).sort_order = value;
    } else {
      await getPool().query("UPDATE admin_notes SET sort_order = ?, updated_at = updated_at WHERE id = ? AND user_id = ?", [value, item.id, user.id]);
    }
  }
};

const setSortOrder = async (user, id, value) => {
  if (env.useMemoryDb) {
    memoryWrites += 1;
    memoryNotes.find((note) => note.id === Number(id)).sort_order = value;
    return;
  }
  // updated_at = updated_at: reordenar no cuenta como edicion (no altera "Últimos editados"
  // ni invalida el updated_at que usa el autoguardado para detectar conflictos).
  await getPool().query("UPDATE admin_notes SET sort_order = ?, updated_at = updated_at WHERE id = ? AND user_id = ?", [value, id, user.id]);
};

// --- Listado ---------------------------------------------------------------------------------

const SORT_SQL = {
  manual: { column: "sort_order", direction: "ASC" },
  updated: { column: "updated_at", direction: "DESC" },
  created: { column: "created_at", direction: "DESC" }
};

const encodeCursor = (row, sort) => {
  const column = SORT_SQL[sort].column;
  const value = column === "sort_order" ? Number(row.sort_order) : toIso(row[column]);
  return Buffer.from(JSON.stringify({ v: value, id: Number(row.id), s: sort })).toString("base64url");
};

const decodeCursor = (cursor, sort) => {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(cursor), "base64url").toString("utf8"));
    if (parsed.s !== sort || !Number.isInteger(parsed.id)) throw new Error();
    return parsed;
  } catch {
    throw fail("Cursor no válido.");
  }
};

const compareMemory = (sort) => (a, b) => {
  if (sort === "manual") return a.sort_order - b.sort_order || a.id - b.id;
  const column = SORT_SQL[sort].column;
  return new Date(b[column]) - new Date(a[column]) || b.id - a.id;
};

const afterCursorMemory = (row, cursor, sort) => {
  if (!cursor) return true;
  if (sort === "manual") return row.sort_order > cursor.v || (row.sort_order === cursor.v && row.id > cursor.id);
  const column = SORT_SQL[sort].column;
  const value = new Date(row[column]).getTime();
  const pivot = new Date(cursor.v).getTime();
  return value < pivot || (value === pivot && row.id < cursor.id);
};

/**
 * Lista apuntes del usuario. Sin cursor, los fijados llegan completos (son pocos y encabezan
 * el tablero) y el resto se pagina por cursor sobre (columna de orden, id).
 */
export const listNotes = async (user, filters = {}) => {
  const q = clean(filters.q).slice(0, 120);
  const archived = ["1", "true", true].includes(filters.archived);
  const pinnedOnly = ["1", "true", true].includes(filters.pinned);
  const sort = NOTE_SORTS.includes(filters.sort) ? filters.sort : "manual";
  const limit = Math.min(Math.max(Number(filters.limit) || PAGE_DEFAULT, 1), PAGE_MAX);
  const cursor = decodeCursor(filters.cursor, sort);

  let pinnedRows = [];
  let pageRows = [];

  if (env.useMemoryDb) {
    const needle = fold(q);
    const base = memoryNotes.filter((note) => {
      if (note.user_id !== Number(user.id) || note.deleted_at) return false;
      if (Boolean(note.is_archived) !== archived) return false;
      if (needle && ![note.title, note.content, note.category].some((field) => fold(field).includes(needle))) return false;
      return true;
    });
    const ordered = [...base].sort(compareMemory(sort));
    if (!archived && !cursor) pinnedRows = ordered.filter((note) => note.is_pinned);
    if (!pinnedOnly) pageRows = ordered.filter((note) => !note.is_pinned && afterCursorMemory(note, cursor, sort)).slice(0, limit + 1);
  } else {
    const where = ["user_id = ?", "deleted_at IS NULL", "is_archived = ?"];
    const params = [user.id, archived ? 1 : 0];
    if (q) {
      const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
      where.push("(title LIKE ? OR content LIKE ? OR category LIKE ?)");
      params.push(like, like, like);
    }
    const { column, direction } = SORT_SQL[sort];
    const orderBy = `ORDER BY ${column} ${direction}, id ${direction}`;
    const pool = getPool();
    if (!archived && !cursor) {
      [pinnedRows] = await pool.query(`SELECT * FROM admin_notes WHERE ${where.join(" AND ")} AND is_pinned = 1 ${orderBy}`, params);
    }
    if (!pinnedOnly) {
      const pageWhere = [...where, "is_pinned = 0"];
      const pageParams = [...params];
      if (cursor) {
        const op = direction === "ASC" ? ">" : "<";
        pageWhere.push(`(${column} ${op} ? OR (${column} = ? AND id ${op} ?))`);
        const value = column === "sort_order" ? cursor.v : new Date(cursor.v);
        pageParams.push(value, value, cursor.id);
      }
      [pageRows] = await pool.query(`SELECT * FROM admin_notes WHERE ${pageWhere.join(" AND ")} ${orderBy} LIMIT ?`, [...pageParams, limit + 1]);
    }
  }

  const hasMore = pageRows.length > limit;
  const page = pageRows.slice(0, limit);
  const items = await withLinks([...pinnedRows, ...page]);
  return {
    items,
    next_cursor: hasMore ? encodeCursor(page[page.length - 1], sort) : null,
    sort,
    q
  };
};

export const getNote = (user, id) => getOwnNote(user, id);

export const listCategories = async (user) => {
  if (env.useMemoryDb) {
    const counts = new Map();
    memoryNotes
      .filter((note) => note.user_id === Number(user.id) && !note.deleted_at && note.category)
      .forEach((note) => counts.set(note.category, (counts.get(note.category) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es")).map(([name]) => name).slice(0, 50);
  }
  const [rows] = await getPool().query(
    `SELECT category, COUNT(*) AS total FROM admin_notes
     WHERE user_id = ? AND deleted_at IS NULL AND category IS NOT NULL AND category <> ''
     GROUP BY category ORDER BY total DESC, category ASC LIMIT 50`,
    [user.id]
  );
  return rows.map((row) => row.category);
};

// --- Mutaciones ------------------------------------------------------------------------------

export const createNote = async (user, payload = {}) => {
  const content = normalizeContent(payload.content);
  const title = normalizeTitle(payload.title);
  const color = normalizeColor(payload.color);
  const category = await normalizeCategory(user, payload.category);
  // Una nota nueva va al inicio de su seccion.
  const orders = await activeOrders(user);
  const sortOrder = orders.length ? orders[0].sort_order - SORT_STEP : 0;

  let id;
  if (env.useMemoryDb) {
    const now = nowIso();
    id = memoryId++;
    memoryNotes.push({ id, user_id: Number(user.id), title, content, color, category, is_pinned: 0, is_archived: 0, sort_order: sortOrder, deleted_at: null, created_at: now, updated_at: now });
  } else {
    const [result] = await getPool().query(
      "INSERT INTO admin_notes (user_id, title, content, color, category, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
      [user.id, title, content, color, category, sortOrder]
    );
    id = result.insertId;
  }
  await audit(user, "note.created", id, "Apunte creado");
  return getOwnNote(user, id);
};

const TEXT_FIELDS = ["title", "content", "color", "category"];

/**
 * Edita texto, color, categoria, pin o archivado. Si llega expected_updated_at y no coincide
 * con la fila, responde 409 con la version actual en vez de pisar el cambio.
 */
export const updateNote = async (user, id, payload = {}) => {
  const row = await findOwnRow(user, id);
  const current = mapNote(row);
  if (payload.expected_updated_at && TEXT_FIELDS.some((field) => field in payload)) {
    const expected = new Date(payload.expected_updated_at).getTime();
    if (Number.isNaN(expected) || expected !== new Date(current.updated_at).getTime()) {
      throw fail("Este apunte cambió en otra pestaña.", 409, { note: (await withLinks([row]))[0] });
    }
  }

  const patch = {};
  if ("content" in payload) patch.content = normalizeContent(payload.content);
  if ("title" in payload) patch.title = normalizeTitle(payload.title);
  if ("color" in payload) patch.color = normalizeColor(payload.color);
  if ("category" in payload) patch.category = await normalizeCategory(user, payload.category);
  if ("is_pinned" in payload) patch.is_pinned = payload.is_pinned ? 1 : 0;
  if ("is_archived" in payload) {
    patch.is_archived = payload.is_archived ? 1 : 0;
    // Archivar desfija; restaurar desde Archivados no recupera el pin.
    if (patch.is_archived) patch.is_pinned = 0;
  }
  if (!Object.keys(patch).length) return getOwnNote(user, id);

  const isEdit = TEXT_FIELDS.some((field) => field in patch);
  if (env.useMemoryDb) {
    memoryWrites += 1;
    Object.assign(row, patch, isEdit ? { updated_at: nowIso() } : {});
  } else {
    const columns = Object.keys(patch);
    const sets = columns.map((column) => `${column} = ?`);
    // Fijar y archivar organizan, no editan: no alteran "Últimos editados" ni el control de
    // conflictos del autoguardado.
    if (!isEdit) sets.push("updated_at = updated_at");
    await getPool().query(`UPDATE admin_notes SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`, [...columns.map((column) => patch[column]), row.id, user.id]);
  }
  if ("is_archived" in patch) await audit(user, patch.is_archived ? "note.archived" : "note.unarchived", row.id, patch.is_archived ? "Apunte archivado" : "Apunte restaurado del archivo");
  return getOwnNote(user, id);
};

/**
 * Reubica una nota entre dos vecinos: before_id queda antes y after_id despues. Calcula el
 * punto medio y actualiza una sola fila. Si un vecino ya no existe o el orden recibido no
 * coincide con el guardado, responde 409 con la posicion real para que el cliente se reconcilie.
 */
export const moveNote = async (user, id, payload = {}) => {
  const row = await findOwnRow(user, id);
  const beforeId = payload.before_id == null || payload.before_id === "" ? null : Number(payload.before_id);
  const afterId = payload.after_id == null || payload.after_id === "" ? null : Number(payload.after_id);
  if (beforeId === row.id || afterId === row.id) throw fail("Un apunte no puede ser su propio vecino.");

  const conflict = async () => fail("El tablero cambió; se recargó el orden.", 409, { note: (await withLinks([await findOwnRow(user, id)]))[0] });
  const neighbor = async (neighborId) => {
    if (neighborId == null) return null;
    try {
      return await findOwnRow(user, neighborId);
    } catch {
      throw await conflict();
    }
  };

  let before = await neighbor(beforeId);
  let after = await neighbor(afterId);
  if (!before && !after) return getOwnNote(user, id);
  if (before && after && !(Number(before.sort_order) < Number(after.sort_order))) throw await conflict();

  // Con un solo vecino (inicio o final de lo que el cliente tiene cargado) se busca el vecino
  // real en la secuencia completa: con paginacion, "final de la lista cargada" no es el final
  // del tablero y sumar un paso fijo saltaria por encima de notas no cargadas.
  if (!before || !after) {
    const others = (await activeOrders(user)).filter((item) => item.id !== Number(row.id));
    if (before && !after) {
      const next = others.find((item) => item.sort_order > Number(before.sort_order));
      if (next) after = await findOwnRow(user, next.id);
    } else if (after && !before) {
      const previous = others.filter((item) => item.sort_order < Number(after.sort_order)).pop();
      if (previous) before = await findOwnRow(user, previous.id);
    }
  }

  if (before && after && Number(after.sort_order) - Number(before.sort_order) < MIN_GAP * 2) {
    await renumber(user);
    before = await findOwnRow(user, before.id);
    after = await findOwnRow(user, after.id);
  }

  const value = before && after
    ? (Number(before.sort_order) + Number(after.sort_order)) / 2
    : before ? Number(before.sort_order) + SORT_STEP : Number(after.sort_order) - SORT_STEP;
  await setSortOrder(user, row.id, value);
  return getOwnNote(user, id);
};

/** Copia independiente, sin pin y activa, inmediatamente despues del original. */
export const duplicateNote = async (user, id) => {
  const source = await findOwnRow(user, id);
  const orders = await activeOrders(user);
  const index = orders.findIndex((item) => item.id === Number(source.id));
  let next = orders[index + 1];
  if (next && next.sort_order - Number(source.sort_order) < MIN_GAP * 2) {
    await renumber(user);
    const fresh = await activeOrders(user);
    next = fresh[fresh.findIndex((item) => item.id === Number(source.id)) + 1];
    source.sort_order = fresh.find((item) => item.id === Number(source.id)).sort_order;
  }
  const sortOrder = next ? (Number(source.sort_order) + next.sort_order) / 2 : Number(source.sort_order) + SORT_STEP;

  let newId;
  if (env.useMemoryDb) {
    const now = nowIso();
    newId = memoryId++;
    memoryNotes.push({ ...source, id: newId, is_pinned: 0, is_archived: 0, sort_order: sortOrder, deleted_at: null, created_at: now, updated_at: now });
  } else {
    const [result] = await getPool().query(
      "INSERT INTO admin_notes (user_id, title, content, color, category, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
      [user.id, source.title, source.content, source.color, source.category, sortOrder]
    );
    newId = result.insertId;
  }
  await audit(user, "note.duplicated", newId, "Apunte duplicado", { source_id: Number(source.id) });
  return getOwnNote(user, newId);
};

/** Borrado logico: la nota se puede recuperar con restore hasta la purga (30 dias). */
export const deleteNote = async (user, id) => {
  const row = await findOwnRow(user, id);
  if (env.useMemoryDb) {
    memoryWrites += 1;
    row.deleted_at = nowIso();
  } else {
    await getPool().query("UPDATE admin_notes SET deleted_at = CURRENT_TIMESTAMP, updated_at = updated_at WHERE id = ? AND user_id = ?", [row.id, user.id]);
  }
  await audit(user, "note.deleted", row.id, "Apunte eliminado");
  return { id: Number(row.id), deleted: true };
};

/** Deshace un borrado. La nota vuelve con su sort_order intacto (y archivada si lo estaba). */
export const restoreNote = async (user, id) => {
  const row = await findOwnRow(user, id, { includeDeleted: true });
  if (row.deleted_at) {
    if (env.useMemoryDb) {
      memoryWrites += 1;
      row.deleted_at = null;
    } else {
      await getPool().query("UPDATE admin_notes SET deleted_at = NULL, updated_at = updated_at WHERE id = ? AND user_id = ?", [row.id, user.id]);
    }
    await audit(user, "note.restored", row.id, "Apunte recuperado");
  }
  return getOwnNote(user, id);
};

const resolveLinkTarget = async (targetType, targetId, payload) => {
  if (targetType === "inspeccion") {
    if (env.useMemoryDb) return clean(payload.target_label) || `#${targetId}`;
    const [[inspeccion]] = await getPool().query("SELECT numero_inspeccion FROM inspecciones WHERE id = ? LIMIT 1", [targetId]);
    if (!inspeccion) throw fail("La inspección indicada no existe.", 404);
    return inspeccion.numero_inspeccion;
  }
  throw fail("Destino no válido.");
};

/** Registra un envio de "Enviar a...". Cada envio es una fila nueva; ninguno pisa al anterior. */
export const addNoteLink = async (user, id, payload = {}) => {
  const row = await findOwnRow(user, id);
  const targetType = clean(payload.target_type);
  const targetId = clean(payload.target_id).slice(0, 64);
  if (!NOTE_LINK_TARGETS.includes(targetType)) throw fail("Destino no válido.");
  if (!targetId) throw fail("Falta el elemento creado en el destino.");
  const label = (await resolveLinkTarget(targetType, targetId, payload)).slice(0, 120);

  if (env.useMemoryDb) {
    memoryLinks.push({ id: memoryLinkId++, note_id: Number(row.id), target_type: targetType, target_id: targetId, target_label: label, created_at: nowIso() });
  } else {
    await getPool().query(
      "INSERT INTO note_links (note_id, target_type, target_id, target_label) VALUES (?, ?, ?, ?)",
      [row.id, targetType, targetId, label]
    );
  }
  await audit(user, "note.linked", row.id, `Apunte enviado a ${targetType} ${label}`, { target_type: targetType, target_id: targetId });
  return getOwnNote(user, id);
};

// --- Purga ---------------------------------------------------------------------------------

export const purgeDeletedNotes = async (now = new Date()) => {
  const limit = new Date(now.getTime() - PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000);
  if (env.useMemoryDb) {
    const doomed = memoryNotes.filter((note) => note.deleted_at && new Date(note.deleted_at) < limit).map((note) => note.id);
    for (const noteId of doomed) {
      memoryNotes.splice(memoryNotes.findIndex((note) => note.id === noteId), 1);
      for (let index = memoryLinks.length - 1; index >= 0; index -= 1) {
        if (memoryLinks[index].note_id === noteId) memoryLinks.splice(index, 1);
      }
    }
    return doomed.length;
  }
  const [result] = await getPool().query("DELETE FROM admin_notes WHERE deleted_at IS NOT NULL AND deleted_at < ?", [limit]);
  return result.affectedRows;
};

export const startNotesPurge = () => {
  const run = () => purgeDeletedNotes().catch(() => {
    // Base aun no disponible o caida momentanea: se reintenta en el siguiente ciclo.
  });
  const first = setTimeout(run, 60_000);
  const timer = setInterval(run, 6 * 60 * 60 * 1000);
  first.unref?.();
  timer.unref?.();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
};
