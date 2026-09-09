// Base exclusiva de pruebas; nunca conecta a la base configurada en .env.
import test from "node:test";
import assert from "node:assert/strict";
import mysql from "mysql2/promise";

const database = `aguaschol_entregas_test_${process.pid}`;
Object.assign(process.env, {
  DB_HOST: "127.0.0.1", DB_PORT: process.env.ENTREGAS_TEST_PORT || "3317", DB_USER: "root",
  DB_PASSWORD: process.env.ENTREGAS_TEST_PASSWORD || "entregas-local-qa", DB_NAME: database,
  USE_MEMORY_DB: "false", DB_AUTO_START: "false", AUTH_PASSWORD: "entregas-local-qa",
  ENTREGAS_TIMEZONE: "America/Tegucigalpa", ENTREGAS_RECORDATORIO_HORA: "12:00",
  ENTREGAS_PREAVISO_HORA: "16:30", ENTREGAS_FIN_JORNADA: "17:00", TELEGRAM_BOT_TOKEN: ""
});
const db = await import("../config/db.js");
const service = await import("./entregasService.js");
const { enviarRecordatoriosEntregas, jornadaEntregas } = await import("./entregasReminderService.js");
const { addDays } = await import("./entregasRules.js");
const reports = await import("./entregasReportService.js");

