# Seguimiento único de clandestinos: diseño

Fecha: 2026-11-15. Estado: diseño aprobado, sin implementar. El usuario aceptó las diez recomendaciones de la sección 8 el 2026-11-15. No se cambió código ni datos.

Alcance: Alcaldía, Banco, técnicos y fichas. Objetivos, en este orden: no duplicar casos, conservar las decisiones de campo y descontar lo resuelto del pendiente. El padrón importado de FoxPro no se toca en ningún paso.

## Resumen

Hoy un caso tiene dos mitades que no se conocen bien entre sí. El **candidato** vive en `banco_clandestinos` (pendiente, enviado o descartado) y la **ficha** vive en `inmuebles_clandestinos` (siete etapas). Cada tabla compara la clave a su manera, cada vía de entrada evita duplicados solo contra sí misma, y cada pantalla cuenta "pendiente" con su propia regla.

La propuesta no crea una tabla de casos. Mantiene las dos tablas y agrega cuatro piezas:

1. **Una sola clave canónica**, guardada en ambas tablas. El caso es la clave.
2. **Una sola lectura del estado del caso** (un servicio nuevo y pequeño), de donde salen todas las cifras.
3. **Reglas de entrada iguales para todas las vías**: lo que llega se compara contra candidatos y fichas antes de quedar como pendiente.
4. **Una regla de precedencia**: lo que decide una persona solo lo cambia una persona; lo que decide el sistema lo puede deshacer el sistema.

Cambios de esquema: tres columnas nuevas y ninguna tabla. Dos candados de unicidad opcionales al final.

## 1. El flujo actual

### 1.1 Por dónde entra un caso

| Vía | Quién | Código | Referencia de origen | Contra qué evita duplicados |
|---|---|---|---|---|
| Importación de QField (CSV) | Administración | `importBancoClandestinos` → `guardarCandidatos` | `qfield` + id del punto | Su propio origen y referencia; después, agrupación por clave dentro del banco |
| Puntos GPS "sin cuenta" | Administración y operador | `fieldFindingsService.enviarHallazgosAlBanco` | `gps` + clave base (3 bloques) | Banco y fichas, pero por clave base |
| Cruce con Alcaldía | Administración y operador | `enviarClavesAlcaldiaAlBanco` | `alcaldia` + clave como viene en Alcaldía | Banco de otros orígenes y fichas activas, por clave normalizada |
| Ficha nueva a mano | Administración y operador | `POST /inmuebles` → `createInmueble` | Ninguna | Solo la clave exacta de otra ficha |
| Reporte técnico | Administración, operador y validadora | `createTechnicalReport` | Código `RT-…` | Otros reportes abiertos con el mismo texto de clave o abonado |

### 1.2 Banco

- `guardarCandidatos` dictamina cada fila contra los dos padrones en memoria (`dictaminarCandidato`): `clandestino`, `sin_determinar` o `registrado`.
- `agruparDuplicadosBanco` deja un candidato principal por clave y pasa las demás copias pendientes a descartadas con `duplicado_de`. Corre al importar, al verificar y, como máximo cada 10 minutos, al abrir el banco.
- Administración reparte (`asignarCandidatos`). Cada técnico ve y trabaja solo lo suyo (`soloLoSuyo`, `canWork`), en orden de recorrido (`ORDEN_TECNICO`).
- "Verificar" (`verificarBancoClandestinos`) vuelve a dictaminar todos los pendientes y descarta los que salen `registrado`.
- El técnico envía a ficha (`enviarCandidatoAFicha`), descarta con motivo (`descartarCandidato`) o devuelve un descarte (`restaurarCandidato`). Devolver una copia la marca `no_duplicado = 1`.

### 1.3 Ficha

- Etapas (`FICHA_TRANSITIONS`): borrador, pendiente, visita, confirmada, regularización, regularizada y descartada.
- El operador confirma el hallazgo de la visita. Regularizar, cerrar, descartar y devolver una regularización a confirmada son de administración (`changeFichaState`).
- Cada cambio de etapa queda en `historial_estados` y en la bitácora.
- Aparte de la etapa, la ficha tiene `estado_padron` (clandestino, varios padrones, reportada), `printed_at` y `archived_at`. Archivar es un paso habitual después de imprimir ("Ficha impresa enviada a guardadas").

