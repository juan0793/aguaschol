// Prueba contra MySQL real. Usa las credenciales del .env pero una base temporal propia que
// se crea y se borra al final; nunca toca la base configurada.
//   node --env-file=.env --test src/services/notes.integration.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

const database = `aguaschol_notes_test_${process.pid}`;
Object.assign(process.env, { DB_NAME: database, USE_MEMORY_DB: "false", DB_AUTO_START: "false", TELEGRAM_BOT_TOKEN: "" });
const db = await import("../config/db.js");
const notes = await import("./notesService.js");

test("MySQL real: listado, cursor, búsqueda, mover con un UPDATE, conflictos, vínculos y purga", async () => {
  let pool;
  try {
    await db.ensureDatabaseReady();
    pool = db.getPool();
    const [[adminRow]] = await pool.query("SELECT id FROM app_users WHERE username = 'admin'");
    const admin = { id: adminRow.id, role: "admin" };
    const [otro] = await pool.query("INSERT INTO app_users (username, full_name, email, role, password_hash, is_active) VALUES ('otro_admin_qa', 'Otro', 'otro@example.test', 'admin', 'qa', 1)");
    const otroAdmin = { id: otro.insertId, role: "admin" };

    const c = await notes.createNote(admin, { content: "C" });
    const b = await notes.createNote(admin, { content: "B", category: "Compras" });
    const a = await notes.createNote(admin, { title: "Portón", content: "A 9988-4455" });
    const contents = async (filters) => (await notes.listNotes(admin, filters)).items.map((note) => note.content);
    assert.deepEqual(await contents(), ["A 9988-4455", "B", "C"]);
    await assert.rejects(() => notes.getNote(otroAdmin, a.id), { status: 404 });

    // Un movimiento = exactamente un UPDATE sobre admin_notes.
    const original = pool.query.bind(pool);
    const updates = [];
    pool.query = (sql, ...rest) => {
      if (/^\s*UPDATE\s+admin_notes/i.test(sql)) updates.push(sql);
      return original(sql, ...rest);
    };
    try {
      await notes.moveNote(admin, c.id, { before_id: a.id, after_id: b.id });
    } finally {
      pool.query = original;
    }
    assert.equal(updates.length, 1);
    assert.deepEqual(await contents(), ["A 9988-4455", "C", "B"]);
    await notes.moveNote(admin, b.id, { after_id: a.id });
    assert.deepEqual(await contents(), ["B", "A 9988-4455", "C"]);
    await assert.rejects(() => notes.moveNote(admin, c.id, { before_id: 999999 }), { status: 409 });

    // Fijar no toca sort_order ni updated_at; editar con updated_at viejo es 409.
    const pinned = await notes.updateNote(admin, c.id, { is_pinned: true });
    assert.equal(pinned.updated_at, c.updated_at);
    assert.deepEqual(await contents(), ["C", "B", "A 9988-4455"]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const edited = await notes.updateNote(admin, c.id, { content: "C editada", expected_updated_at: c.updated_at });
    assert.notEqual(edited.updated_at, c.updated_at);
    await assert.rejects(() => notes.updateNote(admin, c.id, { content: "vieja", expected_updated_at: c.updated_at }), { status: 409 });
    assert.equal((await notes.updateNote(admin, c.id, { is_archived: true })).is_pinned, false);

    // Búsqueda en servidor sin tildes y paginación por cursor sin repetidos.
    for (let index = 0; index < 45; index += 1) await notes.createNote(admin, { content: `Relleno ${index}` });
    assert.deepEqual((await notes.listNotes(admin, { q: "porton" })).items.map((note) => note.id), [a.id]);
    assert.deepEqual((await notes.listNotes(admin, { q: "compras" })).items.map((note) => note.id), [b.id]);
    assert.equal((await notes.listNotes(admin, { q: "50%" })).items.length, 0, "los comodines se escapan");
    for (const sort of ["manual", "updated", "created"]) {
      const seen = new Set();
      let cursor = null;
      do {
        const page = await notes.listNotes(admin, { limit: 20, cursor, sort });
        page.items.forEach((note) => {
          assert.equal(seen.has(note.id), false, `${sort}: repetido`);
          seen.add(note.id);
        });
        cursor = page.next_cursor;
      } while (cursor);
      assert.equal(seen.size, 47, sort);
    }

    // Duplicar, borrar, restaurar, vincular y purgar.
    const copy = await notes.duplicateNote(admin, a.id);
    const ordered = (await notes.listNotes(admin, { limit: 100 })).items.map((note) => note.id);
    assert.equal(ordered.indexOf(copy.id), ordered.indexOf(a.id) + 1);
    await notes.deleteNote(admin, copy.id);
    assert.equal((await notes.restoreNote(admin, copy.id)).sort_order, copy.sort_order);

    const [inspeccion] = await pool.query(
      "INSERT INTO inspecciones (numero_inspeccion, trabajo_solicitado, fecha_asignacion) VALUES ('INS-QA-00001', 'QA', NOW())"
    );
    await notes.addNoteLink(admin, a.id, { target_type: "inspeccion", target_id: String(inspeccion.insertId) });
    const linked = await notes.addNoteLink(admin, a.id, { target_type: "inspeccion", target_id: String(inspeccion.insertId) });
    assert.deepEqual(linked.links.map((link) => link.target_label), ["INS-QA-00001", "INS-QA-00001"]);
    const [[linkCount]] = await pool.query("SELECT COUNT(*) AS total FROM note_links WHERE note_id = ?", [a.id]);
    assert.equal(Number(linkCount.total), 2);

    await notes.deleteNote(admin, a.id);
    await pool.query("UPDATE admin_notes SET deleted_at = DATE_SUB(NOW(), INTERVAL 31 DAY) WHERE id = ?", [a.id]);
    assert.equal(await notes.purgeDeletedNotes(), 1);
    const [[linksAfter]] = await pool.query("SELECT COUNT(*) AS total FROM note_links WHERE note_id = ?", [a.id]);
    assert.equal(Number(linksAfter.total), 0, "los vínculos se borran en cascada");
  } finally {
    if (pool) await pool.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await pool?.end();
  }
});
