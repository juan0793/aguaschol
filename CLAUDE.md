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

## Nota para Claude: informe de campo por láminas (2026-10-19)

- El PDF de técnico y censo se ordena por zona, no por día: `unirBarrios` junta un barrio trabajado en varias jornadas (el día queda en `__dia`) y `armarLaminas` lo parte en láminas L1, L2… (`dividirEnHojas` a 1800 × 800 px y zoom 19; una hoja con menos de 12 puntos se une a la vecina si caben a un zoom menos). Folios: barrio → lámina → clave.
- Hoja 1: datos, puntos por tipo y por jornada, índice de láminas y el mapa general con un recuadro por lámina (`marcos` en `dibujarMapaPuntos`). En vertical (censo) el mapa va antes de las tablas.
- Cada lámina: rótulo, tipos presentes, mapa a todo el ancho (se achica hasta el 70 % si así cabe) y su tabla de una línea por punto: # · Clave · Tipo (punto de color) · Descripción (sin la clave del inicio; con "Ref.:" si hay) · Coordenadas · ± m · Fecha (censo: clave/abonado y nombre en padrón). Ya no hay portada por día ni "Referencia cercana" por fila (va una vez en el encabezado del barrio).
- "Imprimir" de técnico y censo usa el mismo PDF: se carga en un iframe oculto y llama a `print()`; si falla, se descarga. Las versiones HTML de impresión de esos dos se quitaron.
- Con los 508 puntos reales del 14 al 16 de octubre: técnico 49 → 28 hojas, censo 22. No se vio el diálogo de impresión del sistema (el panel del navegador no lo muestra).

## Nota para Claude: pantalla Pozos (2026-10-20)

- Menú "Pozos" en Territorio, solo administración y Gerencia (`/pozos`, vista `pozos`, `modules/pozos/`). Es solo consulta y usa la bandeja plana del sistema (`cl-module is-flat`, como Fichas):
  - búsqueda (acepta "032"), Colonia y Lista/Mapa;
  - pestañas Todos / En uso / Con calidad medida / Fuera del valor guía / Por revisar;
  - franja de métricas de las mediciones;
  - tabla indexada de 20 filas con orden por columna;
  - ficha en `cl-drawer` (`PozoDetalle.jsx`, con mapa Leaflet y flechas ← →).
- Detalles del diseño en DESIGN.md, sección "Pozos".
- Datos:
  - el archivo es `backend/data/pozos-choluteca.json`, generado del shapefile "Pozos Choluteca Part1" con `backend/scripts/convertir_pozos_shp.py` (Python de QGIS);
  - un 0 en una medición se guarda como null;
  - `GET /api/pozos` (`pozosRoutes.js`, `pozosService.js`) usa `requireRoles("admin","gerente")` y está en la lista cerrada de `managerAccess.js`;
  - el servicio vuelve a leer el JSON cuando cambia su fecha de modificación y devuelve `actualizado`.
- Actualización sin F5: la pantalla consulta cada 60 s y al volver a la pestaña, en silencio. Solo reemplaza los datos si cambió `actualizado`.
- 65 pozos reales: Pchol.-032 trae la Y con un dígito de más (no va al mapa) y 18 códigos se repiten en pozos distintos.
- Verificado:
  - pruebas de `pozosService` (3) y `pozosFiltros` (10);
  - `npm test` del backend (298);
  - `npm run build`;
  - `frontend/qa-pozos.html` (datos de prueba) capturado a 1440 y 390 px;
  - revisión del agente de diseño de impeccable: en la segunda ronda, 6 de 8 arreglos resueltos; los 2 parciales (TDS en el teléfono y el registro en DESIGN.md) se corrigieron después, sin tercera revisión.
- No se probó con sesión iniciada.

## Nota para Claude: saldo de sobrantes y avisos al técnico (2026-10-21)

