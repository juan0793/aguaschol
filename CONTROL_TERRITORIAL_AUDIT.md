# Control Territorial GPS — Auditoría previa y plan de cambios

Respuesta a la sección **30. PRIMERA TAREA** del documento. Nada de código modificado todavía.

Fecha: 14/08/2026 · Alcance revisado: `FieldValidationWorkspace.jsx`, `FieldMap.jsx`, `fieldControlUtils.js`, `utils/barrioCodes.js`, `constants/formsAndUi.js`, `fieldValidationService/routes/controller`, `mapPointService`, `claveLookupService`, `barrioCodeService`, `clandestinosService`, `inspeccionesService`, `sql/schema.sql`, `app.js`.

---

## 1. Resumen ejecutivo

El plan del documento es correcto en su diagnóstico principal (el frontend consulta las claves una por una y eso no escala), pero **hay cuatro hallazgos en el código actual que cambian cómo debe implementarse**. Los enumero primero porque afectan decisiones de arquitectura:

| # | Hallazgo | Impacto en el plan |
|---|---|---|
| 1 | El padrón **no está en MySQL**: son 24,080 registros en un JSON cargado en memoria del proceso Node | La cartera **no se puede agregar con SQL**. Se agrega en Node con un índice `Map`. La sección 6 del documento ("agregaciones SQL") no aplica tal cual |
| 2 | `map_points` **no tiene columna de clave ni de barrio** — la clave se extrae con regex desde `reference_note`/`description`, y solo en el frontend | Para mover el análisis al backend hay que **portar** esa lógica. Si diverge, los números del panel dejarán de coincidir con los del mapa |
| 3 | `GET /api/field-validation` devuelve **todo el histórico, sin filtro ni límite** | Segundo cuello de botella, no mencionado en el documento. A 50,000 puntos son ~20–40 MB por carga de pantalla |
| 4 | El color ya es un dato persistido (`marker_color`) y "rojo = negocio" es explícito en constantes | Los modos de visualización deben ser **función de presentación**, nunca escritura en `marker_color` |

---

## 2. Qué se reutiliza (inventario verificado)

### Tablas — ninguna nueva en fases 1 a 4

| Tabla | Uso en el centro de inteligencia | Estado |
|---|---|---|
| `map_points` | Fuente única de puntos. Ya tiene `accuracy_meters`, `diary_date`, `created_by`, `validation_status`, `point_type`, `housing_units`, `is_terminal_point` | Suficiente |
| `map_point_validation_logs` | Historial de validación (§22). Guarda `previous_payload_json` / `next_payload_json` / `notes` / `created_at` → permite la línea de tiempo **y** el "tiempo hasta aprobación" con `TIMESTAMPDIFF` | Suficiente |
| `audit_logs` | Ya recibe `map_point.validated` desde `fieldValidationService` | Suficiente |
| `app_users` | Técnicos (`created_by` → `full_name`), ya viene con JOIN en `SELECT_VALIDATION_POINT` | Suficiente |
| `inmuebles_clandestinos` | Cruce §18. `clave_catastral` es **UNIQUE** → cruce directo por clave. Trae `conexion_agua`, `conexion_alcantarillado`, `estado_padron`, `estado_operativo` | Suficiente |
| `inspecciones` | Cruce §19. Tiene `idx_inspecciones_clave` → agregación por clave es barata | Suficiente |
| `barrio_codigo_catalogo` + `planos_barrios` | Catálogo de barrios (ya lo consume la pantalla vía `/planos/barrios` + `barrioCodes`) | Suficiente |

**No propongo crear ninguna tabla.** Tampoco columnas nuevas en fase 1 (ver §6 sobre la opción de materializar `clave` / `barrio_codigo` más adelante, con medición previa).

### Índices — no hace falta crear ninguno ahora

`map_points` ya tiene: `idx_map_points_created_at`, `idx_map_points_diary_date`, `idx_map_points_creator`, `idx_map_points_validation_status`, `idx_map_points_validated_by`.

El documento (§25) sugiere evaluar un índice en `point_type`. **No lo recomiendo todavía**: con 5,000 filas MySQL hace table scan de todas formas y el índice solo agrega costo de escritura. Reevaluar a partir de ~25,000 filas, midiendo con `EXPLAIN`. Tampoco recomiendo índice en `latitude`/`longitude`: sin tipo espacial ni `SPATIAL INDEX` un índice B-tree sobre decimales no sirve para consultas por área.

