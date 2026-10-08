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
- Pendiente de revisión en dispositivo iOS real. La prueba de integración del backend requiere el MySQL local, que no estaba disponible en la revisión anterior.
