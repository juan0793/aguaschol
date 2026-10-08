import assert from "node:assert/strict";
import { test } from "node:test";

process.env.USE_MEMORY_DB = "true";

test("exportMapPointsWorkbook builds a formatted, numbered Excel report", async () => {
  const ExcelJS = (await import("exceljs")).default;
  const { createMapPoint, exportMapPointsWorkbook } = await import("./mapPointService.js");

  await createMapPoint(
    {
      point_type: "caja_registro",
      latitude: 13.300123,
      longitude: -87.190456,
      accuracy_meters: 4.5,
      reference: "Barrio Suyapa",
      description: "Caja frente a vivienda",
      marker_color: "#1576d1",
      housing_units: 2
    },
    { id: 1, full_name: "Tecnico Demo" }
  );

  await createMapPoint(
    {
      point_type: "alerta",
      latitude: 13.301123,
      longitude: -87.191456,
      reference: "Barrio Suyapa",
      description: "Revisar acometida",
      marker_color: "#f59e0b"
    },
    { id: 1, full_name: "Tecnico Demo" }
  );

  const exported = await exportMapPointsWorkbook();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(exported.buffer);

  const reportSheet = workbook.getWorksheet("reporte_detallado");
  assert.ok(reportSheet);
  assert.equal(reportSheet.getCell("C1").value, "REPORTE DETALLADO DE PUNTOS DE CAMPO");
  assert.equal(reportSheet.getCell("A7").value, "No.");
  assert.equal(reportSheet.getCell("A8").value, 1);
  assert.equal(reportSheet.getCell("A9").value, 2);
  assert.equal(reportSheet.getCell("F8").value, "13.300123, -87.190456");
  assert.match(reportSheet.getCell("L8").value.hyperlink, /google\.com\/maps/);
  assert.ok(reportSheet.getImages().length > 0);
  assert.ok(workbook.getWorksheet("por_ubicacion"));
  assert.ok(workbook.getWorksheet("datos"));
});

test("createMapPoint no duplica un punto reenviado con el mismo client_ref", async () => {
  const { createMapPoint } = await import("./mapPointService.js");
  const payload = { point_type: "caja_registro", latitude: 13.31, longitude: -87.18, client_ref: "local-abc12345" };
  const first = await createMapPoint(payload, { id: 2, full_name: "Tecnico" });
  const again = await createMapPoint(payload, { id: 2, full_name: "Tecnico" });
  assert.equal(again.id, first.id);
  const other = await createMapPoint({ ...payload, client_ref: "local-xyz98765" }, { id: 2, full_name: "Tecnico" });
  assert.notEqual(other.id, first.id);
});

test("resolveCaptureDiaryDate usa la hora de captura, salvo futura o muy vieja", async () => {
  const { resolveCaptureDiaryDate } = await import("./mapPointService.js");
  const now = new Date("2026-10-09T18:00:00Z");
  assert.equal(resolveCaptureDiaryDate("2026-10-08T15:00:00Z", now), "2026-10-08");
  assert.equal(resolveCaptureDiaryDate("2026-10-20T15:00:00Z", now), "2026-10-09");
  assert.equal(resolveCaptureDiaryDate("2026-08-01T15:00:00Z", now), "2026-10-09");
  assert.equal(resolveCaptureDiaryDate("no es fecha", now), "2026-10-09");
  assert.equal(resolveCaptureDiaryDate(null, now), "2026-10-09");
});
