# Handoff para Codex — Centro de Inteligencia Territorial GPS

Repo: `juan0793/aguaschol` · rama `main` · 14/08/2026

Este documento es autosuficiente: podés pegarlo tal cual como prompt. Describe lo que **ya está hecho** (fase 1, backend) y lo que **sigue** (fase 2, frontend).

> **Importante:** los archivos de la fase 1 ya están escritos en el working tree pero **no están commiteados**. Nadie ejecutó `git add` ni `git commit`. Revisalos con `git status` / `git diff` antes de empezar.

---

## 1. Contexto en tres párrafos

La pantalla **Control Territorial GPS** (`frontend/src/components/FieldValidationWorkspace.jsx`) muestra el histórico de puntos GPS levantados en campo sobre un mapa Leaflet. El objetivo es convertirla de un mapa histórico en un centro de inteligencia territorial que responda preguntas administrativas: qué barrio concentra la cartera, cuántos negocios hay identificados, qué técnico levanta más puntos, qué claves están repetidas.

El cuello de botella era el botón "Analizar cartera": hacía un `fetch` a `/api/claves/search` **por cada clave única** de la selección — entre 800 y 3,000 peticiones HTTP simultáneas, cada una recorriendo linealmente los ~25,000 registros del padrón. La fase 1 lo reemplazó por un endpoint único de analítica que resuelve todo en un solo pase: **129 ms medidos** con 5,000 puntos.

La fase 2 es conectar el frontend a ese endpoint y evolucionar el panel lateral. No se debe reconstruir la pantalla desde cero.

---

## 2. Invariantes — romper cualquiera de estas es un bug

1. **Rojo = negocio / local comercial.** `COMMERCIAL_MAP_POINT_TYPE = "negocio_local_comercial"` con color `#ef4444` (`frontend/src/constants/formsAndUi.js`). El rojo **no** significa error, alerta, deuda ni incidencia. Azul (`#1576d1`) son los puntos ordinarios. Nunca usar rojo para representar deuda mientras el mapa esté en modo "Tipo de punto".
2. **`marker_color` es un dato persistido en la base.** Los modos de visualización son **función de presentación**: se calcula el color al pintar. Jamás se escribe `marker_color` desde un cambio de modo de visualización.
3. **`map_points` no tiene columna de clave ni de barrio.** Ambos se derivan por regex del texto de `reference_note` + `description`. La regla vive por duplicado en:
   - `frontend/src/utils/barrioCodes.js` + `frontend/src/components/fieldControlUtils.js`
   - `backend/src/utils/claveField.js` ← **nuevo, espejo declarado del anterior**

   Si una cambia, la otra cambia igual, o los números del panel dejan de coincidir con el mapa **sin que nada falle**. Ambos lados tienen test que cubre los mismos casos.
4. **El padrón no está en MySQL.** Son ~25,140 registros en memoria del proceso Node (`claveLookupService.js`), restaurados desde R2 al arrancar. La cartera **no se puede agregar con SQL**: se cruza en memoria con un índice `Map`.
5. **No romper lo que ya funciona:** jornada, búsqueda, filtros, selección de zonas, listado de puntos, cartera, edición/validación, generar reporte, mapa, refrescar histórico.
6. **No crear tablas, no inventar campos, no borrar registros, no alterar datos reales.** Las anomalías se marcan para revisión, nunca se corrigen solas.

---

## 3. Fase 1 — ya implementada (backend)

### Archivos nuevos