### 1.4 Dónde se pierde, se duplica o se vuelve a contar

Los hallazgos salen de la lectura del código. Los marcados con (local) además se vieron en la base local, en modo lectura.

**Identidad**

| # | Hallazgo | Dónde |
|---|---|---|
| A1 | Hay cuatro formas de comparar una clave. El banco rellena cada bloque a dos cifras (`normalizarClaveBanco`). La ficha solo quita espacios (`normalizeKey`). Los puntos GPS comparan por clave base. Los reportes comparan el texto tal cual. | `bancoClandestinosService.js:48`, `utils/normalize.js:1`, `fieldFindingsService.js:154`, `clandestinosService.js:503` |
| A2 | Al enviar a ficha se busca la ficha por texto exacto (`getByClave`). Una ficha escrita "89-13-5" no se encuentra con "89-13-05" y nace una segunda ficha del mismo predio. La restricción única no lo impide, porque son textos distintos. | `bancoClandestinosService.js:896`, `inmuebleService.js:160` |
| A3 | "089-13-15" y "89-13-15" quedan como claves distintas: el cero a la izquierda de un bloque de tres cifras se conserva. | `bancoClandestinosService.js:51` |
| A4 | Los puntos GPS dan por atendido un predio si cualquier unidad del lote tiene candidato o ficha. Contradice la regla vigente: una clave de 4 bloques sin coincidencia exacta es un caso propio. | `fieldFindingsService.js:160` |

**Duplicados**

| # | Hallazgo | Dónde |
|---|---|---|
| B1 | La agrupación por clave solo mira el banco. Una ficha creada a mano no tiene candidato, así que un punto nuevo con esa clave entra como pendiente y se reparte. (local: 1 candidato pendiente cuya clave ya tiene ficha activa.) | `planDuplicados`, `bancoClandestinosService.js:590` |
| B2 | Solo la vía de Alcaldía revisa las fichas antes de entrar. QField no lo hace. | `clavesConTrabajo`, `bancoClandestinosService.js:705` |
| B3 | Si la ficha de esa clave está archivada, "Enviar a ficha" falla con "Ya existe una ficha archivada…" y el candidato se queda pendiente para siempre. | `bancoClandestinosService.js:915` |
| B4 | Si administración elimina una ficha archivada, el candidato queda "enviado" sin ficha (la llave foránea pone `inmueble_id` en nulo). Ese candidato sigue siendo el principal de su clave: los puntos nuevos se agrupan bajo un caso que ya no existe. | `schema.sql:340`, `inmuebleService.js:675` |
| B5 | Varios candidatos pueden quedar "enviados" a la misma ficha (una copia devuelta se enlaza sin crear otra). "Enviados a ficha" puede ser mayor que el número de fichas. | `bancoClandestinosService.js:896` |
| B6 | Si se corrige la clave de una ficha, el candidato enlazado conserva la clave vieja y sigue ocupándola como principal. | `updateInmueble`, `inmuebleService.js:298` |
| B7 | La agrupación corre como máximo cada 10 minutos al abrir el banco. Imprimir el listado, "seleccionar todos" y asignar no la disparan. (local: 12 claves repetidas entre pendientes sin agrupar.) | `agruparSiToca`, `bancoClandestinosService.js:649` |
| B8 | Un candidato sin clave recibe la clave al enviarlo a ficha. En ese momento no se revisa si esa clave ya se descartó o ya tiene otro candidato. | `bancoClandestinosService.js:875` |

**Decisiones que no se conservan**

