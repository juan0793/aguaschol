import assert from "node:assert/strict";
import test from "node:test";
import {
  agruparPorBarrio,
  agruparPorMotivo,
  agruparPorResponsable,
  assertPuedeAgregarNoEntregadas,
  calcularEfectividad,
  calcularEntregadas,
  construirCorreccion,
  construirSnapshotSemanal,
  contarNoEntregadasActivas,
  describirSemana,
  detectarDuplicadosEnLote,
  etiquetarVersion,
  listarDiasDelRango,
  lotesParaRevisar,
  parsearPegadoNoEntregadas,
  semanaPorDefecto,
  validarConsistenciaDetalle,
  validarMotivo,
  validarSobrantes,
  validarTotalAsignado
} from "./entregasRules.js";

const lotes = [
  {
    id: 1,
    fecha: "2026-08-17",
    responsable_id: 1,
    responsable_nombre: "Carlos Martínez",
    tipo_personal: "TECNICO",
    barrio_codigo: "05",
    barrio_nombre: "Barrio Campo Sol",
    tipo_documento: "FACTURA",
    total_asignadas: 100,
    total_sobrantes: 10,
    estado: "CERRADO",
    observacion_responsable: "Varias viviendas cerradas por la mañana."
  },
  {
    id: 2,
    fecha: "2026-08-18",
    responsable_id: 2,
    responsable_nombre: "José Reyes",
    tipo_personal: "COBRADOR",
    barrio_codigo: "10",
    barrio_nombre: "Barrio San Juan Bosco",
    tipo_documento: "NOTA_COBRO",
    total_asignadas: 50,
    total_sobrantes: 0,
    estado: "ABIERTO",
    observacion_responsable: ""
  }
];

const noEntregadas = Array.from({ length: 10 }, (_unused, index) => ({
  id: index + 1,
  lote_id: 1,
  numero_abonado: `1024${index}`,
  clave_catastral: `10-20-03-${index}`,
  motivo: index < 6 ? "CASA_CERRADA" : "DIRECCION_NO_ENCONTRADA",
  estado: index === 0 ? "REENTREGADA" : "PENDIENTE",
  fecha_lote: "2026-08-17",
  tipo_documento: "FACTURA",
  barrio_codigo: "05",
  barrio_nombre: "Barrio Campo Sol",
  responsable_id: 1,
  responsable_nombre: "Carlos Martínez",
  intentos: index === 1 ? 3 : 0
}));

test("calcula entregadas y efectividad protegiendo la división entre cero", () => {
  assert.equal(calcularEntregadas({ total_asignadas: 100, total_sobrantes: 10 }), 90);
  assert.equal(calcularEfectividad(90, 100), 90);
  assert.equal(calcularEfectividad(3516, 3842), 91.51);
  assert.equal(calcularEfectividad(0, 0), 0);
});

test("rechaza totales asignados inválidos", () => {
  assert.throws(() => validarTotalAsignado(0), /mayor que cero/);
  assert.throws(() => validarTotalAsignado(-4), /mayor que cero/);
  assert.equal(validarTotalAsignado("120"), 120);
});

test("rechaza sobrantes negativos o mayores a las asignadas", () => {
  assert.throws(() => validarSobrantes(-1, 100), /negativos/);
  assert.throws(() => validarSobrantes(101, 100), /no pueden superar/);
  assert.throws(() => validarSobrantes("", 100), /total de sobrantes/);
  assert.equal(validarSobrantes(0, 100), 0);
  assert.equal(validarSobrantes(10, 100), 10);
});

test("exige que el detalle identificado cuadre con el total de sobrantes", () => {
  const detalle = Array.from({ length: 20 }, () => ({ estado: "PENDIENTE" }));
  assert.throws(() => validarConsistenciaDetalle({ total_sobrantes: 23, detalle }), /Faltan 3/);
  assert.throws(() => validarConsistenciaDetalle({ total_sobrantes: 18, detalle }), /solo declaraste 18/);
  assert.deepEqual(validarConsistenciaDetalle({ total_sobrantes: 20, detalle }), {
    sobrantes: 20,
    identificadas: 20,
    diferencia: 0
  });
  // Las filas canceladas no cuentan para el cuadre.
  assert.equal(
    validarConsistenciaDetalle({ total_sobrantes: 1, detalle: [{ estado: "PENDIENTE" }, { estado: "CANCELADA" }] })
      .identificadas,
    1
  );
});

test("un administrador puede forzar el cierre con diferencia", () => {
  assert.doesNotThrow(() =>
    validarConsistenciaDetalle({ total_sobrantes: 5, detalle: [], permitirDiferencia: true })
  );
});

test("detecta abonados o claves repetidos dentro del mismo lote", () => {
  const duplicados = detectarDuplicadosEnLote([
    { numero_abonado: "10245", clave_catastral: "10-20-03-04" },
    { numero_abonado: "10245", clave_catastral: "10-20-03-04" },
    { numero_abonado: "10287", clave_catastral: "10-20-03-18" }
  ]);
  assert.equal(duplicados.length, 1);
});

