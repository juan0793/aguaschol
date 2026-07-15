# Resultado del rediseño de Reportes

Fecha: 2026-07-15  
Rama: `refactor/reports-workspace`

## Implementado

- Módulo lazy independiente en `frontend/src/modules/reports`.
- Encabezado único con jornada, estado, actualización, configuración, vista previa y generador.
- Selector compacto con cinco recientes y modal filtrable por texto, año, mes y jornadas con puntos.
- Barra horizontal de Puntos, Barrios, Listos y Pendientes.
- Pestañas Resumen, Registros, Mora y Ente regulador; solo se renderiza la pestaña activa.
- Registros con búsqueda, filtros, tabla, paginación, acceso al mapa y drawer de edición.
- Mora con resumen, gráfico, detalle, impresión y PDF mediante los handlers existentes.
- Ente regulador con máximo cinco jornadas, técnicos, mapa y generación existente.
- Drawer de generación para técnico, resumen, censo y ente regulador; PDF o impresión.
- Modal de vista previa con páginas, zoom, descarga e impresión.
- Drawer de configuración compatible con la clave existente de `localStorage`.
- Sidebar de 220 px / 68 px, preferencia persistente, tooltip al colapsar y drawer móvil existente.
- Menú superior de usuario para perfil, contraseña y cierre de sesión.
- Diseño institucional responsive y accesible, con foco, Escape, focus trap y reducción de movimiento.

## Compatibilidad y backend

- Se conservaron los endpoints `/map-points`, `/map-points/diary-groups` y `/map-points/context`.
- Se reutilizaron sin cambios los generadores y nombres de archivo de técnico, resumen, censo, ente regulador y mora.
- No se modificó el backend, la base de datos, Railway, Vercel, autenticación, roles ni variables de entorno.
- No se borraron registros ni datos.

## Validación

- `npm run build` en frontend: aprobado.
- Pruebas frontend: 6 aprobadas.
- Pruebas backend: 22 aprobadas.
- Navegador: encabezado sin duplicados, pestañas, generador, cierre por Escape, desktop y móvil aprobados.
- La jornada disponible durante la prueba contenía 0 puntos. Por ello no fue posible comparar visualmente PDFs con contenido real; la equivalencia se protege reutilizando exactamente los handlers anteriores, sin reescribirlos.

## Capturas

- `docs/reports-desktop.png`
- `docs/reports-mobile.png`

## Pendiente deliberado

El bloque JSX anterior permanece deshabilitado temporalmente dentro de `App.jsx` como respaldo inmediato. Puede eliminarse cuando se comparen los cinco tipos de salida con una jornada que contenga puntos reales. Los cálculos y exportadores compartidos continúan en `App.jsx` para evitar una migración riesgosa antes de esa comparación.
