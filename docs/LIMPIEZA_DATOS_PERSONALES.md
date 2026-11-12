# Sacar los padrones del repositorio

El repositorio `juan0793/aguaschol` es público y versionaba padrones con datos
personales:

| Archivo | Contenido |
| --- | --- |
| `backend/data/alcaldia-claves.json` | 47,533 registros de catastro; 33,246 con número de identidad |
| `backend/data/maestro-claves.json` | 24,080 abonados con nombre, clave y saldo |
| `backend/data/maestro-source-upload.bin` | Excel fuente del padrón de Aguas |
| `backend/data/alcaldia-meta.json`, `maestro-meta.json` | Metadatos de los dos padrones |
| `referencia/CLANDESTINOS2026.xlsx` | Registro de clandestinos |

La rama `chore/sacar-padron-del-repo` trae dos commits que **se despliegan por
separado y en orden**.

## Paso 0: dejar el repositorio en privado (hoy)

GitHub → Settings → General → Danger Zone → Change visibility → Private.
Vercel y Railway siguen funcionando porque usan la integración de GitHub.

## Paso 1: desplegar el respaldo en R2 (commit `54fd1f1`)

El padrón de Aguas ya se recupera de R2 al arrancar. El de Alcaldía no: en
producción solo existía porque venía en el repositorio. Este commit:

- al arrancar, baja el padrón de Alcaldía de R2 (`padron/alcaldia/…`);
- si R2 todavía no lo tiene, sube una vez la copia local, que en este
  despliegue todavía viene en el repositorio;
- cada carga nueva desde la pantalla del padrón también se guarda en R2.

```bash
git push origin 54fd1f1:main
```

Cuando Railway termine, revisa que el log tenga esta línea:

```
Padron de Alcaldia: 47533 registros (origen local, copiado a R2).
```

En el siguiente reinicio debe decir `origen r2`. **No sigas al paso 2 hasta
verla.** Si sale "No se pudo sincronizar…", revisa las variables `R2_*`.

## Paso 2: dejar de versionar los archivos (commit `1af0d00`)

Saca los archivos del índice y los agrega al `.gitignore`. Siguen en tu disco.
Las pruebas pasan a usar un padrón inventado (`backend/test/fixtures/padron`).

```bash
git push origin chore/sacar-padron-del-repo:main
```

Después del despliegue, el log debe decir `origen r2` para Alcaldía y
`Padron maestro recuperado desde r2` para Aguas.

## Paso 3: borrar los archivos del historial

Hasta este paso, cualquiera con acceso al repositorio puede recuperar los
archivos desde commits viejos. Reescribir el historial cambia el hash de todos
los commits: hazlo cuando no haya trabajo sin subir en otras máquinas.

```bash
pip install git-filter-repo
```

```bash
git clone --mirror https://github.com/juan0793/aguaschol.git aguaschol-limpio.git
```

```bash
cd aguaschol-limpio.git && git filter-repo --invert-paths --path backend/data/alcaldia-claves.json --path backend/data/alcaldia-meta.json --path backend/data/maestro-claves.json --path backend/data/maestro-meta.json --path backend/data/maestro-source-upload.bin --path referencia/CLANDESTINOS2026.xlsx
```

```bash
git push --force --mirror origin
```

`git filter-repo` quita el remoto `origin` por seguridad; antes del push,
vuelve a agregarlo con
`git remote add origin https://github.com/juan0793/aguaschol.git`.

Después:

1. En cada computadora, vuelve a clonar el repositorio. Antes, copia aparte
   `backend/data/*-claves.json` y `backend/.env`, que no están en git.
2. GitHub puede conservar copias en caché de los commits viejos, por ejemplo en
   pull requests. Para borrarlas, pide la purga en
   https://support.github.com (opción "Remove sensitive data").
3. Si el repositorio estuvo público, alguien pudo haberlo clonado. Decide con
   la gerencia si corresponde avisar.
