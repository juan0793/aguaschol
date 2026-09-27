# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Usuario principal: el personal de oficina y administración de Aguas de Choluteca. Trabaja en escritorio, de día y a diario. Registra y valida fichas, consulta el padrón y la mora, sigue el trabajo de campo e imprime documentos.

La app también registra el trabajo de los técnicos de campo (roles técnico y validador en el sistema): levantamiento GPS, inspecciones y entrega de facturas y notas de cobro. Ese trabajo se hace desde el celular y a veces con mala señal (ver Restricciones).

## Product Purpose

Sistema interno de Aguas de Choluteca para detectar y registrar inmuebles clandestinos y controlar la cartera del padrón de abonados. Nació para reemplazar el flujo manual en Excel.

El éxito se mide en tres cosas, confirmadas por el usuario (2026-09-27):
- recuperar cartera en mora: detectar clandestinos y deudores, y que se cobre más;
- dejar el Excel y el papel: un solo sistema confiable, con historial;
- controlar el trabajo de campo: saber qué técnico visitó o entregó qué barrio, y cuándo, con GPS.

## Positioning

Une en una sola herramienta tres fuentes que antes estaban separadas:
- el padrón maestro de Aguas, importado del sistema FoxPro;
- la cartografía catastral local (SIG, capas por clave);
- la evidencia de campo con GPS.

Todo se cruza por la clave catastral. Por eso la app puede decir qué inmueble existe en el terreno y no en el padrón, cuánto debe cada barrio y quién lo visitó.

## Operating Context

- Oficina: escritorio con luz de día; se imprime en tamaño carta (fichas, avisos, reportes, hojas de reparto).
- Campo: celular del técnico en la calle, con datos móviles poco confiables.
- Fuentes: padrón FoxPro (importación por lotes revisables), padrón privado en Cloudflare R2, capas SIG locales, diferencias de padrón con la Alcaldía.
- Hosting en Railway (frontend, backend Express, MySQL y PostGIS). El costo del ciclo se sigue en la pantalla "Uso en Railway".

## Capabilities and Constraints

Módulos actuales:
- Tablero y Reportes ejecutivos;
- Nueva ficha y Buscar clave;
- Mapa de campo, SIG Territorial y Control territorial GPS;
- Inspecciones y Control de entregas (reparto de barrios por técnico);
- Planos y Croquis;
- Informes (peticiones de padrón), Importación FoxPro;
- Imprimir alertas, Bitácora, Apuntes, Mi perfil y Uso en Railway.

Restricciones confirmadas por el usuario (2026-09-27):
- **Señal débil en campo:** el celular puede estar sin datos o con mala señal, y la app no debe perder lo capturado.
- **Datos sensibles del padrón:** nombres, claves catastrales y deudas de abonados. El acceso es por rol y nada es público.

Requisitos del proyecto (AGENTS.md):
- La ficha y el aviso deben parecerse lo más posible a los formatos originales (`referencia/CLANDESTINOS2026.xlsx`, `referencia/AVISO-CLANDESTINO.docx`).
- Stack React + Vite, Express y MySQL; API REST en JSON; la fotografía se guarda como archivo y la base de datos solo guarda su ruta.

## Evidence on Hand

- Formatos originales en `referencia/`.
- Padrón real importado de FoxPro, que es dato sensible y no se muestra fuera del sistema.
- Capas SIG locales.
- No hay testimonios, métricas públicas ni casos de estudio. No se deben inventar.
- Los bancos de prueba `frontend/qa-*-preview.html` usan datos de mentira con la forma real, marcados como tales.

## Product Principles

1. La clave catastral es el hilo que une padrón, mapa, campo y cobro: toda pantalla debe llevar a ella o partir de ella.
2. Lo capturado en campo no se pierde. Si no hay señal se guarda y se envía después; nunca se descarta en silencio.
3. Cada cifra de mora o de trabajo de campo debe poder rastrearse hasta quién, dónde y cuándo.
4. Los datos del padrón se tratan como privados por defecto: acceso por rol, nada expuesto en URLs ni en páginas públicas.
5. Reemplazar el papel sin perder su autoridad: los documentos impresos siguen siendo oficiales.
