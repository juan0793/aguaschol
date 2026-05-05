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
- Tablero y listados: densidad tipo sistema administrativo moderno.
- Formularios: claridad de datos y flujo guiado, sin adornos innecesarios.
- Mapas y reportes: enfoque tecnico, coordenadas y resumen visual confiable.

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
