---
version: 1
slug: "modules-dashboard-dashboardworkspace-jsx-dc49099b"
primary_target: "frontend/src/modules/dashboard/DashboardWorkspace.jsx"
related_targets: ["frontend/src/modules/dashboard/dashboard.css","frontend/src/modules/dashboard/dashboardSala.css","frontend/src/app/appChrome.css","frontend/src/app/AppHeader.jsx","frontend/mockup-tablero.html"]
---

# Tablero de control (DashboardWorkspace)

Modo: Operate. Usuarios: administración y operadores de Aguas de Choluteca, a diario en escritorio de oficina (luz de día), a veces en celular. Tarea: ver qué está en alarma hoy, cuánto se debe y cómo cambió con el último lote, y dónde se concentra. Restricciones: tema claro, conservar todo el contenido, acciones, impresión y el divisor de columnas. 2026-11-15: rediseño completo («que no parezca hecho por IA»); mockup en `frontend/mockup-tablero.html`, luego aplicado a la app real junto con la barra global (`app/AppHeader.jsx`, `app/appChrome.css`) igual en todas las pantallas.

Verdad de datos (no inventar): el historial de mora por lote no existe (solo el lote anterior); el cambio por barrio solo existe para los que más cambiaron (el resto muestra «—»); los plazos de fichas no tienen dato de la semana anterior (sin delta ni marca).

## Direction contract
THESIS: El tablero es el panel de operación de la cartera, como la pantalla de una sala de control de acueducto: gris sereno, y solo lo que se sale de lo normal toma color. Rechaza la grilla de tarjetas blancas con KPI, icono y gráfico de adorno.
OWN-WORLD: Fondo gris de planta (#e2e5e8), módulos planos con filete de 1px y esquinas de 4px. Una sola familia (Archivo variable, autoalojada, condensada en rótulos y cifras) en cuatro tamaños: 12, 14, 20, 44. Cifras tabulares. Medidores horizontales con la marca del lote anterior. Color solo para estados anormales: rojo crítico, ámbar atención; el azul institucional marca la magnitud medida y el foco. Gravedad también por forma (cuadrado, triángulo, rombo).
STORY: El operador ve primero qué está en alarma hoy y lo reconoce o lo atiende, después cuánto se debe y cómo cambió con el último lote, y dónde se concentra.
FIRST VIEWPORT: Barra global blanca (buscador de clave/abonado/nombre, campana, avatar). Encabezado de página: «Tablero» con la línea de origen (corte, lote, antigüedad en ámbar si pasa de 7 días, hora de las cifras) y, debajo, la fila de acciones (secundarias en texto, «Nueva ficha» primaria al final; en el teléfono, rejilla de dos columnas con rótulo). Enmienda 2026-11-15: a 1440 con el menú lateral, la línea de origen y cinco acciones no caben en una línea; debajo del título conservan el orden de lectura. Banda «Requiere atención» a todo el ancho. Fila de medidores: cartera (5), cuentas del padrón (4), plazos de fichas (3). Después cambios del lote, el tablero de barrios (columna ancha) y campo/bitácora (columna angosta) con el divisor.
FORM: Panel de sala de control (candidato 4 de mi lista), seed b83b1602. Firma: alarmas con reconocimiento («Marcar visto» deja el símbolo en contorno, la fila sigue hasta resolverse y se reenciende si cambia la cifra), y la fila de un barrio (cursor, foco o selección) enciende su punto en el gráfico por servicio y su tramo en la barra de concentración.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
