# Micro-interacciones

Componentes de gesto y estado adaptados de [React Bits](https://reactbits.dev)
(categoria *Micro*). Se copian al proyecto, no se instalan como paquete.

## Que hay aqui

| Componente | Para que sirve | Donde se usa hoy |
| --- | --- | --- |
| `HoldButton` | Confirmar una accion irreversible manteniendo presionado, en lugar de `window.confirm` | Eliminar inspeccion, eliminar chat de Telegram |
| `SpringCheck` | Casilla de seleccion con respuesta visible en listados densos | Bandeja de fichas clandestinas |
| `StatusMark` | Glifo de estado (espera, proceso, exito, fallo) para bitacoras | Linea de tiempo de intentos de entrega |

## Reglas de adopcion

`DESIGN.md` pide una interfaz institucional y sin adornos. Estos componentes se
usan solo donde el gesto o el glifo cumplen una funcion:

- Confirmacion deliberada de algo que no se puede deshacer.
- Lectura rapida de estado en una lista larga.
- Feedback de seleccion en tablas densas.

No se adoptan los componentes decorativos de la misma categoria (Pulse Heart,
Peek Rating, Comet Dial, Voice Pill, Fuse Button, Sling Button). Tampoco
`Dodge Field`: un control que esquiva el cursor es un antipatron de
accesibilidad en una herramienta de captura. Ni `Scrub Field` o `Wake Slider`:
la entrada numerica por arrastre es riesgosa para datos catastrales.

## Como verlos sin entrar a la app

`npm run dev` dentro de `frontend/` y abrir `/qa-micro-preview.html`. Esa pagina
monta los tres componentes dentro de los contenedores reales (`.cl-module`,
`.cl-table`, `.cl-history.ent-timeline`) para comprobar que las hojas globales
no los deforman. Fuente: `src/qa/microPreview.jsx`.

## Adaptaciones respecto del original

- Paleta mapeada a los tokens `--ds-*` de `components/ds/design-system.css`
  (el original viene en tema oscuro con acento morado).
- Sin dependencia de `@hugeicons/*`: los iconos son SVG propios o los de
  `components/Icon.jsx`.
- Textos de lector de pantalla y etiquetas por defecto en espanol.
- `HoldButton` sin brillo ni cresta de ola por defecto, radio de 8px.
- Reglas `@media print` para que nada quede a medio animar en papel.
- Se conservan intactas las rutas de accesibilidad del original: teclado,
  `prefers-reduced-motion`, `prefers-contrast` y textos para lector de pantalla.

## Licencia

MIT + Commons Clause v1.0 — Copyright (c) 2026 David Haz.

Permite usar, modificar y distribuir el codigo **como parte de una aplicacion o
producto**, incluso comercial. Prohibe vender, sublicenciar o redistribuir los
componentes en si (solos, en un paquete o como port). Nuestro uso — dentro de
la app de Aguas de Choluteca — esta cubierto.
