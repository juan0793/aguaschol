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