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

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Base de datos: MySQL / MariaDB
- Carga de archivos: Multer
- API: REST JSON

## Estructura del proyecto

```text
backend/
  sql/
  src/
  uploads/
frontend/
  src/
referencia/
```

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
- `POST /api/inmuebles`
- `PUT /api/inmuebles/:id`
- `POST /api/inmuebles/:id/foto`
- `GET /api/inmuebles/:id/aviso`
- `POST /api/inmuebles/aviso-preview`

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

### 2. Backend

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

Al iniciar, el backend intenta conectarse a MySQL/MariaDB, arranca la instancia local si existe en `.db/mariadb` y ejecuta `backend/sql/schema.sql`.

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