### Endpoints y servicios existentes

| Recurso | Reutilización |
|---|---|
| `GET /api/field-validation` | Se conserva **sin cambios de contrato**. Es la carga del mapa |
| `PUT /api/field-validation/:id` | Se conserva. Ya escribe log de validación + auditoría |
| `GET /api/claves/search` | **Se conserva intacto.** Tiene otros 4 llamadores en `App.jsx` (líneas 5254, 6324, 6827) y el chat de lookup. Solo deja de usarse desde `analyzeSelection` |
| `GET /api/planos/barrios`, `/api/barrios` | Catálogo de barrios, ya consumidos |
| `GET /api/map-points/diary-groups` | Ya hace `GROUP BY` de jornadas con `COUNT(*)` — patrón a imitar para §17 (evolución temporal) |
| `barrioCodeService.resolveBarrioNameFromClave()` | Ya existe en backend. Reutilizable directo |
| `mapPointService` (`POINT_TYPE_LABELS`) | Ya duplica las etiquetas de tipo en backend. Reutilizar en vez de volver a duplicar |
| `auditService.createAuditLog()` | Reutilizar si el análisis llega a registrar acciones |

### Frontend

`FieldValidationWorkspace.jsx` (22 KB) ya está fuera de `App.jsx` y con `lazy()`. `FieldMap.jsx` ya usa `preferCanvas: true` y `L.circleMarker` — es decir, **ya renderiza en canvas**, adecuado hasta ~10k puntos. `fieldControlUtils.js` tiene la agrupación por zona y el resumen; tiene test (`fieldControlUtils.test.mjs`).

---

## 3. Los cuatro hallazgos, en detalle

### 3.1 El padrón vive en memoria, no en la base de datos

`claveLookupService.js:518` hace `let masterRecords = normalizeMasterRecords(readJsonFile(maestroPath, []))` — carga `backend/data/maestro-claves.json` (14 MB, **24,080 registros** según `maestro-meta.json`) a un array del proceso. `searchClaveCatastral` (línea 1381) hace un `.filter()` lineal sobre ese array.

Cada registro ya trae exactamente lo que el centro de inteligencia necesita:

```
clave_catastral, clave_base, abonado, inquilino, nombre, barrio_colonia,
agua, alcantarillado, barrido, recoleccion, desechos_peligrosos,
valor, intereses, total
```

**Consecuencia:** no hay JOIN posible entre `map_points` y la cartera. Pero esto es una buena noticia para el rendimiento: cruzar 5,000 puntos contra un `Map` de 24,080 entradas es O(n+m) en memoria — del orden de **milisegundos**, sin tocar disco ni red.

**Bloqueo menor:** `masterRecords` es privado del módulo. Hay que exportar un accessor (`getMasterRecords()`) y una clave de versión (`masterMeta.updated_at`) para invalidar el índice cuando se re-importa el padrón.

### 3.2 La clave y el barrio no existen como dato

`map_points` guarda solo `reference_note` (VARCHAR 255) y `description` (TEXT). La clave sale de:

```js
// frontend/src/utils/barrioCodes.js:8
extractClaveFromText = (v) => String(v).match(/\b\d{2,3}-\d{2}-\d{2}(?:-\d{2})?\b/)?.[0] || ""
```

y el barrio de `getFieldPointZone()` (`fieldControlUtils.js:26`), que aplica una cascada: `report_zone_label` → `suggested_zone` → `barrio_colonia` → código derivado de la clave → catálogo.

**Riesgo real:** si el backend implementa su propia versión de esta cascada, el conteo de "Barrios: 42" del panel y el agrupamiento del mapa se van a desincronizar, y nadie va a saber cuál de los dos está bien.

**Mitigación propuesta:** un único módulo `backend/src/utils/claveField.js` con la lógica portada literalmente, con test espejo del `fieldControlUtils.test.mjs` existente, y que el frontend deje de recalcular lo que ya vino resuelto del backend (el punto que devuelve `/analytics` trae su `zone` y su `clave` resueltas).

### 3.3 El listado carga todo el histórico

`listFieldValidationPoints()` (`fieldValidationService.js:66`) construye la consulta sin `LIMIT`, y `FieldValidationWorkspace` la llama sin parámetro de fecha (`apiFetch("/field-validation")`, línea 46). Devuelve `map_points.*` — incluyendo `description` (TEXT), `validation_notes` y `correction_notes` completos, más los dos JSON de payload no, pero sí todo lo demás.

