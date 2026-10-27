# DESIGN.md

Guia visual para la app de Aguas de Choluteca. Este documento define como debe verse y sentirse el proyecto completo: tablero, fichas, busqueda, mapa, reportes, avisos, usuarios e impresion.

## 1. Tema visual y atmosfera

La interfaz debe sentirse institucional, operativa y clara. Es una herramienta de trabajo diario para captura, validacion, consulta e impresion de informacion catastral; no debe parecer una landing page ni una app decorativa.

Principios:
- Priorizar lectura rapida, densidad moderada y controles visibles.
- Mantener una apariencia municipal/oficial, especialmente en fichas, avisos y reportes.
- Evitar efectos visuales excesivos, fondos muy oscuros, blobs decorativos, gradientes llamativos o layouts de marketing.
- Usar superficies limpias, bordes finos, jerarquia tipografica fuerte y estados faciles de distinguir.
- Todo lo imprimible debe poder verse bien en pantalla y salir limpio en papel/PDF.

Referencias de caracter:
- Fichas y avisos: formato institucional, parecido a documento de oficina.
- Tablero y listados: densidad tipo sistema administrativo moderno, cercano a shadcn admin dashboards.
- Formularios: claridad de datos y flujo guiado, sin adornos innecesarios.
- Mapas y reportes: enfoque tecnico, coordenadas y resumen visual confiable.

## 1.1 Referencia shadcn admin

El proyecto puede tomar de shadcn/ui la sobriedad de dashboard: cards blancas, bordes finos, radios de 8px a 12px, sidebar neutral, acciones compactas, estados discretos y tipografia clara.

No asumir que shadcn debe instalarse por defecto. La app actual usa React + Vite + CSS puro; instalar shadcn completo implica agregar Tailwind, configurar aliases y posiblemente migrar a TypeScript. Para cambios visuales incrementales, preferir adaptar el estilo con CSS existente.

### Icono de la app y logo de la empresa (desde 2026-10-13)

- El escudo de Aguas de Choluteca sigue siendo el logo de la empresa: login, menú, barra superior, avisos e informes.
- La app instalada (PWA), el favicon y la pestaña usan su propio icono: una gota clara con un visto bueno azul profundo (`#0d47c2`), sobre un degradado azul (`#0a2f9e` → `#1465d9` → `#1fa2f2`) con un resplandor turquesa en la esquina superior derecha.
- La fuente es `frontend/public/icons/app-icon.svg`, a sangre completa: el sistema recorta las esquinas, así que el archivo no lleva margen ni esquinas redondeadas. La gota cabe en el círculo seguro de Android (radio 40 %), por eso el mismo PNG de 512 sirve como `maskable`.
- `favicon.svg` es la versión para 16–32 px: gota más grande, check más grueso, sin sombra ni brillo.
- Las direcciones de los iconos llevan versión (`?v=2`) en el manifiesto, `index.html` y `sw.js`. El acceso directo instalado guarda su copia del icono y no la cambia si la dirección es la misma: al cambiar el icono, sube esa versión y la de las cachés del service worker.
- Los PNG (512, 192, Apple 180 y favicon 32) se generan desde los SVG. Comparación con la propuesta original en `docs/qa/icono-app-comparacion.png`.

## 2. Paleta de color

Usar la paleta actual como base. No cambiar el caracter azul institucional del sistema sin una razon fuerte.

Colores principales:
- Azul principal: `#1465d9` para acciones primarias, enlaces activos y datos destacados.
- Azul profundo: `#0b3f73` para encabezados, texto fuerte y piezas institucionales.
- Indigo: `#315bff` solo como acento secundario, con moderacion.
- Cian: `#2bc6df` para estados informativos, mapa o detalles de actividad.
- Teal: `#18a689` para estados correctos, completados o disponibles.
- Oro: `#f2b64a` para advertencias suaves, plazos o atencion.
- Azul cielo: `#76c8ff` para fondos suaves y detalles secundarios.
- Texto base: `#183b5a`.
- Texto secundario: `#597087`.
- Borde suave: `rgba(20, 101, 217, 0.14)`.

Roles:
- Primario: acciones que guardan, buscan, generan o confirman.
- Secundario: acciones de navegacion, limpiar, contraer, expandir o consultar.
- Peligro: archivar, eliminar o acciones irreversibles.
- Advertencia: pendientes de foto, plazos criticos, validaciones incompletas.
- Exito: ficha lista, validada, procesada o sincronizada.

Evitar:
- Interfaz dominada por un solo tono azul sin contraste.
- Gradientes morados/purpuras como estilo principal.
- Fondos oscuros extensos en modulos operativos.
- Amarillo fuerte sobre blanco en texto pequeno.

## 3. Tipografia

Fuente principal:
- `Plus Jakarta Sans`, con fallback a `system-ui`, `Segoe UI`, Arial.

Reglas:
- Texto de trabajo: 14px a 16px segun densidad.
- Titulos de panel: 18px a 24px.
- Titulos internos de formularios, tarjetas y tablas: 14px a 18px.
- Fichas imprimibles: tipografia sobria, compacta y legible.
- Etiquetas: pequenas, semibold, preferiblemente en mayusculas solo cuando ayude a escanear.

No usar:
- Letter spacing negativo.
- Hero-scale type dentro de paneles administrativos.
- Texto largo centrado en modulos de captura.

## 4. Layout general

La app debe organizarse como sistema operativo:
- Navegacion lateral o modular clara.
- Contenido principal con ancho aprovechado.
- Paneles de datos en grids consistentes.
- Acciones principales cerca del contexto donde se aplican.

Espaciado:
- Base pequena: 0.4rem a 0.6rem.
- Bloques compactos: 0.75rem a 1rem.
- Separacion de secciones: 1rem a 1.5rem.

Radios:
- Controles pequenos: 8px a 10px.
- Paneles y tarjetas: 10px a 14px.
- Fichas/documentos imprimibles: maximo 8px en bloques internos.
- Evitar radios grandes en formatos oficiales.

Sombras:
- Usar sombras suaves solo para separar paneles interactivos.
- En documentos y fichas, preferir borde fino sobre sombra fuerte.
- En impresion, eliminar sombras.

## 5. Componentes

### Botones

Primario:
- Fondo azul institucional.
- Texto blanco.
- Usar para guardar, generar, buscar, descargar o confirmar.

Secundario:
- Fondo claro.
- Borde azul suave.
- Texto azul profundo.
- Usar para imprimir, contraer, limpiar, navegar o acciones auxiliares.

Peligro:
- Fondo o borde rojo, con texto claro y accion explicita.
- Usar con confirmacion cuando sea irreversible.

