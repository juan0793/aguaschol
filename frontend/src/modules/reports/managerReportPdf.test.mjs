import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { buildManagerReportPdf, downloadManagerReport } from "./managerReportPdf.js";
import { saveReportPdf } from "../../utils/printDocument.js";
import { createHash } from "node:crypto";

const sample = (rows = 3) => ({
  report_id: "RPT-20261012-120000-ABCDEF12", title: "Informe gerencial de prueba", type: "executive",
  created_at: "2026-10-12T18:00:00Z", filters: { barrio: "" }, cutoff: "2026-10-10T18:00:00Z",
  period: { from: "2026-10-01", to: "2026-10-12" }, notes: ["Datos sintéticos exclusivamente para QA."],
  sections: [{ title: "Seguimiento", columns: ["Técnico", "Inspecciones"], rows: Array.from({ length: rows }, (_, index) => [`Técnico de prueba ${index + 1}`, index]) }]
});

test("el PDF usa carta en todas sus páginas y conserva título e identificador", async () => {
  const report = sample(150);
  const document = await buildManagerReportPdf(report);
  const parsed = await PDFDocument.load(document.output("arraybuffer"));
  assert.ok(parsed.getPageCount() > 1);
  for (const page of parsed.getPages()) assert.deepEqual(page.getSize(), { width: 612, height: 792 });
  assert.equal(parsed.getTitle(), report.title);
  assert.ok(parsed.getSubject().includes(report.report_id));
});

test("una consulta vacía produce un PDF válido", async () => {
  const document = await buildManagerReportPdf(sample(0));
  assert.equal((await PDFDocument.load(document.output("arraybuffer"))).getPageCount(), 1);
});

test("una falla de auditoría impide guardar el PDF", async () => {
  let saved = false;
  await assert.rejects(() => downloadManagerReport(sample(), async () => new Response(JSON.stringify({ message: "Auditoría no disponible" }), { status: 503 }), { save: () => { saved = true; } }), /Auditoría no disponible/);
  assert.equal(saved, false);
});

test("la descarga registra bytes y huella antes de guardar el documento con el ID del servidor", async () => {
  const events = [];
  let saveMetadata;
  let savedHash;
  await downloadManagerReport(sample(), async (path, options) => { events.push({ path, body: JSON.parse(options.body) }); return new Response("{}", { status: 200 }); }, { save: (doc, filename, options) => { saveMetadata = options; doc.save = () => { savedHash = createHash("sha256").update(Buffer.from(doc.output("arraybuffer"))).digest("hex"); }; saveReportPdf(doc, filename, options); } });
  assert.deepEqual(events.map((item) => item.body.event), ["pdf_generated", "download_requested"]);
  assert.equal(events[0].body.bytes, events[1].body.bytes);
  assert.ok(events[0].body.bytes > 1000);
  assert.match(events[0].body.sha256, /^[a-f0-9]{64}$/);
  assert.equal(saveMetadata.reportId, sample().report_id);
  assert.equal(savedHash, events[0].body.sha256, "la huella auditada corresponde al archivo que guarda el sistema PDF existente");
});

test("cerrar la consulta antes del guardado impide descargar", async () => {
  let saved = false;
  await assert.rejects(() => downloadManagerReport(sample(), async () => new Response("{}", { status: 200 }), { save: () => { saved = true; }, isActive: () => false }), /consulta se cerró/);
  assert.equal(saved, false);
});