| Archivo | Qué hace |
|---|---|
| `backend/src/utils/claveField.js` | `extractClaveFromText`, `getPointClave`, `buildClaveBase`, `resolveFieldZone`, `classifyGpsAccuracy`, `haversineMeters`, `median`. Constante `DUPLICATE_DISTANCE_METERS = 15` |
| `backend/src/utils/claveField.test.mjs` | 6 pruebas, incluidos los mismos casos que `fieldControlUtils.test.mjs` |
| `backend/src/services/padronIndexService.js` | Índice `Map` por clave base sobre el padrón en memoria. Se invalida solo cuando cambia `getMasterVersion()` |
| `backend/src/services/fieldAnalyticsService.js` | Todo el cálculo. `computeFieldAnalytics()` es **pura** (recibe puntos + índice, no toca IO); `getFieldAnalytics()` hace la IO |
| `backend/src/services/fieldAnalyticsService.test.mjs` | 11 pruebas sobre la función pura |

### Archivos modificados

- `claveLookupService.js` → se agregaron `getMasterRecords()` y `getMasterVersion()`. `searchClaveCatastral` quedó intacto.
- `fieldValidationService.js` → se agregó `listFieldPointsForAnalytics()` (proyección reducida + filtros SQL de jornada, técnico, tipo y estado). `listFieldValidationPoints` intacto.
- `fieldValidationController.js` → `fieldAnalyticsHandler`.
- `fieldValidationRoutes.js` → `router.post("/analytics", allowFieldValidation, fieldAnalyticsHandler)`.
- `backend/package.json` → los dos test nuevos agregados al script `test`.

### Verificación

```bash
npm --prefix backend test
```

17 pruebas nuevas pasan. Las de `claveLookupService.test.mjs` requieren el padrón real en `backend/data/`.

---

## 4. Contrato del endpoint

### Request

`POST /api/field-validation/analytics` — roles `admin` y `validadora_campo`, igual que el resto de la pantalla.

```jsonc
{
  "date": "2026-08-13",          // jornada; "" = todo el histórico
  "zones": ["24 - La Libertad"], // etiquetas de barrio tal como las arma resolveFieldZone
  "technicians": [7],            // ids de app_users
  "pointTypes": [],              // valores de MAP_POINT_TYPES
  "validationStatuses": [],      // pending | approved | needs_correction | corrected
  "search": "",
  "includePoints": true          // false omite el detalle por punto
}
```

`date`, `technicians`, `pointTypes` y `validationStatuses` se resuelven en SQL. `zones` y `search` se resuelven en memoria, porque barrio y clave no son columnas.

### Response

```jsonc
{
  "territory":   { "points", "zones", "keys", "technicians", "withoutKey", "pendingValidation" },

  "portfolio":   { "accountsFound", "keysFound", "total", "average", "median",
                   "ranges": [ { "id", "label", "accounts", "keys", "total", "percent" } ] },
                 // ids de rango: sin_deuda, r1..r6 (1-1k, 1k-5k, 5k-10k, 10k-20k, 20k-50k, +50k)

  "commercial":  { "businesses", "percentOfPoints", "keys", "accounts", "total", "average",
                   "withoutDebt", "withDebt", "over5k", "over10k", "over20k", "over50k",
                   "withoutKey", "duplicatedKey", "withoutWater", "withoutSewer", "clandestine",
                   "zones": [ { "label", "businesses", "accounts", "total", "average" } ] },

  "quality":     { "accuracy": { "mean", "median", "best", "worst" },
                   "buckets": [ { "id", "label", "count" } ],   // excelente|buena|aceptable|baja|deficiente|sin_dato
                   "withoutKey", "duplicatedKeys", "duplicatedPoints" },

  "services":    { "withWater", "withoutWater", "withSewer", "withoutSewer", "withoutAccount" },

  "zones":       [ { "code", "name", "label", "points", "keys", "businesses", "accounts",
                     "total", "average", "debtRate", "withoutKey", "duplicates",
                     "accuracyMean", "technicians" } ],        // ordenado por cartera desc

  "technicians": [ { "id", "name", "points", "keys", "businesses", "zones", "diaries",
                     "pointsPerDiary", "accuracyMean", "withoutKey", "duplicates",
                     "approved", "pending", "corrected", "needsCorrection",
                     "keyRate", "validationRate" } ],

  "duplicates":  [ { "clave", "count", "maxDistanceMeters",
                     "kind": "probable_duplicado | inconsistencia_territorial",
                     "points": [ { "id", "latitude", "longitude", "date", "technician", "accuracy_meters" } ] } ],

  "anomalies":   [ { "type", "severity", "detail", "pointIds": [], "total" } ],
                 // type: coordenada_repetida | punto_casi_identico | clave_distante | gps_deficiente
                 //     | fuera_de_area | sin_clave | registro_incompleto | velocidad_improbable

  "selection":   { "flags":  { "sin_clave": [ids], "gps_deficiente": [ids], "gps_sin_dato": [ids],
                               "clave_repetida": [ids], "negocio": [ids], "clandestino": [ids],
                               "sin_abonado": [ids], "pendiente_validacion": [ids] },
                   "ranges": { "sin_deuda": [ids], "r1": [ids], ... } },

  "points":      [ { "id", "clave", "base", "zone", "zoneCode", "business", "accounts",
                     "debt", "debtRange", "accuracyBucket", "water", "sewer", "clandestine" } ],

  "meta":        { "generated_at", "filters", "points_scanned", "points_analyzed",
                   "padron": { "version", "bases", "claves" },
                   "duplicate_threshold_meters", "took_ms" }
}
```

