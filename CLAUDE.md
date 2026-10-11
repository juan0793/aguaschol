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