Estimación: ~400–800 bytes por punto → **2–4 MB hoy**, 20–40 MB a 50,000 puntos. Esto se paga en cada entrada a la pantalla.

**Propuesta (fase 1, sin romper contrato):** agregar un parámetro opcional `?view=map` que proyecte solo las columnas que el mapa necesita (`id, latitude, longitude, accuracy_meters, point_type, marker_color, is_terminal_point, validation_status, diary_date, created_at, created_by, created_by_name, reference_note`) y omita los campos de texto largo, que ya se cargan al abrir el detalle de un punto. Sin el parámetro, el endpoint responde exactamente como hoy.

### 3.4 El color ya es dato, y el rojo ya es explícito

No es una convención implícita que haya que proteger a mano:

```js
// constants/formsAndUi.js:12
COMMERCIAL_MAP_POINT_TYPE = "negocio_local_comercial"
COMMERCIAL_MAP_POINT_COLOR = "#ef4444"
```

`FieldMap.jsx:234` pinta `point.marker_color` tal cual viene de la BD.

**Propuesta:** una función pura `resolveMarkerColor(point, mode, analytics)` en el frontend. Con `mode === "tipo"` devuelve `point.marker_color` — es decir, **el modo por defecto no cambia un solo píxel del mapa actual**. Los otros modos (cartera, técnico, precisión, estado, jornada, servicios, actividad comercial) devuelven un color calculado, y la leyenda cambia con ellos. `marker_color` en la base **nunca** se toca desde la visualización.

---

## 4. El costo actual del "Analizar cartera", medido sobre el código

`FieldValidationWorkspace.jsx:106-116`:

```js
const results = await Promise.all(keys.map(async (key) =>
  apiFetch(`/claves/search?clave=${key}&field=clave`) ...
));
```

Con ~5,000 puntos y del orden de 800–3,000 claves únicas:

- **800–3,000 peticiones HTTP simultáneas.** El navegador limita a ~6 conexiones por dominio, así que se serializan en decenas de tandas.
- Cada petición recorre linealmente los 24,080 registros del padrón → hasta **~72 millones de comparaciones de cadena** en el servidor para un solo clic.
- El controlador fuerza `Cache-Control: no-store` en cada una (`claveLookupController.js:17`), así que no hay reutilización posible.
- Cada respuesta es un JSON con todos los campos de cada coincidencia.

Con un solo `POST /analytics`: **1 petición**, un índice `Map` construido una vez, y un recorrido O(puntos + padrón). Estimación conservadora: de decenas de segundos a **menos de 300 ms**.

Esto confirma el diagnóstico de la sección 6 del documento y es, con diferencia, la mejora de mayor retorno.

---

## 5. Cambios concretos propuestos

### Fase 1 — Backend de analítica (lo que desbloquea todo lo demás)

**Archivos nuevos (4):**

| Archivo | Contenido |
|---|---|
| `backend/src/utils/claveField.js` | `extractClaveFromText`, `buildBaseKey`, `getBarrioCodeFromClave`, `resolveFieldZone`, `classifyGpsAccuracy`, `haversineMeters`. Portado 1:1 desde el frontend |
| `backend/src/utils/claveField.test.mjs` | Test espejo de `fieldControlUtils.test.mjs` — garantiza que backend y frontend extraen la misma clave |
| `backend/src/services/padronIndexService.js` | `Map<clave_base, registros[]>` sobre `masterRecords`, invalidado por `masterMeta.updated_at` |
| `backend/src/services/fieldAnalyticsService.js` | Un solo recorrido de los puntos filtrados que produce todos los bloques del response |

**Archivos modificados (3):**

- `claveLookupService.js` → exportar `getMasterRecords()` y `getMasterVersion()`. Sin tocar `searchClaveCatastral`.
- `fieldValidationController.js` → un handler nuevo.
- `fieldValidationRoutes.js` → `router.post("/analytics", allowFieldValidation, fieldAnalyticsHandler)` — mismo guard de roles que el resto (`admin`, `validadora_campo`).

**Contrato propuesto** (respeta el del documento, §7):