Iconos:
- Usar iconos existentes del sistema cuando haya uno adecuado.
- Los botones de accion repetida deben incluir icono y texto corto.
- En toolbars densas, el icono ayuda a escanear.

### Formularios

Los formularios deben sentirse como captura administrativa:
- Etiquetas visibles arriba del input.
- Inputs con borde claro, buen foco y altura estable.
- Agrupar campos por seccion logica: abonado, inmueble, servicios, aviso, fotografia.
- Mostrar validaciones cerca del formulario y con acciones que lleven a la seccion afectada.

No hacer:
- Campos en columnas demasiado estrechas.
- Placeholder como unico label.
- Grandes tarjetas explicativas dentro del formulario.

### Listados

Los listados deben favorecer busqueda y comparacion:
- Cada registro debe mostrar clave catastral, abonado o nombre, barrio/colonia, estado y accion principal.
- Usar badges de estado compactos.
- Mantener botones de abrir, imprimir o procesar cerca del registro.
- Soportar filtros visibles sin saturar la pantalla.

### Tablero

El tablero debe ser ejecutivo y escaneable:
- KPIs compactos.
- Alertas accionables.
- Resumen de fichas, mapas, actividad y pendientes.
- Evitar secciones tipo hero comercial.

Lenguaje de tablero de análisis (desde 2026-09-24, tomado de una referencia tipo "Insights Dashboard" en versión clara). Aplica al tablero principal y es la excepción documentada a las reglas generales de títulos y bordes:
- Paneles planos: fondo blanco, filete gris de 1px (`#dfe5ec`), radio de 8px, sin sombras.
- Sin filetes de color arriba ni a la izquierda, sin etiquetas en mayúsculas encima del título y sin insignias de fondo para los conteos.
- Títulos de panel en caso oración, de 15px y peso 650. Es más chico que la regla general de 18 a 24px, porque en el tablero el protagonista es la cifra.
- Cifras grandes, en tinta (`#16283b`) y tabulares.
- Rejillas horizontales de 1px muy claras (`#e8ecf1`) y ejes de 11px apagados.
- Las barras son finas, sin pista rellena, con el extremo del dato redondeado.
- El color es dato, no adorno. El azul institucional marca la magnitud, el rojo solo lo crítico y el ocre los intereses. Una misma medida va en un solo color: la mora por servicio es toda azul, porque el icono y el nombre ya identifican el servicio.
- Gráfico de puntos "Mora por barrio y servicio": una columna por servicio y un punto por barrio. Al pasar el cursor, el mismo barrio se marca en todas las columnas, y un clic lo deja fijo. Con teclado: Tab para entrar, flechas para recorrer, Esc para soltar.

Pantallas de monitoreo (desde 2026-09-27, primera: "Uso en Railway"). Usan este mismo lenguaje de análisis y suman estas reglas:
- Gráficos de líneas con varios servicios: un color por servicio, en orden de costo: `#1465d9`, `#0f8a7e`, `#8a4fb8` y `#64748b` (del quinto en adelante, `#94a3b8`). Estos colores van solo en las líneas y su leyenda; en el resto de la pantalla el nombre identifica el servicio. Nunca se usan ocre ni rojo.
- Gráfico de líneas: el cursor en cruz lee todos los servicios a la misma hora. Es discontinuo al pasar y sólido cuando está fijo. Un clic o un toque lo fija, las flechas recorren las horas, RePág/AvPág saltan un día y Esc lo suelta; es la misma regla que el gráfico de puntos. La ficha de lectura nunca sale del gráfico.
- Mapa de calor: seis tonos de un solo azul (`#eef3f9`, `#d3e2f4`, `#a9c7ec`, `#6ea1de`, `#2f72c9` y `#0b3f73`), repartidos entre el mínimo y el máximo observados, no desde cero; el tono más claro es "la hora más tranquila". Una celda sin datos va rayada en gris, nunca en el tono 0. El pico lleva un anillo de tinta y una línea de texto lo nombra.
- Las barras que se comparan dentro de un mismo panel comparten escala, para que el mismo dólar mida lo mismo en todas. La proyección va detrás, en azul aclarado `#c9dbf3`, y la leyenda "Consumido / Proyección al cierre" aparece solo si hay proyección.
- Regla gasto contra calendario: la barra azul es la parte gastada del estimado y la marca vertical en tinta es el día del ciclo. Debajo va la frase en texto, por ejemplo "56% del estimado · 60% del ciclo transcurrido".
- Las fichas flotantes (tooltips) llevan una sombra suave `0 6px 18px rgba(22, 40, 59, 0.12)`. Es la única sombra permitida en este lenguaje, porque separa una capa que flota sobre el dato.

Resúmenes de proceso sin tarjetas (desde 2026-09-30, primero: "Resumen de clandestinos"). Aplican el mismo lenguaje de análisis, pero sin paneles: todo va a todo el ancho y las secciones se separan con filetes de 1px (`#dfe5ec`).
- La franja de indicadores solo lleva cifras que no aparecen en otra parte de la pantalla, como vencidas, nuevas, avance del equipo o conversión. Si una cifra ya está en una sección, no se repite arriba.
- El proceso va en columnas iguales, una por etapa y en orden, conectadas con un chevrón fino. Debajo lleva una franja proporcional y una frase que la lee, por ejemplo "87% sigue en el banco sin ficha · 1% ya está cerrado".
- Los tonos de las etapas son un solo azul que se oscurece al avanzar (`#c9dbf3`, `#8db6e6`, `#4f8bd8`, `#1465d9`, `#0b3f73`). Lo que todavía no es ficha (el banco) va en gris `#b6c3d1` y el cierre en verde `#18a689`.
- Lo que hay que atender va en una tabla densa, lo más atrasado primero, y la clave catastral abre el registro. El rojo marca lo vencido y el ocre lo que está por vencer.
- El avance por persona va en una barra apilada: hecho en azul, descartado en gris y pendiente como pista clara. A la derecha van el porcentaje y los pendientes.
- Las columnas dependen del ancho del resumen (container queries), no de la ventana: 7 etapas desde unos 1040px, 4 por debajo y una lista densa en teléfono.
- No van etiquetas encima de los títulos ni tracking negativo.
- La bandeja de Fichas usa el mismo lenguaje (clase `is-flat` del módulo, igual que el Resumen):
  - Las pestañas de etapa son columnas iguales con el tono de la etapa (`frontend/src/modules/clandestinos/etapas.js`) y su cifra; Descartadas va aparte, tras un filete.
  - El aviso de plazos es una línea entre filetes y el plazo de cada fila es texto con color de dato, no una cajita.
  - "Ritmo de trabajo": barras de un solo azul por día, semana, mes o año de levantamiento; el periodo actual va en azul profundo `#0b3f73` y el promedio en una línea discontinua. La lectura del periodo va arriba del gráfico, nunca encima de las barras. A la derecha van los totales (hoy, semana, mes, año) y los barrios con más fichas, que filtran.
  - El listado se agrupa por el mismo periodo, con un encabezado de grupo y su total ("6 fichas · 1 en esta página" si el grupo sigue en otra página).
