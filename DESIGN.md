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
- "Mapa de operaciones" (desde 2026-10-05, reemplaza la "Memoria operativa"). Está en el menú, bajo Dashboard, y en la ruta `/operaciones`. Usa el lenguaje de análisis sin tarjetas:
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