```jsonc
// POST /api/field-validation/analytics
{ "date": "", "zones": [], "technicians": [], "pointTypes": [],
  "validationStatuses": [], "search": "", "debtRange": "", "flags": [] }
```

```jsonc
{
  "territory":   { "points", "zones", "keys", "keysUnique", "technicians", "withoutKey" },
  "portfolio":   { "accountsFound", "total", "average", "median",
                   "ranges": [{ "id", "label", "accounts", "keys", "total", "percent" }] },
  "commercial":  { "businesses", "percentOfPoints", "accounts", "total", "average",
                   "withoutDebt", "withDebt", "over5k", "over10k", "over20k", "over50k",
                   "withoutKey", "duplicatedKey", "withoutWater", "withoutSewer", "clandestine" },
  "quality":     { "accuracy": { "mean", "median", "best", "worst" },
                   "buckets": [{ "id", "label", "count" }], "withoutKey", "duplicates" },
  "technicians": [{ "id", "name", "points", "keys", "businesses", "zones", "diaries",
                    "pointsPerDiary", "accuracyMean", "withoutKey", "duplicates",
                    "approved", "pending", "corrected", "validationRate" }],
  "zones":       [{ "code", "name", "points", "keys", "businesses", "accounts",
                    "total", "average", "debtRate", "withoutKey", "duplicates",
                    "accuracyMean", "technicians" }],
  "services":    { "withWater", "withoutWater", "withSewer", "withoutSewer" },
  "duplicates":  [{ "clave", "count", "maxDistanceMeters", "kind", "points": [...] }],
  "anomalies":   [{ "type", "severity", "pointIds": [], "detail" }],
  "pointFlags":  { "<pointId>": ["sin_clave", "gps_deficiente", "duplicado", "clandestino"] }
}
```

`pointFlags` es el añadido que hace que las tarjetas sean **interactivas** (§4): al hacer clic en "GPS deficiente: 37" el frontend filtra por bandera sin volver a pedir nada al servidor.

**Detalles de cálculo:**

- **Duplicados (§11):** agrupar por clave; si hay ≥2 puntos, calcular la distancia máxima con Haversine. `≤ 30 m` → `probable_duplicado` (Caso A); `> 30 m` → `inconsistencia_territorial` (Caso B). El umbral debe ser una constante configurable, no un número suelto.
- **Precisión GPS (§10):** cortes 5 / 10 / 20 / 30 m tal como pide el documento. `accuracy_meters` es `NULL` en puntos viejos → categoría explícita "sin dato", **no** contarlos como deficientes.
- **Mediana:** sobre el array ya materializado, sin ordenar dos veces.
- **Clandestinos e inspecciones (§18, §19):** una sola consulta agregada `WHERE clave_catastral IN (...)` por lote de claves, reutilizando los índices `UNIQUE`/`idx_inspecciones_clave` existentes. No duplicar datos: solo contadores y última fecha; el detalle se pide a los servicios existentes al abrir el punto.

**Frontend en fase 1 (mínimo, sin rediseño):** reemplazar el cuerpo de `analyzeSelection` por un solo `POST`, y alimentar con la respuesta las tarjetas de métrica existentes más las nuevas. Todo lo demás (jornada, búsqueda, filtros, zonas, listado, edición, reporte, refrescar) queda tal cual.

### Fases 2 a 5

Coinciden con el documento. Solo dos precisiones:

- **Ubicación del código nuevo del frontend:** `frontend/src/modules/campo/`, siguiendo el patrón ya establecido por `modules/inspecciones` y `modules/clandestinos` (páginas, componentes, hooks, services, styles). **No** dentro de `App.jsx`, que ya está en 890 KB / ~17,000 líneas.
- **Fase 5 (polígonos):** el `resolveFieldZone` del módulo compartido debe recibir el barrio como resultado de una estrategia, para que incorporar GeoJSON después sea agregar una estrategia y no reescribir el cálculo.

---

## 6. Riesgos de rendimiento identificados