| # | Hallazgo | Dónde |
|---|---|---|
| C1 | Un candidato descartado por "Verificar" (aparece en Aguas) y devuelto por una persona se vuelve a descartar en la siguiente verificación. No hay marca de "una persona ya lo revisó". | `verificarBancoClandestinos`, `bancoClandestinosService.js:787` |
| C2 | Un candidato `registrado` no se puede enviar a ficha aunque el técnico confirme en campo que es otra casa. La única salida es descartarlo. | `bancoClandestinosService.js:881` |
| C3 | Un descarte automático y uno manual solo se distinguen por el texto del motivo ("Aparece en Aguas (verificación automática)…"). | `bancoClandestinosService.js:803` |
| C4 | Un descarte automático nunca se revisa de nuevo: si un lote posterior del padrón ya no trae esa cuenta, el candidato sigue descartado. | `bancoClandestinosService.js:792` |
| C5 | Un operador puede reabrir una ficha descartada: la transición descartada → pendiente no exige administración y el cajón le muestra "Iniciar visita". Leído en el código, sin probar en pantalla. | `clandestinosService.js:408`, `FichaDrawer.jsx:72` |
| C6 | La migración de arranque que convierte el viejo dictamen "probable" corre en cada reinicio. Hoy es inofensiva, pero es el mismo mecanismo que causó el problema del 3 de noviembre. | `config/db.js:783` |
| C7 | Las fichas nunca se vuelven a cruzar con el padrón. Una ficha en regularización cuya clave ya aparece en Aguas sigue contando como pendiente hasta que alguien la cierre. | Sin código que lo haga |

**Conteos**

| # | Hallazgo | Dónde |
|---|---|---|
| D1 | El avance por técnico cuenta como "trabajado" lo que "Verificar" descartó solo, porque el descarte automático conserva la asignación. | `resumirAsignaciones`, `marcarProcesado` |
| D2 | "Banco que terminó en ficha" divide entre todos los descartados, que incluyen copias y descartes automáticos. | `ResumenClandestinos.jsx:116` |
| D3 | Gerencia muestra como "Fichas activas" todas las no archivadas, incluidas regularizadas y descartadas. | `managerReportService.js:159`, `useManagerDashboard.js:26` |
| D4 | Una ficha archivada sale de todos los conteos, abierta o cerrada. | `listClandestinosFichas`, `clandestinosService.js:126` |
| D5 | El cruce con Alcaldía marca solo las claves que entraron por Alcaldía. Una clave que ya está en el banco por QField, que ya tiene ficha o que se descartó sigue saliendo como candidata sin tratar, y la brecha por barrio nunca baja. | `listarRefsBanco`, `ClavesSinAguas.jsx:62` |
| D6 | Para saber el estado de un caso hay que leer seis campos en dos tablas: estado y dictamen del candidato; etapa, estado de padrón, archivo e impresión de la ficha. | — |

### 1.5 La base local

Medido el 2026-11-15, en una transacción de solo lectura. Sirve para ver la forma de los datos, no su tamaño real: la base local no es la de producción.

| Dato | Valor |
|---|---|
| Candidatos | 303, todos pendientes y de QField |
| Dictamen | 221 clandestino, 67 registrado, 15 sin determinar |
| Sin clave | 30 |
| Claves de 4 bloques | 67 |
| Claves repetidas entre pendientes, sin agrupar | 12 |
| Lotes con más de una clave distinta | 3 |
| Fichas | 2 (una pendiente, una descartada), ninguna salida del banco |
| Candidatos pendientes cuya clave ya tiene ficha | 1 |
| Claves no canónicas | 0 en el banco, 0 en fichas |

## 2. Identidad única del caso

### 2.1 La llave

El caso se identifica por la **clave catastral canónica**. Todas las vías usan la misma función, `claveCanonica`, que es la actual `normalizarClaveBanco` movida a `backend/src/utils/claveCanonica.js` con dos ajustes:

- una clave sin ninguna cifra distinta de cero ("00-00-00") no es clave. Es la misma regla que ya usa Inspecciones;
- se quitan los ceros a la izquierda antes de rellenar a dos cifras, para que "089-13-15" y "89-13-15" sean la misma (decisión 7, con una comprobación pendiente en el padrón).

Reglas por tipo de clave:

| Caso | Identidad | Regla |
|---|---|---|
| Clave de 3 bloques | La clave canónica | Un caso por clave |
| Clave de 4 bloques | La clave canónica completa | Un caso por unidad. Solo coincide con la misma clave de 4 bloques. No se une sola con el lote ni con otras unidades. Si otra clave del mismo lote ya tiene caso, se muestra como aviso ("Mismo lote: …") |
| Clave ilegible o solo ceros | El punto (`origen` + `origen_ref`) | Se trata como sin clave. El texto original se guarda en `nota_revision` |
| Punto sin clave | El punto (`origen` + `origen_ref`) | No se agrupa solo. Cuando el técnico escribe la clave al enviarlo, pasa en ese momento por las reglas de la sección 3 |
| Ficha antigua con clave que no se puede leer | El id de la ficha | Queda fuera del cruce y aparece en el diagnóstico para corregirla a mano |

