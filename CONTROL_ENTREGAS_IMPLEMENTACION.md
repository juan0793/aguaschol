# Control de Entregas — implementación

Módulo de control de distribución física de **facturas** y **notas de cobro**, según
`CONTROL_ENTREGAS_CLAUDE_SPEC.md`. Se integró respetando los patrones ya existentes en
Control Aguas (rutas → controlador → servicio en backend, `modules/<nombre>` en frontend).

---

## 1. Archivos nuevos

### Backend

```
backend/sql/migrations/20260818_add_control_entregas.sql
backend/src/services/entregasRules.js          reglas y cálculos puros (sin BD)
backend/src/services/entregasRules.test.mjs    14 pruebas node:test
backend/src/services/entregasService.js        personal, lotes, no entregadas, intentos
backend/src/services/entregasReportService.js  informe semanal + snapshot + versiones
backend/src/controllers/entregasController.js
backend/src/routes/entregasRoutes.js
```

### Frontend

```
frontend/src/modules/entregas/
├── pages/EntregasPage.jsx                 workspace con subnav (#entregas/<vista>)
├── components/
│   ├── EntregasStats.jsx                  4 KPI + efectividad
│   ├── LoteForm.jsx                       nuevo lote (solo total asignado)
│   ├── LotesTable.jsx                     lotes diarios + filtros + paginación
│   ├── CierreLoteDialog.jsx               sobrantes, observación y captura de no entregadas
│   ├── NoEntregadasTable.jsx              vista "No entregadas" con prioridades
│   ├── NoEntregadaDetalle.jsx             detalle + registrar intento / reentregar
│   ├── IntentosTimeline.jsx               línea de tiempo del seguimiento
│   ├── PersonalCampoTable.jsx             personal con y sin usuario
│   ├── ReporteCharts.jsx                  3 gráficos sobrios en HTML/CSS
│   └── ReportesSemanales.jsx              preview, generación, histórico y correcciones
├── print/
│   ├── WeeklyReportPrint.jsx              hoja Letter (3–4 páginas)
│   ├── weeklyReportStyles.css             estilos de impresión (@page letter portrait)
│   └── weeklyReportPdf.js                 PDF bajo demanda con jsPDF + autoTable
├── hooks/  useEntregasList · useLotes · useNoEntregadas · useReportesSemanales
├── selectors/entregasSelectors.js (+ 7 pruebas)
├── services/entregasApi.js
├── utils/entregasFormatters.js
└── styles/entregas.css
```

## 2. Archivos modificados (cambios mínimos)

| Archivo | Cambio |
|---|---|
| `backend/src/app.js` | 1 import + `app.use("/api/entregas", requireAuth, entregasRoutes)` |
| `backend/sql/schema.sql` | bloque de tablas del módulo al final |
| `backend/package.json` | `entregasRules.test.mjs` añadido a `npm test` |
| `frontend/src/App.jsx` | 1 import, 3 entradas de navegación, 1 rama de render |
| `frontend/src/components/sidebar/sidebarConfig.js` | etiqueta + posición en "Principal" |
| `frontend/package.json` | script `test:entregas` |

No se movió ni refactorizó nada más.

## 3. Modelo de datos

`personal_campo` · `entrega_motivos` · `entrega_lotes` · `entrega_no_entregadas` ·
`entrega_intentos` · `reportes_semanales_entregas`

- `total_entregadas` **no** se almacena: se deriva de `total_asignadas - total_sobrantes`.
- Los intentos se acumulan; nunca se sobrescribe el anterior.
- `resumen_json` guarda nombres además de IDs (responsable, barrio, observaciones), por lo
  que un cambio posterior de nombre no altera un informe histórico.
- Índices incluidos en la definición: fecha, `responsable_id+fecha`, estado,
  `tipo_documento+fecha`, `numero_abonado`, `clave_catastral`, motivo, `lote_id`,
  `fecha_inicio+fecha_fin`.

Las tablas se crean solas al arrancar el backend (`schema.sql` se aplica en
`ensureSchema()`). La migración suelta sirve para aplicar el módulo a una base ya viva.

## 4. Endpoints

```
GET    /api/entregas/config
GET    /api/entregas/resumen
GET    /api/entregas/personal            POST · PATCH /:id        (admin)
GET    /api/entregas/lotes               POST (admin/operator)
GET    /api/entregas/lotes/:id           PATCH /:id
POST   /api/entregas/lotes/:id/cerrar
POST   /api/entregas/lotes/:id/no-entregadas
GET    /api/entregas/no-entregadas       GET · PATCH · DELETE /:id
POST   /api/entregas/no-entregadas/:id/intentos
GET    /api/entregas/reportes/semanales
GET    /api/entregas/reportes/semanales/preview      (datos vivos, no persiste)
POST   /api/entregas/reportes/semanales              (crea el snapshot)
GET    /api/entregas/reportes/semanales/:id
POST   /api/entregas/reportes/semanales/:id/correccion   (admin)
POST   /api/entregas/reportes/semanales/:id/anular       (admin)
```

## 5. Permisos (sin roles nuevos)

| Rol actual | Alcance |
|---|---|
| `admin` | todo, incluye correcciones, anulaciones y cierre forzado |
| `operator` | crear/editar/cerrar lotes, seguimiento, generar informe semanal |
| otros con `personal_campo.user_id` | solo sus lotes: cerrar, observar, registrar no entregadas e intentos |
| sin vínculo | el listado sale vacío (no error), sin acceso operativo |

## 6. Reglas críticas implementadas

- `0 ≤ sobrantes ≤ asignadas`; no se cierra un lote sin registrar sobrantes.
- `COUNT(no entregadas activas) == total_sobrantes` antes de cerrar; si no cuadra se
  bloquea el cierre y se muestra la diferencia exacta. Solo un admin puede forzarlo.
- Aviso al repetir abonado/clave dentro del mismo lote; se permite en semanas distintas.
- Motivo `OTRO` exige observación.
- Rango semanal duplicado devuelve 409 y sugiere generar una corrección.
- Una corrección crea `version = anterior + 1` con `reporte_origen_id` al original; el
  original nunca se toca.

## 7. Informe semanal

1. Vista previa con datos vivos (no escribe nada en la base).
2. «Generar informe semanal» recalcula y guarda el snapshot.
3. Desde ahí, pantalla, impresión y PDF salen del snapshot.
4. Hoja Letter vertical, encabezado azul institucional repetido, pie con rango, fecha de
   generación y número de página, `thead` repetido en tablas largas.
5. El PDF se arma en el navegador con jsPDF (dependencia ya presente). **No se guarda
   ningún PDF en el servidor ni en Railway.**

## 8. Cómo verificar

```bash
cd backend  && npm test              # incluye entregasRules.test.mjs (14 pruebas)
cd frontend && npm run test:entregas # selectors (7 pruebas)
cd frontend && npm run build         # build de Vite
```

Ruta manual sugerida: Personal de campo → Nuevo lote → Lotes diarios → Cerrar lote
(sobrantes + captura pegada) → No entregadas → registrar intento → Marcar reentregada →
Reportes semanales → Vista previa → Generar informe → Imprimir / Descargar PDF →
Generar corrección.

## 9. Pendiente de tu lado

- Ejecutar `npm run build` del frontend con tus `node_modules` (aquí se validó el módulo
  con un bundle de esbuild; App.jsx y el módulo compilan sin errores).
- Confirmar la primera arrancada del backend para que `schema.sql` cree las tablas.
- Ajustar la lista de motivos en `entrega_motivos` si la empresa usa otros.
