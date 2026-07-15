# Auditoría previa del módulo de Reportes

Fecha: 2026-07-15  
Rama base auditada: `main`  
Rama de respaldo remoto: `backup/pre-reports-refactor`  
Rama de trabajo: `refactor/reports-workspace`

## Resultado resumido

La vista `workspaceView === "mapReports"` vive en `frontend/src/App.jsx`. El JSX principal ocupa aproximadamente las líneas 16792–17659; la barra superior duplicada está alrededor de 13459. Los estados, selectores, efectos y exportadores están distribuidos entre las líneas 500–8700. `frontend/src/styles.css` contiene los estilos `map-report-*`, `field-debt-*` y del sidebar.

No se requiere cambiar base de datos, autenticación, roles, Railway, Vercel ni variables de entorno. La primera versión reutilizará los endpoints, modelos de datos, generadores PDF/impresión y la clave de `localStorage` existentes.

## Matriz de traslado y verificación

| Elemento | Tipo | Ubicación actual | Dónde se usa | Exclusivo/Compartido | Destino | Dependencias | Riesgo | Verificación |
|---|---|---|---|---|---|---|---|---|
| `mapReportPage` | estado | `App.jsx` | paginación de zonas | exclusivo | `ReportsWorkspace` | `mapReportPagination` | bajo | cambiar páginas y conservar límites |
| `showFieldDebtModal`, `fieldDebtReport`, carga | estado | `App.jsx` | mora, PDF e impresión | exclusivo | módulo Reportes | consultas de clave | alto | comparar totales, coincidencias y deuda |
| selección/edición del punto de reporte | estado + handlers | `App.jsx` | mapa, formulario y tabla | compartido con mapa | adaptador temporal del módulo | `FieldMap`, `/map-points` | alto | crear, editar, enfocar y refrescar |
| `mapReportStaff` | estado | `App.jsx` | firmas y ente regulador | exclusivo | configuración del módulo | valores por defecto | medio | comparar nombres en todas las salidas |
| `mapReportSettingsByDate` | estado persistente | `App.jsx` | títulos, contenido, mapa y zonas | exclusivo | `useReportSettings`/adaptador | `aguaschol-map-report-settings` | alto | recargar y confirmar valores por fecha |
| jornadas regulatorias | estado + selector | `App.jsx` | informe regulatorio | exclusivo | pestaña Ente regulador | máximo 5 jornadas | alto | seleccionar 1–5 y generar |
| `reportMapCaptureRef` | ref | `App.jsx` | captura del mapa en PDF | exclusivo | módulo Reportes | `html2canvas` | alto | PDF con mapa visible |
| jornadas y fecha activa | datos + efectos | `App.jsx` | mapa, validación y reportes | compartido | props mínimas/adaptador | `/map-points/diary-groups`, `/map-points?date=` | alto | fechas, orden y puntos coinciden |
| puntos visibles y contexto | memos + API | `App.jsx` | mapa, reportes y analítica | compartido | props mínimas/adaptador | `/map-points`, `/map-points/context` | alto | barrios, zonas, referencias y coordenadas |
| `mapReportData`/`mapReportPrintData` | `useMemo` | `App.jsx` | métricas, tablas y exportación | compartido con analítica | selectores reutilizados | códigos de barrio y overrides | alto | comparar totales y agrupaciones |
| `fieldDebtSummary`/gráfico | `useMemo` + builders | `App.jsx` | pestaña Mora | exclusivo | módulo Reportes | búsquedas del padrón | alto | deuda total, crítica y sin coincidencia |
| exportación técnica | handlers | `App.jsx` | PDF e impresión | exclusivo | generador de documentos | jsPDF, autoTable, impresión | alto | nombre, páginas, puntos y coordenadas |
| resumen ligero | handlers | `App.jsx` | PDF e impresión | exclusivo | generador de documentos | builders actuales | alto | nombre, barrios, observaciones y totales |
| censo sin coordenadas | handlers | `App.jsx` | PDF e impresión | exclusivo | generador de documentos | builders actuales | alto | ausencia de coordenadas y mismos registros |
| ente regulador | handlers | `App.jsx` | PDF regulatorio | exclusivo | pestaña/generador | jornadas, mapa, técnicos y evidencias | alto | máximo 5, mapa, fotos y personal |
| mapa adjunto | settings + carga de archivo | `App.jsx` | configuración/regulador | exclusivo | drawer Configuración | Data URL no persistida | medio | adjuntar, quitar y generar |
| fotografías/evidencias | datos derivados | `App.jsx` | regulador | compartido | pestaña Ente regulador | puntos seleccionados | alto | cantidades y archivos coinciden |
| estilos del módulo | CSS | `styles.css` | UI y documentos | exclusivo/compartido | `modules/reports/reports.css` | clases impresas existentes | medio | build, desktop, tablet, móvil e impresión |
| sidebar global | JSX + CSS | `App.jsx`, `styles.css` | todos los módulos | compartido | coordinador global | `workspaceView`, localStorage | alto | expandido, colapsado y drawer móvil |

## Contratos existentes que se conservan

- `GET /map-points/diary-groups` → `{ groups: [] }`.
- `GET /map-points` y `GET /map-points?date=AAAA-MM-DD` → arreglo de puntos.
- `POST /map-points/context` → `{ contexts: [] }`.
- `POST /map-points`, `PUT /map-points/:id` y rutas actuales de borrado para edición.
- Consultas actuales del padrón usadas por la verificación de deuda.
- No se crean todavía `/api/reports/*`: el documento las define como propuesta futura no destructiva.

## Persistencia

- Clave actual: `aguaschol-map-report-settings`.
- Forma vigente: `{ "by_date": { "AAAA-MM-DD": settings } }`.
- El cargador también acepta el objeto plano anterior y lo migra a la fecha actual.
- `map_image_data_url` y `map_image_name` se excluyen deliberadamente al persistir; se conserva el comportamiento actual.

## Funciones y salidas que no pueden perderse

- Refrescar puntos y zonas; crear y editar puntos visuales.
- Buscar/abrir jornadas, incluidas jornadas antiguas.
- Filtros, paginación, detalle, mapa y edición de referencia.
- Verificación, gráfica, detalle, PDF e impresión de mora.
- PDF e impresión: técnico con coordenadas, resumen ligero y censo sin coordenadas.
- Ente regulador con hasta cinco jornadas, personal, mapa, fotos y evidencias.
- Configuración por jornada, nombres actuales de archivo y compatibilidad de impresión.

## Plan de migración y riesgos

1. Extraer la presentación a `frontend/src/modules/reports` sin cambiar contratos.
2. Mantener temporalmente en `App.jsx` los cálculos y exportadores compartidos con mapa/analítica, expuestos al módulo mediante un único adaptador.
3. Aplicar jornadas compactas, métricas, pestañas, drawers y modal de vista previa.
4. Verificar build y pruebas existentes antes de retirar el JSX anterior.
5. No reorganizar backend mientras el frontend no esté estabilizado.

Riesgos principales: captura del mapa para PDF, resultados de deuda dependientes del padrón, selección regulatoria múltiple y funciones compartidas con Mapa/Validación. Esos flujos se mantienen sobre los handlers actuales para evitar una migración destructiva.
