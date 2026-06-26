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
  assert.equal(reportSheet.getCell("A7").value, "No.");
  assert.equal(reportSheet.getCell("A8").value, 1);
  assert.equal(reportSheet.getCell("A9").value, 2);
  assert.equal(reportSheet.getCell("F8").value, "13.300123, -87.190456");
  assert.match(reportSheet.getCell("L8").value.hyperlink, /google\.com\/maps/);
  assert.ok(reportSheet.getImages().length > 0);
  assert.ok(workbook.getWorksheet("por_ubicacion"));
  assert.ok(workbook.getWorksheet("datos"));
});