La clave escrita en la ficha no se reescribe, porque ya salió en documentos impresos. La canónica se guarda aparte.

### 2.2 Dónde se guarda

- `banco_clandestinos.clave_catastral` ya es canónica. Se conserva así.
- `inmuebles_clandestinos.clave_norm` es una columna nueva. La escriben `createInmueble` y `updateInmueble`; el arranque rellena las vacías.
- `getByClave` busca por `clave_norm`. Con eso se cierra A2 sin tocar los demás usos.

### 2.3 Una sola fuente para el estado

El candidato y la ficha no se pisan: el candidato manda hasta que se envía a ficha y, desde ahí, manda la ficha. No hace falta una tercera tabla que repita el estado. Lo que falta es leerlo en un solo lugar.

Servicio nuevo, `backend/src/services/seguimientoClandestinosService.js`:

- `casoDe(candidatoPrincipal, ficha)`: función pura que devuelve el estado del caso.
- `leerCasos()`: dos consultas (candidatos principales y fichas) unidas por `inmueble_id` y por clave canónica.
- `resumenCasos(user)`: las cifras de todas las pantallas. Respeta `soloLoSuyo`.
- `estadoPorClave(claves)`: en qué va cada clave. Lo usan las reglas de entrada, el cruce con Alcaldía, los puntos GPS, la ficha nueva y los reportes.

Estados del caso:

| Estado | Condición | Cuenta como |
|---|---|---|
| Por revisar | Candidato principal pendiente, dictamen distinto de registrado, sin ficha | Pendiente |
| Por depurar | Candidato principal pendiente con dictamen registrado | Aparte: sale con "Verificar" |
| En ficha | Ficha en borrador, pendiente, visita, confirmada o regularización | Pendiente |
| Regularizado | Ficha regularizada | Resuelto |
| Descartado | Candidato descartado a mano, ficha descartada o ficha eliminada | Resuelto |
| Ya en Aguas | Candidato descartado por la verificación automática | Resuelto |
| Copia | Candidato con `duplicado_de` o enlazado como copia a una ficha | No es un caso |

Si hay ficha, manda la ficha. Una ficha archivada conserva su etapa (ver decisión 1).

## 3. Reglas al entrar

Las mismas para QField, puntos GPS, Alcaldía, ficha a mano y reportes. Se aplican dentro de `guardarCandidatos`, antes de insertar, con `estadoPorClave`. Dos filas del mismo lote de importación con la misma clave se resuelven entre ellas: la primera es principal y la segunda, copia.

| Lo que ya existe para esa clave | Qué pasa con lo que llega |
|---|---|
| Nada | Entra como candidato principal pendiente |
| El mismo punto (mismo origen y referencia) | Reimportación. Si sigue pendiente se actualiza; si ya se trabajó, no se toca. Es el comportamiento actual |
| Otro candidato pendiente | Entra como copia del principal: no se reparte. El principal se elige como hoy (`pesoPrincipal`) |
| Candidato enviado o ficha abierta | Entra como copia enlazada a la ficha. No se reparte |
| Ficha regularizada | Entra como copia enlazada. El resumen avisa "punto nuevo en una clave regularizada", por si es reincidencia. No reabre nada |
| Descarte manual (candidato o ficha) | Entra como copia con "la clave ya se había descartado", quién, cuándo y por qué. No vuelve a Por revisar |
| Descarte automático "ya en Aguas" | Entra como copia. Si el padrón deja de traer la cuenta, "Verificar" devuelve el principal |
| Candidato marcado "no es duplicado" | No se agrupa. Es el comportamiento actual |

Casos particulares:

- **Ficha a mano con un candidato pendiente de esa clave**: la ficha se crea y el candidato pasa a enviado, enlazado, en la misma transacción.
- **Ficha a mano de una clave ya descartada**: no se crea. El mensaje dice quién la descartó, cuándo y por qué, y manda a devolver el candidato (ver decisión 5).
- **Ficha archivada**: se enlaza igual que una activa. Desaparece el error de B3.
- **Clave escrita al enviar un punto sin clave**: pasa por la misma tabla. Si la clave ya tiene caso, el punto queda como copia y el técnico ve el motivo.
- **Corrección de la clave de una ficha**: la clave del candidato enlazado cambia con ella y queda anotada la anterior. Si la clave nueva ya tiene otro caso, se rechaza con el aviso.
- **Puntos GPS**: `leerSeguimiento` deja de comparar por clave base y usa `estadoPorClave`. El lote queda como aviso.

