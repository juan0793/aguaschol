# Auditoría previa — Rediseño del módulo Clandestinos

## Mapa real antes de la extracción

- `frontend/src/App.jsx`: concentraba bandeja, filtros, ficha, impresión y navegación del módulo junto con el resto de la aplicación.
- `frontend/src/components/records/RecordsWorkspaceHeader.jsx` y `frontend/src/utils/records.js`: piezas auxiliares del flujo anterior.
- `backend/src/routes/inmuebleRoutes.js`, `controllers/inmuebleController.js` y `services/inmuebleService.js`: CRUD existente de fichas y avisos.
- `backend/sql/schema.sql`: `inmuebles_clandestinos`, usuarios, sesiones y auditoría; no existían reportes técnicos ni historial de estados dedicado.
- Dependencias preservadas: React/Vite, Express, MySQL, almacenamiento local/Cloudinary, autenticación y `audit_logs` existentes.

## Riesgos identificados y tratamiento

1. **Pérdida o reinterpretación de estados antiguos.** Se conserva `estado_padron` y se agrega `estado_operativo`; no se migran ni eliminan valores históricos.
2. **Reportes de campo alterando el padrón.** La API de reportes escribe exclusivamente en `reportes_tecnicos` y tablas relacionadas. El vínculo es explícito y auditado.
3. **Permisos solo visuales.** Las transiciones se validan en el backend por rol, además de ocultarse o deshabilitarse en la interfaz.
4. **Observaciones internas impresas.** El centro de impresión construye documentos con campos públicos y excluye `observaciones_internas`.
5. **Ruptura del ejecutable o despliegue.** No se modifica `foxpro-reader` ni sus binarios. El frontend se integra bajo la vista existente `records`, conservando el resto de claves de navegación.
6. **Base existente sin columnas nuevas.** `db.js` agrega columnas idempotentemente y `schema.sql` crea las entidades nuevas con claves foráneas e índices.
7. **Pérdida de contexto al abrir una ficha.** Búsqueda, estado, barrio y página se guardan en `sessionStorage`; el panel lateral no desmonta la bandeja.

## Extracción aplicada

El módulo vive en `frontend/src/modules/clandestinos` con páginas, componentes, hooks, servicio HTTP y estilos propios. `App.jsx` conserva temporalmente el JSX histórico bajo una vista deshabilitada para reducir el riesgo de una eliminación masiva en el mismo cambio; la vista activa delega al módulo independiente.
