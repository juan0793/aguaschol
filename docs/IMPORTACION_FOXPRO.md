# Importacion manual del padron FoxPro

## Alcance

La integracion copia el padron desde la tabla libre `maestro.dbf` hacia tablas temporales de Control Aguas. No modifica archivos DBF, CDX o FPT y no actualiza el padron activo hasta que un administrador revisa y aplica los cambios.

Flujo:

1. El lector Windows abre la carpeta FoxPro con `VFPOLEDB.1` en modo lectura.
2. Al pulsar **Leer y enviar ahora**, lee solamente las columnas permitidas y envia bloques HTTPS autenticados.
3. El backend valida integridad e idempotencia, y clasifica cada fila.
4. Un administrador revisa el lote en **Administracion > Importacion**.
5. **Aplicar seleccionados** o **Aplicar todos los validos** actualiza el padron activo usando el mismo mecanismo de reemplazo y recarga que ya usa Control Aguas.

No hay tarea programada, disparador ni sincronizacion automatica.

## Mapeo de datos

| FoxPro | Control Aguas | Regla |
|---|---|---|
| `catastral` | `clave_catastral` | Texto, conserva guiones |
| `abonado` | `abonado` | Identificador principal de comparacion |
| `inquilino` | `inquilino` | Nombre mostrado |
| `des_coloni` | `barrio_colonia` | Colonia o barrio |
| `agua` | `agua` | Se normaliza `S/N`; el original se conserva en staging |
| `alca` | `alcantarillado` | Se normaliza `S/N` |
| `barr` | `barrido` | Se normaliza `S/N` |
| `tren` | `recoleccion` | Se normaliza `S/N` |
| `bomb` | `desechos_peligrosos` | Se normaliza `S/N` |
| `valor` | `valor` | Decimal |
| `intereses` | `intereses` | Decimal |

El archivo `Maestro 14 julio.xls` contiene 16,383 filas. Se detectaron abonados duplicados, claves catastrales incompletas o repetidas y valores de servicio distintos de `S/N`; por eso la importacion no usa la clave catastral como identificador unico y envia esos casos a `CONFLICTO` o `ERROR`.

## Estados

- `NUEVO`: el abonado no existe en el padron activo.
- `MODIFICADO`: existe una coincidencia segura y hay diferencias.
- `SIN_CAMBIOS`: existe y todos los campos comparados coinciden.
- `CONFLICTO`: el abonado esta duplicado en el lote o tiene varias coincidencias en el padron.
- `ERROR`: falta un dato indispensable o un valor no puede normalizarse.
- `APLICADO`: el administrador incorporo la fila al padron activo.
- `DESCARTADO`: el administrador decidio no aplicarla.

## Backend y Railway

Ejecute [backend/sql/migrations/20260714_add_foxpro_import.sql](../backend/sql/migrations/20260714_add_foxpro_import.sql) una vez en la base existente. En instalaciones nuevas, las mismas tablas ya forman parte de `backend/sql/schema.sql`.

Configure estas variables en Railway:

```env
FOXPRO_SYNC_API_KEY=una-clave-larga-aleatoria-y-distinta-de-las-claves-de-usuarios
FOXPRO_SYNC_BATCH_SIZE=500
FOXPRO_SYNC_MAX_RECORDS=25000
FOXPRO_SYNC_RETAIN_BATCHES=5
```

La clave se usa exclusivamente en `Authorization: Bearer ...` para el lector. No debe colocarse en el frontend ni reutilizarse como sesion de usuario. El backend limita solicitudes por IP, limita el tamano JSON y nunca registra la credencial.

Rutas del lector:

- `POST /api/integracion/foxpro/lotes/iniciar`
- `POST /api/integracion/foxpro/lotes/:codigoLote/bloques`
- `POST /api/integracion/foxpro/lotes/:codigoLote/finalizar`

Rutas de administracion, protegidas por sesion y rol administrador:

- `GET /api/integracion/foxpro/lotes`
- `GET /api/integracion/foxpro/lotes/:codigoLote/registros`
- `POST /api/integracion/foxpro/lotes/:codigoLote/aplicar`
- `POST /api/integracion/foxpro/lotes/:codigoLote/descartar`

Cada bloque lleva SHA-256 del contenido canonico. Reenviar un lote o bloque ya recibido con el mismo hash es idempotente; reutilizar el identificador con contenido diferente devuelve conflicto.

### Impacto de almacenamiento

El staging guarda columnas normalizadas, dato original, diferencias e indices. Para un lote de unas 16 mil filas, reserve aproximadamente 10 a 25 MB, dependiendo del motor, juego de caracteres e indices. Con retencion de 5 lotes, el orden de magnitud esperado es 50 a 125 MB. La retencion elimina el detalle de lotes antiguos ya aplicados o descartados, pero conserva sus resumenes y la auditoria.

