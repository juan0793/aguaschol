# Fase 7 — Integración real de "Probar como otro rol"

Se verificó la Fase 6 contra MariaDB real, por HTTP y WebSocket, con una cuenta independiente por perfil, y en el navegador con la compilación de producción servida localmente. Se corrigieron dos errores de vencimiento.

## Correcciones

**Zona horaria.** El vencimiento se escribía con el reloj de MySQL (`DATE_ADD(NOW(), INTERVAL 15 MINUTE)`) y se evaluaba con el reloj de Node. Sin `timezone` en el pool, con MySQL en UTC y Node en America/Tegucigalpa, la prueba duraba 6 h 15 min en lugar de 15 minutos. Ahora `getSessionUser` lee `UNIX_TIMESTAMP(preview_expires_at)`, un instante absoluto que no depende de la zona de ninguno de los dos.

**Recarga continua.** El frontend compara `preview.expires_at` en cada `/auth/me` y recarga si cambió (`useAppShellEffects.js`). Una versión intermedia de la corrección calculaba `expires_at` como "ahora + segundos restantes" y el valor variaba en cada consulta. La página quedaba en "Validando sesión…" con cientos de llamadas por segundo, y las otras pestañas también recargaban por el evento `storage`. Con el instante absoluto, el valor es idéntico entre consultas. Las pruebas unitaria y de integración lo comprueban.

## Integración con MariaDB

`npm run test:role-preview` (backend) usa una base temporal `aguaschol_preview_test_<pid>` en `127.0.0.1:3317`, igual que `test:entregas`. Nunca usa la base de `.env`. Durante la prueba, MySQL usa una zona distinta a la de Node; al terminar se restaura la zona y se borra la base.

Cubre:
- **Migración:** la de la Fase 6 se aplica sobre una tabla sin las columnas nuevas.
- **Cuentas reales:** las de gerente, operador, validación de campo y transporte no pueden iniciar una prueba.
- **Por cada perfil:** el vencimiento queda en 15 minutos y `expires_at` es estable. Ninguna lectura permitida en la prueba la tiene prohibida la cuenta real. Las respuestas llevan `private, no-store`. Se bloquean escrituras, cambio de contraseña y cambios anidados. Al volver se recupera administrador y `app_users.role` sigue en `admin`.
- **Otra sesión del mismo administrador:** no cambia.
- **Inicio doble:** dos inicios simultáneos en la misma sesión dejan uno con 200 y otro con 403, con un solo registro de auditoría.
- **Bloqueo previo:** el cambio de contraseña pendiente impide iniciar la prueba.
- **WebSockets:** los de perfil y transporte de esa sesión se cierran con 1008 y no se aceptan nuevos durante la prueba. Los de otra sesión siguen conectados. Al volver se aceptan otra vez.
- **Vencimiento real:** con el reloj de MySQL, las lecturas responden 403 "venció"; `/auth/me` y el retorno siguen disponibles y no se puede elegir otro perfil. El cierre de sesión desde una prueba vencida funciona. La auditoría de retorno registra perfil previo y efectivo.

Sin la corrección de zona horaria, la prueba falla con "gerente vence en 15 minutos (fueron 374.99)".

## Navegador y PWA

Compilación de producción con `VITE_API_URL=/api`, servida por `frontend/server.js` contra un backend local en la base temporal. `frontend/.env` apunta a producción, por eso no se usó el `dist` normal.

- **Inicio de prueba:** se inicia Gerente General en una pestaña; la otra recarga una vez y muestra el mismo modo. Cada pestaña hace una sola llamada a `/auth/me`.
- **Regreso:** al volver a administrador desde la segunda pestaña, la primera recarga una vez y vuelve a administrador.
- **Service worker:** queda activo y controla la página. El manifiesto es válido (`standalone`, iconos de 192 y 512).
- **Cachés:** solo existen `controlaguas-shell-v2` y `controlaguas-assets-v2`, sin `/api`, `/uploads` ni `/planos-pdf`, también después de usar la prueba de perfil.
- **Limpieza de v1:** una caché `controlaguas-assets-v1` se borra al activarse un service worker nuevo. Mientras otra pestaña siga controlada por el anterior, el navegador no lo reemplaza.

## Verificación

- `npm run test:role-preview`: 1/1.
- `npm run test:entregas`: 1/1.
- `npm test`: 271/271.

## Pendiente

- **Instalación real:** la app instalada en un teléfono Android y en iPhone (Safari, "Agregar a inicio") con HTTPS en producción. El navegador de pruebas no instala PWAs.
- **Operación en curso:** cambiar de modo no revierte una operación que ya estaba en curso. Es una limitación documentada y no se probó con solicitudes lentas.
- **Retornos repetidos:** un `DELETE /api/auth/preview` sin prueba activa también registra `auth.preview_ended`, así que dos retornos seguidos dejan dos registros.
- **Producción:** no se aplicó nada. No hubo push, merge ni despliegue.

## Aviso de actualización

`frontend/src/app/UpdateNotice.jsx` compara el script de entrada de la página (`/assets/index-<hash>.js`) con el que publica `index.html`, pidiéndolo con `cache: "no-store"`. El service worker no intercepta esa petición. La revisión corre 30 segundos después de cargar, cada 5 minutos y al volver a la pestaña, para toda cuenta con sesión. Al cambiar, se muestra "Hay una nueva actualización disponible" con "Más tarde" y "Actualizar". No recarga solo.

Verificado con la compilación de producción servida en local: con el service worker activo, las versiones coinciden sin aviso; tras recompilar, la pestaña abierta detecta la nueva. Las pestañas abiertas antes de este despliegue no tienen el aviso: reciben la versión nueva al recargar, y el aviso funciona desde el siguiente despliegue.