**`selection` y `points` son la clave de la interactividad.** Con ellos el frontend colorea el mapa y filtra por tarjeta **sin volver a pedir nada al servidor**.

---

## 5. Fase 2 — lo que toca hacer (frontend)

Ubicar el código nuevo en `frontend/src/modules/campo/`, siguiendo el patrón de `modules/inspecciones` y `modules/clandestinos`. **No** dentro de `App.jsx`, que ya pesa 890 KB.

### 5.1 Reemplazar `analyzeSelection`

En `FieldValidationWorkspace.jsx` líneas 106–116, sustituir el `Promise.all` de N peticiones por una sola:

```js
const response = await apiFetch("/field-validation/analytics", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ date: dateFilter, zones: [...selectedZones],
                         pointTypes: typeFilter ? [typeFilter] : [], search: query })
});
```

Recomendación: disparar automáticamente cuando cambien los filtros, con debounce de ~300 ms y `AbortController` para cancelar la anterior, en vez de exigir clic en "Analizar cartera". El documento original pide que **todas** las métricas reaccionen a jornada, barrios, técnicos, tipos, búsqueda y filtros activos. Conservar el botón como refresco manual.

Mostrar `skeleton` mientras carga, no bloquear el mapa.

### 5.2 Selector "Visualizar mapa por"

Nuevo archivo `frontend/src/modules/campo/fieldMapModes.js` con dos funciones puras y su test:

- `resolveMarkerColor(point, mode, analyticsPoint)` — con `mode === "tipo"` devuelve `point.marker_color` **sin transformar** (el mapa actual no cambia ni un píxel).
- `buildLegend(mode, analytics)` — devuelve las entradas de la leyenda del modo activo.

Modos: `tipo`, `cartera`, `tecnico`, `precision`, `validacion`, `jornada`, `servicios`, `comercial`.

Para el modo `cartera`, los cortes de color del mapa son más gruesos que los rangos analíticos: `0` · `1–5,000` · `5,001–15,000` · `15,001–50,000` · `+50,000`. Derivarlos de `analyticsPoint.debt`. La leyenda debe decir explícitamente que los colores representan deuda. En el popup, si el punto es negocio, seguir mostrando **Tipo: Negocio / local comercial**.

`FieldMap.jsx` línea 234 lee `point.marker_color` directo. Cambio mínimo y retrocompatible: aceptar una prop opcional `getMarkerColor` y usarla si viene, con `point.marker_color` como valor por defecto.

### 5.3 Tarjetas de métricas interactivas

