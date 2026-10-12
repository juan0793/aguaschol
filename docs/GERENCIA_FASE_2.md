# Gerencia General — Fase 2

Este documento describe la incorporación inicial del perfil. Los permisos actuales se documentan en [GERENCIA_FASE_3.md](GERENCIA_FASE_3.md).

Se incorpora `gerente` en MySQL, creación/cambio de perfiles, etiquetas y filtros de usuarios. Los otros cuatro roles conservan sus permisos. Los roles desconocidos ahora responden 400 en vez de convertirse en `operator`.

El gerente puede iniciar sesión, consultar `/api/auth/me`, cambiar su propia contraseña y salir. Los módulos y archivos privados responden 403 hasta la Fase 3. El canal WebSocket de perfil también rechaza ese rol y la cola GPS no sincroniza con su sesión. No se incluye todavía dashboard gerencial ni simulador.

## Migración y validación en MySQL aislado

1. Respaldar una base de prueba y verificar que `app_users.role` conserva los cuatro valores actuales. Usar credenciales y datos independientes de producción.
2. Aplicar `backend/sql/migrations/20261012_add_gerente_role.sql`. Agrega el valor al final del ENUM y conserva `NOT NULL DEFAULT 'operator'`; no cambia ninguna cuenta.
3. Usar el backend actualizado: `schema.sql` y `ensureRoleEnum` incluyen el mismo ENUM. El inicializador realiza este ALTER al arrancar; no arrancar contra producción durante estas pruebas.
4. Crear una cuenta Gerente General desde Usuarios y cambiar otra cuenta de prueba a ese rol. Comprobar rol almacenado, auditoría y respuesta de `/api/auth/me`. El cambio del propio perfil administrativo sigue prohibido.
5. Reiniciar el backend dos veces. Verificar que el rol gerente permanece y que los cuatro perfiles anteriores no cambiaron.
6. Confirmar 403 en consulta/escritura de módulos y archivos para gerente, cambio de contraseña y cierre de sesión correctos, y operación habitual con cuentas de los cuatro roles anteriores.

MySQL realiza commits implícitos para ALTER TABLE. No confiar en ROLLBACK de una transacción para deshacer esta migración. Puede bloquear la tabla durante el cambio; medirlo en la copia aislada antes de programar su aplicación.

## Recuperación

No retirar `gerente` del ENUM mientras existan cuentas que lo usan, ni arrancar un backend anterior que vuelva a definir solo cuatro roles. Para revertir, conservar el bloqueo de Gerencia y restaurar una copia de prueba, o reasignar explícitamente sus cuentas con autorización, revocar sus sesiones y comprobar que ninguna conserva ese rol antes de retirar el valor. No se incluye una reversión destructiva automática.

## Pruebas sin base de datos

Desde `backend`, en PowerShell:

```powershell
$env:USE_MEMORY_DB = 'true'
node --test src/utils/userRoles.test.mjs src/middleware/managerAccess.test.mjs
npm test
```

Desde `frontend`: `npm run build`.

Las pruebas de permisos son unitarias: no sustituyen la creación real de cuentas, migración y reinicios sobre MySQL aislado ni pruebas de sesión de extremo a extremo. No se aplicaron cambios a producción.
