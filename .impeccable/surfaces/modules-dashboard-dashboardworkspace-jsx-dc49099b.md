---
version: 1
slug: "modules-dashboard-dashboardworkspace-jsx-dc49099b"
primary_target: "frontend/src/modules/dashboard/DashboardWorkspace.jsx"
related_targets: ["frontend/src/modules/dashboard/dashboard.css"]
---

# Tablero de control (DashboardWorkspace)

Modo: Operate. Usuarios: administración y operadores de Aguas de Choluteca, a diario en escritorio de oficina (luz de día), a veces en celular. Tarea: ver la cartera en mora, qué es crítico, dónde se concentra y qué atender hoy. Restricciones confirmadas (2026-09-24): tema claro, mismo orden de secciones, conservar todo el contenido, acciones e impresión.

## Direction contract
THESIS: Tablero de análisis sobrio al estilo del "Insights Dashboard" de referencia que dio el usuario, en claro: paneles planos, rejilla fina, cifras grandes y el color reservado al dato. Rechaza la tarjeta decorada: filetes de color arriba, etiquetas en mayúsculas espaciadas, iconos en baldosas.
OWN-WORLD: Fondo gris frío, paneles blancos con filete de 1px y radio de 8px, sin sombras. Títulos de panel en caso oración, 14px semibold, tinta pizarra. Cifras 800 tabulares. Rejillas horizontales de 1px muy claras, ejes de 11px apagados. Color solo como dato: azul institucional (magnitud), rojo (crítico), ocre (intereses).
STORY: El operador entiende de un vistazo cuánto se debe, cuánto es crítico y en qué barrios y servicios está, y va a atenderlo.
FIRST VIEWPORT: Banda de estado de una línea; cartera en mora (cifra grande + barra capital/intereses) junto a cuentas del padrón (barras finas sobre rejilla graduada); plazos de fichas como KPI; acciones rápidas; después los paneles del análisis y la columna de pendientes.
FORM: Fijada por el usuario (captura de referencia), versión clara; sin sorteo de concepto. Firma: gráfico de puntos "Mora por barrio y servicio" (un punto por barrio en cada columna de servicio); al pasar sobre un punto, ese barrio se enciende en todas las columnas.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