| Riesgo | Severidad | Mitigación |
|---|---|---|
| N peticiones a `/claves/search` (situación actual) | **Alta** | Fase 1, endpoint único |
| Carga completa del histórico sin límite ni proyección | **Alta a futuro** | `?view=map` con proyección de columnas; medir antes de paginar |
| Divergencia entre extracción de clave del backend y del frontend | **Alta** (silenciosa: da números erróneos sin fallar) | Módulo único + test espejo |
| Detección de duplicados O(n²) si se compara todo contra todo | Media | Agrupar por clave primero; solo comparar dentro del grupo |
| El índice del padrón se reconstruye en cada petición | Media | Cachear por `masterMeta.updated_at` |
| Leaflet con >10k marcadores | Baja hoy | Ya usa canvas. Reevaluar con datos reales, no antes |
| `masterRecords` (24k registros) reside en memoria del proceso | Baja | Ya es así hoy; el índice agrega ~1–2 MB |

---

## 7. Compromisos de no-ruptura

Lo que debe seguir funcionando idéntico y cómo se protege:

- **Jornada, búsqueda, filtros, selección de zonas, listado, cartera, edición/validación, generar reporte, mapa, refrescar** → ninguno de sus caminos de código se toca en fase 1; solo se sustituye el cuerpo de `analyzeSelection`.
- **Rojo = negocio, azul = ordinario** → el modo por defecto devuelve `point.marker_color` sin transformación.
- **`/api/claves/search`** → sin cambios; sus otros 4 llamadores no se enteran.
- **`marker_color` en base de datos** → solo se escribe desde la edición del punto, como hoy.
- Sin borrado de registros, sin alteración de datos reales, sin campos inventados. Las anomalías se **marcan**, nunca se corrigen solas.

---

## 8. Preguntas antes de escribir código

1. **¿Cuántos puntos hay hoy en producción?** El documento dice "más de 5,000". El número real decide si `?view=map` entra en fase 1 o espera.
2. **¿`point_type = "negocio_local_comercial"` se usa de forma consistente?** Si hay negocios marcados solo poniendo el color rojo a mano, el conteo comercial saldrá bajo y hay que contemplar ambos criterios.
3. **Umbral de duplicado por cercanía:** ¿30 m es razonable para Choluteca, o prefieren algo más estrecho (10–15 m) dado que la precisión media parece rondar los 5 m?

---

## Anexo — Fase 1 implementada (backend)

Decisiones confirmadas: negocios se cuentan **solo por `point_type = negocio_local_comercial`**; umbral de duplicado **15 m**.

### Archivos

**Nuevos**

- `backend/src/utils/claveField.js` — extracción de clave, barrio, precisión GPS, Haversine, mediana. Espejo declarado del frontend.
- `backend/src/utils/claveField.test.mjs` — 6 pruebas, incluidos los mismos casos que `fieldControlUtils.test.mjs`.
- `backend/src/services/padronIndexService.js` — índice `Map` por clave base sobre el padrón en memoria, invalidado por versión del padrón.
- `backend/src/services/fieldAnalyticsService.js` — cálculo completo en un solo pase.
- `backend/src/services/fieldAnalyticsService.test.mjs` — 11 pruebas sobre la función pura.

**Modificados**

- `claveLookupService.js` — se agregaron `getMasterRecords()` y `getMasterVersion()`. `searchClaveCatastral` no se tocó.
- `fieldValidationService.js` — se agregó `listFieldPointsForAnalytics()` con proyección reducida y filtros SQL (jornada, técnico, tipo, estado). `listFieldValidationPoints` intacto.
- `fieldValidationController.js` — handler `fieldAnalyticsHandler`.
- `fieldValidationRoutes.js` — `POST /analytics` con el mismo guard de roles.
- `package.json` — los dos test nuevos agregados al script `test`.

### Contrato

`POST /api/field-validation/analytics`

```jsonc
{ "date": "2026-08-13", "zones": ["24 - La Libertad"], "technicians": [7],
  "pointTypes": [], "validationStatuses": [], "search": "", "includePoints": true }
```

Devuelve `territory`, `portfolio` (con `ranges`), `commercial` (con ranking de barrios comerciales), `quality`, `services`, `zones`, `technicians`, `duplicates`, `anomalies`, `selection` y `meta`.

Dos bloques que conviene conocer antes de tocar el frontend:

- **`selection`** — `{ flags: { sin_clave: [ids], gps_deficiente: [ids], clave_repetida: [...], negocio, clandestino, sin_abonado, pendiente_validacion }, ranges: { sin_deuda: [ids], r1: [...], ... } }`. Es lo que hace clicables las tarjetas: "GPS deficiente: 37" filtra el mapa sin pedir nada al servidor.
- **`points`** — una fila compacta por punto: `{ id, clave, base, zone, business, accounts, debt, debtRange, accuracyBucket, water, sewer, clandestine }`. Con esto se pintan los modos de color y el popup sin consultas extra. Se puede omitir con `includePoints: false`.

