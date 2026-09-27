---
target: parte superior del Tablero (barra superior y banda de estado)
total_score: 17
max_score: 36
na_heuristics: 5
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\JR\\Documents\\aguaschol\\frontend\\src\\modules\\dashboard\\DashboardWorkspace.jsx"
target_fingerprint: "sha256:ee518ab5b5c7490793a30e2416cdda1dd391b784a1b383433fe21ea83ea88b0e"
target_path: "C:\\Users\\JR\\Documents\\aguaschol\\frontend\\src\\modules\\dashboard\\DashboardWorkspace.jsx"
timestamp: 2026-09-27T06-55-21Z
slug: modules-dashboard-dashboardworkspace-jsx-dc49099b
---
Method: dual-agent (A: design review · B: detector + browser)
Target: top of the Tablero (app header bar in App.jsx ~13578, status band in DashboardWorkspace.jsx ~513). The user's goal: "that the app not look AI-made".

## Heuristics (this region): 17/36, Poor (47%); #5 n/a
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of status | 2 | The band flips every 10 s ("Actualizando…", pulse). It says "hace un momento", and the cut date is the faintest element. |
| 2 | Match with the real world | 2 | "Tablero de control" and "Sincronizado" are software words; the initials identify no one. |
| 3 | Control | 3 | The logo returns home; there is a manual refresh. |
| 4 | Consistency | 1 | The header breaks the flat-panel rule; the brand appears twice; the screen has four names. |
| 5 | Error prevention | n/a | No inputs or destructive actions. |
| 6 | Recognition | 2 | Online names only show on hover. |
| 7 | Efficiency | 2 | Actualizar disables itself every 10 s; no keyboard path. |
| 8 | Minimalism | 1 | Repeated figures and brand, decorative avatars, perpetual pulse, shadows. |
| 9 | Error recovery | 2 | "Reintentando" without an explanation. |
| 10 | Help | 2 | The cut date is shown without its source. |

## Specificity
- The header is a floating card: white→#f0f8ff gradient, shadow 0 18px 36px, 12px radius, 1px lift on hover, logo in a tile with two shadows, ripple and rotation, translucent chrome with blur.
  - About six CSS layers ending in !important (styles.css 26350).
  - Comment at styles.css:16396: "inspirado en patrones de Gentelella/Adminator/Sufee/Concept".
- The band adds stock SaaS widgets: letter avatars, a green live dot, a Refresh button.
- Detector: 0 findings in the region.
  - DashboardWorkspace.jsx and dashboard.css are clean.
  - Outside the region: styles.css 42 (32 side-tab, 9 layout-transition, 1 font, 1 grid) and App.jsx 5 (print templates).
  - Browser: 21 patterns on the rest of the page (11.5px text, bar animations), 0 in the band.
- Not flagged by the detector:
  - dead shimmer ::before on the header (content:none);
  - leftover side stripe on .dw-status (dashboard.css:1594);
  - initials at 10px and "+5" at 9.5px;
  - user chip 30px and logout 34px (below 40/44px).

## What works
1. The band is already transparent and borderless.
2. The padrón cut date gives real provenance.
3. Sync states: distinct retry colour, reduced motion, 40/44px targets.

## Priority issues
- [P1] Header as a floating template card.
  - Fix: flat full-width bar with a 1px #dfe5ec rule, no gradient, shadow, radius or lift; logo without a tile; opaque chrome without blur or entrance animation; consolidate the layers.
- [P1] Band blinks every 10 s.
  - Cause: the background refresh sets refreshing=true, and Actualizar disables itself. role=status re-announces on every cycle. "Sincronizado" suggests an import that did not happen.
  - Fix: only the manual refresh changes the visible state; show "Cifras al HH:MM" without a dot; ocre only on failure.
- [P2] The band repeats "25,158 cuentas · 127 barrios" from the panel below and shows the cut date in grey.
  - Fix: "Padrón maestro · corte del 27 de septiembre de 2026" in ink, without the counts.
- [P2] Avatar stack A L M D +5 (10px, aria-hidden, names only in title, repeats "Usuarios en línea").
  - Fix: remove it, or show plain text linking to the team panel.
- [P3] Brand twice and four names for the screen, no h1.
  - Fix: header = page title as h1; user chip with a one-person icon, name and role at 40px; sound toggle inside the bell.
  - Renaming the screen needs the user's confirmation.

## Personas
- Power user:
  - Actualizar disabled every 10 s.
  - No keyboard shortcuts.
  - Names need a mouse.
- Accessibility:
  - role=status every 10 s.
  - aria-hidden avatars.
  - Text at 10/9.5px.
  - No h1.
- Office admin at 8 am:
  - Cut date in grey.
  - Repeated totals.
  - "Sincronizado" suggests an import that did not happen.
  - No warning when the cut is old.

## Minor
- Mobile: about 166px of band before the first figure.
- Muted sound toggle in pink.
- Separator dots in #b8cde4.
- Badge in --brand-indigo.
- Two <header> elements.

## Questions
1. What is Actualizar for if the page refreshes every 10 s?
2. Should the top show the age of the cut instead of who is logged in?
3. Does the dashboard need a separate header?