- Administración y Gerencia ven el saldo del padrón de cada documento no entregado: total, capital (`valor`) y mora (`intereses`). Se busca primero por número de abonado y, si no aparece, por clave (una clave base solo cuenta si apunta a un único inmueble). Reglas puras en `services/entregasSaldoRules.js` (con pruebas); el índice se rehace al cambiar `getMasterVersion()`. El técnico y el operador nunca reciben montos.
- Dónde se ve: detalle del lote (tarjeta "Saldo de lo no entregado" con total, capital, mora, pendiente de entregar y documentos sin padrón; monto por fila), columna "Saldo no entregado" en Lotes/Anteriores, columna "Saldo" en la bandeja de No entregadas y bloque de saldo en el detalle del documento. Los cancelados no suman.
- Avisos: `POST /api/entregas/no-entregadas/:id/avisos` (admin y gerente; nunca en modo de prueba de rol). Plantillas en `PLANTILLAS_AVISO`, nota opcional (obligatoria en "Otro"); el texto no lleva montos. Va a la campana del usuario del responsable del lote y queda en `entrega_documento_avisos` (se borra con su documento o lote). Al tocarlo se abre `#entregas/pendientes?documento=ID`. Es la única escritura permitida a Gerencia (`MANAGER_WRITES` en `managerAccess.js`).
- Parpadeo: `NoEntregadaDetalle` recargaba el documento en cada redibujo de la página (su carga dependía de `onClose`, nuevo en cada render) y cada foco de la ventana traía una configuración nueva que redibujaba todo. Medido: 3 regresos de foco causaban 25 recargas y 17 destellos de "Cargando seguimiento…"; ahora 0. La configuración refrescada se conserva si no cambió y personal/resumen solo se cargan la primera vez.
- Verificado: `npm test` del backend (305), `npm run test:entregas` contra MariaDB temporal en 3317 (incluye saldo, permisos y aviso), `npm run build`, y en el navegador con datos de prueba: admin y gerente ven montos, gerente envía el aviso, el técnico lo recibe y abre el documento sin ver montos; revisado a 800 y 390 px. No se probó con datos reales ni en iOS.

## Nota para Claude: Pozos con Resumen y Análisis (2026-10-21)

- A partir de un mockup de ChatGPT, solo con datos reales (el usuario eligió ese alcance): sin "Nuevo pozo", "Editar", fotos, historial ni fecha por pozo, porque el JSON del shapefile no los tiene.
- "Ver como" pasa a Resumen · Lista · Mapa · Análisis (Resumen al entrar). Filtros nuevos Calidad y "Le falta"; columna Calidad en la lista; mapa pintado por calidad; ficha con escala del valor guía y "Falta levantar"; "Exportar CSV" de los pozos filtrados. La franja de promedios se movió a Análisis.
- Gráficos en `modules/pozos/PozosGraficos.jsx` (HTML/SVG, sin librería). Cálculos en `pozosFiltros.js` (`calidadDe`, `DATOS`, `histograma`, `hallazgos`, `pozosCsv`…), con pruebas (14). Detalle visual en DESIGN.md, sección Pozos.
- Verificado con `frontend/qa-pozos.html` (datos de prueba) a 1180, 800 y 390 px, detector de impeccable sin hallazgos y `npm run build`. No se probó con sesión iniciada ni con los 65 pozos reales; no hubo revisión del agente de diseño.
- Despliegue: el 2026-10-21 Railway no desplegó `eb09488` ni `42a12e2` (GitHub solo registra despliegues de Vercel para esos commits); www.controlaguas.com seguía con el bundle anterior. Hay que lanzarlo a mano en Railway o revisar su integración con GitHub.
- Informes de Pozos (mismo día): "Descargar" reúne Inventario, Fichas técnicas, Calidad del agua y Plan de levantamiento en PDF, más el CSV; la ficha de un pozo también sale desde su cajón. Se arman en `pozosPdf.js` (jsPDF + autotable, pruebas en `pozosPdf.test.mjs`, `npm run test:pozos` 16) y `informesPozos.js` dibuja los mapas con `dibujarMapaPuntos` (ahora acepta `colorDe` también para las etiquetas). Revisados con los 65 pozos reales generados en Node (sin mapas) y en `qa-pozos.html` interceptando la descarga (con mapa, sin mosaicos). Con los datos reales: inventario 4 hojas, calidad 2, levantamiento 13 (una por colonia). No se probó con sesión ni con los mosaicos reales.
- Bug del mapa encima de la ficha (mismo día): al abrir un pozo desde la vista Mapa, los puntos, el zoom y Satélite/Calles del mapa de fondo se pintaban sobre el cajón (capa 100), porque Leaflet usa capas 400–1000 sin contenedor que las encierre. `.pz-mapa` ahora lleva `isolation: isolate`; verificado en `qa-pozos.html` (0 de 41 marcas del fondo por encima de la ficha).

