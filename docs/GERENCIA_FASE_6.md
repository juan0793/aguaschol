# Fase 6 — Probar como otro rol

El administrador puede elegir Gerente General, Técnico/Operador, Validación de campo o Transporte. La barra amarilla identifica la prueba y permite volver a administrador. La prueba dura 15 minutos; al vencer bloquea consultas y operaciones hasta el retorno explícito. No recupera permisos administrativos automáticamente.

## Sesión y permisos

`POST /api/auth/preview` acepta únicamente `{ role }`; `DELETE /api/auth/preview` termina la prueba, incluso vencida. Solo una cuenta activa cuyo rol real sea `admin` puede iniciar o terminar el modo. El cambio obligatorio de contraseña impide iniciar una prueba. No se permiten cambios de perfil anidados.

El modo se guarda en `auth_sessions.preview_role` y `preview_expires_at`, bajo bloqueo transaccional. `app_users.role` conserva `admin`. No se emiten credenciales administrativas adicionales: el bearer y la cookie de medios de esa sesión reciben el mismo permiso efectivo. Otras pestañas de esa sesión quedan restringidas también; otras sesiones independientes no cambian.

Se conserva el ID administrativo. Las consultas propias de un técnico o transportista pueden estar vacías si esa cuenta no tiene asignaciones. No se suplanta la identidad de un empleado. Para probar escrituras o asignaciones reales se requieren cuentas independientes en un entorno aislado.

Una lista cerrada admite lecturas y consultas POST sin efectos operativos; el router y los servicios siguen aplicando los permisos del perfil elegido. Las escrituras, contraseñas, mensajería, importación, usuarios y rutas nuevas quedan bloqueadas con 403. La exportación gerencial de la Fase 5 está permitida, con su archivo/auditoría; no emite documentos operativos ni marca impresiones. Los informes registran cuenta real, perfil efectivo y `preview_mode`.

Inicio y retorno se auditan en la misma transacción que el cambio (`auth.preview_started`, `auth.preview_ended`). Una falla de auditoría revierte el cambio. Las conexiones WebSocket de esa sesión se invalidan y no se aceptan sockets nuevos durante la prueba.

## Caché y datos locales

El cambio recarga la aplicación para descartar componentes y respuestas previas. Las pestañas reaccionan al cambio de sesión almacenada y se revalidan al recuperar visibilidad; admin/prueba consultan `/auth/me` cada minuto. Si se pierde la respuesta del cambio, se recarga y verifica el estado real antes de reutilizar la interfaz. Una sesión administrativa almacenada no monta módulos sin validación inicial en línea.

La caché ETag queda separada por sesión/perfil y se desactiva en prueba. Las respuestas privadas llevan `private, no-store`; el cambio solicita `Clear-Site-Data: "cache"` (su aplicación depende del navegador y del origen HTTPS). La PWA usa cachés v2, descarta v1 y excluye API, fotos, PDFs privados y solicitudes con Authorization. No guarda navegación con respuesta privada.

La prueba no carga ni modifica borradores, historial privado, avisos locales o la cola GPS administrativa. No sincroniza ni crea puntos pendientes. No se borran esos datos al cambiar de modo.

## Base de datos y validación

Migración: `backend/sql/migrations/20261012_role_preview_sessions.sql`. Ejecutarla una vez en MySQL aislado si se usan migraciones manuales; el inicializador también asegura las dos columnas sin reejecutar la migración. No se aplicó a producción.

Se retiró la búsqueda heredada de tokens en texto claro: ahora autenticación y logout buscan exclusivamente SHA-256 del bearer. Un hash filtrado ya no sirve directamente como credencial. Las sesiones antiguas sin hash necesitan iniciar sesión de nuevo; no se transforman automáticamente ni se borran cuentas.

Verificación: 270 pruebas backend, 18 de dashboard/PDF/simulador frontend y compilación Vite. Las pruebas cubren permisos, identidad, vencimiento, rollback, retorno, hash filtrado, sockets, historial y exclusión PWA. La transacción se probó con un ejecutor controlado; no con MySQL real. Se revisó la barra en escritorio y móvil usando fixtures sintéticos en `qa-gerencia.html?role-preview=1`; las capturas están en `docs/qa/gerencia-fase-6/`.

Pendiente para Fase 7: integración completa con MySQL aislado y cuentas de cada perfil, concurrencia de solicitudes ya iniciadas, regreso entre pestañas, sockets reales y PWA instalada. Cambiar de modo no revierte una operación que ya estaba en curso. No hubo push, merge ni despliegue.