`agruparDuplicadosBanco` se conserva como red de seguridad y pasa a considerar también las fichas sin candidato.

## 4. Conservar las decisiones

Regla general: **lo que decide una persona solo lo cambia una persona, con su nombre y motivo. Lo que decide el sistema lo puede deshacer el sistema.**

Para aplicarla hay que distinguir quién decidió. Columna nueva `banco_clandestinos.descarte_tipo`: `manual`, `en_aguas` o `copia`.

| Decisión | Cómo queda protegida |
|---|---|
| Descarte manual de un candidato | `descarte_tipo = 'manual'`. Importar, verificar, agrupar y arrancar el servidor no lo tocan. Manda sobre copias nuevas (sección 3) y sobre una ficha a mano |
| "No es duplicado" | `no_duplicado = 1`. Sin cambio |
| Devolver un descarte automático | Columna nueva `no_registrado = 1`: "una persona dijo que no es la cuenta que encontró el cruce". Con la marca, `dictaminarCandidato` da `sin_determinar` en vez de `registrado`, con la cuenta como pista. "Verificar" ya no lo descarta y el técnico puede enviarlo a ficha. Cierra C1 y C2 |
| "Posible desmembración" y "cuenta anotada en campo" | Son dictámenes calculados y hoy ya se conservan. Si el técnico confirma que es el mismo predio, lo descarta con motivo (decisión manual). Si confirma que es otra casa, lo envía a ficha |
| Confirmación del operador y demás etapas de la ficha | Ningún proceso automático escribe `estado_operativo`. Se agrega una prueba que lo fija |
| Descarte de una ficha | Reabrirla pasa a ser de administración y con motivo (ver decisión 3) |
| Ficha eliminada | El caso queda descartado con el motivo de archivo. La clave no vuelve al banco (ver decisión 2) |

Frente a cada proceso:

- **Verificar**: solo cambia candidatos pendientes sin marca manual. Además revisa los descartes `en_aguas`: si la cuenta ya no está en el padrón, los devuelve a pendiente. Guarda la versión del padrón con la que verificó (`clandestinos_ajustes`).
- **Lote nuevo del padrón**: no dispara nada. El banco muestra "El padrón cambió desde la última verificación". Las fichas abiertas cuya clave ya aparece en Aguas salen en el resumen como "revisar para cerrar"; se calcula al leer, con el padrón en memoria, y no cambia ninguna etapa.
- **Reinicio del servidor**: todo cambio de datos del arranque lleva una marca de una sola vez en `clandestinos_ajustes`, como ya hace `relleno_analista_datos`. La conversión de "probable" pasa a ese esquema.
- **Reimportación**: sin cambio. Actualiza los pendientes y no toca lo trabajado.

Rastro: `marcarProcesado` escribe una fila en `historial_estados` con `entidad_tipo = 'candidato'`. Así cada cambio de un candidato, manual o automático, queda con fecha, autor y motivo. La línea de tiempo del caso es el historial de sus candidatos más el de su ficha.

## 5. Pendiente y resuelto, en cada vista

Definición única:

- **Pendiente** = Por revisar + En ficha.
- **Resuelto** = Regularizado + Descartado + Ya en Aguas.
- Las copias no se cuentan. "Por depurar" se muestra aparte.