## Nota para Claude: lectura química de los pozos (2026-10-21)

- Investigado por un agente de ciencia (norma leída del PDF de FAOLEX, OMS 4.ª ed., USGS) y comprobado con los datos: Acuerdo 084/1995, cuadro 3, recomienda pH 6.5–8.5, temperatura 18–30 °C, conductividad 400 µS/cm y cloro residual libre 0.5–1.0 mg/L (máximo 5); TDS máximo 1000 mg/L. pH, temperatura y conductividad son valores recomendados, no máximos. Salinidad y oxígeno disuelto no están regulados.
- El TDS y la salinidad los calcula el equipo a partir de la conductividad (TDS = SPC × 0.65; compensación 1.91 %/°C, los valores por defecto de YSI). La conductividad "a/b" trae la de 25 °C (SPC) y la de la muestra, en cualquier orden; `conductividadDe` toma como SPC el número que cuadra con el TDS. Cuadra en 27 de 31 pozos; Pchol.-007, -031, -033 y -034 quedan como dato por revisar.
- `modules/pozos/pozosQuimica.js` (pruebas en `pozosQuimica.test.mjs`; `npm run test:pozos` 20): `PARAMETROS` y `lecturaDe` (veredicto, regla y significado), `revisionesDelDato` (conductividad o salinidad que no cuadran, pH < 5.5 o > 9, temperatura > 35 °C, OD > 110 %), `especiacionCarbonato` y `curvaCarbonato` (pKa de Plummer y Busenberg, 6.35/10.33 a 25 °C y 6.32/10.27 a 33 °C). Con los datos reales, 12 pozos tienen algún aviso.
- `PozoQuimica.jsx` es el panel. La ficha PDF muestra la conductividad como "N µS/cm" (la de 25 °C).
- No se muestran iones, metales, bacterias, dureza ni índice de Langelier porque no se midieron. El pie del panel lo dice. El cloro de 0.02–0.1 mg/L en agua cruda se lee como "no detectado" (límite del método DPD).
- Verificado en `qa-pozos.html` a 800 y 390 px (datos de prueba), detector de impeccable sin hallazgos y `npm run build`. No se probó con sesión iniciada.

## Nota para Claude: Inspecciones, clave visible y aviso de repetidas (2026-10-22)