Las tarjetas actuales (Puntos, Barrios, Claves, Técnicos) se conservan. Se agregan: Abonados encontrados, Cartera total, Deuda promedio, Deuda mediana, Negocios/locales, Cartera comercial, Puntos sin clave, Claves repetidas, GPS deficiente, Pendientes de validación.

Al hacer clic en una tarjeta, el mapa debe mostrar inmediatamente ese subconjunto: `selection.flags[flagId]` da los ids; filtrar `selectedPoints` por ese `Set`. Mismo mecanismo para los rangos de cartera con `selection.ranges[rangeId]`. El filtro debe poder limpiarse.

### 5.4 Panel lateral

Evolucionar las pestañas actuales (Zonas, Puntos, Cartera) a cinco: **Territorio** (zonas, puntos, claves) · **Cartera** (resumen, rangos, mayores deudores) · **Comercial** (negocios, cartera comercial, barrios comerciales) · **Calidad** (sin clave, duplicados, GPS, inconsistencias) · **Técnicos** (técnicos, jornadas, productividad).

Evitar que el panel quede demasiado ancho. El mapa sigue siendo el protagonista.

### 5.5 Diseño

Mantener la estética actual: blanco, azul institucional, bordes suaves, sombras sutiles, alta densidad de información. Evitar tarjetas gigantes, glassmorphism, gradientes innecesarios y animaciones exageradas. Microinteracciones: hover suave, transición de panel 180–250 ms, skeleton durante el análisis.

### 5.6 Criterios de aceptación

- El modo "Tipo de punto" produce exactamente los mismos colores que hoy.
- Una interacción de filtro dispara **una** petición, no N.
- `fieldControlUtils.test.mjs` sigue verde; se agrega test para `fieldMapModes.js`.
- Jornada, búsqueda, filtros, zonas, listado, edición, reporte y refrescar siguen funcionando igual.
- Ningún flujo escribe `marker_color` como efecto de un cambio de modo de visualización.

---

## 6. Fases siguientes (referencia)

- **Fase 3** — Técnicos: ranking, comparador y ruta aproximada (polyline cronológica por `created_by` + `created_at`, rotulada **"Recorrido estimado basado en puntos registrados"**, nunca presentada como rastreo GPS continuo).
- **Fase 4** — Cruces con clandestinos e inspecciones. El cruce con `inmuebles_clandestinos` ya está en el backend (`commercial.clandestine`, flag `clandestino`). Falta inspecciones: reutilizar `inspeccionesService`, no duplicar datos.
- **Fase 5** — Polígonos GeoJSON de barrios, heatmaps, histórico avanzado. `resolveFieldZone` ya está escrito como cascada de estrategias para que incorporar polígonos sea agregar una rama, no reescribir.

---

## 7. Pendientes que no dependen de código

1. **Datos reales sin confirmar.** Las consultas están en `docs/consultas_diagnostico_territorial.sql` (solo lectura). Las tres que cambian decisiones: bloque 1 (cuántos puntos y cuántos sin clave → decide si conviene una proyección `?view=map` en el listado), bloque 2 (si "negocio" siempre lleva `point_type` o hay puntos rojos puestos a mano → decide el criterio comercial; hoy el backend cuenta **solo** por `point_type`), bloque 4 (claves repetidas y separación → valida el umbral de 15 m).
2. **`GET /api/field-validation` no tiene `LIMIT` ni proyección.** Devuelve `map_points.*` de todo el histórico en cada carga de pantalla. A 50,000 puntos son 20–40 MB. Propuesta pendiente: parámetro opcional `?view=map` que omita los campos de texto largo, sin cambiar el contrato por defecto.
3. **Bot de Telegram con dos instancias en producción.** Cada arranque loguea `Conflict: terminated by other getUpdates request`. Fuera del alcance de esta pantalla, pero está ahí.

El detalle completo de la auditoría está en `CONTROL_TERRITORIAL_AUDIT.md`, en la raíz del repo.