test("valida el catálogo de motivos y exige observación cuando es OTRO", () => {
  assert.equal(validarMotivo({ motivo: "casa_cerrada" }), "CASA_CERRADA");
  assert.throws(() => validarMotivo({ motivo: "INEXISTENTE" }), /no es válido/);
  assert.throws(() => validarMotivo({ motivo: "OTRO" }), /exige una observación/);
  assert.equal(validarMotivo({ motivo: "OTRO", observacion: "Portón sin número" }), "OTRO");
});

test("interpreta el pegado masivo de no entregadas", () => {
  const filas = parsearPegadoNoEntregadas(
    "10245\t10-20-03-04\tCasa cerrada\n10287    10-20-03-18    Dirección no encontrada"
  );
  assert.equal(filas.length, 2);
  assert.deepEqual(
    filas.map((fila) => [fila.numero_abonado, fila.clave_catastral, fila.motivo]),
    [
      ["10245", "10-20-03-04", "CASA_CERRADA"],
      ["10287", "10-20-03-18", "DIRECCION_NO_ENCONTRADA"]
    ]
  );
});

test("la semana por defecto va de lunes a viernes", () => {
  assert.deepEqual(semanaPorDefecto("2026-08-19"), { fecha_inicio: "2026-08-17", fecha_fin: "2026-08-21" });
  assert.deepEqual(semanaPorDefecto("2026-08-23"), { fecha_inicio: "2026-08-17", fecha_fin: "2026-08-21" });
  assert.equal(listarDiasDelRango("2026-08-17", "2026-08-21").length, 5);
  assert.equal(describirSemana("2026-08-17", "2026-08-21"), "Semana del 17 al 21 de agosto de 2026");
});

test("agrupa por responsable, barrio y motivo", () => {
  const porResponsable = agruparPorResponsable(lotes, noEntregadas);
  assert.equal(porResponsable[0].responsable_nombre, "Carlos Martínez");
  assert.equal(porResponsable[0].entregadas, 90);
  assert.equal(porResponsable[0].efectividad, 90);
  assert.equal(porResponsable[0].tipo_predominante, "FACTURA");
  assert.equal(porResponsable[0].reentregadas, 1);
  assert.equal(porResponsable[0].pendientes, 9);

  const porBarrio = agruparPorBarrio(lotes, noEntregadas);
  assert.equal(porBarrio.find((fila) => fila.barrio_codigo === "10").efectividad, 100);

  const porMotivo = agruparPorMotivo(noEntregadas);
  assert.equal(porMotivo[0].motivo, "CASA_CERRADA");
  assert.equal(porMotivo[0].total, 6);
  assert.equal(porMotivo[0].motivo_etiqueta, "Casa cerrada");
});

test("el snapshot semanal es una foto completa e independiente de los datos vivos", () => {
  const snapshot = construirSnapshotSemanal({
    fecha_inicio: "2026-08-17",
    fecha_fin: "2026-08-21",
    lotes,
    noEntregadas,
    generado_por: 7,
    generado_por_nombre: "Encargada de sistema",
    generado_en: "2026-08-21T18:00:00.000Z"
  });

  assert.equal(snapshot.totales.asignadas, 150);
  assert.equal(snapshot.totales.entregadas, 140);
  assert.equal(snapshot.totales.pendientes, 9);
  assert.equal(snapshot.totales.reentregadas, 1);
  assert.equal(snapshot.periodo.etiqueta, "Semana del 17 al 21 de agosto de 2026");
  assert.equal(snapshot.por_dia.length, 5);
  assert.equal(snapshot.observaciones.length, 1);
  assert.equal(snapshot.observaciones[0].responsable_nombre, "Carlos Martínez");
  assert.ok(snapshot.indicadores_atencion.some((item) => item.codigo === "LOTES_ABIERTOS" && item.total === 1));

  // Mutar los datos vivos después de generar no puede alterar el snapshot ya emitido.
  const copia = JSON.parse(JSON.stringify(snapshot));
  noEntregadas.forEach((item) => { item.estado = "REENTREGADA"; });
  lotes[0].responsable_nombre = "Otro nombre";
  assert.deepEqual(snapshot, copia);
  noEntregadas.forEach((item, index) => { item.estado = index === 0 ? "REENTREGADA" : "PENDIENTE"; });
  lotes[0].responsable_nombre = "Carlos Martínez";
});

test("una semana sin datos produce un informe válido en ceros", () => {
  const snapshot = construirSnapshotSemanal({ fecha_inicio: "2026-09-07", fecha_fin: "2026-09-11" });
  assert.equal(snapshot.totales.asignadas, 0);
  assert.equal(snapshot.totales.efectividad, 0);
  assert.equal(snapshot.por_responsable.length, 0);
  assert.equal(snapshot.por_dia.length, 5);
});