- La bandeja "Requieren acción" (`InspeccionesResumen.jsx`) muestra la clave catastral (mono, en negrita) con el número de inspección, el número de abonado junto al nombre (en su propia línea en pantallas angostas) y "motivo · barrio". El backend la arma en `getResumenInspecciones` y envía `clave_catastral`, `inspeccion_general`, `abonado_numero`, `barrio_snapshot` y `repeticion`.
- Una clave puede tener varias cuentas. `services/inspeccionesRepeticion.js` (`repeticionesDe`, `mismaCuenta`; 6 pruebas) devuelve `repetidas` (abiertas de la misma cuenta, o cuando alguna es general de la clave), `otras_cuentas` (abiertas de otras cuentas: solo referencia) y `ultima_finalizada` (de la misma cuenta). Una clave sin dígitos distintos de cero ("00-00-00-00") no cuenta.
- Por defecto la bandeja agrupa por clave ("Agrupar por clave" / "Solo por antigüedad", guardado por navegador en `localStorage`): una clave con varias inspecciones abiertas tiene un encabezado con barrio, "N abiertas · una sola cuenta / N cuentas" y "Posible inspección repetida" en ocre si corresponde; sus filas van sangradas con una guía de 1 px (en el teléfono, una tarjeta con las suyas dentro). Los grupos siguen el orden de su inspección más antigua. Arriba se cuentan las posibles repetidas. La columna Técnico pasó a 184 px para que el nombre no se corte.
- Avisos por fila: "Repite a INS-… (misma cuenta / una general de la clave)" en ocre; "Otra cuenta en esta clave" en azul claro solo en la vista sin agrupar; "Inspeccionada antes" en gris.
- Nueva inspección: al encontrar la clave consulta `/inspecciones?clave=` (filtro parcial, se queda con las exactas) y avisa según la cuenta elegida: "Esta cuenta ya tiene una inspección abierta…" (ocre) u "Otras cuentas de esta clave tienen N abiertas (no es la misma visita)" (azul claro). No bloquea la creación.
- Banco de prueba: `frontend/qa-inspecciones.html` (`src/qa/inspeccionesPreview.jsx`, datos ficticios con claves 99-…). Verificado a 1180 y 390 px; `npm test` del backend y `npm run build`. No se probó con sesión iniciada.
- El detector de impeccable marca una franja lateral de 4 px en `.ins-drawer .ins-identity::before` (inspecciones.css): ya existía y no se tocó.

## Nota para Claude: Reclamos sin huecos y Resumen de Pozos compacto (2026-10-22)

- Reclamos (`reclamos.css`): la grilla pasa a "buscar equipo" / "lista equipo"; "Por técnico" es lateral y fija (`position: sticky`, alto máximo de la ventana con su propio desplazamiento). Antes la lista esperaba a que terminara "Por técnico" y quedaba un hueco grande bajo el buscador. Bajo 1080 px vuelve a una columna con el equipo al final. Banco nuevo: `frontend/qa-reclamos.html` (`src/qa/reclamosPreview.jsx`, datos ficticios).
- Pozos, vista Resumen: franja compacta de cuatro paneles (`pz-tablero is-compacto`; "Uso y calidad" con `FranjaCalidad`) y la tabla de la Lista debajo, en la misma vista. Los filtros de los paneles filtran la tabla sin cambiar de vista. Teléfono: paneles deslizables con `scroll-snap`. Barras, franjas e histogramas crecen al entrar y transicionan al filtrar; el largo de barras y columnas es `transform: scale(var(--escala))` (no `width`/`height`) para no recalcular la página, y la animación de entrada usa `backwards` para que después actúe la transición.
- Verificado en los bancos a 1600, 1440 y 390 px: en Reclamos la lista empieza 16 px bajo el buscador; en Pozos los paneles miden 295 px y la tabla muestra 6 pozos sin bajar (1600 × 1000). `npm run build` correcto. No se probó con sesión iniciada.

## Nota para Claude: impresión de Reclamos en blanco (2026-10-22)

- Causa: `clandestinos.css` imprimía con `body * { visibility: hidden }` sin condición y esa hoja queda cargada al abrir Fichas, Pozos o Reportes; después, la ficha de Reclamos (portal `.rc-imp-portal`) salía invisible y la hoja en blanco.
- Arreglo en el origen: la regla ahora es `body:where(:has(.cl-print-preview)) *`, solo con la vista previa de fichas abierta; `:where()` conserva la prioridad original para que `.cl-print-preview` siga ganando. Además, `reclamosImpresion.css` devuelve la visibilidad a su portal (como el acta de Entregas).
- Verificado en `qa-reclamos.html` cargando `clandestinos.css` y aplicando todas las reglas `@media print` como hoja normal: ficha de Reclamos visible (antes `hidden`); con la vista previa de fichas, la vista previa visible y el resto oculto, como antes. No se vio el diálogo de impresión real.