| Vista | Hoy | Con el diseño |
|---|---|---|
| Banco de administración | Tres estados; "Descartados" mezcla manuales, automáticos y copias | Las cifras de arriba salen de `resumenCasos`. "Descartados" se separa en descartes, ya en Aguas y copias. La lista paginada no cambia |
| Lista del técnico | Sus pendientes por barrio y clave | Igual. Las copias ya no llegan a su lista, tampoco las de claves con ficha |
| Avance por técnico | Trabajado = enviados + descartados con su asignación | Trabajado = lo que envió o descartó una persona. Lo que salió solo se muestra aparte y no sube el avance (ver decisión 8) |
| Resumen de Clandestinos | Banco pendiente + conteo de fichas por etapa | La franja del proceso sale de `resumenCasos`. "Terminó en ficha" = a ficha ÷ (a ficha + descartes manuales). Dos avisos nuevos: fichas abiertas que ya aparecen en Aguas y fichas archivadas con etapa abierta |
| Mapa de operaciones | Igual que el Resumen | Lee `resumenCasos`. `armarMapa` no cambia |
| Tablero | Fichas por etapa | Casos pendientes y resueltos |
| Gerencia | "Fichas activas" incluye cerradas y descartadas | "Casos abiertos" = pendientes. Las cerradas van aparte |
| Cruce con Alcaldía | Marca solo lo que entró por Alcaldía | Cada clave lleva su estado, venga de donde venga. La brecha por barrio se parte en sin tratar, en seguimiento y resueltas. Solo "sin tratar" se puede enviar |
| Puntos GPS | En seguimiento si el lote tiene algo | En seguimiento por clave exacta; el lote, como aviso |

## 6. Cambios mínimos

### 6.1 Esquema

| Cambio | Tabla | Para qué |
|---|---|---|
| `clave_norm VARCHAR(30) NOT NULL DEFAULT ''` con índice | `inmuebles_clandestinos` | Identidad (sección 2) |
| `descarte_tipo VARCHAR(12) NOT NULL DEFAULT ''` | `banco_clandestinos` | Quién decidió (sección 4) |
| `no_registrado TINYINT(1) NOT NULL DEFAULT 0` | `banco_clandestinos` | Devolución que manda sobre "Verificar" |

Sin tablas nuevas. Se agregan con `ensureColumn` y `ensureIndex` en el arranque y en `schema.sql`.

Opcionales, al final (paso 6):

- una columna generada en el banco con la clave solo cuando la fila es principal, con índice único, para que la base rechace un segundo principal;
- índice único sobre `clave_norm` en fichas, que exige guardar nulo en vez de vacío.

### 6.2 Migración de datos

Cada paso es idempotente y lleva su marca en `clandestinos_ajustes`. Solo toca `banco_clandestinos`, `inmuebles_clandestinos` y `clandestinos_ajustes`. No toca el padrón, las tablas de importación de FoxPro ni la bitácora.

1. **Clave canónica de las fichas**: rellena `clave_norm` donde esté vacía. Cuenta las que no se pueden leer.
2. **Tipo de descarte**: con `duplicado_de`, `copia`; con el motivo de verificación automática, `en_aguas`; el resto de descartados, `manual`.
3. **Devoluciones anteriores**: marca `no_registrado` en los candidatos pendientes que tienen una devolución en la bitácora después de un descarte automático. Solo lee la bitácora.
4. **Enlace con fichas**: cada candidato pendiente cuya clave ya tiene ficha pasa a copia enlazada y pierde la asignación.
5. **Enviados sin ficha**: quedan como descarte manual con el motivo "Ficha eliminada" (decisión 2).
6. **Agrupación**: una pasada de `agruparDuplicadosBanco`.

Antes de migrar se corre un diagnóstico de solo lectura en producción (paso 0) y se revisa a mano lo que no se resuelve solo: fichas con la misma clave escrita distinto y claves que se unirían al quitar ceros.

### 6.3 Servicios

| Archivo | Cambio |
|---|---|
| `utils/claveCanonica.js` (nuevo) | La función única; `normalizarClaveBanco` queda como alias |
| `services/seguimientoClandestinosService.js` (nuevo) | `casoDe`, `leerCasos`, `resumenCasos`, `estadoPorClave`. Con rama para la base en memoria |
| `bancoClandestinosService.js` | `guardarCandidatos` decide antes de insertar. `marcarProcesado` escribe tipo de descarte e historial. `verificarBancoClandestinos` respeta marcas y revisa los automáticos. `dictaminarCandidato` atiende `no_registrado`. `restaurarCandidato` pone la marca. `resumirAsignaciones` separa lo automático. `listarRefsBanco` responde por clave para cualquier origen |
| `inmuebleService.js` | `clave_norm` al crear y editar. `getByClave` por `clave_norm`. Crear enlaza o rechaza según la sección 3. Eliminar deja el caso descartado |
| `clandestinosService.js` | Reabrir una ficha descartada, solo administración. Reportes: aviso del estado del caso al crear |
| `fieldFindingsService.js` | `leerSeguimiento` usa `estadoPorClave` |
| `managerReportService.js` | Cifras desde `resumenCasos` |
| `config/db.js`, `sql/schema.sql` | Columnas, índices y migración con marcas |
| `clandestinosRoutes.js`, `middleware/managerAccess.js` | `GET /api/clandestinos/seguimiento`, de lectura; también para Gerencia |

