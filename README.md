# Aguas de Choluteca

App web para registrar inmuebles clandestinos, basada en los formatos actuales de trabajo de Aguas de Choluteca.

Esta primera versión toma como referencia:

- `referencia/CLANDESTINOS2026.xlsx`
- `referencia/AVISO-CLANDESTINO.docx`

El objetivo es reemplazar el flujo manual en Excel manteniendo una ficha y un aviso visualmente cercanos a los documentos originales.

## Características

- Crear registros de inmuebles clandestinos
- Editar registros existentes
- Buscar por clave catastral
- Listar registros
- Subir fotografía del inmueble
- Visualizar ficha técnica
- Imprimir ficha en formato carta
- Generar aviso en pestaña aparte
- Editar el aviso antes de imprimirlo

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Base de datos: MySQL
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

## Qué se detectó en los archivos de referencia

### Excel

El archivo no trae una tabla maestra, sino fichas individuales por inmueble. Los bloques principales detectados fueron:

- Clave catastral
- Información del abonado
- Identificación del inmueble
- Datos del inmueble
- Datos de los servicios
- Fotografía
- Firmas de levantamiento y análisis

### Word

El aviso utiliza una estructura fija con variables como:

- Fecha
- Ubicación del inmueble
- Clave catastral
- Firmante
- Cargo

## Base de datos

El script inicial está en [backend/sql/schema.sql](/c:/Users/kyubi/OneDrive/Documentos/app-clandestinos/backend/sql/schema.sql).

Tabla principal:

- `inmuebles_clandestinos`

Campos destacados:

- `clave_catastral` como identificador único
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

## Cómo ejecutar el proyecto

### 1. Backend

```bash
cd backend
copy .env.example .env
npm install
```

Si todavía no vas a conectar MySQL, puedes usar modo temporal en memoria:

```env
USE_MEMORY_DB=true
```

Luego:

```bash
npm run dev
```

### 2. Base de datos

Si vas a usar MySQL, ejecuta:

```sql
backend/sql/schema.sql
```

Y configura las credenciales en `backend/.env`.

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

La aplicación ya incluye:

- interfaz moderna azul/blanco basada en la identidad del logo
- formulario por secciones para evitar una página demasiado larga
- ficha técnica visual e imprimible
- aviso editable en una pestaña aparte
- soporte para fotografía
- modo temporal en memoria para pruebas rápidas

## Siguientes pasos sugeridos

- conectar MySQL real en producción
- importar datos históricos desde Excel
- mejorar la ficha para replicar aún más el formato original
- agregar autenticación en una segunda versión

## Notas

- `backend/.env` no se sube al repositorio
- `node_modules` y `dist` están excluidos por `.gitignore`
- la carpeta `referencia/` se conserva porque forma parte del contexto del proyecto
