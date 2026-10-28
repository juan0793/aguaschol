---
target: pantalla Descartes de Control de entregas
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\JR\\Documents\\aguaschol\\frontend\\src\\modules\\entregas\\components\\ControlDescartes.jsx"
target_fingerprint: "sha256:963ba5f57bf0861a444bfdbac8a37d3d83708b90a39c869f7f762e95b01a1da5"
target_path: "C:\\Users\\JR\\Documents\\aguaschol\\frontend\\src\\modules\\entregas\\components\\ControlDescartes.jsx"
timestamp: 2026-10-28T14-00-56Z
slug: entregas-components-controldescartes-jsx-b841c071
closed: true
---
Method: dual-agent (A: revisión de diseño · B: detector y navegador)

## Salud del diseño: 24/40 (Aceptable)

| # | Heurística | Nota | Hallazgo clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | Al pedir otro ciclo se ve un instante "0 documentos" con el día nuevo y los datos viejos. |
| 2 | Lenguaje del mundo real | 2 | "Descartes", "sin entregar", "no entregadas" y "sobrantes" nombran lo mismo; una fila "sin entregar" puede decir "Reentregada". |
| 3 | Control y libertad | 2 | Después de "Ir a un día" fuera del ciclo, ni "Todo el ciclo" ni "Limpiar" vuelven al ciclo actual. |
| 4 | Consistencia | 2 | Repetidos en ocre en la cifra y en rojo en el resto; kicker contra DESIGN.md; icono de mapa para "Técnicos". |
| 5 | Prevención de errores | 3 | "Técnicos 7" cuenta "Sin responsable" como técnico. |
| 6 | Reconocer en vez de recordar | 3 | El encabezado de la tabla no queda fijo; tras dos filas se pierden las columnas. |
| 7 | Flexibilidad y eficiencia | 2 | 14 clics para ver 1,400 documentos; sin orden por columna; la vista por abonado es otra tabla al fondo. |
| 8 | Estética y minimalismo | 2 | Cinco capas antes del primer dato; 42 % de filas en rosa; "Abonados" repite "Sin entregar". |
| 9 | Recuperación de errores | 3 | Los vacíos con filtros no ofrecen "Quitar filtros" ahí mismo. |
| 10 | Ayuda | 2 | No se explica "Reentregada" ni por qué los repetidos ignoran el día. |

## Especificidad
Mitad propia (franja con "Todo el ciclo", totales que filtran, impreso que declara filtros) y mitad plantilla (kicker, tira con filete lateral de 4 px, cuatro tarjetas KPI, tabla de tarjetas rosadas).
Detector: 0 hallazgos en el JSX; en el navegador 263 marcas a 1440 px: 257 textos de 11 px (`.ent-operational-table small`), borde lateral de 4 px en `.ent-ciclo-strip`, salto h1→h3, párrafo del encabezado de ~150-225 caracteres por línea, primer chip pegado al borde de la franja (dudoso). Fuera de alcance: botón "Nuevo lote" y barra móvil (shell), fuente global, transiciones de width de otras pantallas (falso positivo).

## Problemas prioritarios
1. [P1] Filas de 109-183 px (316-389 en el teléfono): dos filas por pantalla. Una línea por documento, antecedente en una línea, encabezado fijo.
2. [P1] "Abonados repetidos" repite "Solo repetidos", ignora el día y empieza a 12,319 px. Hacerlo un modo de la lista ("Por documento / Por abonado").
3. [P1] Sin regreso al ciclo actual tras "Ir a un día" fuera del ciclo; datos viejos mezclados mientras carga.
4. [P2] Color de "repetido" incoherente (ocre y rojo) y fondo rosado en el 42 % de las filas; la insignia reusa el estado "No localizada".
5. [P2] Jerarquía invertida: kicker más fuerte que el título de 16 px/400; cifras redundantes; "Sin responsable" escondido como técnico; tira de ciclo con filete lateral.

## Personas
- Usuario experto: sin orden por columna, sin encabezado fijo, 14 clics para ver todo, días viejos escondidos en la franja.
- Teclado y lector: `role="listitem"` sobre los botones de días anula su rol y `aria-pressed`; los números de los totales se leen sin rótulo.
- Gerencia: los crónicos están 8,5 pantallas abajo; "Sin responsable" pasa como técnico; en el teléfono la primera cifra aparece a 829 px.

## Menores
"mar 27 27/10/2026" repite el día; días de la franja sin mes; "Todo el ciclo" sin separación; doble scroll del lateral a 900 px; caption con orden aun con 0 resultados; CSS muerto `.ent-descartes-dia-head`.

## Preguntas
¿La pantalla debe abrir por abonado crónico? ¿"Sin responsable" es el hallazgo más grave? ¿"Descartes" es la palabra de la oficina?
