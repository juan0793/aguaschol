---
target: parte superior del Tablero de control
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\JR\\Documents\\aguaschol\\frontend\\src\\modules\\dashboard\\DashboardWorkspace.jsx"
target_fingerprint: "sha256:d41b14f3ff35e37f04c014ef452bfbf974ee84b29d9639d17ed27d3ca344c3fd"
target_path: "C:\\Users\\JR\\Documents\\aguaschol\\frontend\\src\\modules\\dashboard\\DashboardWorkspace.jsx"
timestamp: 2026-09-24T22-08-45Z
slug: modules-dashboard-dashboardworkspace-jsx-dc49099b
---
# Crítica: parte superior del Tablero de control (2026-09-24)
Method: dual-agent (A: revisión de diseño · B: detector). Sin overlay en vivo (requiere login admin).

| # | Heurística | Puntos | Problema |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | Punto verde junto a "Actualizando…", estado duplicado |
| 2 | Mundo real | 3 | "Críticas" = umbral L 1,000, 51% del padrón |
| 3 | Control | 3 | Navegación reversible |
| 4 | Consistencia | 2 | "Crítico" con dos significados; icono de importar; títulos no son encabezados |
| 5 | Prevención | 3 | Nada destructivo |
| 6 | Reconocer | 3 | 4 de 9 en línea sin "+5" |
| 7 | Flexibilidad | 2 | Sin atajos; buscar clave = navegar |
| 8 | Estética mínima | 3 | Repeticiones banda/regla; fila padrón siempre 100% |
| 9 | Recuperación | 2 | Sin detalle de fallo ni antigüedad de cifras |
| 10 | Ayuda | 2 | Montos exactos solo en hover |
| Total | | 26/40 | Aceptable |

Especificidad: forma de kit; propio en el lenguaje (lecturas escritas, L 1,000, 7 días hábiles, regla de niveles).
Detector: 7 en la zona (4 side-tab ya anulados por la capa final = código muerto; 3 layout-transition = falsos positivos).

## Problemas prioritarios
- [P1] "Crítico" sobrecargado; el rojo pinta a la mayoría y a las 10 fichas vencidas. Fix: "mora alta (≥ L 1,000)" en azul oscuro, rojo solo para vencidas. (clarify/colorize) — requiere decisión del usuario.
- [P1] En móvil las acciones quedan tras ~3 pantallazos; "Buscar clave" no es campo. Fix: acciones arriba en móvil + búsqueda en línea. (adapt/layout) — requiere decisión.
- [P2] Regla con dos bases (barra vs. nota de críticas); fila padrón 100%. (distill)
- [P2] Sin tendencia contra el corte anterior. (bolder, solo datos) — falta el dato.
- [P2] Banda de estado contradictoria al actualizar. (harden)

## Personas
- Alex: sin atajos; exactos solo en hover; 4 de 9 en línea.
- Sam: títulos no son encabezados; Plazos es un botón enorme; marcas 10px; filas en 0 casi invisibles.
- Casey: imprimir 32px y Actualizar 36px; acciones después de todo.

## Menores
Mitad derecha teñida; icono de Plazos ocre con barra roja; campana 5 vs. Plazos 10; promedio por cuenta fuera de lugar.
