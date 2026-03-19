# App de inmuebles clandestinos

Primera version funcional basada en los formatos de `referencia/CLANDESTINOS2026.xlsx` y `referencia/AVISO-CLANDESTINO.docx`.

## Hallazgos del analisis

### Excel

Las hojas del archivo no son una tabla maestra sino fichas individuales. De una ficha completa se identificaron estos bloques:

- Clave catastral
- Informacion del abonado
- Barrio/Colonia/Lotificacion
- No. de identidad
- Telefono/Celular
- Accion de inspeccion
- Situacion del inmueble
- Tendencia del inmueble
- Uso del suelo
- Actividad
- Codigo del sector
- Comentarios
- Conexion de agua potable
- Conexion alcantarillado
- Recoleccion de desechos
- Fotografia del inmueble

### Word

El aviso repite una estructura fija con variables principales:

- Fecha
- Ubicacion del inmueble
- Clave catastral
- Nombre y cargo de firmante
- Listado fijo de documentos requeridos

## Estructura

```text
backend/
  sql/schema.sql
  src/
frontend/
  src/
referencia/
```

## Schema SQL propuesto

El schema base esta en [backend/sql/schema.sql](/c:/Users/kyubi/OneDrive/Documentos/app-clandestinos/backend/sql/schema.sql).

Tabla principal: `inmuebles_clandestinos`

- `clave_catastral` como identificador unico de negocio
- Campos textuales para replicar la ficha actual
- `foto_path` para guardar la ruta del archivo subido
- `fecha_aviso`, `firmante_aviso` y `cargo_firmante` para generar el aviso

## Backend

API REST en Express con rutas:

- `GET /api/health`
- `GET /api/inmuebles`
- `GET /api/inmuebles/clave/:clave`
- `POST /api/inmuebles`
- `PUT /api/inmuebles/:id`
- `POST /api/inmuebles/:id/foto`
- `GET /api/inmuebles/:id/aviso`

Si defines `USE_MEMORY_DB=true`, el backend levanta con un registro semilla mientras se configura MySQL.

## Frontend

Interfaz React + Vite con:

- Busqueda por clave catastral
- Listado lateral de registros
- Formulario principal inspirado en la ficha actual
- Carga de fotografia
- Ficha visual mas completa
- Generacion de aviso desde la API
- Impresion de ficha y aviso

## Como correr localmente

### 1. Backend

```bash
cd backend
copy .env.example .env
npm install
```

Configura MySQL en `.env` o usa temporalmente:

```env
USE_MEMORY_DB=true
```

Luego:

```bash
npm run dev
```

### 2. Base de datos

Ejecuta el script [backend/sql/schema.sql](/c:/Users/kyubi/OneDrive/Documentos/app-clandestinos/backend/sql/schema.sql) en tu servidor MySQL.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Opcionalmente crea `.env`:

```env
VITE_API_URL=http://localhost:4000/api
VITE_FILES_URL=http://localhost:4000
```

## Siguiente paso recomendado

Conectar la app a MySQL real y empezar a cargar datos historicos desde las fichas existentes del Excel.
