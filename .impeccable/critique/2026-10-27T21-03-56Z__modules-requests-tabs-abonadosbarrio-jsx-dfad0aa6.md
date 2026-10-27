---
target: panel Abonados del barrio
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\JR\\Documents\\aguaschol\\frontend\\src\\modules\\requests\\tabs\\AbonadosBarrio.jsx"
target_fingerprint: "sha256:df0d1689c1b6a73c99031e0197aa626fd86d19d1ab182e5da621a345ab131e5a"
target_path: "C:\\Users\\JR\\Documents\\aguaschol\\frontend\\src\\modules\\requests\\tabs\\AbonadosBarrio.jsx"
timestamp: 2026-10-27T21-03-56Z
slug: modules-requests-tabs-abonadosbarrio-jsx-dfad0aa6
---
Method: dual-agent (A: design review · B: detector + browser). The first A run was stopped by the user by mistake and relaunched.

## Design Health Score (panel antes del rediseño)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | La fecha del padrón no aparecía en el panel |
| 2 | Match System / Real World | 3 | Orden fijo por clave; la oficina piensa por nombre o por deuda |
| 3 | User Control and Freedom | 2 | El foco se escapaba del modal; sin "Limpiar" en el vacío |
| 4 | Consistency and Standards | 2 | La impresión no llevaba la línea de filtro de los otros informes |
| 5 | Error Prevention | 2 | Una lista filtrada se imprimía como el barrio completo |
| 6 | Recognition Rather Than Recall | 2 | Clave y abonado dentro de una frase; clave sin guiones no se encontraba |
| 7 | Flexibility and Efficiency | 1 | Sin orden, sin filtro por deuda, sin teclado en filas, sin imprimir un abonado |
| 8 | Aesthetic and Minimalist Design | 2 | Filas de 94 px; 5 pastillas por fila, casi todas tachadas |
| 9 | Error Recovery | 2 | Vacío sin acción; error de carga sin reintentar |
| 10 | Help and Documentation | 2 | Doble clic solo anunciado por nota y tooltip |
| **Total** | | **21/40** | Aceptable |

## Design Specificity Verdict
Contenido y lógica propios del producto (saldo = capital + intereses, claves en mono, servicio elegido en azul). La forma era genérica: hoja lateral con lista de contactos. Se leía como directorio cuando el trabajo pide un estado de cuenta del barrio.

Detector: CLI limpio. Navegador: 9× bajo contraste 2.2:1 en "L 0.00"; pastillas inactivas tachadas a 2.15:1 no marcadas (falso negativo); nested-cards en el pie (falso positivo).

## Priority Issues
- [P1] Filas sin acción ni foco; no se podía imprimir un abonado. Fix: fila-botón con flechas, ficha en la fila, imprimir estado de cuenta.
- [P1] Lista de tarjetas que no escala (7 filas por pantalla, sin orden ni filtro). Fix: columnas fijas de 48 px, orden por mayor saldo, filtro Con deuda / Al día / A favor, saldo del barrio arriba.
- [P1] La impresión no decía su filtro ni llevaba totales. Fix: línea de filtro y fila de totales.
- [P2] Foco fuera del modal y contraste 2.2:1. Fix: fondo inert, servicios como iconos en posición fija, saldos en cero como "Al día".
- [P2] Estados de saldo indistintos. Fix: deuda en tinta, al día atenuado, a favor en verde con "a favor".

## Persona Red Flags
- Oficina en ventanilla: encontraba la cuenta pero no podía imprimirla ni copiar la clave.
- Usuario avanzado: no podía ver primero a los mayores deudores.
- Gerencia: la deuda del barrio solo en el pie, sin total en el papel.
