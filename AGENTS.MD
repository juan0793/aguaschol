# Proyecto: App de inmuebles clandestinos

## Objetivo
Construir una app web moderna para registrar inmuebles clandestinos.

La app debe tomar como referencia:
- `referencia/CLANDESTINOS2026.xlsx`
- `referencia/AVISO-CLANDESTINO.docx`

Debe reemplazar el flujo manual actual basado en Excel, pero conservar una apariencia muy parecida al formato existente.

## Stack requerido
- Frontend: React + Vite
- Backend: Node.js + Express
- Base de datos: MySQL
- ORM opcional: Prisma
- Estilos: CSS o Bootstrap si ayuda a replicar el diseño actual

## Requisitos funcionales
1. Analizar el Excel y detectar campos principales.
2. Analizar el Word y reutilizar la estructura del aviso.
3. Crear una base de datos simple y clara.
4. Permitir:
   - crear registros
   - editar registros
   - buscar por clave catastral
   - listar registros
   - subir fotografía
   - visualizar ficha
   - imprimir ficha
   - generar aviso
5. La UI debe actualizarse sin recargar toda la página.
6. La ficha debe parecerse lo más posible al formato actual.

## Requisitos técnicos
- Separar frontend y backend por carpetas.
- El backend debe exponer una API REST en JSON.
- El frontend debe consumir la API con fetch o axios.
- La foto debe guardarse como archivo y almacenar su ruta en la BD.
- Priorizar una primera versión funcional antes de optimizaciones complejas.
- Usar nombres de variables y campos claros.
- Mantener el código simple y mantenible.

## Entregables
- estructura del proyecto
- schema SQL
- backend funcional
- frontend funcional
- formulario principal
- búsqueda por clave
- ficha visual
- generación de aviso
- instrucciones para correr localmente

## Orden de trabajo
1. Analizar archivos de referencia
2. Proponer campos y esquema SQL
3. Crear backend Express
4. Crear frontend React
5. Integrar subida de foto
6. Crear ficha imprimible
7. Crear módulo de aviso
8. Documentar instalación y uso

## Autenticación
No implementar login en la primera versión.
Dejar la arquitectura preparada para agregar autenticación más adelante.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