- El Banco de clandestinos usa filas en vez de tarjetas (desde 2026-10-05):
  - Cada candidato es una fila densa con estas columnas: dictamen (icono de color), clave con el punto de campo, propietario en Alcaldía, Aguas, lo observado en campo y la acción. Las columnas dependen del ancho de la lista.
  - El comentario, los avisos, el motivo de descarte y los formularios se abren debajo de la fila. Así la fila cerrada se lee en una sola pasada.
  - La lista se agrupa por técnico, con "Sin asignar" al final. El encabezado de cada grupo lleva sus pendientes, su parte de la carga y una casilla para seleccionar el grupo. El backend ordena por técnico para que un grupo no se parta entre páginas.
  - "Carga del equipo" va a todo el ancho, entre filetes. La carga de un técnico es la parte que le toca de los pendientes ya repartidos. Las barras son azules y comparten la escala del técnico con más carga. Una marca en tinta señala el reparto parejo. El ocre marca a quien pasa de 1,5 veces lo parejo. Lo que falta repartir va aparte, con la cifra "sin asignar".
  - El diálogo de reparto ordena a los técnicos de menos a más carga. Para cada técnico muestra sus pendientes y su carga antes y después de asignar.
- "Actividad del equipo" usa una columna lateral y el registro paginado (desde 2026-10-05):
  - A la izquierda van "Por persona" (con una barra fina de su actividad del periodo, todas en la misma escala) y "Por día", el índice del periodo. El índice queda fijo al recorrer el registro. Cada día muestra sus acciones, una barra azul y la página donde empieza. Los días de la página actual van marcados en azul claro, y un clic lleva a la página y al día.
  - El registro se pagina con números, de 50 acciones por página. Arriba van el rango ("51–100 de 191 acciones") y las flechas, y abajo los números de página. Un día partido entre páginas dice "27 acciones · 13 en esta página".
  - Lo que cierra un trabajo lleva el icono verde, pero el texto va en tinta para que la lista no se vuelva toda verde. Si se filtra por una persona o por un área, esa columna desaparece de las filas.
  - Los días se cuentan en la hora de quien mira (`tz`), no en la de la base.
