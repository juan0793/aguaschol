# Tablero y navegación — referencia institucional

- Superficie: tablero operativo; estado, prioridades y acciones del equipo.
- P1: indicadores reales. P2: prioridades y mora. P3: actividad y desglose. Acción: nueva ficha / búsqueda.
- Verdad: logo, métricas y permisos existentes; ninguna cifra de la imagen se copia a producción.
- Composición amplia: [sidebar 280px | estado + actualizar / acciones / indicadores / prioridades + ranking / cartera + actividad].
- Composición móvil: [abrir menú / estado / acciones en dos columnas / indicadores 2x2 / prioridades / cartera / ranking / actividad].
- Sistema: azul marino institucional, cian de selección, fondo claro, iconos existentes, ritmo 4/8/16px, radios 10/12px.
- Firma: franja cian identifica la ubicación dentro del menú; transición breve al navegar y cambiar cifras.
- Motivo expresivo: degradado limitado al sidebar, tomado de la referencia.
- Riesgos: montos largos en móvil y menú desplegado en pantallas bajas; verificar overflow, scroll y acceso al perfil.
- Se conserva el SIG existente como destino de navegación; no se agrega un mapa decorativo con puntos inventados.

## Verificación

Ejecutar `npm --prefix frontend run dev` y abrir `/tests/dashboard.html`.
La vista monta los componentes reales con una API simulada, sin modificar datos.
El botón «Ejecutar comprobación UI» comprueba apertura visible de la campanita,
límites del panel, cierre con Escape y estado vacío de filtros. No se incluye en el build.

Revisión visual: 390×844, 768×1024, 1440×900, 1920×1080 y 2560×1080.
Probados menú móvil, sidebar plegado, notificaciones y filtros; sin desbordamiento horizontal.
Limitación: las llamadas al servidor y entrega WebSocket requieren una sesión real.
Pruebas de selectores, impresión de mora y configuración de sidebar: correctas.
