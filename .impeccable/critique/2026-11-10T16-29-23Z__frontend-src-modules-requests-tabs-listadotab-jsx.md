---
target: Consultas del padrón, pestaña Negocios y categorías
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\JR\\Documents\\aguaschol\\frontend\\src\\modules\\requests\\tabs\\ListadoTab.jsx"
target_fingerprint: "sha256:7b1a6bb89f7360f0f5cb26a0321ce71026b01083a6b501be126fe4518ac564ba"
target_path: "C:\\Users\\JR\\Documents\\aguaschol\\frontend\\src\\modules\\requests\\tabs\\ListadoTab.jsx"
timestamp: 2026-11-10T16-29-23Z
slug: frontend-src-modules-requests-tabs-listadotab-jsx
---
Method: dual-agent (A: revisión de diseño · B: detector y navegador)

# Consultas del padrón → Negocios y categorías — 25/40 (aceptable)

Heurísticas: 1 Estado 3 · 2 Lenguaje 3 · 3 Control 2 · 4 Consistencia 2 · 5 Prevención 2 · 6 Reconocer 3 · 7 Eficiencia 2 · 8 Minimalismo 2 · 9 Recuperación 3 · 10 Ayuda 3.

## Veredicto
Razonamiento propio del producto (curva del deslizador, atajos en lempiras, agrupación por barrio, se imprime lo filtrado); cáscara genérica de panel de filtros + fichas + acordeón, con cinco tratamientos de contenedor y etiquetas numeradas que DESIGN.md no admite en este módulo. Detector: código limpio; en página 8 avisos cramped-padding (pestaña activa y pq-table-wrap), falsos positivos.

## Lo que funciona
- Rango de saldo bien pensado; impresión con el mismo filtro.
- Un toque en la categoría produce el listado oficial.
- Tablas sobrias: tabulares, clave mono, subtotales por barrio.

## Problemas prioritarios
- [P1] Deslizador sin flechas de teclado: el redondeo devuelve el mismo valor. Guardar posición cruda o saltar al siguiente valor distinto. (harden)
- [P1] "Generar listado" fuera de pantalla a 1366×768: panel fijo de 890 px. Sacar título/descripción, compactar, botón bajo palabras clave. (layout)
- [P1] 625 px de controles antes de la primera fila y conteos triplicados. Fundir fichas en una frase, aplanar el deslizador, índice de barrios solo con muchos barrios. (distill)
- [P2] Rompe el lenguaje del módulo: quitar "1 · 2 · 3 ·", un solo contenedor, filetes finos. (layout)
- [P2] Alcance de impresión ambiguo: el buscador no se imprime, el título exige regenerar. Decir el alcance junto a los botones; título y descripción en vivo. (clarify)

## Personas
- Experto: sin orden por saldo ni combinación de categorías.
- Teclado/lector: flechas muertas, 33 paradas antes de la primera fila, foco ~1.4:1, aria-live sobre 140 filas.
- Oficinista: "Con saldo" pesa igual que "Todos"; nada confirma qué se imprime.

## Menores
- "Salud" grupo y botón; "Educacion" sin tilde.
- Desde 0.01 y Hasta 180095 sin formato.
- .pq-summary dt 4.34:1.
- Subtotales del barrio sin alinear con Tarifa/Total.
- A 390 px las columnas de deuda quedan fuera de la vista.

## Preguntas
- ¿Por qué el inicio es "Todos los saldos" y la lista no sale por deuda?
- ¿Hace falta la pista del deslizador?