- Control de entregas (desde 2026-10-05):
  - El encabezado no repite el nombre del módulo, que ya está marcado en el menú lateral; el título queda solo para lectores de pantalla. Las pestañas ocupan su lugar, en la misma fila que "Nuevo lote".
  - Cada pestaña lleva la cifra de lo que espera acción: "Hoy", los lotes de hoy por cerrar; "Anteriores", los lotes de otros días sin cerrar, en rojo; "Pendientes", los documentos pendientes. En el celular la cifra va sobre el icono de la barra inferior.
  - El técnico entra directo a "Hoy". Arriba ve "Tu lote por cerrar", con el botón "Cerrar lote" a mano. El avance del equipo solo se muestra a quien ve a todos.
  - Cierre de lote (rediseño 2026-10-13): usa la palabra del técnico, "sobrantes". Abre con "¿Te sobraron facturas?" y dos respuestas grandes: "No · Entregué todas" (verde) y "Sí · Me sobraron" (ocre). Con "Sí" aparece "¿Cuántas te sobraron?" y, al cambiar la cantidad, una ficha por sobrante ("Sobrante 1 de 3": abonado y clave lado a lado, motivo y nota). Al bajar la cantidad solo se quitan fichas vacías; quitar una ficha baja la cantidad. "Pegar un listado" queda como enlace secundario. El pie lleva el deslizador y, en el teléfono, un motivo de una línea ("Falta el abonado o la clave en 2 fichas."); "Guardar sin cerrar" aparece solo cuando hay algo anotado. QA: `frontend/qa-cierre.html` (datos simulados).
  - Arriba de "Avance de hoy" va "Avance del mes" (desde 2026-10-12): una barra con un tramo por barrio del reparto, agrupada por técnico. El tramo se llena en azul cuando el barrio tiene un lote cerrado en el ciclo y ninguno abierto, va rayado si tiene un lote abierto y queda gris si está pendiente. Arriba, "31 de 76 barrios entregados" y el porcentaje; al pasar el puntero, el barrio, su técnico y su estado. Tocar la barra (o "Ver entregados y pendientes") abre dos columnas, "Ya entregados" y "Faltan" (primero los de lote abierto), con filtros por técnico y su conteo; tocar el tramo de un técnico la abre filtrada a él. Cada barrio entregado lleva sus lotes cerrados (#41) y cada uno abre su detalle. El ciclo es el de facturación (desde el último corte); sin cortes, el mes calendario. Solo lo ve quien ve a todo el equipo.
  - Al cerrar un lote aparece "Listo, lote cerrado": un check verde con las entregadas, las no entregadas y la efectividad, y los botones "Listo" y "Ver lote". En el celular es una hoja abajo y además vibra. Se va sola a los 7 segundos, salvo que se toque.
  - Los títulos de sección van en una línea, sin etiqueta encima, y "Actualizar" es solo el icono.
  - "Requiere atención" ya no repite lo que dicen las tarjetas ni el aviso rojo de lotes anteriores.
  - El técnico con usuario guarda y cierra sus lotes y los de personal sin usuario en la app. Al crear un lote, el barrio solo puede ser uno de los que el reparto le dio a ese responsable; el servidor lo valida. Por eso el formulario arranca con el técnico como responsable, solo lista esos barrios ("Solo los barrios que el reparto le asignó") y avisa si la persona no tiene barrios. En "Hoy", sus lotes y los de personal sin usuario aparecen juntos en "Por cerrar hoy", con el nombre de cada responsable.
- "Mapa de operaciones" (desde 2026-10-05, reemplaza la "Memoria operativa"). Se abre desde Auditoría (botón "Mapa de operaciones") y en la ruta `/operaciones`. No va en el menú lateral, para no repetirlo. Usa el lenguaje de análisis sin tarjetas:
  - Arriba va "Dónde se traba hoy": una línea por problema, primero lo vencido (punto rojo) y después lo que pide atención (punto ocre). Cada línea dice el problema en una frase y lleva su acción ("Repartir", "Ver fichas"…). Si no hay nada trabado, lo dice en verde.
  - Debajo, "Cómo avanza cada proceso": un carril por proceso (Clandestinos, Inspecciones, Entregas de la semana). Cada carril tiene sus pasos en orden, unidos por flechas rotuladas con lo que hace avanzar el trabajo ("se visita", "se notifica"…). Cada paso lleva su cifra y una nota: en rojo lo vencido, en ocre lo atrasado y en verde lo cerrado.
  - Cada paso y cada acción abre su módulo con el filtro puesto.
  - La memoria en PDF sigue disponible como botón discreto.
  - En pantallas angostas, los pasos bajan uno debajo del otro y la flecha apunta hacia abajo.
- Marca de la aplicación (desde 2026-10-05):
  - El menú lateral conserva el logo con el nombre "Aguas de Choluteca / Panel ejecutivo".
  - Fuera del tablero, la barra superior no repite el nombre ni el título, porque el título ya lo dice la página. Lleva solo el logo, circular y sin letras, al centro de la barra (50px; 40px en el teléfono, junto al botón del menú). Un clic lleva al inicio. En reposo late cada 5 segundos: un leve pulso del logo y una onda azul que se apaga. Al pasar el puntero, la onda se acelera. Con movimiento reducido queda quieto.
  - Las cifras de la barra nunca pasan por debajo del logo. Lo que no cabe antes del centro se oculta.
  - El menú usa el mismo nombre que la página: "Consultas del padrón" (antes "Impresión e informes").
- "Servicios por barrio" en Consultas del padrón permite elegir un servicio (desde 2026-10-05):
  - Arriba de la tabla hay una fila de columnas iguales: "Todos los servicios" y una columna por servicio, cada una con sus usuarios y su porcentaje del padrón. La columna elegida va en azul claro con un filete azul abajo.
  - Al elegir un servicio, el resumen va en una sola frase con las cifras en negrita: cuántos usuarios lo tienen, en cuántos barrios, cuánto deben esas cuentas y el promedio por cuenta con deuda. Debajo va su tabla, con usuarios, con y sin el servicio, cuentas con deuda, deuda y la parte de la deuda del servicio que cae en cada barrio. Capital e intereses solo van en el informe. Los barrios sin el servicio se ocultan, y una casilla los incluye.
  - La línea de estado dice solo "Padrón actualizado el …". El nombre del lote FoxPro va en la ayuda emergente.
  - El informe impreso y el PDF llevan las filas tal como se ven: mismo orden, misma búsqueda o solo los barrios marcados. Al final nombran los barrios sin el servicio.
  - La deuda siempre se rotula como "de las cuentas con el servicio", porque el archivo maestro no separa la deuda por concepto.
- "Abonados del barrio" (doble clic en un barrio de Todos los servicios o Por servicio; rediseño del 2026-10-27 tras una crítica de impeccable, 21/40). Es el estado de cuenta del barrio, no un directorio:
  - Panel lateral de 880px (todo el ancho en el teléfono) con el fondo inerte. Arriba el barrio en azul profundo y "N abonados · padrón del …"; sin etiqueta sobre el título.
  - Lo primero es el saldo del barrio (26px, azul profundo) en un recuadro azul muy claro, con una barra capital (azul `#1465d9`) / intereses (ocre `#d59124`) y su porcentaje, y "Con deuda" / "Al día" (y "A favor" si hay).
  - Buscador (nombre, abonado o clave con o sin guiones), "Ordenar" (Mayor saldo por defecto, Nombre, Clave), filtro segmentado Todos / Con deuda / Al día / A favor con su conteo y, desde Por servicio, "Solo con <servicio>".
  - Lista en columnas fijas de 48px con encabezado pegajoso: clave (mono, azul profundo) y abonado debajo · nombre · cinco iconos de servicio en posición fija (lleno si lo tiene, azul sólido el elegido, trazo tenue si no) · intereses en ocre · saldo. El saldo se lee en tres tonos: deuda en tinta, "Al día" atenuado, a favor en verde `#0f7a63` con "a favor".
  - Cada fila es un botón (flechas, Inicio y Fin la recorren); al abrirla muestra capital, intereses, saldo y servicios, con "Imprimir estado de cuenta", "PDF" y "Copiar clave". La ficha impresa es el "Estado de cuenta" (ver abajo).
  - Pie: "5 de 36 abonados · Con deuda · “castillo”", el saldo con su desglose y "Imprimir esta lista" / "Guardar PDF". La impresión lleva la línea de filtro y una fila de totales que cuadra con el pie.
  - Cargando: filas en hueso. Vacío: dice qué filtros dejaron la lista vacía y ofrece "Ver todos los abonados". Error: "Reintentar".
  - En el teléfono cada abonado ocupa dos líneas (nombre y saldo; clave, abonado e intereses; servicios) y el orden va junto a la casilla del servicio.
- "Estado de cuenta" de un abonado (desde 2026-10-27; reemplaza la ficha con tablas de la plantilla de informes del padrón). Hoja carta vertical (márgenes 14 × 16 mm) para ventanilla o para adjuntar a un reclamo:
  - Cabecera: logo, "Aguas de Choluteca, S.A. de C.V." y "Estado de cuenta" (22px, azul profundo); a la derecha "Emitido" con hora y "Padrón" con su fecha. Filete de 2px azul profundo.
  - "Abonado" y el nombre del padrón (18px); debajo tres datos con filetes: número de abonado y clave (mono) y barrio.
  - Saldo en un recuadro azul muy claro: a la izquierda "Saldo total al <fecha del padrón>" y la cifra (30px; verde con "Saldo a favor", gris si está al día) con una nota ("El saldo total ya incluye los intereses."); a la derecha la barra capital (azul) / intereses (ocre `#c07f15`), y capital, intereses y saldo total con sus porcentajes.
  - "Servicios del inmueble": cinco casillas iguales con el nombre largo y "Activo" o "No tiene" (texto, se lee en blanco y negro).
  - Firmas: "Atendido por (nombre y firma)" y "Recibido por el abonado". Pie: "Información confidencial…" y el ID de reporte.
  - "Imprimir estado de cuenta" abre directo el diálogo del sistema (sin la vista previa antigua), como Reclamos. "PDF" lo dibuja con jsPDF con el mismo diseño. Ambos dejan el ID en la auditoría (`announceReportGenerated`, tipo `estado-cuenta-abonado`).
- "Gerencia General" (desde 2026-10-12, rehecho con ideas de una referencia de tablero ejecutivo). Usa el lenguaje de análisis:
  - El encabezado saluda con el primer nombre y debajo dice "Gerencia": "Te damos la bienvenida, Ana" en el primer ingreso de la cuenta; después "Buenos días" (5:00 a 11:59), "Buenas tardes" (12:00 a 18:59) o "Buenas noches", en la hora de Honduras. La insignia de la derecha dice solo "Solo lectura". El menú lateral y la pantalla se llaman "Gerencia".
  - Arriba: enlace a "Consultas e informes", la hora de la última actualización con su botón y el período. Debajo, dos pestañas para que la pantalla no se alargue: "Operación" y "Cartera y padrón" (el tablero de cartera de siempre).
  - "Operación" abre con seis indicadores en tarjetas con icono en círculo de color suave: inspecciones creadas (cambio contra el mes anterior), inspecciones pendientes (cuántos días lleva la más antigua), entregas efectivas (puntos contra el mes anterior; solo los vencidos en rojo), fichas clandestinas activas, equipo activo hoy (personas con acciones hoy en la bitácora) y costo de la app en el ciclo de Railway con su barra de gasto contra calendario. Van en 3 × 2; seis en fila solo desde 1800px; dos por fila en el teléfono. Cada tarjeta abre su módulo.
  - Segunda fila: dona de inspecciones pendientes por estado con el total al centro, efectividad de entregas por barrio (barra con pista, porcentaje y "52 de 60") y "Equipo hoy" (inicial, acciones, "Activo ahora" en verde si actuó en los últimos 30 minutos y "Activo hoy" en azul).
  - Luego entregas por día y carga por técnico, y "Resumen por barrio": tabla con encabezados agrupados (Padrón, Cartera en mora, Entregas del período), ordenada por mora, con buscador y páginas de 8. Lo que no tiene dato va con "—", nunca en cero.
  - "Cartera y padrón" deja la banda del padrón solo con el corte (la actualización ya está arriba), sin accesos rápidos ni "Actividad del equipo". En la columna derecha, bajo "Atención requerida", va "En vivo": lo último que el equipo cerró, con filtros por área (Todo, Inspecciones, Entregas, Fichas) y su conteo; lo recién llegado se ilumina en azul claro y se apaga en 2,4 s. Cada fila abre su módulo.
  - Campana de Gerencia en el encabezado, junto a "Solo lectura": avisa los trabajos cerrados (inspección finalizada, lote cerrado, documento reentregado, punto del banco pasado a ficha o descartado, reporte técnico, recorrido completado), con insignia roja, sonido silenciable y un punto azul en lo nuevo. Al abrirla se marca como vista (salvo en una prueba de perfil). Gerencia no usa sockets: la campana y "En vivo" comparten una consulta cada 30 s, solo con la pestaña visible.
 mapa de actividad (ya existe "Mapa de operaciones"), alertas (ya existe "Atención requerida"), evolución de 12 meses (no hay serie) ni filtros globales por barrio y responsable.
  - Los meses se escriben con nombre ("octubre de 2026"), nunca "2026-10".
- "Consultas e informes" de Gerencia (desde 2026-10-12). Usa el lenguaje de análisis:
  - El tablero no repite el control de informes: lleva un enlace "Consultas e informes" junto al período.
  - A la izquierda va el índice de informes (Resumen ejecutivo, Cartera por barrio, Fichas clandestinas, Inspecciones, Entregas, Seguimiento GPS y Actividad del equipo), con nombre y una línea que dice qué trae. Bajo 1100px pasa a una fila de botones que se desliza.
  - Elegir un informe lo prepara solo; cada combinación de informe, mes y barrio se prepara una vez por visita. El botón de recargar vuelve a consultar.
  - Para que la pantalla no se alargue, el informe va en pestañas: "Resumen" (o "Fichas") con los gráficos, una pestaña por tabla de detalle con su cantidad y, en Fichas clandestinas, "Banco de clandestinos" aparte.
  - Gráficos: franja de cifras con lectura debajo, barras horizontales con escala y ancho de cifra compartidos, columnas por día o mes (puntero o flechas muestran la lectura arriba) y franja por etapa con los tonos de `etapas.js`. Capital en azul, intereses en ocre `#d59124`; dictamen del banco en rojo, gris y verde.
  - Tocar una barra abre el detalle filtrado por esa fila. El detalle se busca y se pagina de 12 en 12, con números de página.
  - Las tablas llevan cifras con separador de miles y estados en español; el PDF sigue saliendo de esas mismas tablas.
- Prueba de perfil (desde 2026-10-12):
  - El administrador la abre desde la acción "Probar como otro rol" (icono de ojo) del pie del menú lateral; no hay barra fija mientras no se prueba. En escritorio se abre a la derecha del menú, con la sombra de capa flotante. En el teléfono sale como hoja inferior. Cada perfil dice dónde empieza, y el botón nombra la acción: "Ver como Gerente General".
  - Durante la prueba, una barra ocre de 48px queda fija arriba: "Viendo como Gerente General · Solo lectura · Quedan 12 minutos" y el botón en tinta "Volver a administrador" ("Volver" en el teléfono). En los últimos 3 minutos el ocre se intensifica; al vencer la barra pasa a rojo claro.

- Aviso de versión nueva (desde 2026-10-12): toda cuenta con sesión revisa cada 5 minutos, y al volver a la pestaña, si `index.html` publica otro script de entrada. Si cambió, muestra "Hay una nueva actualización disponible", con "Más tarde" (lo pospone una hora) y "Actualizar" (recarga). Nunca recarga solo. En escritorio va abajo a la derecha con la sombra de capa; en el teléfono va arriba, para no tapar la barra de Entregas ni los controles de captura GPS.
- "Reclamos de entrega" (desde 2026-10-15). Desde 2026-10-22, "Por técnico" es una columna lateral fija a lo alto del buscador y la lista (con su propio desplazamiento si el equipo es largo), para que la lista suba bajo el buscador; bajo 1080 px vuelve al final. Pantalla de inicio de técnicos (operador y validación de campo), en `/reclamos`; la oficina la tiene en Operación. Usa el lenguaje de análisis:
  - Arriba, una franja de tres cifras que también filtra: "Sin respuesta" (punto ocre; rojo si el más antiguo pasa de 3 días), "Respondidos" (azul, esperan cierre de la oficina) y "Cerrados" del ciclo (verde). En el teléfono el punto va junto a la cifra.
  - "¿Quién entregó esta factura?": un solo campo para clave o abonado. La respuesta pone al técnico como protagonista, en un panel azul claro con su inicial en azul profundo: "La entregó" (lote del ciclo, primero los cerrados) o "Le toca entregarla" (reparto, si el barrio no tiene lote). Debajo, en una línea cada una, si quedó como sobrante, si ya tiene un reclamo abierto o si el reparto nombra a otra persona. La oficina registra el reclamo desde ahí mismo: motivo en pastillas, factura o nota de cobro, cuántas, lo que dijo el abonado y el técnico (cambiarlo queda como "asignado por la oficina").
  - "Por técnico": una barra por persona en la misma escala, sin pista: ocre sin respuesta, azul respondido y verde (`#18a689`) cerrado. Tocar una fila filtra la lista.
  - La lista va en filas densas: abonado y clave, motivo y cantidad, técnico con de dónde sale, y estado con hace cuánto. La respuesta del técnico va debajo en un bloque gris claro; el formulario de respuesta se abre en la misma fila y guarda el borrador en `sessionStorage`. Lo sin respuesta va primero, lo más viejo arriba. Todos los técnicos ven todos los reclamos. Al registrarlo, la campana avisa al responsable ("Reclamo de entrega para ti…", si tiene usuario) y a todo el equipo de campo ("Nuevo reclamo de entrega para…"); tocar el aviso abre Reclamos.
  - El técnico solo ve el título, el buscador con su filtro (Activos, Sin respuesta, Respondidos) y la lista de reclamos activos; la franja, la consulta y "Por técnico" son de la oficina. En escritorio la consulta y "Por técnico" van lado a lado arriba de la lista.
  - Impresión: cada reclamo tiene "+" (lo junta para imprimir varios) e "Imprimir" (solo ese), a la izquierda de las acciones de la fila. Con algo juntado aparece una barra flotante al pie de la lista: "3 reclamos para imprimir", "Agregar los N de esta página", "Quitar todos" e "Imprimir 3"; la selección se conserva al cambiar de filtro o de página. La ficha impresa es un documento institucional tamaño carta (logo, "Reclamo de entrega #N", estado y fecha, datos en tabla con "--" si falta algo, lo que dijo el abonado, la respuesta del técnico o renglones para escribirla a mano, firmas del técnico y de la oficina). Varias fichas comparten hoja, separadas por una línea de corte, y ninguna se parte entre páginas.
  - La oficina "archiva" en vez de cerrar. El archivo (solo oficina y Gerencia) se agrupa por día, mes o año del archivado, en hora de Honduras, con un selector Día/Mes/Año junto al título; cada grupo lleva su encabezado ("Hoy · 15 de octubre de 2026 · 3 reclamos") y dice cuántos caen en la página si el grupo sigue en otra.
- "Fallas del equipo" (desde 2026-10-13). Lo que técnicos y operadores intentaron guardar y no se pudo:
  - Se registra sola: el servidor anota toda acción que guarda algo y falla (404, 409, datos no válidos…) y cualquier error 500; el teléfono anota lo que ni siquiera salió por falta de señal y lo envía al volver la conexión. Nunca se guarda lo que la persona escribió, solo la acción ("Cerrar lote #41"), el motivo y cuántas veces pasó. No cuentan administración, Gerencia, la prueba de perfil ni la sesión (ingresar, contraseña).
  - El símbolo de las fallas es la "Gota rota" (`components/icons/GotaRota.jsx`): la gota de Aguas partida, con el trazo de los iconos de la app. Va en el encabezado, en el menú y en las fallas rechazadas (404, 409…); "sin conexión" y "error del servidor" conservan su icono para distinguirse.
  - En el encabezado de administración y Gerencia, junto a la campana, va ese icono propio: tenue sin pendientes; rojo con su contador cuando hay fallas sin revisar, con un leve vaivén cada pocos segundos. Al tocarlo muestra las últimas, con un punto por tipo (ocre sin conexión, rojo rechazada, vino error del servidor).
  - La pantalla (Gestión → Fallas del equipo) abre con una franja de cifras por tipo que sirve de filtro, "Sin revisar / Todas" y persona. Cada fila: icono del tipo, acción, persona, código legible ("409 · ya había cambiado"), mensaje y hace cuánto. Administración marca una o todas como revisadas; Gerencia solo consulta.
- Tablero de Apuntes (rediseño del 2026-10-13):
  - Encabezado con conteos vivos ("10 apuntes activos · 8 nuevos esta semana"), selector Tarjetas/Lista y botón "Atajos". "Todos / Fijados / Archivados" llevan su número. Debajo, filtros de un clic: un punto por color con su cantidad y una pastilla por categoría; "Quitar filtros" aparece solo con alguno activo. La categoría de una tarjeta también filtra al tocarla.
  - El color de un apunte es tinte del 7 % más el borde teñido de ese color; ya no lleva barra lateral. Al pasar el mouse, los controles flotan sobre la esquina y el título usa todo el ancho; en táctil siguen en su fila.
  - Con "Orden manual" hay Fijados y Otros apuntes. Ordenado por fecha, el resto se agrupa en Hoy, Ayer, Esta semana, Este mes y Anteriores (hora de Honduras). La fecha es relativa ("Hace 5 min", "Ayer") y muestra la completa al pasar el mouse. La búsqueda resalta las coincidencias aunque se escriba sin tilde.
  - Movimiento: al fijar, archivar, filtrar o reordenar, cada tarjeta se desliza desde donde estaba hasta su nuevo lugar (FLIP, 340 ms, curva de salida exponencial); las nuevas entran con un fundido corto, escalonado con tope. Con "reducir movimiento" no hay desplazamientos.
  - Teclado: N nuevo, / buscar, ? atajos; sobre una tarjeta, flechas para moverse, Enter abre, F fija, A archiva, D duplica, C copia y Supr elimina (con "Deshacer"). El foco sigue a la tarjeta al fijarla y pasa a la vecina al archivar o eliminar. En teléfono no se muestra el botón de atajos.
  - Con un filtro activo, el apunte nuevo toma ese color y esa categoría. La creación rápida sugiere las categorías existentes.
  - QA: `frontend/qa-apuntes.html` con datos en memoria (`?vista=lista`, `?orden=updated`, `?filtro=Entregas&nuevo=1`, `?oscuro=1`).
- "Generar documento" de Reportes GPS (rediseño 2026-10-19). Panel lateral de 500px (hoja inferior en el teléfono), sin numeración de pasos ni cajas por sección: secciones planas separadas por filetes, en el orden en que se decide.
  - "Tipo de documento" primero: cuatro filas con icono del sistema en un recuadro (técnico `map`, censo `users`, resumen `records`, regulador `auth`); la elegida va en azul claro con el recuadro en azul y el icono en blanco.
  - "Jornadas" (técnico y censo) y "Barrios": título con icono, la cifra elegida al lado y los enlaces a la derecha; casillas en dos columnas, lo no marcado queda tenue. Mientras cargan las jornadas todo dice "Cargando…", nunca "sin puntos".
  - "Opciones" con interruptores (mapa de cada barrio; claves compartidas y deuda en el resumen ligero) y "Salida" como control segmentado (PDF o Imprimir), solo cuando hay elección.
  - El encabezado del documento (título, subtítulo, descripción) va plegado al final y muestra el título actual.
  - Pie fijo: a la izquierda lo que sale ("98 puntos · 3 barrios" y la jornada), a la derecha "Vista previa" y la acción principal, que muestra el paso en curso al generar. No hay "Cancelar": cierran la X, Esc y el fondo.
  - QA: `frontend/qa-generar-documento.html?abrir=1` (datos simulados).

### Busqueda de clave

La busqueda debe sentirse como herramienta de campo:
- Campo de busqueda prominente.
- Resultado claro: existe/no existe, padron, coincidencias.
- Acciones directas: crear ficha, abrir ficha, generar reporte.
- Mostrar diferencias entre Aguas y Alcaldia de forma tabular.

### Mapa

El mapa debe priorizar ubicacion y reporte:
- El mapa es el elemento central.
- Paneles laterales o inferiores solo con controles necesarios.
- Estados de carga y puntos visibles.
- Reportes de campo deben seguir estilo institucional.

### Usuarios e historial

Administracion y auditoria deben ser densas y sobrias:
- Tablas/listas con filtros claros.
- Mostrar actor, accion, entidad y fecha.
- Evitar decoracion; la trazabilidad debe ser confiable.

## 6. Fichas catastrales

La ficha es el documento central del sistema. Debe parecer oficial, imprimible y muy cercana al flujo manual anterior, pero con mejor lectura.

Estructura recomendada:
- Encabezado institucional con logo y datos de Aguas de Choluteca.
- Titulo del documento en franja clara.
- Barra de metadatos: clave, estado, numero de ficha, fecha.
- Bloques tipo tabla para padrones, abonado, inmueble y servicios.
- Evidencia fotografica integrada en el bloque de servicios o evidencia.
- Firmas al final con lineas visibles.

Reglas visuales:
- Bordes finos, fondo blanco, encabezados de seccion en azul muy suave.
- No usar tarjetas flotantes dentro del documento.
- No usar sombras al imprimir.
- Texto compacto y legible.
- Campos vacios deben mostrar `--`, no dejar huecos ambiguos.

Impresion:
- Ocultar navegacion, botones y paneles no imprimibles.
- Mantener la ficha en una sola composicion limpia.
- Evitar saltos de pagina dentro de encabezado, metadatos, firmas y bloques pequenos.
- Usar colores con `print-color-adjust: exact` solo donde aporte claridad.

## 7. Avisos y reportes

Avisos:
- Deben conservar tono formal.
- Texto justificado cuando sea cuerpo de carta.
- Encabezado centrado e institucional.
- Firma clara y espacio suficiente.
- No convertir el aviso en tarjeta visual moderna.

Reportes:
- Deben ser sobrios, con tabla legible.
- Incluir fecha, filtros usados, totales y origen de datos.
- Acciones de imprimir/descargar deben estar fuera del area imprimible.

## 8. Estados y feedback

Estados recomendados:
- Cargando: skeleton o mensaje corto dentro del panel.
- Vacio: explicar que falta y dar accion directa.
- Error: mensaje claro, accion recuperable si existe.
- Exito: confirmacion breve y no invasiva.
- Pendiente: badge amarillo/oro suave.
- Validado/procesado: badge verde/teal.
- Clandestino/alerta: rojo sobrio o advertencia fuerte segun severidad.

Evitar:
- Alertas flotantes permanentes que tapen contenido.
- Mensajes largos en cada tarjeta.
- Estados que dependan solo del color.

## 9. Responsive

Desktop:
- Aprovechar dos columnas en fichas: listado/formulario y vista previa.
- Formularios en grids de 2 a 3 columnas si los labels caben bien.
- Tablas y reportes deben mantener densidad.

Tablet:
- Reducir a una o dos columnas.
- Acciones principales deben seguir visibles.

Movil:
- Una columna.
- Botones con altura tactil suficiente.
- Tabs compactas con texto corto.
- Evitar que claves catastrales, nombres largos o direcciones rompan el layout.
- La ficha puede apilar metadatos y campos, pero debe conservar orden documental.

## 10. Accesibilidad y legibilidad

- Contraste suficiente entre texto y fondo.
- Focus visible en inputs, botones y enlaces.
- Botones con texto comprensible.
- No depender solo de iconos para acciones criticas.
- Usar `overflow-wrap: anywhere` para claves, direcciones y nombres largos.
- Evitar texto que se superponga o se salga del contenedor.

## 11. Do's and don'ts

Hacer:
- Mantener consistencia con `frontend/src/styles.css`.
- Reusar variables existentes antes de crear nuevas.
- Preferir componentes simples y mantenibles.
- Separar visual de impresion con clases `no-print` y reglas `@media print`.
- Diseñar primero para flujo operativo real.

No hacer:
- No instalar una libreria UI grande sin necesidad.
- No convertir el sistema en landing page.
- No usar fondos con orbes, blobs, bokeh o decoracion abstracta.
- No meter tarjetas dentro de tarjetas.
- No cambiar todo el lenguaje visual por copiar una marca externa.
- No romper la similitud de ficha/aviso con los formatos de referencia.

## 12. Guia para agentes

Cuando se pida mejorar una pantalla:
1. Revisar el modulo actual y sus clases existentes.
2. Mantener la API y estructura de datos salvo que el pedido sea funcional.
3. Ajustar primero jerarquia, espaciado, estados y responsividad.
4. Validar con `npm run build` si cambia frontend.
5. Si la pantalla imprime, revisar reglas `@media print`.

Prompt interno sugerido:

> Mejora esta pantalla siguiendo `DESIGN.md`: sistema institucional de Aguas de Choluteca, operativo, claro, imprimible cuando aplique, sin estilo de landing page, usando la paleta azul existente y manteniendo los componentes simples.

### Pozos (desde 2026-10-20; Resumen y Análisis desde 2026-10-21)

- Extensión del mundo de la bandeja de Clandestinos/Fichas en su variante plana (`cl-module is-flat`). Sin concept roll ni clave de semilla, porque el mundo se hereda.
- Sin tarjetas. La pantalla tiene, en este orden:
  - encabezado con alcance y chips de filtro (colonia, calidad, dato que falta, búsqueda), estado "Al día", Actualizar y "Descargar": un menú con los cuatro informes en PDF y la tabla CSV, siempre de los pozos filtrados en el orden de la lista (en el teléfono, solo el icono y el menú como hoja al pie);
  - búsqueda con etiqueta y los filtros Colonia, Calidad (dentro / fuera del valor guía / sin medición) y "Le falta" (profundidad, nivel freático, diámetro, pH, TDS, temperatura, estado de uso, coordenada válida), más "Ver como": Resumen · Lista · Mapa · Análisis (Resumen al entrar). Bajo 1320 px la búsqueda va en su propia fila; en el teléfono la vista ocupa todo el ancho y sin iconos;
  - cinco pestañas en columnas iguales con su cifra y la marca azul deslizante: son las cifras de arriba y también filtran;
  - la vista elegida. Filtros y pestañas valen para las cuatro.
- Resumen compacto (desde 2026-10-22): cuatro paneles bajos en una franja (dos por fila bajo 1280 px; en el teléfono, tarjetas que se deslizan de lado con la siguiente asomada) y, debajo, la misma tabla de la Lista; tocar una colonia, un dato o un hallazgo filtra esa tabla sin cambiar de vista. "Uso y calidad" lleva las dos franjas. Las barras y franjas crecen al entrar y se reacomodan con transición de 450 ms al filtrar (sin movimiento con "reducir movimiento").
- Resumen y Análisis usan el lenguaje de análisis del tablero sin tarjetas: paneles en dos columnas separados por filetes (una columna bajo 900 px), título de 15 px y una nota que dice qué se toca.
  - Resumen: "Pozos por colonia" (barras horizontales en azul con escala y cifra compartidas, cinco colonias y "Otras"), "Estado de uso" (cifra en % y franja al 100 % con leyenda; no dona), "Datos levantados" (cuántos tienen cada dato, con pista) y "Para atender" (una fila por hallazgo con icono, cifra y flecha). Tocar una colonia filtra; tocar un dato o un hallazgo abre la Lista con ese filtro.
  - Análisis: arriba la franja de promedios de las mediciones; debajo, histogramas de pH y TDS con cortes fijos (teal dentro, rojo fuera del valor guía, cifra sobre cada columna), "pH contra TDS" (un punto por pozo con aro blanco de 2 px y el recuadro de la zona guía; tocar un punto abre la ficha) y "Calidad por colonia" (barra apilada con separación de 2 px).
  - Toda marca muestra su lectura en un globo tinta al pasar el puntero o con el foco.
- Paleta de los gráficos (validada con el script de dataviz; teal y gris llevan siempre leyenda o rótulo): azul `#1465d9` una sola serie, teal `#18a689` dentro del valor guía, rojo `#c92a3a` fuera, gris `#a3b1c0` sin medición o sin dato, ocre `#d59124` fuera de uso. Los mismos tonos pintan los puntos del mapa (por calidad) y su leyenda.
- La lista lleva la columna Calidad después de Uso, con la etiqueta del sistema (verde dentro, roja fuera, gris sin medición) y se puede ordenar.
- La ficha se abre en el cajón del sistema (`cl-drawer`). Arriba dice la calidad del pozo y, si falta algo, una franja ocre "Falta levantar: …". pH y TDS llevan una escala con la banda del valor guía y una marca en la medición (roja si queda fuera).
- Las mediciones llevan decimales fijos por columna, con los puntos alineados. Un vacío se muestra como "—". El rojo se usa solo para pH fuera de 6.5–8.5 y TDS por encima de 1 g/L.
- No salta:
  - el alto se congela y se suelta (`alturaSuave`) al cambiar de pestaña, colonia, calidad, dato que falta, página, orden o vista, y tiene un piso mientras se busca;
  - el refresco automático (cada 60 s y al volver a la pestaña) es silencioso: barra de 2 px. Un fallo se avisa en el indicador "Al día / Sin conexión", nunca con un aviso que empuje la tabla.
- En teléfono, Pozo queda fijo a la izquierda y se ven Prof., Nivel, pH, TDS y Temp.; el resto está en la ficha. Una sombra en el borde derecho indica que hay más columnas.
- Lectura química (desde 2026-10-21): en la ficha, cada medición es un botón con borde fino; la elegida lleva borde azul y abre debajo un panel (no un modal, porque la ficha ya es una capa). El panel muestra:
  - el valor grande en el tono de su veredicto: teal dentro, rojo fuera, ocre atención y gris referencia o no detectado;
  - qué mide y una escala con bandas con significado ("Recomendado", "Sabor bueno (OMS)", "Agua dulce"), referencias ("Máximo norma", "Agua de mar") y la marca del valor; la conductividad y la salinidad van en escala logarítmica;
  - el resumen, la regla de la norma o de la OMS con su icono, los avisos del dato en ocre claro y un pie con los límites de la medición.
  - En el pH, además, "Cómo está el carbono disuelto a este pH": franja y curvas de CO₂ (naranja `#e0702a`), bicarbonato (azul) y carbonato (teal `#12a08a`), validadas con el script de dataviz y rotuladas sobre la curva, con un control para probar otro pH y volver al medido. Son proporciones calculadas del pH, no concentraciones.
  - Una medición con un dato dudoso lleva un icono de aviso junto a su nombre.
- Informes en PDF (`modules/pozos/pozosPdf.js`, desde 2026-10-21). Identidad propia de hoja técnica, distinta de los informes institucionales de campo:
  - encabezado con el logo, el sello "AGUAS DE CHOLUTECA · RED DE POZOS" en teal `#0e5e6f`, el título (se achica si no cabe) y a la derecha el bloque del código del documento (POZ-INV, POZ-FIC, POZ-CAL, POZ-LEV); debajo, doble filete teal ("nivel de agua"). Las hojas siguientes llevan el encabezado compacto;
  - al pie de cada hoja, un cajetín como en un plano: fuente y valor guía de la norma a la izquierda; Documento, Generado y "Hoja X de Y" a la derecha;
  - cifras grandes separadas por filetes, subtítulos en teal, tablas con cabecera teal y celdas de pH/TDS fuera del valor guía en rojo sobre rosa tenue; los mismos colores de calidad de la pantalla; Helvetica, como el resto de los PDF;
  - Inventario (horizontal): cifras, pozos por colonia, uso y calidad en franjas, mapa general por calidad y la tabla de todos los pozos.
  - Fichas (vertical, una hoja por pozo; también "Ficha PDF" en el cajón): sellos de estado, Pozo y bomba, Ubicación, su mapa, pH y TDS con escala y banda del valor guía, las demás mediciones, "Falta levantar" en ocre claro, observaciones y renglones de verificación en campo.
  - Calidad (vertical): cifras, recuadro de la norma, histogramas de pH y TDS, mapa de los medidos y la tabla, primero los que están fuera.
  - Levantamiento (vertical): una hoja por colonia para repartir en campo, con mapa de etiquetas por código y una casilla vacía por dato que falta ("sí" si ya está), notas de campo y firma del técnico.

