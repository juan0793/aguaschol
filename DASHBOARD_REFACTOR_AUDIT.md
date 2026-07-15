# Auditoría previa del Dashboard principal

Fecha: 2026-07-15  
Rama base: `main`  
Respaldo remoto: `backup/pre-dashboard-refactor`  
Rama de trabajo: `refactor/dashboard-workspace`

## Diagnóstico

`frontend/src/App.jsx` contiene unas 19,100 líneas. El dashboard activo se renderiza desde aproximadamente la línea 13676 y el sidebar desde la línea 13624. Sus estados, selectores y polling están repartidos entre las líneas 885–4869; también existe un segundo conjunto de widgets históricos alrededor de la línea 11703.

El backend ya entrega los datos necesarios mediante contratos existentes. La primera etapa no requiere endpoints, cambios de base de datos ni datos ficticios.

## Matriz de dependencias

| Elemento | Ubicación actual | Uso | Compartido | Destino | Riesgo | Verificación |
|---|---|---|---|---|---|---|
| JSX dashboard activo | `App.jsx:13676+` | vista principal | no | `modules/dashboard/DashboardWorkspace.jsx` | alto | cifras y acciones iguales |
| Widgets históricos | `App.jsx:11703+` | configuración anterior | parcialmente | eliminar tras comparación | medio | build y búsqueda de referencias |
| Sidebar y secciones | `App.jsx:2049–2200, 13624+` | navegación por rol | sí | `components/navigation/AppSidebar.jsx` | alto | todas las opciones y permisos |
| Menú de usuario | `App.jsx:13020+` | perfil, contraseña y sesión | sí | `components/navigation/SidebarUserMenu.jsx` | alto | tres acciones y Escape |
| `dashboardNow` | `App.jsx:919` | tiempos relativos | no | `useDashboardLiveStatus` | bajo | actualización periódica |
| `dashboardLastUpdatedAt` | `App.jsx:920` | última sincronización | no | `useDashboardLiveStatus` | bajo | fecha y “hace X” |
| refresco/estado/conexión | `App.jsx:921–923` | polling y barra viva | no | `useDashboardLiveStatus` | alto | refresco manual/automático |
| filtro de alertas/modal | `App.jsx:886,924` | atención requerida | parcialmente | workspace + modal existente | medio | filtros, impresión y navegación |
| métricas vivas | `App.jsx:2772–2888` | fichas, GPS, usuarios, alertas | no | `dashboardSelectors.js` | alto | comparar cuatro valores |
| actividad reciente | `App.jsx:2884–2986` | feed real | sí, auditoría | `useDashboardActivity` | medio | orden y destinos |
| jornadas | `App.jsx:2987` | actividad GPS | sí, mapa/reportes | selector del módulo | medio | 7/30 días con datos reales |
| acciones rápidas | `App.jsx:3025` | navegación | no | `DashboardQuickActions` | medio | Nueva, Buscar y Más |
| prioridades | `App.jsx:3036` | atención | no | `DashboardAttentionList` | alto | destinos y contadores |
| alertas | `App.jsx:3119–3190` | vencidas/sin foto | sí, fichas | selector del módulo | alto | mismos registros |
| resumen de técnicos/zonas | `App.jsx:3275–3340` | widgets históricos | no | descartar si no aporta al nuevo layout | bajo | no perder cifras obligatorias |
| polling | `App.jsx:4731,4869` | refresco cada 10 s | no | hook vivo | alto | intervalo, foco y visibilidad |
| preferencia del sidebar | `aguaschol-sidebar-collapsed` | ancho persistente | global | `useSidebarState` | medio | recarga, tablet y móvil |
| preferencias de widgets | `aguaschol:dashboard-widgets:v1` | UI histórica | dashboard | mantener lectura durante migración | bajo | no borrar localStorage |

## Contratos y datos conservados

- Fichas activas, vencidas, críticas y sin fotografía.
- Puntos GPS y jornadas desde `/map-points` y `/map-points/diary-groups`.
- Usuarios y presencia en línea desde los contratos actuales.
- Auditoría/actividad desde el historial existente.
- Padrón y deuda mediante el informe real ya disponible; no se inventarán barrios ni montos.
- Roles, `workspaceView`, callbacks de navegación, impresión y autenticación.

## Plan de extracción

1. Extraer selectores puros y dejar una prueba ejecutable.
2. Crear DashboardWorkspace y componentes visuales compactos.
3. Extraer sidebar y menú de usuario conservando la fuente de navegación calculada en App.
4. Mantener temporalmente en App únicamente datos compartidos y callbacks; mover polling exclusivo al hook cuando el contrato quede estable.
5. Comparar navegador, cifras, permisos y build antes de retirar el JSX anterior.

## Riesgos

- El ranking de mora depende de datos reales del padrón; debe mostrar estado vacío si no hay desglose por barrio.
- La navegación del sidebar depende de rol y contadores de varios módulos.
- El polling comparte cargas con usuarios, auditoría, mapas y padrón; moverlo sin duplicar solicitudes requiere conservar un único coordinador.
- Los archivos no rastreados bajo `foxpro-reader` son ajenos a este trabajo y no se incluirán.
