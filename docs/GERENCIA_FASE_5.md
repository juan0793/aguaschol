# Gerencia General — consultas e informes PDF

En el dashboard y en **Consultas e informes** se puede preparar y descargar:

- Resumen ejecutivo.
- Cartera y padrón por barrio.
- Inspecciones asignadas en el mes.
- Seguimiento de Entregas.
- Listado de fichas clandestinas activas.
- Puntos GPS del mes.
- Actividad del equipo del mes.

Los informes utilizan los servicios actuales, jsPDF, AutoTable y `saveReportPdf`. Son carta vertical, con logo, encabezado institucional, ID y numeración en cada página. Cartera y fichas muestran el estado actual; el resto indica su período. Barrio es un filtro exacto opcional para cartera, inspecciones y fichas. Los listados de inspecciones, fichas y GPS se limitan a 500 filas, y actividad a 200: la vista previa y el documento declaran sus límites y totales; no se confunden con datos completos.

## API y auditoría

- `POST /api/reports/manager`: valida tipo/mes/barrio, obtiene datos del servidor, archiva una copia HTML escapada y registra `report.manager.prepared` en una transacción.
- `POST /api/reports/manager/:id/events`: admite únicamente `pdf_generated` y `download_requested`, con tamaño y SHA-256. Comprueba propietario, vinculación a la sesión y vigencia de 30 minutos.
- `GET /api/reports/manager/:id`: consulta únicamente archivos propios que tienen preparación gerencial registrada por el servidor.

Las rutas exigen autenticación y perfil admin/gerente, llevan `private, no-store` y tienen límites por usuario. No aceptan filas, HTML ni actor enviados por el cliente. Una falla de archivo/auditoría impide entregar la consulta; una falla de auditoría de exportación impide guardar el PDF. La descarga solicitada y la generación son declaraciones del cliente: no prueban que el usuario guardó o imprimió físicamente el archivo.

La exportación solo escribe en `report_archives` y `audit_logs`. No llama a la emisión oficial de informes semanales, no cambia lotes a REVISADO ni marca fichas/avisos como impresos. Estos eventos tampoco aumentan las estadísticas de trabajo del equipo.

## Seguridad de sesiones

Durante la Fase 5, `authService.getSessionUser` conservaba una búsqueda antigua que admite tanto el hash del token recibido como su valor directo. Eso permite reutilizar un hash de `auth_sessions` que se filtre como credencial. Para evitar ampliar ese riesgo, la auditoría de informes almacena una huella separada (`SHA-256('manager-report:' + token)`), no el hash autenticador ni el token. Hay una prueba de regresión de esa separación. La Fase 6 retiró esa compatibilidad: las sesiones heredadas sin hash requieren iniciar sesión de nuevo. Ver `GERENCIA_FASE_6.md`.

## Verificación

`npm --prefix backend test` incluye validación, controles HTTP, propiedad, sesión, vencimiento, HTML escapado, rollback y restricciones de escritura. `npm --prefix frontend run test:manager-reports` verifica carta en múltiples páginas, metadata, consultas vacías, huella del archivo guardado y bloqueo ante falla de auditoría o cierre de consulta. También se verificaron compilación, lint, consulta y descarga en navegador con fixtures locales.

`output/pdf/gerencia-qa.pdf` es una muestra sintética de tres páginas, renderizada e inspeccionada. No contiene cifras reales ni constituye un informe institucional emitido.

No hay migración nueva: se reutilizan tablas existentes. Queda pendiente probar las siete consultas y la transacción real con un usuario Gerente General en MySQL aislado. No se realizaron cambios ni despliegues en producción.
