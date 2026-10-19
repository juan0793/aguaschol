## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Nota para Claude: QA de Control de entregas (2026-10-08)

- Los formularios de lote y cierre conservan borradores por usuario y registro en `sessionStorage`; si falla el envío, se recuperan dentro de la misma pestaña. `sessionStorage` se borra al cerrar la pestaña y no sincroniza entre dispositivos. El cierre avisa por filas nuevas, sobrantes, observación y texto pegado.
- El reintento es manual a propósito: las escrituras de entregas todavía no tienen clave de idempotencia y una interrupción de red o un error 5xx puede ocultar un guardado exitoso. Antes de volver a enviar, revisa el lote; el cierre exige reabrir la captura y vuelve a pedir confirmación de duplicados.
- El avance no presenta el estado vacío junto a un error; el encabezado ya no informa "Todo guardado" para Entregas. En móvil, la pestaña de pendientes usa "Pend." con nombre accesible completo y la barra respeta el área segura.
- Se ajustaron etiquetas y plurales en el cierre, el corte del ciclo y el reparto. Verificado: `npm run test:entregas` (35 aprobadas) y `npm run build` (correcto; Vite conserva el aviso de chunks grandes).
- Actualizado el 2026-10-08: la integración de backend se ejecutó contra MySQL local y pasó. Sigue pendiente una revisión en un dispositivo iOS real.

## Nota para Claude: continuación de QA de Puntos GPS (2026-10-08)

- Se completó el CSS faltante de Puntos GPS y se verificó el visor en Chrome móvil a 390 × 844. La banda de coordenadas queda bajo la barra de la app; atribución y escala del mapa quedan encima de la hoja inferior.
- La cola combina IndexedDB con el respaldo local aunque IndexedDB vuelva a estar disponible, prefiere la copia más reciente y no confirma un punto ni sus cambios si no se pudieron guardar localmente. El indicador distingue puntos por enviar, rechazados y falta de señal.
- Al fallar sin red la edición de un punto ya enviado, conserva el borrador en `sessionStorage`, por usuario y punto. Para recuperarlo en la misma pestaña, vuelve a abrir ese punto y reintenta con conexión; no se envía automáticamente.
- Se corrigieron plurales, acentos y mensajes del mapa sin señal. Si no se baja ningún cuadro del mapa, la zona no aparece como guardada. El selector de tipo ahora responde a flechas y los botones de deshacer/detalles y la manija móvil tienen mayor área táctil.
- Verificado: 11 pruebas dirigidas de cola, recuperación, mosaicos y zonas offline; `npm run build` y `git diff --check` correctos. La compilación mantiene el aviso existente de chunks mayores a 500 kB.
- Revisión real en iOS sigue pendiente porque el entorno de trabajo es Linux. En la captura web, los mosaicos y algunas llamadas API no cargaron (`Failed to fetch`); la verificación visual confirma la composición, no la disponibilidad de los servicios de mapa.

## Nota para Claude: PWA de Control Aguas (2026-10-10)

- Se agregó `frontend/public/manifest.webmanifest`, iconos 192×192, 512×512 y Apple touch, y `frontend/public/sw.js`. `frontend/src/main.jsx` registra el service worker en producción.
- El service worker precarga el shell y las dependencias estáticas iniciales, y guarda recursos de `/assets/` y `/icons/`. Excluye `/api` y `/uploads` para no persistir respuestas ni fotos privadas.
- `frontend/server.js` sirve el MIME de `webmanifest` y usa `no-cache` para el HTML, manifiesto y service worker. Solo `/assets/` (con hash) es `immutable`; iconos y demás archivos de `public/` usan `max-age=86400`.
- La app se renombró de "App Clandestinos" a "Control Aguas", el mismo nombre del login. Las cachés usan el prefijo `controlaguas-`. El service worker pide los iconos primero a la red y limita `controlaguas-assets-v1` a 160 entradas, borrando las más antiguas.
- Verificado en Chrome con `node frontend/server.js` (`frontend-prod` en `.claude/launch.json`): el service worker queda activo y controla la página, el shell precarga 14 recursos y los encabezados de caché son correctos.
- Verificado: `node --check public/sw.js`, parseo del manifiesto y `npm run build` correctos. Vite aún informa bundles mayores de 500 kB. No se ejecutó la suite de tests.
- Alcance offline: carga el shell de la app; búsquedas, registros y fotos requieren conexión. La instalación se ofrece desde el menú del navegador al publicar por HTTPS.
- Graphify code-only actualizado: 4,870 nodos y 12,373 relaciones. No se analizaron 10 archivos SQL porque falta `tree_sitter_sql`; refrescar nombres de comunidades con IA requiere una clave de proveedor.

## Nota para Claude: verificación sin conexión (2026-10-15)

- `sw.js` (cachés v5) precarga también los módulos de `import()` dinámico (Reclamos, Inspecciones, Entregas, Fichas, mapa), salvo lo pesado de oficina (`NO_PRECARGAR`: PDF, Planos, MapLibre). Se repite cuando llega un `index.html` nuevo y borra lo de versiones viejas: cada despliegue cambia los hash sin cambiar `sw.js`.
- `lazyWithRetry` devuelve el aviso "Esta pantalla no se pudo abrir" en vez de dejar la app en blanco cuando un módulo no se puede bajar.
- "Guardar zona" se cancelaba sola: el efecto de `OfflineZonesPanel` dependía de `onClose` (nuevo en cada render). Arreglado.
- Verificado en local con `frontend-prod` apagando servidores: el técnico entra sin red, el mapa usa la zona guardada (y amplía el detalle), Reclamos abre y dice "Sin conexión", un punto marcado sin red se envía solo al volver la conexión. Las sesiones de administrador y de prueba de perfil siguen exigiendo validar en línea (se quedan en "Validando sesión…" sin red).

