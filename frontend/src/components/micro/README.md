# Micro-interacciones

Componentes de gesto y estado adaptados de [React Bits](https://reactbits.dev)
(categoria *Micro*). Se copian al proyecto, no se instalan como paquete.

## Que hay aqui

| Componente | Para que sirve | Donde se usa hoy |
| --- | --- | --- |
| `HoldButton` | Confirmar una accion irreversible manteniendo presionado, en lugar de `window.confirm` | Eliminar inspeccion, eliminar chat de Telegram |
| `LiveNumber` | Cifra de tablero que cuenta desde el valor anterior solo cuando cambia, y hace destellar su tarjeta una vez; escribe en el nodo de texto (sin re-renders). También `flashElement` y la clase `.live-attention` (3 latidos) | KPIs del Tablero y del Resumen de clandestinos, centro del donut |
| `LatticeLoader` | Estado de carga con retícula de puntos, etiqueta y cronómetro opcional | Arranque de los módulos y placeholders de las tablas |
| `SlideCommit` | Confirmar con un deslizamiento completo y reflejar el resultado de la promesa (pendiente, hecho, fallo) | Cierre de lote en Control de Entregas |
| `SpringCheck` | Casilla de seleccion con respuesta visible en listados densos | Bandeja de fichas clandestinas |
| `StatusMark` | Glifo de estado (espera, proceso, exito, fallo) para bitacoras | Linea de tiempo de intentos de entrega |

## Reglas de adopcion

`DESIGN.md` pide una interfaz institucional y sin adornos. Estos componentes se
usan solo donde el gesto o el glifo cumplen una funcion:

- Confirmacion deliberada de algo que no se puede deshacer.
- Acciones largas cuyo resultado el usuario necesita ver (el cierre de lote
  guarda el detalle y luego cierra: la promesa mueve el control).
- Lectura rapida de estado en una lista larga.
- Feedback de seleccion en tablas densas.
- Espera con senal de vida: el arranque de un modulo mostraba un icono
  estatico que no distinguia "cargando" de "colgado".

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
- `SlideCommit` con pista clara y radio de 10px en lugar de la pastilla oscura
  del original; `width="fill"` mide el hueco real con ResizeObserver para
  funcionar igual en el cajon de escritorio (280px) y en movil (a lo ancho), y
  la etiqueta se centra en el espacio libre para no chocar con la capsula.
  Acepta `describedBy` y `title` para conservar la explicacion de por que el
  cierre esta bloqueado.
- `LatticeLoader` hereda el color del contenedor (los estados vacios ya son
  grises) y trae el cronometro apagado por defecto: solo se enciende donde la
  espera es larga, como el arranque de un modulo. En las tablas iria de mas.
- Reglas `@media print` para que nada quede a medio animar en papel.
- Se conservan intactas las rutas de accesibilidad del original: teclado,
  `prefers-reduced-motion`, `prefers-contrast` y textos para lector de pantalla.

## Licencia

MIT + Commons Clause v1.0 — Copyright (c) 2026 David Haz.

Permite usar, modificar y distribuir el codigo **como parte de una aplicacion o
producto**, incluso comercial. Prohibe vender, sublicenciar o redistribuir los
componentes en si (solos, en un paquete o como port). Nuestro uso — dentro de
la app de Aguas de Choluteca — esta cubierto.
