---
version: 1
slug: "frontend-src-components-railwayusageworkspace-jsx"
primary_target: "frontend/src/components/RailwayUsageWorkspace.jsx"
related_targets: ["frontend/src/components/railway-usage.css","backend/src/services/railwayUsageService.js"]
---

# Uso en Railway (RailwayUsageWorkspace)

Modo: Operate. Usuario: el administrador del sistema, desde escritorio y a veces el celular, pocas veces por semana. Tarea: saber cuánto va a costar el ciclo, si el gasto va más rápido que el calendario, qué servicio consume y a qué horas se carga el sistema. Confirmado (2026-09-26): estructura "Monitor"; ampliar la API con series horarias y costo por servicio sin quitar campos.

## Direction contract
THESIS: Monitor de rendimiento dentro del lenguaje del Tablero de análisis: el gasto contra el calendario y la carga contra la hora. Rechaza la ficha de texto con cifras sueltas: tarjetas iguales con icono en baldosa, franja azul lateral, etiquetas en mayúsculas.
OWN-WORLD: Paneles blancos planos, filete #dfe5ec, radio 8px, sin sombras. Títulos en caso oración de 15px/650. Cifras tabulares en tinta #16283b. Rejilla de 1px #e8ecf1, ejes de 11px apagados. Color = dato: azul institucional para magnitud; un color por servicio solo en el gráfico de líneas; escala secuencial azul en el mapa de calor. Iconos lucide en gris, al lado de su etiqueta.
STORY: El administrador ve de un vistazo si el ciclo cerrará caro, qué servicio lo explica y en qué horas conviene no programar tareas pesadas.
FIRST VIEWPORT: Línea de estado del ciclo con "Actualizar"; panel único de cuatro celdas (consumo, estimado con regla gasto-vs-tiempo, pico CPU, pico memoria); debajo, el gráfico de líneas por servicio con CPU/Memoria y 24 h / 7 d / 30 d.
FORM: Monitor, primera de tres estructuras presentadas (seed: user-choice-monitor, sin tirada: estructura elegida por el usuario). Firma: el gráfico de líneas con cursor en cruz que lee todos los servicios a la misma hora (flechas con teclado), y el mapa de calor hora × día.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