### 6.4 Pantallas

| Archivo | Cambio |
|---|---|
| `ResumenClandestinos.jsx` | Lee el seguimiento; dos avisos nuevos |
| `BancoClandestinos.jsx` | Descartados en tres grupos; aviso "mismo lote"; aviso de padrón cambiado; marca "devuelto por una persona" |
| `FichaDrawer.jsx`, `FichaSections.jsx` | Lista de puntos de campo de la clave; mensaje al crear una ficha de una clave con caso; reabrir solo administración |
| `ClavesSinAguas.jsx` | Estado del caso por clave para cualquier origen |
| `flujoOperaciones.js`, `useManagerDashboard.js`, `ManagerReportVisuals.jsx` | Cifras del seguimiento |
| `ReporteTecnicoForm.jsx` | Muestra en qué va la clave consultada |

### 6.5 Lo que se reutiliza sin cambio

Las tablas actuales, `historial_estados` y la bitácora; `dictaminarCandidato` y el índice de padrones; `planDuplicados` y `pesoPrincipal`; `FICHA_TRANSITIONS` y `changeFichaState`; `soloLoSuyo`, `canWork`, `canFeed`, `ORDEN_TECNICO` y `repartirCandidatos`; la asignación con sus avisos y notificaciones; la lista paginada del banco y la bandeja de fichas; la impresión.

## 7. Riesgos, casos límite y orden

### 7.1 Riesgos

| Riesgo | Tratamiento |
|---|---|
| La base de producción tiene casos que la local no | Paso 0: diagnóstico de solo lectura antes de escribir nada |
| La migración enlaza mal un candidato con una ficha | Solo enlaza por clave canónica idéntica. Cada cambio queda en el historial y se puede devolver |
| Quitar ceros une dos claves que eran distintas | El diagnóstico lista los pares antes de aplicar. Si hay un barrio real con código de tres cifras que empiece en cero, no se aplica |
| Dos lecturas del estado que se separen con el tiempo | Hay una sola función (`casoDe`); las pantallas dejan de calcular por su cuenta |
| Un candado único rechaza una importación | Va al final y solo si el diagnóstico da cero conflictos durante un ciclo |
| Los avances por técnico bajan al quitar lo automático | Se avisa antes; la cifra anterior queda visible como "salieron solos" |
| Permisos | No cambia ninguna decisión vigente. La ruta nueva es de lectura y sigue `soloLoSuyo` |

### 7.2 Casos límite

- **Dos casas con la misma clave escrita**: una se devuelve con "no es duplicado" y sigue como caso aparte. Para que no terminen en la misma ficha, al enviarla se permite corregir la clave.
- **Desmembración**: el caso es la clave nueva de Alcaldía. La cuenta del lote original queda como pista y como abonado en la ficha.
- **Clave regularizada que vuelve a aparecer en campo**: queda como copia con aviso. Reabrir es decisión de administración.
- **Cuenta que desaparece del padrón**: el descarte automático se devuelve solo; el manual no.
- **Ficha archivada con etapa abierta**: sigue pendiente y sale en un aviso.
- **Dos técnicos envían la misma clave a la vez**: lo cubren el control de estado esperado de `marcarProcesado` y la restricción única de la ficha.
- **Reintento sin red**: "Enviar a ficha" ya responde igual si el envío se había completado.
- **Clave repetida en el padrón de Alcaldía**: ya cuenta una sola vez.
- **Operador que envía claves de Alcaldía a un banco que no ve**: sin cambio. La respuesta le dice cuántas entraron y cuántas ya tenían caso.

### 7.3 Orden de implementación

Cada paso se puede desplegar solo y no cambia lo que ven los técnicos hasta el paso 5.

