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

test("summarizeMapPoints entrega cifras y solo las filas recientes", async () => {
  const { createMapPoint, listMapPoints, summarizeMapPoints } = await import("./mapPointService.js");

  const antes = await summarizeMapPoints({ recentLimit: 3 });

  for (let i = 0; i < 5; i += 1) {
    await createMapPoint(
      {
        point_type: i % 2 ? "alerta" : "caja_registro",
        latitude: 13.3 + i / 10000,
        longitude: -87.19 - i / 10000,
        accuracy_meters: 4,
        reference: `Referencia ${i}`,
        description: `Punto de prueba ${i}`,
        housing_units: 1
      },
      { id: 1, role: "admin", full_name: "Admin" }
    );
  }

  const resumen = await summarizeMapPoints({ recentLimit: 3 });
  const completos = await listMapPoints();

  // El total debe coincidir con el listado completo, que es lo que el resumen sustituye.
  assert.equal(resumen.total, completos.length);
  assert.equal(resumen.total, antes.total + 5);

  // Los cinco recien creados cuentan como de hoy y de la semana.
  assert.ok(resumen.today >= 5);
  assert.ok(resumen.week >= 5);

  // by_type debe sumar el total.
  const sumaTipos = Object.values(resumen.by_type).reduce((acc, value) => acc + value, 0);
  assert.equal(sumaTipos, resumen.total);

  // Solo viajan las filas pedidas, ordenadas de la mas reciente a la mas antigua.
  assert.equal(resumen.recent.length, 3);
  const marcas = resumen.recent.map((point) => Date.parse(point.created_at));
  assert.deepEqual(marcas, [...marcas].sort((a, b) => b - a));
  assert.equal(resumen.recent[0].id, completos[0].id);

  // last_activity_at es la marca del punto mas reciente.
  assert.equal(Date.parse(resumen.last_activity_at), Date.parse(completos[0].created_at));
});

test("summarizeMapPoints acota el limite de filas recientes", async () => {
  const { summarizeMapPoints } = await import("./mapPointService.js");

  assert.equal((await summarizeMapPoints({ recentLimit: 0 })).recent.length, 0);
  assert.ok((await summarizeMapPoints({ recentLimit: 999 })).recent.length <= 50);
  // Un valor no numerico no debe reventar la consulta.
  assert.ok(Array.isArray((await summarizeMapPoints({ recentLimit: "abc" })).recent));
});
