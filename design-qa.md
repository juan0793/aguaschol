# Design QA - Login animado de Control Aguas

## Evidencia

- Source visual truth: `C:\Users\JR\Downloads\Guia_Assets_Login_Control_Aguas_Animado.pdf`.
- Fuente de fondo: 1672 x 941 px, extraída de la página 1 del PDF.
- Fuente del panel: 1024 x 1536 px, extraída de la página 2 del PDF.
- Implementación: `.codex/login-animated-redesign/11-desktop-final.jpg`.
- Comparación completa: `.codex/login-animated-redesign/12-comparison-full.jpg`.
- Comparación enfocada de tarjeta: `.codex/login-animated-redesign/13-comparison-card.jpg`.
- Viewport de escritorio: 1280 x 720 CSS px.
- Captura de implementación: 1280 x 720 px, densidad 1:1.
- Estado: formulario vacío, animación completada, sin sesión iniciada.

## Resultado visual

- Tipografía: Geist existente, jerarquía ajustada para acercar el título al panel de referencia sin perder legibilidad.
- Espaciado: tarjeta de 480 px centrada; ritmo vertical consistente y controles de 52-54 px.
- Colores: paleta institucional azul/turquesa del PDF, overlay suficiente para mantener el puente reconocible.
- Imágenes: fondo, gota y splash provienen del PDF; no se usaron dibujos CSS ni placeholders.
- Contenido: coincide con la guía. El checkbox se omitió porque el sistema actual no implementa persistencia opcional de sesión.
- Iconos: se reutilizó la librería de iconos existente del proyecto para usuario y contraseña.
- Responsive: sin desbordamiento horizontal en 1280 x 720, 768 x 1024 y 390 x 844.
- Accesibilidad: labels asociados, botón real para mostrar/ocultar, foco visible, texto alternativo y `prefers-reduced-motion`.

## Interacciones verificadas

- Mostrar y ocultar contraseña mediante el botón accesible.
- Error de credenciales visible y legible en móvil.
- Inicio de sesión real completado con el endpoint existente.
- Cierre de sesión devuelve al formulario vacío.
- Estado de carga y botón deshabilitado conservados en el flujo existente.
- Consola del login en una pestaña limpia: 0 errores.

## Historial de comparación

### Iteración 1

- P1: el splash extraído conservaba un rectángulo claro del storyboard.
  - Fix: eliminación del fondo blanco y optimización del PNG con transparencia real.
  - Evidencia posterior: `.codex/login-animated-redesign/10-splash-fixed.jpg`.
- P1: el aviso de error quedaba recortado en 390 px.
  - Fix: ancho limitado al viewport, centrado fijo y `box-sizing: border-box`.
  - Evidencia posterior: `.codex/login-animated-redesign/09-error-mobile-fixed.jpg`.
- P2: el título tenía más peso visual que la referencia.
  - Fix: escala reducida a `clamp(2.15rem, 3vw, 2.8rem)`.
  - Evidencia posterior: `.codex/login-animated-redesign/13-comparison-card.jpg`.

## Hallazgos finales

No quedan hallazgos P0, P1 ni P2. La diferencia de altura frente al panel de referencia es intencional: se eliminó el checkbox porque no existe soporte funcional para esa preferencia. Como seguimiento P3, conviene probar `prefers-reduced-motion` en un dispositivo con esa preferencia activa; la ruta CSS ya muestra directamente logo y tarjeta.

## Límites

Después de autenticar, el dashboard existente registra errores de reconexión WebSocket cuando ese servicio no está disponible. No aparecen en la pantalla de login y no fueron introducidos por este cambio.

final result: passed