| Paso | Qué | Pruebas |
|---|---|---|
| 0 | Diagnóstico de solo lectura en producción. Sin cambios | Revisión de las cifras con el usuario |
| 1 | `claveCanonica`, `clave_norm` en fichas, `getByClave` por clave canónica | Unitarias de la función (ceros, 3 y 4 bloques, solo ceros, texto). Una ficha "302-6-1" se encuentra con "302-06-01". Enviar a ficha enlaza y no crea otra |
| 2 | Servicio de seguimiento y ruta de lectura. Ninguna pantalla lo usa todavía | Unitarias de `casoDe` con cada combinación de candidato y ficha. `resumenCasos` con un banco de prueba: pendiente + por depurar + resuelto = total. Un técnico solo recibe lo suyo |
| 3 | Reglas de entrada y migración de enlace | Matriz: cada vía (QField, GPS, Alcaldía, ficha a mano, clave escrita al enviar) contra cada estado previo de la tabla de la sección 3. Reimportar dos veces da el mismo resultado. Ficha archivada se enlaza |
| 4 | `descarte_tipo`, `no_registrado`, verificación que respeta marcas, marcas de una sola vez en el arranque, ficha eliminada y clave corregida | Verificar dos veces no cambia nada. Devolver y verificar: sigue pendiente. Un descarte manual sobrevive a importar, verificar y a correr la migración dos veces. Cuenta que sale del padrón: el automático vuelve y el manual no. Integración contra la base temporal |
| 5 | Pantallas | Bancos de prueba a 1440 y 390 px. La suma de la franja del Resumen coincide con el seguimiento. `npm run build` |
| 6 | Candados de unicidad (opcional) | Importación con clave repetida: una principal y una copia, sin error. Diagnóstico en cero antes de crear los índices |
| 7 | Reportes técnicos por las mismas reglas de entrada (opcional) | Reporte aprobado de una clave con caso: se enlaza y no crea otro |

## 8. Decisiones del usuario

Las diez quedaron aceptadas por el usuario el 2026-11-15, tal como se recomendaron.

| # | Pregunta | Decisión |
|---|---|---|
| 1 | Una ficha archivada con etapa abierta, ¿sigue pendiente? | Sí. Archivar no cambia el estado; el resumen avisa cuántas hay |
| 2 | Al eliminar una ficha, ¿qué pasa con el caso? | Queda descartado con el motivo. No vuelve al banco |
| 3 | ¿Quién reabre una ficha descartada? Hoy puede un operador | Solo administración, con motivo |
| 4 | Un candidato "registrado en Aguas" que el técnico dice que es otra casa | Devolverlo lo marca y lo deja enviar a ficha; "Verificar" no lo vuelve a descartar |
| 5 | Ficha a mano de una clave ya descartada | No se crea; primero se devuelve el candidato, para que quede un solo rastro |
| 6 | Mismo lote, distinta unidad (3 y 4 bloques) | Casos separados con aviso. No se unen solos |
| 7 | ¿"089-13-15" es la misma clave que "89-13-15"? | Sí, con la condición de abajo |
| 8 | Lo que "Verificar" descarta solo, ¿cuenta en el avance del técnico? | No. Se muestra aparte |
| 9 | ¿Candados de unicidad en la base? | Sí, al final y con el diagnóstico en cero |
| 10 | ¿Los reportes técnicos entran ahora al mismo seguimiento? | Después. No bloquea los tres objetivos |

Condición de la decisión 7: que ningún barrio real tenga un código de tres cifras que empiece en cero.

- Comprobado el 2026-11-15 en el catálogo de barrios de la base local: 67 códigos, 7 de tres cifras, ninguno empieza en cero y ninguno choca con otro al quitar ceros. El banco y las fichas locales tampoco tienen bloques así.
- Falta comprobarlo en el padrón: la base local no tiene el padrón cargado y el catálogo no es completo (el código 113 está en el padrón y no en el catálogo). Queda como parte del paso 0. Si aparece un caso, la regla de los ceros no se aplica y el resto del diseño no cambia.

## 9. Lo que no se verificó

- No se ejecutó ninguna prueba ni se probó ninguna pantalla: el trabajo fue de lectura.
- La base de producción no se consultó. Las cifras son de la base local.
- C5 (el operador reabre una ficha descartada) sale del código; falta confirmarlo con sesión iniciada.
- No se revisó la importación de FoxPro más allá de confirmar que el diseño no escribe en sus tablas.