Vigile el consumo real con:

```sql
SELECT table_name,
       ROUND((data_length + index_length) / 1024 / 1024, 2) AS mb
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name LIKE 'importacion_padron_%';
```

## Preparar Windows Server 2016

El proyecto del lector esta en `foxpro-reader/ControlAguasFoxProReader`. Se publica para `win-x86` porque el proveedor Visual FoxPro suele estar registrado en 32 bits.

> Compatibilidad: Microsoft publica .NET 8 para Windows Server 2016 como arquitectura x64 soportada, no x86. El RID `win-x86` es necesario para cargar el proveedor de 32 bits, pero esta combinacion debe probarse en el servidor antes de pasar a produccion. Si el ejecutable no inicia bajo WOW64, la alternativa soportable es compilar el lector para .NET Framework 4.8/x86 o instalar un proveedor OLE DB de la misma arquitectura que un proceso x64.

1. Instale Microsoft Visual FoxPro OLE DB Provider (`VFPOLEDB.1`).
2. Cree una cuenta dedicada, por ejemplo `DOMINIO\\ControlAguasReader`.
3. Conceda solamente lectura y ejecucion sobre la carpeta que contiene `maestro.dbf` y archivos asociados:

```powershell
icacls "D:\FoxPro\DATOS" /grant "DOMINIO\ControlAguasReader:(OI)(CI)(RX)"
```

Si se usa una ruta UNC, configure tambien el recurso compartido con permiso **Read** para esa cuenta. No guarde usuario o contrasena del recurso en `appsettings.json`; ejecute el lector bajo la cuenta autorizada.

Compruebe el proveedor desde PowerShell de 32 bits:

```powershell
& "$env:SystemRoot\SysWOW64\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command `
  '[System.Data.OleDb.OleDbEnumerator]::GetRootEnumerator() | Where-Object SOURCES_NAME -eq "VFPOLEDB.1"'
```

Pruebe la salida HTTPS, sustituyendo el host:

```powershell
Test-NetConnection control-aguas.example.com -Port 443
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest "https://control-aguas.example.com/api/health" -UseBasicParsing
```

## Compilar y publicar el lector

Requiere el SDK de .NET 8 en una maquina de compilacion. Desde la raiz del repositorio:

```powershell
dotnet restore .\foxpro-reader\ControlAguasFoxProReader\ControlAguasFoxProReader.csproj
dotnet publish .\foxpro-reader\ControlAguasFoxProReader\ControlAguasFoxProReader.csproj `
  -c Release -r win-x86 --self-contained true `
  -p:PublishSingleFile=true `
  -o .\foxpro-reader\publish\win-x86
```

Copie `appsettings.example.json` como `appsettings.json` junto al ejecutable y configure:

```json
{
  "FoxProFolder": "D:\\FoxPro\\DATOS",
  "BackendBaseUrl": "https://control-aguas.example.com",
  "ApiKey": "la-misma-clave-configurada-en-railway",
  "BatchSize": 500
}
```

Proteja el archivo para que solo la cuenta dedicada y administradores puedan leerlo:

```powershell
icacls ".\appsettings.json" /inheritance:r
icacls ".\appsettings.json" /grant:r "DOMINIO\ControlAguasReader:R" "BUILTIN\Administrators:F"
```

La aplicacion muestra conexion FoxPro, conexion Control Aguas, hora de ultima importacion, filas leidas, bloques enviados y rechazados. Los registros locales se escriben en `%ProgramData%\ControlAguasFoxProReader\logs` sin incluir la clave API.

## Operacion y recuperacion

- Pulse **Probar conexion** antes del primer envio.
- Pulse **Leer y enviar ahora** solamente cuando el archivo no este siendo mantenido o respaldado.
- Si falla la red, repita el envio: el codigo de lote y los hashes evitan duplicados.
- Si una fila queda en conflicto, revise el abonado duplicado y descarte o corrija el origen antes de un nuevo lote.
- Aplicar es manual y queda registrado con usuario, fecha, lote, cantidad y accion.
- Antes de la primera aplicacion en produccion, haga respaldo de MySQL y de `backend/data/maestro-claves.json`.

## Pruebas

Backend:

```powershell
cd backend
npm test
```

Frontend:

```powershell
cd frontend
npm run build
```

Prueba de aceptacion recomendada: enviar dos veces el mismo lote, verificar que no duplique filas; modificar una copia controlada del DBF, revisar la diferencia estructurada, aplicar una fila y comprobar inmediatamente la busqueda por abonado y clave.