test("MySQL real: permisos, cierre concurrente, correcciones, recordatorios y reportes", async () => {
  let pool;
  try {
    await db.ensureDatabaseReady();
    pool = db.getPool();
    const [[adminRow]] = await pool.query("SELECT id FROM app_users WHERE username = 'admin'");
    const admin = { id: adminRow.id, role: "admin", full_name: "Administrador QA" };
    const users = [];
    for (const [username, role] of [["tecnico_qa", "validadora_campo"], ["otro_qa", "transport"], ["gestor_qa", "operator"]]) {
      const [result] = await pool.query("INSERT INTO app_users (username, full_name, email, role, password_hash, is_active) VALUES (?, ?, ?, ?, 'qa', 1)", [username, username, `${username}@example.test`, role]);
      users.push({ id: result.insertId, role, full_name: username });
    }
    const [tecnico, otro, gestor] = users;
    const persona = await service.createPersonal({ nombre_completo: "María Hernández", tipo_personal: "TECNICO", user_id: tecnico.id, activo: true }, admin);
    await service.createPersonal({ nombre_completo: "José Martínez", tipo_personal: "TECNICO", user_id: otro.id, activo: true }, admin);
    await assert.rejects(service.createPersonal({ nombre_completo: "No permitido" }, gestor), { status: 403 });
    const hoy = jornadaEntregas().fecha;
    const lote = await service.createLote({ responsable_id: persona.id, fecha: hoy, barrio_nombre: "BO. EL CENTRO", tipo_documento: "FACTURA", total_asignadas: 10 }, admin);
    await assert.rejects(service.getLoteDetail(lote.id, otro), { status: 403 });
    assert.equal((await service.listLotes({}, otro)).total, 0);
    assert.equal((await service.getLoteDetail(lote.id, tecnico)).id, lote.id);
    assert.equal((await service.getResumen({ fecha_desde: hoy, fecha_hasta: hoy }, admin)).entregadas, 0);
    await assert.rejects(service.createLote({ ...lote, total_asignadas: 2.5 }, admin));
    await assert.rejects(service.updateLote(lote.id, { estado: "CERRADO" }, admin));
    await assert.rejects(service.cerrarLote(lote.id, { total_sobrantes: 1, forzar_cierre: true }, admin));
    await assert.rejects(service.cerrarLote(lote.id, { total_sobrantes: 0.5 }, tecnico));
    await assert.rejects(service.cerrarLote(lote.id, { total_sobrantes: 11 }, tecnico));
    await assert.rejects(service.cerrarLote(lote.id, { total_sobrantes: 0 }, otro), { status: 403 });
    await service.updateLote(lote.id, { observacion_responsable: "Recorrido interrumpido por lluvia" }, tecnico);
    const [[nota]] = await pool.query("SELECT COUNT(*) AS total FROM audit_logs WHERE entity_type = 'entrega' AND entity_id = ? AND action = 'LOTE_EDITADO'", [String(lote.id)]);
    assert.equal(nota.total, 1);
    const noon = new Date(`${hoy}T18:00:00Z`);
    assert.equal(await enviarRecordatoriosEntregas(noon), 1);
    assert.equal(await enviarRecordatoriosEntregas(noon), 0);
    const concurrent = await Promise.all([enviarRecordatoriosEntregas(new Date(`${hoy}T22:30:00Z`)), enviarRecordatoriosEntregas(new Date(`${hoy}T22:30:00Z`))]);
    assert.equal(concurrent.reduce((a, b) => a + b, 0), 1);
    assert.equal(await enviarRecordatoriosEntregas(new Date(`${hoy}T23:00:00Z`)), 1);
    const nextDay = new Date(`${addDays(hoy, 1)}T14:00:00Z`);
    assert.equal(await enviarRecordatoriosEntregas(nextDay), 3); // responsable, admin y gestor
    assert.equal(await enviarRecordatoriosEntregas(nextDay), 0);
    const [[unread]] = await pool.query("SELECT COUNT(*) AS total FROM user_profile_messages WHERE recipient_user_id = ? AND read_at IS NULL", [tecnico.id]);
    assert.equal(unread.total, 1);
    const withDetail = await service.createNoEntregadas(lote.id, { items: [{ numero_abonado: "10001", motivo: "CASA_CERRADA" }, { numero_abonado: "10002", motivo: "CASA_CERRADA" }] }, tecnico);
    await assert.rejects(service.updateLote(lote.id, { total_asignadas: 1 }, admin));
    const attempts = await Promise.allSettled([service.cerrarLote(lote.id, { total_sobrantes: 2 }, tecnico), service.cerrarLote(lote.id, { total_sobrantes: 2 }, tecnico)]);
    assert.equal(attempts.filter((item) => item.status === "fulfilled").length, 1);
    const cerrado = await service.getLoteDetail(lote.id, tecnico);
    assert.equal(cerrado.total_entregadas, 8);
    assert.equal(cerrado.closed_by, tecnico.id);
    assert.ok(cerrado.closed_at);
    assert.equal(await enviarRecordatoriosEntregas(nextDay), 0);
    const [[resolved]] = await pool.query("SELECT COUNT(*) AS total FROM user_profile_messages WHERE read_at IS NULL");
    assert.equal(resolved.total, 0);
    await assert.rejects(service.deleteNoEntregada(withDetail.no_entregadas[0].id, tecnico), { status: 403 });
    await service.registrarIntento(withDetail.no_entregadas[0].id, { resultado: "ENTREGADO", fecha: hoy }, tecnico);
    assert.equal((await service.getNoEntregadaDetail(withDetail.no_entregadas[0].id, tecnico)).estado, "REENTREGADA");
    await assert.rejects(service.createNoEntregadas(lote.id, { items: [{ numero_abonado: "10003", motivo: "OTRO", observacion: "Prueba" }] }, tecnico));
    await service.createNoEntregadas(lote.id, { correccion_admin: true, items: [{ numero_abonado: "10003", motivo: "OTRO", observacion: "Prueba" }] }, admin);
    assert.equal((await service.getLoteDetail(lote.id, admin)).total_sobrantes, 3);
    const report = await reports.generarReporteSemanal({ fecha_inicio: hoy, fecha_fin: hoy }, admin);
    const snapshot = JSON.stringify(report.snapshot);
    assert.equal((await service.getLoteDetail(lote.id, admin)).estado, "REVISADO");
    await assert.rejects(service.registrarIntento(withDetail.no_entregadas[1].id, { resultado: "ENTREGADO" }, tecnico));
    await service.updateLote(lote.id, { observacion_inicial: "Cambio posterior" }, admin);
    assert.equal(JSON.stringify((await reports.getReporteSemanal(report.id, admin)).snapshot), snapshot);
    for (let i = 0; i < 14; i++) await service.createLote({ responsable_id: persona.id, fecha: i < 2 ? addDays(hoy, -2) : hoy, barrio_nombre: i % 2 ? "BO. LA LIBERTAD" : "COL. JULIO MIDENCE", tipo_documento: i % 2 ? "NOTA_COBRO" : "FACTURA", total_asignadas: 30 + i }, admin);
    const page = await service.listLotes({ limit: 2 }, admin);
    assert.equal(page.items.length, 2);
    assert.equal(page.total, 15);
    assert.equal(page.resumen.total, 15);
    assert.equal(page.resumen.abiertos, 14);
    assert.equal((await service.listLotes({ estado: "ABIERTO", fecha_hasta: addDays(hoy, -1) }, admin)).total, 2);
    assert.equal((await service.listNoEntregadas({ q: "10003", sin_intentos: "1" }, admin)).total, 1);
    // Una vez emitido el informe, sus cifras siguen congeladas.
    assert.equal(JSON.stringify((await reports.getReporteSemanal(report.id, admin)).snapshot), snapshot);
    // Marcha atras administrativa: reabrir para corregir, borrar lo cargado por error.
    const errado = await service.createLote({ responsable_id: persona.id, fecha: hoy, barrio_nombre: "BO. EL CENTRO", tipo_documento: "FACTURA", total_asignadas: 5 }, admin);
    await assert.rejects(service.deleteLote(errado.id, { motivo: "eh" }, admin));
    await assert.rejects(service.deleteLote(errado.id, { motivo: "Cargado por error" }, gestor), { status: 403 });
    await service.cerrarLote(errado.id, { total_sobrantes: 0 }, admin);
    await assert.rejects(service.deleteLote(errado.id, { motivo: "Cargado por error" }, admin), { status: 409 });
    await assert.rejects(service.reabrirLote(errado.id, { motivo: "Cierre equivocado" }, tecnico), { status: 403 });
    const reabierto = await service.reabrirLote(errado.id, { motivo: "Cierre equivocado en campo" }, admin);
    assert.equal(reabierto.estado, "ABIERTO");
    assert.equal(reabierto.closed_by, null);
    await assert.rejects(service.reabrirLote(errado.id, { motivo: "Ya quedó abierto" }, admin), { status: 409 });
    assert.equal((await service.updateLote(errado.id, { total_asignadas: 7 }, admin)).total_asignadas, 7);
    assert.equal((await service.deleteLote(errado.id, { motivo: "Lote duplicado por error" }, admin)).deleted, true);
    await assert.rejects(service.getLoteDetail(errado.id, admin), { status: 404 });
    // Un lote ya revisado tambien vuelve atras: el informe emitido no se toca.
    assert.equal((await service.reabrirLote(lote.id, { motivo: "Corrección posterior al informe" }, admin)).estado, "ABIERTO");
    assert.equal(JSON.stringify((await reports.getReporteSemanal(report.id, admin)).snapshot), snapshot);
    const [[trazas]] = await pool.query("SELECT COUNT(*) AS total FROM audit_logs WHERE entity_type = 'entrega' AND action IN ('LOTE_REABIERTO', 'LOTE_ELIMINADO')");
    assert.equal(trazas.total, 3);
    // Barrios ordenados por sobrante, con la tasa sobre lo asignado.
    const conBarrios = await service.getResumen({ fecha_desde: addDays(hoy, -7), fecha_hasta: hoy }, admin);
    assert.ok(conBarrios.por_barrio.length >= 2);
    assert.ok(conBarrios.por_barrio[0].sobrantes >= conBarrios.por_barrio[1].sobrantes);
    const centro = conBarrios.por_barrio.find((fila) => fila.barrio_nombre === "BO. EL CENTRO");
    assert.equal(centro.sobrantes, 3);
    assert.equal(centro.asignadas, 10);
    assert.equal(centro.tasa_sobrante, 30);
    // Un barrio sin sobrantes aparece igual, en cero, no desaparece del ranking.
    const libertad = conBarrios.por_barrio.find((fila) => fila.barrio_nombre === "BO. LA LIBERTAD");
    assert.equal(libertad.sobrantes, 0);
    assert.ok(libertad.asignadas > 0);

    // Ciclo mensual: al emitirse las facturas nuevas, los pendientes del ciclo
    // anterior quedan sin efecto, pero las cifras del lote cerrado NO se mueven.
    const previo = await service.createLote({ responsable_id: persona.id, fecha: addDays(hoy, -20), barrio_nombre: "BO. EL CENTRO", tipo_documento: "FACTURA", total_asignadas: 6 }, admin);
    await service.createNoEntregadas(previo.id, { items: [{ numero_abonado: "20001", motivo: "CASA_CERRADA" }, { numero_abonado: "20002", motivo: "CASA_CERRADA" }] }, admin);
    await service.cerrarLote(previo.id, { total_sobrantes: 2 }, admin);
    const antes = await service.getLoteDetail(previo.id, admin);
    assert.equal(antes.total_entregadas, 4);
    assert.equal(antes.total_sobrantes, 2);

    await assert.rejects(service.cerrarCicloEntregas({ motivo: "Emisión de octubre" }, gestor), { status: 403 });
    await assert.rejects(service.cerrarCicloEntregas({ motivo: "no" }, admin));
    await assert.rejects(service.cerrarCicloEntregas({ motivo: "Emisión futura", fecha_corte: addDays(hoy, 1) }, admin));
    const ciclo = await service.cerrarCicloEntregas({ motivo: "Emisión de facturas del mes nuevo", fecha_corte: addDays(hoy, -1) }, admin);
    assert.ok(ciclo.documentos_vencidos >= 2);
    assert.equal(ciclo.fecha_inicio, hoy);
    await assert.rejects(service.cerrarCicloEntregas({ motivo: "Corte repetido", fecha_corte: addDays(hoy, -1) }, admin), { status: 409 });

    // La foto del lote cerrado es exactamente la misma despues del corte.
    const despues = await service.getLoteDetail(previo.id, admin);
    assert.equal(despues.total_entregadas, antes.total_entregadas);
    assert.equal(despues.total_sobrantes, antes.total_sobrantes);
    assert.equal(despues.no_entregadas.every((item) => item.estado === "VENCIDA"), true);
    // Y salen de la cola de seguimiento, sin admitir nuevos intentos.
    assert.equal((await service.listNoEntregadas({ estado: "PENDIENTE", fecha_hasta: addDays(hoy, -1) }, admin)).total, 0);
    assert.equal((await service.listNoEntregadas({ estado: "VENCIDA" }, admin)).total, ciclo.documentos_vencidos);
    await assert.rejects(service.registrarIntento(despues.no_entregadas[0].id, { resultado: "ENTREGADO" }, admin));
    // El informe ya emitido tampoco se movio.
    assert.equal(JSON.stringify((await reports.getReporteSemanal(report.id, admin)).snapshot), snapshot);
    assert.equal((await service.getEntregasConfig(admin)).ciclo.ultimo_corte.fecha_corte, addDays(hoy, -1));
    console.log(`QA MySQL verificado: ${database}`);
  } finally {
    if (pool) await pool.end();
    if (process.env.ENTREGAS_QA_KEEP !== "1") {
      assert.match(database, /^aguaschol_entregas_test_\d+$/);
      const connection = await mysql.createConnection({ host: "127.0.0.1", port: Number(process.env.DB_PORT), user: "root", password: process.env.DB_PASSWORD });
      await connection.query(`DROP DATABASE IF EXISTS \`${database}\``);
      await connection.end();
    }
  }
});
