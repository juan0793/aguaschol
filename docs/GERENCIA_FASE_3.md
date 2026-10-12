# Gerencia General — autorización institucional

El backend reconoce una lista cerrada de consultas para `gerente` en `middleware/managerAccess.js`. Cada nueva ruta debe autorizarse explícitamente. Los cuatro perfiles anteriores conservan sus verificaciones de rol y asignación. No se amplía `isAdmin` ni `isGestor` para dar permiso a Gerencia.

| Área | Lectura gerencial | Operaciones bloqueadas |
|---|---|---|
| Inspecciones | Todas, detalle, GPS, historial, resumen y estadísticas | Crear, modificar, finalizar, asignar y registrar impresiones |
| Entregas | Personal, lotes, documentos pendientes, reparto, descartes e informes existentes/vista previa | Cerrar ciclos/lotes, seguimiento, emitir/corregir/anular informes |
| Clandestinos | Fichas, ritmo, banco, reportes, historial y comparación de padrones | Estados, notas, importaciones, asignaciones, evidencias y marcas de impresión |
| Padrón | Búsqueda, metadatos, servicios, cartera y consultas filtradas | Subir, sincronizar, reprocesar y descargar el padrón completo |
| Campo y SIG | Puntos, jornadas, contextos, analítica, hallazgos y cartografía | Captura, validación, edición, envío al banco y administración técnica |
| Planos | Versiones aprobadas/publicadas, elementos y sus PDF finales | Borradores, revisiones pendientes, edición, aprobación y publicación |
| Transporte | Rutas y posiciones por HTTP | Cambios de rutas, inicio, cierre y posiciones nuevas |
| Equipo | Consulta de actividad | Marcar actividad como vista |
| Cuenta | Validar sesión, cambiar contraseña propia y salir | Cierre de sesiones de otros usuarios |

La lectura incluye cinco consultas POST que no escriben datos operativos: `/claves/requests/run`, `/field-validation/analytics`, `/map-points/context`, `/clandestinos/fichas/por-ids` y `/clandestinos/fichas/compare-padrones`. Los demás POST, PUT, PATCH y DELETE operativos responden 403 antes de llegar a los handlers y a los uploads.

Las respuestas gerenciales llevan `Cache-Control: private, no-store`, incluidos los medios privados. Las fotografías deben estar vinculadas a fichas o evidencias técnicas. Los PDF de Planos deben pertenecer a una versión aprobada o publicada. La autorización también aplica a las URL directas `/uploads`, `/api/uploads`, `/planos-pdf` y `/api/planos-pdf`; adjuntos del chat y archivos huérfanos no conceden acceso. Los archivos públicos externos existentes, por ejemplo Cloudinary, no pasan por este middleware.

La consulta de Entregas separa el alcance general de las capacidades de gestión. La emisión oficial de un informe semanal continúa bloqueada porque cambia lotes a REVISADO. Consultar la vista previa y los informes existentes no ejecuta esa emisión.

En Planos se selecciona la última versión autorizada, aunque exista un borrador más reciente. Pedir explícitamente una versión no autorizada responde 403. Las altas y actualizaciones de barrios verifican administración antes de procesar el PDF.

## Validación y alcance

Desde `backend`, PowerShell: `$env:USE_MEMORY_DB='true'; npm test`. Las pruebas nuevas cubren la lista de acceso, escrituras en servicios, alcance general de Inspecciones, lectura de versiones autorizadas con un borrador posterior y routers Express reales. La identidad autenticada se sustituye en las pruebas HTTP; no son pruebas de login con MySQL. Las pruebas de medios usan un ejecutor simulado para comprobar denegación y normalización de rutas; el SQL necesita validación en MySQL aislado.

Esta fase no modifica el esquema ni ejecuta migraciones. La interfaz de Gerencia sigue mostrando la pantalla de preparación: dashboard/navegación corresponden a Fase 4, PDF gerenciales y auditoría de exportación a Fase 5, simulador y limpieza de datos al cambiar de modo a Fase 6. El canal de perfil sigue cerrado a Gerencia; la consulta institucional actual utiliza HTTP.