test("una semana combinada separa factura y nota de cobro", () => {
  const snapshot = construirSnapshotSemanal({
    fecha_inicio: "2026-08-17",
    fecha_fin: "2026-08-21",
    lotes,
    noEntregadas
  });
  const tipos = snapshot.por_tipo_documento.map((fila) => fila.tipo_documento);
  assert.deepEqual(tipos, ["FACTURA", "NOTA_COBRO"]);
  assert.equal(snapshot.por_tipo_documento[0].no_entregadas, 10);
  assert.equal(snapshot.por_tipo_documento[1].no_entregadas, 0);
});

test("no se pueden agregar no entregadas a un lote CERRADO sin una corrección admin", () => {
  assert.throws(
    () => assertPuedeAgregarNoEntregadas({ estadoLote: "CERRADO" }),
    /ya fue cerrado.*administrador/
  );
  assert.doesNotThrow(() =>
    assertPuedeAgregarNoEntregadas({ estadoLote: "CERRADO", esCorreccionAdmin: true })
  );
});

test("no se pueden agregar no entregadas a un lote REVISADO sin una corrección admin", () => {
  assert.throws(
    () => assertPuedeAgregarNoEntregadas({ estadoLote: "REVISADO" }),
    /ya fue revisado.*administrador/
  );
  assert.doesNotThrow(() =>
    assertPuedeAgregarNoEntregadas({ estadoLote: "REVISADO", esCorreccionAdmin: true })
  );
});

test("un lote ABIERTO admite altas normales sin marcar de corrección admin", () => {
  assert.doesNotThrow(() => assertPuedeAgregarNoEntregadas({ estadoLote: "ABIERTO" }));
  assert.doesNotThrow(() =>
    assertPuedeAgregarNoEntregadas({ estadoLote: "ABIERTO", esCorreccionAdmin: false })
  );
});

test("el lote se mantiene consistente después del cierre, incluso tras una corrección admin", () => {
  // Al cerrar: 3 sobrantes identificados con 3 filas activas -> cuadra.
  const detalleAlCerrar = [
    { estado: "PENDIENTE" },
    { estado: "PENDIENTE" },
    { estado: "REENTREGADA" }
  ];
  const { sobrantes } = validarConsistenciaDetalle({ total_sobrantes: 3, detalle: detalleAlCerrar });
  assert.equal(contarNoEntregadasActivas(detalleAlCerrar), sobrantes);

  // Una corrección admin agrega un documento que se escapó del recorrido: el
  // nuevo total_sobrantes debe recalcularse a partir del detalle activo real,
  // no quedar pegado al valor declarado al momento del cierre.
  const detalleTrasCorreccion = [...detalleAlCerrar, { estado: "PENDIENTE" }];
  const nuevosSobrantes = contarNoEntregadasActivas(detalleTrasCorreccion);
  assert.equal(nuevosSobrantes, 4);
  assert.doesNotThrow(() =>
    validarConsistenciaDetalle({ total_sobrantes: nuevosSobrantes, detalle: detalleTrasCorreccion })
  );

  // Cancelar una fila también debe reflejarse: la regla no se puede quedar
  // apuntando a un total_sobrantes que ya no coincide con las filas activas.
  const detalleTrasCancelacion = detalleTrasCorreccion.map((item, index) =>
    index === 0 ? { ...item, estado: "CANCELADA" } : item
  );
  const sobrantesTrasCancelacion = contarNoEntregadasActivas(detalleTrasCancelacion);
  assert.equal(sobrantesTrasCancelacion, 3);
  assert.doesNotThrow(() =>
    validarConsistenciaDetalle({ total_sobrantes: sobrantesTrasCancelacion, detalle: detalleTrasCancelacion })
  );
});

test("lotesParaRevisar selecciona solo los lotes CERRADOS del rango al generar el informe", () => {
  const lotesDelRango = [
    { id: 1, estado: "CERRADO" },
    { id: 2, estado: "ABIERTO" },
    { id: 3, estado: "REVISADO" },
    { id: 4, estado: "CERRADO" }
  ];
  assert.deepEqual(lotesParaRevisar(lotesDelRango), [1, 4]);
  assert.deepEqual(lotesParaRevisar([]), []);
  assert.deepEqual(lotesParaRevisar([{ id: 9, estado: "ABIERTO" }]), []);
});

test("una corrección crea una versión nueva encadenada al original", () => {
  const correccion = construirCorreccion({ id: 12, version: 1, estado: "GENERADO" });
  assert.deepEqual(correccion, { version: 2, reporte_origen_id: 12, estado: "CORREGIDO" });

  const tercera = construirCorreccion({ id: 15, version: 2, reporte_origen_id: 12, estado: "CORREGIDO" });
  assert.equal(tercera.version, 3);
  assert.equal(tercera.reporte_origen_id, 12);

  assert.throws(() => construirCorreccion({ id: 9, estado: "ANULADO" }), /anulado/);
  assert.equal(etiquetarVersion({ version: 1 }), "Versión 1");
  assert.equal(etiquetarVersion({ version: 2 }), "Versión 2 - corregida");
});
