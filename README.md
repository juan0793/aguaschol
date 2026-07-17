# Aguas de Choluteca

App web para registrar inmuebles clandestinos, basada en los formatos actuales de trabajo de Aguas de Choluteca.

Esta primera version toma como referencia:

- `referencia/CLANDESTINOS2026.xlsx`
- `referencia/AVISO-CLANDESTINO.docx`

El objetivo es reemplazar el flujo manual en Excel manteniendo una ficha y un aviso visualmente cercanos a los documentos originales.

## Caracteristicas

- Crear registros de inmuebles clandestinos
- Editar registros existentes
- Buscar por clave catastral
- Listar registros
- Subir fotografia del inmueble
- Visualizar ficha tecnica
- Imprimir ficha en formato carta
- Generar aviso en pestana aparte
- Editar el aviso antes de imprimirlo
- Guardado persistente con MariaDB/MySQL
- Consulta separada de clave catastral contra padron maestro
- Importacion bajo demanda y revisable del padron FoxPro

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Base de datos: MySQL / MariaDB
- Carga de archivos: Multer
- API: REST JSON

## Estructura del proyecto

```text
backend/
  data/
  sql/
  src/
  uploads/
frontend/
  src/
foxpro-reader/
referencia/
```

La instalacion, seguridad, publicacion `win-x86` y operacion de la integracion FoxPro se documentan en [docs/IMPORTACION_FOXPRO.md](docs/IMPORTACION_FOXPRO.md).

El despliegue, la migracion manual, la recuperacion y el rollback del padron privado en Cloudflare R2 se documentan en [docs/R2_PADRON.md](docs/R2_PADRON.md).

## Base de datos

El script inicial esta en [backend/sql/schema.sql](/c:/Users/kyubi/OneDrive/Documentos/app-clandestinos/backend/sql/schema.sql).

Tabla principal:

- `inmuebles_clandestinos`

Campos destacados:

- `clave_catastral` como identificador unico
- datos del abonado, inmueble y servicios
- `foto_path` para almacenar la ruta de la imagen
- `fecha_aviso`, `firmante_aviso`, `cargo_firmante`
- `levantamiento_datos`, `analista_datos`

## API disponible

Rutas principales:

- `GET /api/health`
- `GET /api/inmuebles`
- `GET /api/inmuebles/clave/:clave`
- `GET /api/claves/search?clave=00-00-00`
- `GET /api/claves/search?clave=00-00-00-00`
- `POST /api/inmuebles`
- `PUT /api/inmuebles/:id`
- `POST /api/inmuebles/:id/foto`
- `GET /api/inmuebles/:id/aviso`
- `POST /api/inmuebles/aviso-preview`
- `GET /api/ai/status`
- `POST /api/ai/record-assist`

## Modulo Buscar clave

La app incluye una pestana separada llamada `Buscar clave`.

Comportamiento:

- acepta clave base `00-00-00`
- acepta clave completa `00-00-00-00`
- si consultas 3 bloques, devuelve todas las coincidencias asociadas
- si consultas 4 bloques, valida la clave exacta
- si no encuentra coincidencias, muestra el mensaje de posible clandestino

Fuente de consulta:

- [backend/data/maestro-claves.json](/c:/Users/kyubi/OneDrive/Documentos/app-clandestinos/backend/data/maestro-claves.json)
- este archivo fue generado a partir del maestro `maestro_completo.xls`

Actualizacion del padron:

- un administrador puede subir un nuevo Excel desde el panel de administracion
- el sistema procesa el archivo y reemplaza el padron activo automaticamente
- la consulta `Buscar clave` empieza a usar la nueva version inmediatamente

## Como ejecutar el proyecto

### Inicio rapido

Desde la raiz del proyecto ahora tienes dos opciones sencillas:

```bash
levantar-app.bat
```

o bien:

```bash
npm run app
```

Eso abre una ventana para backend y otra para frontend.

Si luego quieres detenerlos rapido:

```bash
npm run app:stop
```

### 1. Base de datos local

La app puede usar MariaDB/MySQL persistente desde la carpeta `.db/` del proyecto.

Configuracion recomendada en `backend/.env`:

```env
DB_HOST=localhost
DB_PORT=3307
DB_USER=root
DB_PASSWORD=root
DB_NAME=app_clandestinos
USE_MEMORY_DB=false
DB_AUTO_START=true
```

Si necesitas volver al modo temporal en memoria:

```env
USE_MEMORY_DB=true
```

### IA opcional para fichas

El modulo de fichas puede usar Cerebras u otra API compatible con OpenAI para generar comentario tecnico, resumen ejecutivo, texto base de aviso, revision de calidad de ficha y plan de seguimiento. La clave queda solo en el backend.

```env
LLM_PROVIDER=cerebras
CEREBRAS_API_KEY=
CEREBRAS_API_BASE_URL=https://api.cerebras.ai/v1
CEREBRAS_MODEL=gpt-oss-120b
LLM_API_KEY=
LLM_API_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=openai/gpt-oss-20b:free
LLM_APP_NAME=Aguas de Choluteca
LLM_SITE_URL=http://localhost:5173
LLM_TIMEOUT_MS=25000
```

### Bot de Telegram

El bot responde al enviar únicamente un número de abonado o una clave catastral. Devuelve todos los campos de la ficha y su fotografía, si existe. Créalo con `@BotFather` y agrega al backend o a Railway:

```env
TELEGRAM_BOT_TOKEN=token-entregado-por-botfather
TELEGRAM_ALLOWED_CHAT_IDS=123456789,-1001234567890
```

Para conocer el ID de un chat, escriba al bot antes de autorizarlo: responderá `Chat no autorizado. ID para habilitar: ...`. Separe varios IDs con comas y reinicie el backend después de cambiar las variables.

Después del primer despliegue, los administradores pueden gestionar los chats desde **Usuarios > Accesos de Telegram**. Las solicitudes aparecen automáticamente y se pueden autorizar, revocar, eliminar o agregar manualmente sin volver a desplegar. `TELEGRAM_ALLOWED_CHAT_IDS` queda únicamente como acceso inicial de compatibilidad.

Si `CEREBRAS_API_KEY` y `LLM_API_KEY` quedan vacias, la app sigue funcionando normal y solo muestra el aviso de configuracion cuando se intenta usar IA. Para volver a OpenRouter, usa `LLM_PROVIDER=openrouter` y configura `LLM_API_KEY`.

### 2. Backend

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

Al iniciar, el backend intenta conectarse a MySQL/MariaDB, arranca la instancia local si existe en `.db/mariadb` y ejecuta `backend/sql/schema.sql`.

## Despliegue en Railway

La app ya queda preparada para desplegarse en un solo servicio de Railway desde la raiz del repositorio.

Comportamiento que ya soporta:

- usa `PORT` dinamico de Railway
- construye el frontend durante el build y lo sirve desde Express
- arranca con `npm --prefix backend start`
- acepta `DATABASE_URL` o las variables tipo `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`
- desactiva por defecto el autoarranque de MariaDB local cuando detecta Railway

Variables recomendadas en Railway:

```env
NODE_ENV=production
DB_AUTO_START=false
USE_MEMORY_DB=false
AUTH_USERNAME=admin
AUTH_PASSWORD=cambia-esta-clave
AUTH_SEED_NAME=Administrador General
AUTH_LOGIN_MAX_ATTEMPTS=5
AUTH_LOGIN_WINDOW_MINUTES=15
EMAIL_PROVIDER=brevo
EMAIL_FROM=
EMAIL_FROM_NAME=Aguas de Choluteca
EMAIL_API_KEY=
EMAIL_SANDBOX=true
LLM_PROVIDER=cerebras
CEREBRAS_API_KEY=
CEREBRAS_API_BASE_URL=https://api.cerebras.ai/v1
CEREBRAS_MODEL=gpt-oss-120b
LLM_API_KEY=
LLM_API_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=openai/gpt-oss-20b:free
LLM_APP_NAME=Aguas de Choluteca
LLM_SITE_URL=
LLM_TIMEOUT_MS=25000
```

`AUTH_PASSWORD` es obligatoria en produccion. El backend no inicia si falta.

Pruebas de seguridad y servicios backend:

```bash
npm --prefix backend test
```

Opciones de base de datos:

- si agregas un servicio MySQL en Railway, normalmente bastara con las variables `MYSQL*`
- si usas una cadena unica, tambien funciona `DATABASE_URL`

Flujo recomendado:

1. crea un proyecto nuevo en Railway desde este repositorio
2. agrega un servicio MySQL
3. configura las variables de entorno del bloque anterior
4. despliega la raiz del repositorio
5. abre la URL publica de Railway y la app servira tanto frontend como API

Si luego deseas separar frontend y backend en servicios distintos, todavia puedes hacerlo, pero ya no es obligatorio para una primera version.

Nota importante sobre archivos:

- `backend/uploads` funciona en Railway, pero el sistema de archivos del contenedor no debe considerarse permanente
- para fotografias realmente persistentes conviene migrar luego a S3, Cloudinary o un volumen montado

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Opcionalmente puedes definir:

```env
VITE_API_URL=http://localhost:4000/api
VITE_FILES_URL=http://localhost:4000
```

## Despliegue en Vercel

El frontend ya queda preparado para desplegarse desde la carpeta `frontend/`.

Configuracion recomendada en Vercel:

- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`

Variables requeridas:

```env
VITE_API_URL=https://tu-backend.up.railway.app/api
VITE_FILES_URL=https://tu-backend.up.railway.app
```

Notas:

- [frontend/vercel.json](/c:/Users/kyubi/OneDrive/Documentos/app-clandestinos/frontend/vercel.json) deja lista la app como SPA
- [frontend/.env.example](/c:/Users/kyubi/OneDrive/Documentos/app-clandestinos/frontend/.env.example) incluye las variables base
- en desarrollo local el frontend sigue usando `http://localhost:4000`

## Estado actual

La aplicacion ya incluye:

- interfaz moderna azul/blanco basada en la identidad del logo
- formulario por secciones para evitar una pagina demasiado larga
- ficha tecnica visual e imprimible
- aviso editable en una pestana aparte
- soporte para fotografia
- guardado persistente con MariaDB/MySQL
- modo temporal en memoria para pruebas rapidas

## Siguientes pasos sugeridos

- endurecer credenciales y respaldos automaticos
- importar datos historicos desde Excel
- mejorar la ficha para replicar aun mas el formato original
- agregar autenticacion en una segunda version

## Notas

- `backend/.env` no se sube al repositorio
- `.db/` y `.tools/` se usan como soporte local de la base portable
- `node_modules` y `dist` estan excluidos por `.gitignore`
- la carpeta `referencia/` se conserva porque forma parte del contexto del proyecto