## Nota para Claude: informe de campo de varias jornadas (2026-10-16)

- "Generar documento" de Reportes de levantamiento tiene el paso "Jornadas" para Técnico con coordenadas y Censo: se marcan varias, los barrios se suman entre días y la salida pasa a PDF (Imprimir y Vista previa quedan solo para una jornada). El Resumen ligero sigue siendo de una jornada.
- El PDF de técnico y censo sale de `modules/reports/fieldReportPdf.js` (una o varias jornadas): encabezado con la(s) jornada(s), resumen por tipo y por jornada, cada día en su propia hoja, filas que no se parten, "Página X de Y" y nombre de archivo con la fecha de la jornada. Sin columna "Marca" ni recuadro "Mapa no disponible".
- Los datos de otras jornadas se arman con `utils/mapReportBuilder.js` (el mismo que usa `useMapReportData`) y `loadReportJornadas` en `createMapReportPrinters.js` (puntos por `/map-points?date=` y contexto por `/map-points/context`). Textos de fechas y unión de barrios en `utils/informeJornadas.js` (con pruebas).
- Verificado en local con 24 puntos de prueba en tres jornadas: técnico de 3 jornadas (7 hojas), censo de varias jornadas y técnico de una jornada. La impresión HTML de una jornada no cambió.
- Mapa: la captura `captureReportMapImage` nunca funcionó en la pantalla actual (`reportMapCaptureRef` no está conectada a ningún elemento). Ahora `utils/reportMapImage.js` dibuja el mapa: encuadra los puntos, usa los mosaicos de `/api/map-tiles` con la caché de Puntos GPS y pinta cada punto con la figura de su tipo (o el color del día). Va en el técnico y en el censo (general en la hoja 1 y uno por día; en el censo, vertical, debajo del resumen y a todo el ancho), en la impresión HTML de una jornada de ambos y en el Ente regulador. Un mapa adjunto en Configurar tiene prioridad.

## Nota para Claude: velocidad del informe de varias jornadas (2026-10-19)

- La lentitud venía de `/map-points/context`: consultaba Nominatim punto por punto (hasta 120, en serie y sin caché duradera), y el diálogo "Generar documento" repetía la carga de todas las jornadas en cada casilla marcada y otra vez al descargar.
- `mapPointContextService.js` ahora guarda cada respuesta en la tabla `map_point_contexts` (celda de ~11 m, 4 decimales), usa una sola cola a 1 consulta/s (política de Nominatim), espera como máximo 6 s y omite lo que falte (el barrio sale de la clave); la cola sigue llenando la caché en segundo plano. Al crear un punto se deja su consulta en cola.
- En el frontend, los puntos por jornada se conservan 2 minutos y solo se piden contextos desconocidos; la descarga reusa las jornadas que el diálogo ya cargó; mapas, padrón y módulos de PDF se preparan a la vez, y el botón muestra el paso en curso.
- Verificado: 4 pruebas nuevas del servicio, `npm test` del backend (295), `npm run build`, y medición contra MySQL local con puntos sintéticos (en frío 6 s y el resto en segundo plano; con caché, instantáneo). No se probó el diálogo con sesión iniciada.

## Nota para Claude: mapa de cada barrio con folios (2026-10-19)

- El PDF de técnico y censo (una o varias jornadas) numera cada punto con un folio único del informe (`foliosDelInforme` en `modules/reports/utils/etiquetasMapa.js`: jornada → barrio → punto). La columna "#" muestra ese folio.
- Con la casilla "Mapa de cada barrio" (activada por defecto en "Generar documento"), cada barrio abre con su mapa ampliado: cada punto es una etiqueta con su folio, del color de su tipo; si dos se enciman, `ubicarEtiquetas` corre la etiqueta y la une al sitio exacto con una línea. Al lado (técnico) o debajo (censo) va un resumen: rango de folios, puntos, claves, cajas, precisión y puntos por tipo.
- `dibujarMapaPuntos` acepta `etiquetaDe` y en ese modo acerca hasta zoom 20, ampliando mosaicos de zoom 18. Los mapas de barrio se dibujan de cuatro en cuatro.
- Verificado con una página de prueba temporal (puntos sintéticos en Choluteca, 3 barrios en 2 jornadas, técnico y censo, 7 hojas cada uno) renderizada con PyMuPDF; pruebas de `etiquetasMapa` y `npm run build`. No se probó con sesión iniciada ni con datos reales; la impresión HTML de una jornada no lleva estos mapas.
- 2026-10-19, con datos reales (14–16 oct, 508 puntos): el informe daba 401 "barrios" y 412 hojas. El código 113 (Residencial Montelimar 1 y 2 en el padrón) no está en el catálogo de barrios, los técnicos escriben claves como "113-112-06" (manzana de 3 cifras, no está en el padrón) y los puntos sin clave tomaban su descripción como barrio. Ahora `getMapReportBarrioCode` toma el código también de esas claves, un código fuera del catálogo agrupa como "113 - Sin nombre en el catálogo", y `zonasDePuntos` (mapReportBuilder) une cada punto sin clave al barrio del punto con clave más cercano (≤ 250 m). Resultado: 5 zonas y 42 hojas. `extractClaveFromText` no se tocó (lo usa la búsqueda de deuda).
- Barrios grandes: `dividirEnHojas` parte el barrio en hojas del mapa a zoom 19 (norte→sur, oeste→este); dentro de cada hoja el orden es por clave. Los folios siguen ese orden, cada hoja tiene su mapa y la tabla lleva el subtítulo "Hoja k de N · folios a al b".
- Falta registrar el código 113 en el catálogo de barrios para que salga con nombre.