### Verificación

- 17 pruebas nuevas, todas en verde (`node --test`).
- Medición con datos sintéticos del tamaño real (5,000 puntos, 24,080 registros de padrón, 12 técnicos, 140 barrios): **129 ms** y ~1.1 MB de JSON. Frente a las 800–3,000 peticiones actuales.
- Los tests existentes de `claveLookupService` fallan **en el contenedor de análisis** porque ahí no está `maestro-claves.json`; dependen de los datos reales y no de los cambios (el único cambio en ese archivo son dos exports nuevos). Conviene correr `npm --prefix backend test` en la máquina con los datos para confirmarlo.

### Pendiente antes de fase 2

1. Correr la suite completa en local con los datos reales.
2. Probar el endpoint con la jornada más pesada y revisar `meta.took_ms` y `meta.points_scanned`.
3. Recién entonces conectar el frontend (reemplazar `analyzeSelection` por el POST único).

---

## Anexo 2 — Revisión de producción (14/08/2026)

Hecha con el MCP de Railway ya autorizado en la sesión. No inicié sesión en la aplicación: no ingreso contraseñas en formularios, es una regla que mantengo siempre.

### Topología real

| Pieza | Servicio Railway | Nota |
|---|---|---|
| `www.controlaguas.com` | `heroic-ambition` | Frontend estático (`node ./server.js`, puerto 8080). Es el que tiene el dominio propio |
| API | `aguaschol` | `npm --prefix backend start`, puerto 8080. Sin dominio propio |
| Base | `MySQL` | Último deploy 05/08 |

Último deploy de ambos servicios: **13/08/2026 22:19, SUCCESS**. `GET /api/health` responde `{"ok":true,"mode":"mysql","dbReady":true}`.

### Corrección al documento: el padrón tiene 25,140 registros, no 24,080

El log de arranque de producción dice: *"Padron maestro recuperado desde r2: 25140 registros"*. El `maestro-meta.json` del repo (24,080) está desactualizado — producción **no** usa el JSON del repositorio, lo restaura desde R2 al arrancar (`startDatabaseReconnectLoop` → `restoreActivePadronFromDatabase`).

Esto importa para la fase 1 y lo verifiqué: ese camino pasa por `replaceMasterRecordsFromImport` → `activateMasterRecordsInMemory`, que actualiza `masterMeta.updated_at`. Es decir, **`getMasterVersion()` cambia y el índice del padrón se reconstruye correctamente** también cuando la restauración viene de R2, no solo cuando alguien sube un Excel. El diseño aguanta el flujo real.

### Pendientes detectados (fuera del alcance de esta pantalla)

1. **Bot de Telegram con dos instancias.** En cada arranque: `Error del bot de Telegram: Conflict: terminated by other getUpdates request; make sure that only one bot instance is running`. Hay un segundo proceso consumiendo `getUpdates` con el mismo token — probablemente un backend local o un deploy viejo. Mientras dure, los mensajes se reparten entre las dos instancias de forma impredecible. Anotado, no revisado a fondo.
2. **Ruido de escaneo.** Un bot (91.92.241.196) pidió `/.git/HEAD` y `/.git/config` y recibió 200. **No es una fuga**: verifiqué el contenido y es el `index.html` del SPA por el fallback de rutas. Vale saber que ese fallback responde 200 a cualquier ruta inexistente, así que los logs no distinguen un escaneo de una visita real.

### Lo que sigue sin poder medir desde aquí

El MCP de Railway devuelve los **nombres** de las variables del servicio MySQL pero no sus valores (esta conexión es una app OAuth y los redacta), así que no puedo abrir la base desde aquí. Las consultas de diagnóstico quedaron en `docs/consultas_diagnostico_territorial.sql` — todas de solo lectura. Las tres que más cambian las decisiones pendientes:

- **bloque 1** — cuántos puntos hay y cuántos sin clave (decide si `?view=map` entra ya).
- **bloque 2** — si "negocio" siempre se marca con `point_type` o hay puntos rojos puestos a mano (decide el criterio del análisis comercial).
- **bloque 4** — cuántas claves están repetidas y qué tan separadas (valida el umbral de 15 m).
