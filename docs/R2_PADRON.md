# Padron privado en Cloudflare R2

El padron activo y sus versiones historicas se guardan comprimidos con gzip en un bucket privado. R2 se usa solo para persistencia y recuperacion: las busquedas por clave, abonado y nombre consultan siempre la copia cargada en memoria.

## Despliegue en Railway

Configurar exclusivamente en el servicio backend:

```env
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_BUCKET=...
R2_REGION=auto
```

No se necesita acceso publico, dominio publico ni URLs firmadas. El frontend nunca recibe el nombre del bucket ni credenciales.

Al desplegar, el backend agrega de forma idempotente las columnas de metadatos. La migracion equivalente esta en `backend/sql/migrations/20260717_add_r2_padron_metadata.sql`. La columna `padron_maestro_snapshot.registros_json` y los datos existentes se conservan.

## Migracion inicial manual

El despliegue no copia ni elimina datos automaticamente. Despues de desplegar:

1. Abrir **Administracion > Importacion**.
2. Pulsar **Comprobar conexion**.
3. Pulsar **Migrar snapshot MySQL** y confirmar.
4. Confirmar que el panel muestre el padron activo y el numero esperado de registros.

La operacion primero sube y verifica `padron/historico/{fecha}-{codigoLote}.json.gz`, despues sube y verifica `padron/activo/padron-maestro.json.gz`, y finalmente guarda los metadatos en MySQL. El JSON de MySQL permanece intacto.

Los endpoints administrativos equivalentes, protegidos por sesion y rol administrador, son:

- `GET /api/integracion/foxpro/r2/conexion`
- `GET /api/integracion/foxpro/r2/padron`
- `POST /api/integracion/foxpro/r2/migrar`
- `POST /api/integracion/foxpro/r2/restaurar`

## Importaciones y arranque

Al aplicar una importacion FoxPro se valida el padron completo, se suben y descargan ambas copias R2 para comprobar gzip, JSON y cantidad de registros, y luego se reemplaza inmediatamente la copia en memoria. Una falla de R2 cancela la aplicacion antes de cambiar el padron activo.

En cada arranque se intenta cargar primero el objeto activo de R2. Si no existe, esta incompleto o R2 no responde, se valida y carga `padron_maestro_snapshot.registros_json`. Si ambas fuentes persistentes fallan, se conserva cualquier copia valida ya disponible en el repositorio local; nunca se sustituye por un arreglo vacio.

## Recuperacion y rollback

Para restaurar, elegir una version en **Administracion > Importacion**, pulsar **Restaurar version** y confirmar. La API exige ademas el texto de confirmacion exacto:

```json
{
  "key": "padron/historico/2026-07-17-LOTE.json.gz",
  "confirmation": "RESTAURAR_PADRON_R2"
}
```

La restauracion valida el historico, lo publica como activo, actualiza el respaldo MySQL y recarga memoria inmediatamente. La accion queda registrada en auditoria.

Para rollback de la funcionalidad, desplegar el commit anterior sin borrar columnas ni objetos. El snapshot JSON de MySQL sigue disponible. Si R2 debe deshabilitarse temporalmente, retirar sus variables del backend y reiniciar; el arranque usara MySQL.

## Retencion

`FOXPRO_SYNC_RETAIN_BATCHES` sigue definiendo cuantos lotes recientes conservar con detalle. Tambien se conserva cualquier lote en revision. Solo se eliminan `importacion_padron_bloques` y `importacion_padron_registros` de lotes antiguos aplicados cuando el padron activo y el historico correspondiente tienen verificacion R2. Los lotes, resúmenes y auditoria no se eliminan.

No ejecutar limpieza manual ni borrar `registros_json` durante esta etapa de migracion.

## Archivos del volumen

Las fotografias, evidencias, adjuntos de chat y PDF nuevos se guardan en `uploads/` dentro del mismo bucket privado. Sus rutas publicadas siguen siendo `/uploads/{archivo}`: la peticion siempre llega autenticada al backend, que lee R2 sin exponer el bucket ni sus credenciales.

Para migrar los archivos existentes, abrir **Administracion > Importacion** y pulsar **Migrar archivos del volumen**. La operacion es idempotente: sube cada archivo, confirma el tamaño con `HeadObject`, vuelve a descargarlo para comparar todo su contenido y solo entonces borra la copia local. Si se interrumpe, volver a pulsar el botón continúa con los archivos restantes.

Durante la transición la lectura intenta R2 primero y conserva el volumen como respaldo. El estado del panel muestra cantidad y tamaño local y remoto. Los endpoints administrativos equivalentes son:

- `GET /api/integracion/foxpro/r2/archivos`
- `POST /api/integracion/foxpro/r2/archivos/migrar`

El cuerpo de migracion que libera el volumen es:

```json
{
  "confirmation": "MIGRAR_ARCHIVOS_R2",
  "delete_local": true
}
```
